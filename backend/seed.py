from sqlalchemy import select
from sqlalchemy.orm import Session
from db_engine import sync_engine
from models import User


def seed_user_if_needed():
    with Session(sync_engine) as session:
        with session.begin():
            # change seeding to check if Alice exists
            result = session.execute(select(User).where(User.name == "Alice"))
            if result.first() is not None:
                print("Alice already exists, skipping seeding")
                return
            print("Seeding user Alice")
            session.add(User(name="Alice"))
            session.commit()
