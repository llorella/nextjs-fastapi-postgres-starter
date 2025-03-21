from sqlalchemy import String, ForeignKey, Index, func, text
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

    __table_args__ = (
        # basic indexes
        Index("idx_message_user_id", "user_id"),
        Index("idx_message_timestamp", "timestamp"),
        # composite index for more efficient user message queries
        Index("idx_user_timestamp", "user_id", "timestamp"),
        # partial index for recent messages
        Index(
            "idx_recent_messages",
            "timestamp",
            postgresql_where=text("timestamp > now() - interval '24 hours'")
        )
    )

    def __repr__(self) -> str:
        return f"Message(id={self.id!r}, user_id={self.user_id!r}, is_from_user={self.is_from_user!r})"
