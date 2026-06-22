from sqlalchemy import Column, String, Enum
from app.models.base import BaseModel
import enum

class TransactionType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"

class Transaction(BaseModel):
    __tablename__ = "transactions"
