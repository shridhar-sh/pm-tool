from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


class ProjectCreate(BaseModel):
    name: str
    client: str
    type: str
    description: str
    deadline: str
    assignedAM: str
    assignedLP: str
    teamMembers: List[str] = []
    createdBy: str
    status: str


class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    client: str
    type: str
    description: str
    deadline: str
    assignedAM: str
    assignedLP: str
    teamMembers: List[str] = []
    createdBy: str
    status: str
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ProjectUpdate(BaseModel):
    status: Optional[str] = None


class TaskCreate(BaseModel):
    title: str
    description: str
    assignedTo: str
    dueDate: str
    priority: str
    projectId: str
    projectName: str
    createdBy: str
    completed: bool


class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    assignedTo: str
    dueDate: str
    priority: str
    projectId: str
    projectName: str
    createdBy: str
    completed: bool
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TaskUpdate(BaseModel):
    completed: Optional[bool] = None


class ApprovalCreate(BaseModel):
    type: str
    title: str
    description: str
    approver: str
    projectId: str
    status: str
    requestedBy: str


class Approval(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str
    title: str
    description: str
    approver: str
    projectId: str
    status: str
    requestedBy: str
    reviewedBy: Optional[str] = None
    reviewedAt: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ApprovalUpdate(BaseModel):
    status: Optional[str] = None
    reviewedBy: Optional[str] = None
    reviewedAt: Optional[str] = None


@api_router.get("/")
async def root():
    return {"message": "Agency PM API"}


@api_router.post("/projects", response_model=Project)
async def create_project(input: ProjectCreate):
    project_obj = Project(**input.model_dump())
    doc = project_obj.model_dump()
    await db.projects.insert_one(doc)
    return project_obj


@api_router.get("/projects", response_model=List[Project])
async def get_projects():
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    return projects


@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@api_router.patch("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, update: ProjectUpdate):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.projects.update_one(
        {"id": project_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return project


@api_router.post("/tasks", response_model=Task)
async def create_task(input: TaskCreate):
    task_obj = Task(**input.model_dump())
    doc = task_obj.model_dump()
    await db.tasks.insert_one(doc)
    return task_obj


@api_router.get("/tasks/project/{project_id}", response_model=List[Task])
async def get_project_tasks(project_id: str):
    tasks = await db.tasks.find({"projectId": project_id}, {"_id": 0}).to_list(1000)
    return tasks


@api_router.get("/tasks/user/{user_name}", response_model=List[Task])
async def get_user_tasks(user_name: str):
    tasks = await db.tasks.find({"assignedTo": user_name}, {"_id": 0}).to_list(1000)
    return tasks


@api_router.patch("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, update: TaskUpdate):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.tasks.update_one(
        {"id": task_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return task


@api_router.post("/approvals", response_model=Approval)
async def create_approval(input: ApprovalCreate):
    approval_obj = Approval(**input.model_dump())
    doc = approval_obj.model_dump()
    await db.approvals.insert_one(doc)
    return approval_obj


@api_router.get("/approvals/project/{project_id}", response_model=List[Approval])
async def get_project_approvals(project_id: str):
    approvals = await db.approvals.find({"projectId": project_id}, {"_id": 0}).to_list(1000)
    return approvals


@api_router.patch("/approvals/{approval_id}", response_model=Approval)
async def update_approval(approval_id: str, update: ApprovalUpdate):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.approvals.update_one(
        {"id": approval_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Approval not found")
    
    approval = await db.approvals.find_one({"id": approval_id}, {"_id": 0})
    return approval


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
