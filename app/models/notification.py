from sqlalchemy import Column, String, Text, Boolean, ForeignKey
from app.models.base import BaseModel

class Notification(BaseModel):
    __tablename__ = "notifications"

    user_id = Column(String(50), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="info") # info, warning, ai_insight
    read = Column(Boolean, default=False)
