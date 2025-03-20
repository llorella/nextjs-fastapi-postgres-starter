from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import select, desc
from seed import seed_user_if_needed
from sqlalchemy.ext.asyncio import AsyncSession
from db_engine import engine
from models import User, Message
from typing import List, Dict
from datetime import datetime
import random

seed_user_if_needed()

app = FastAPI()


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
        print(" initialized")
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)


manager = ConnectionManager()


@app.get("/users/me")
async def get_my_user():
    async with AsyncSession(engine) as session:
        async with session.begin():
            # simple solution for getting the current user (n=1 user)
            result = await session.execute(select(User))
            user = result.scalars().first()

            if user is None:
                raise HTTPException(status_code=404, detail="User not found")
            return UserRead(id=user.id, name=user.name)


@app.get("/messages", response_model=List[MessageRead])
async def get_messages():
    async with AsyncSession(engine) as session:
        result = await session.execute(
            select(Message)
            .filter_by(user_id=1)
            .order_by(desc(Message.timestamp))
            .limit(50)
        )
        messages = result.scalars().all()
        return list(reversed(messages))


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            
            async with AsyncSession(engine) as session:
                user_msg = Message(user_id=1, content=data, is_from_user=True)
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
                
                assistant_msg = Message(user_id=1, content=test_response, is_from_user=False)
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
        manager.disconnect(websocket)
