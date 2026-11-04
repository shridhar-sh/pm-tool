"""Validated contracts for project tasks and approval requests."""
from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    projectId: str
    title: str = Field(min_length=1)
    description: str = ""
    assignedTo: str = Field(min_length=1)
    dueDate: date
    priority: Literal["low", "medium", "high"] = "medium"
    createdBy: Optional[str] = None
    completed: bool = False


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1)
    description: Optional[str] = None
    assignedTo: Optional[str] = Field(default=None, min_length=1)
    dueDate: Optional[date] = None
    priority: Optional[Literal["low", "medium", "high"]] = None
    completed: Optional[bool] = None


class ApprovalCreate(BaseModel):
    projectId: str
    type: Literal["internal", "client"] = "internal"
    title: str = Field(min_length=1)
    description: str = ""
    approver: str = Field(min_length=1)
    requestedBy: Optional[str] = None


class ApprovalUpdate(BaseModel):
    status: Literal["approved", "rejected"]
    reviewedBy: str = Field(min_length=1)
