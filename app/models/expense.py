from sqlalchemy import Column, String, Enum
from app.models.base import BaseModel
import enum

class ExpenseCategory(str, enum.Enum):
    SOFTWARE = "SOFTWARE"
    TRAVEL = "TRAVEL"
    OFFICE = "OFFICE"

class Expense(BaseModel):
    __tablename__ = "expenses"
