from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import select, desc
from seed import seed_user_if_needed
from sqlalchemy.ext.asyncio import AsyncSession
from db_engine import engine
from models import User, Message
from typing import List, Dict, Set, DefaultDict, Optional
from datetime import datetime, timedelta
import random
import asyncio
from asyncio import Queue, create_task, QueueEmpty
from collections import defaultdict
from asyncio import Lock
import weakref
from dataclasses import dataclass

seed_user_if_needed()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UserRead(BaseModel):
    id: int
    name: str


class MessageRead(BaseModel):
    id: int
    user_id: int
    content: str
    is_from_user: bool
    timestamp: datetime


class MessageCreate(BaseModel):
    content: str


class ConnectionManager:
    def __init__(self):
        # organize connections by user_id
        self._connections: DefaultDict[int, Set[weakref.ref]] = defaultdict(set)
        self._lock = Lock()

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        async with self._lock:
            # using weakref for garbage collection
            self._connections[user_id].add(weakref.ref(websocket))
            
            # cleanup dead connections
            self._connections[user_id] = {
                ref for ref in self._connections[user_id]
                if ref() is not None
            }
            
            # limit connections per user
            if len(self._connections[user_id]) > 5:
                await websocket.close(code=1008)
                return False
        return True

    async def disconnect(self, websocket: WebSocket, user_id: int):
        async with self._lock:
            self._connections[user_id] = {
                ref for ref in self._connections[user_id]
                if ref() is not websocket
            }

    async def send_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)


manager = ConnectionManager()


@dataclass
class MessageTask:
    user_id: int
    content: str
    timestamp: datetime
    websocket: WebSocket


class MessageProcessor:
    def __init__(self):
        self.queue: Queue[MessageTask] = Queue(maxsize=1000)
        self.rate_limits: DefaultDict[int, int] = defaultdict(int)
        self.last_cleanup = datetime.now()
        
    async def process_messages(self):
        while True:
            messages = []
            try:
                while len(messages) < 10:
                    message = self.queue.get_nowait()
                    messages.append(message)
            except QueueEmpty:
                if not messages:
                    await asyncio.sleep(0.01)
                    continue

            async with AsyncSession(engine) as session:
                session.add_all([
                    Message(
                        user_id=msg.user_id,
                        content=msg.content,
                        is_from_user=True,
                        timestamp=msg.timestamp
                    ) for msg in messages
                ])
                await session.commit()

    async def add_message(self, task: MessageTask) -> bool:
        # basic rate limiting
        now = datetime.now()
        if now - self.last_cleanup > timedelta(minutes=1):
            self.rate_limits.clear()
            self.last_cleanup = now

        if self.rate_limits[task.user_id] > 100:  
            return False

        self.rate_limits[task.user_id] += 1
        await self.queue.put(task)
        return True


message_processor = MessageProcessor()


@app.on_event("startup")
async def startup_event():
    create_task(message_processor.process_messages())

# implement trivial login with the name as the only parameter to demonstrate multiple concurrent users
class LoginRequest(BaseModel):
    name: str

@app.post("/users/login")
async def login(request: LoginRequest):
    name = request.name
    async with AsyncSession(engine) as session:
        # find or create user
        result = await session.execute(
            select(User).where(User.name == name)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            user = User(name=name)
            session.add(user)
            await session.commit()
            # fetch the user ID after commit
            user_id = user.id
            return {"id": user_id, "name": name}
        else:
            return {"id": user.id, "name": user.name}

@app.get("/users/{user_id}")
async def get_user(user_id: int):
    async with AsyncSession(engine) as session:
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {"id": user.id, "name": user.name}


@app.get("/messages", response_model=List[MessageRead])
async def get_messages(
    user_id: int = Query(...), 
    before_id: Optional[int] = None,
    limit: int = Query(default=50, le=100)
):
    async with AsyncSession(engine) as session:
        query = select(Message).filter_by(user_id=user_id)
        
        if before_id:
            query = query.filter(Message.id < before_id)
        
        query = query.order_by(desc(Message.id)).limit(limit)
        
        result = await session.execute(query)
        messages = result.scalars().all()
        return list(reversed(messages))


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    if not await manager.connect(websocket, user_id):
        return
    
    async with AsyncSession(engine) as session:
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            await websocket.close(code=1008)
            return
    
    try:
        while True:
            data = await websocket.receive_text()
            
            # add message to processing queue with rate limiting
            success = await message_processor.add_message(
                MessageTask(
                    user_id=user_id,
                    content=data,
                    timestamp=datetime.now(),
                    websocket=websocket
                )
            )
            
            if not success:
                await websocket.send_json({
                    "error": "Rate limit exceeded"
                })
                continue
            
            # in a real app, this would be handled by a separate llm worker
            async with AsyncSession(engine) as session:
                user_msg = Message(user_id=user_id, content=data, is_from_user=True)
                session.add(user_msg)
                await session.flush()
                
                # convert to dict for sending via ws
                user_msg_dict = {
                    "id": user_msg.id,
                    "user_id": user_msg.user_id,
                    "content": user_msg.content,
                    "is_from_user": user_msg.is_from_user,
                    "timestamp": user_msg.timestamp.isoformat(),
                }
                
                test_responses = [
                    "That's interesting! Tell me more.",
                    "I understand. How does that make you feel?",
                    "Thanks for sharing that with me.",
                    "I'm here to listen. What else is on your mind?",
                    "That's a good point. I hadn't thought of it that way.",
                    "I appreciate your perspective on this.",
                    "Let me think about that for a moment...",
                    "I'm not sure I follow. Could you elaborate?",
                    "That's fascinating! I'd like to hear more about that.",
                    "I see what you mean. That makes sense."
                ]
                test_response = random.choice(test_responses)
                
                assistant_msg = Message(user_id=user_id, content=test_response, is_from_user=False)
                session.add(assistant_msg)
                await session.flush()
                
                assistant_msg_dict = {
                    "id": assistant_msg.id,
                    "user_id": assistant_msg.user_id,
                    "content": assistant_msg.content,
                    "is_from_user": assistant_msg.is_from_user,
                    "timestamp": assistant_msg.timestamp.isoformat(),
                }
                
                await session.commit()
            
            # send both messages back to client for state synchronization
            await manager.send_message(user_msg_dict, websocket)
            await manager.send_message(assistant_msg_dict, websocket)
            
    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id)
