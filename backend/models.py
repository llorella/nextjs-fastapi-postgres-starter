from sqlalchemy import String, ForeignKey, Index, func
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from datetime import datetime


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(30))
    messages: Mapped[list["Message"]] = relationship(back_populates="user")

    def __repr__(self) -> str:
        return f"User(id={self.id!r}, name={self.name!r}"


class Message(Base):
    __tablename__ = "message"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    content: Mapped[str] = mapped_column(String(500))
    is_from_user: Mapped[bool]
    timestamp: Mapped[datetime] = mapped_column(default=func.now())
    
    user: Mapped["User"] = relationship(back_populates="messages")

    # basic indexes
    __table_args__ = (
        Index("idx_message_user_id", "user_id"),
        Index("idx_message_timestamp", "timestamp"),
    )

    def __repr__(self) -> str:
        return f"Message(id={self.id!r}, user_id={self.user_id!r}, is_from_user={self.is_from_user!r})"
