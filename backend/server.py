from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


class WorkflowStage(BaseModel):
    name: str
    taskType: str
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    duration: int = 0
    extraDays: int = 0
    completed: bool = False
    status: str = "not_started"


class ProjectCreate(BaseModel):
    name: str
    client: str
    sow: str
    csDoneBy: str
    projectStartDate: str
    projectEndDate: str
    statusCategory: str
    assignedAM: Optional[str] = None
    assignedLP: Optional[str] = None
    pod: Optional[str] = None
    workflowStages: List[Dict] = []


class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    client: str
    sow: str
    csDoneBy: str
    projectStartDate: str
    projectEndDate: str
    statusCategory: str
    extraDays: int = 0
    assignedAM: Optional[str] = None
    assignedLP: Optional[str] = None
    pod: Optional[str] = None
    workflowStages: List[Dict] = []
    createdBy: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    statusCategory: Optional[str] = None
    extraDays: Optional[int] = None
    workflowStages: Optional[List[Dict]] = None


class StageUpdate(BaseModel):
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    duration: Optional[int] = None
    extraDays: Optional[int] = None
    completed: Optional[bool] = None
    status: Optional[str] = None


@api_router.get("/")
async def root():
    return {"message": "Agency PM API v2"}


def create_default_workflow_stages():
    stages = [
        {"name": "Onboarding Form", "taskType": "SS"},
        {"name": "Onboarding", "taskType": "SS"},
        {"name": "Products", "taskType": "C"},
        {"name": "Research", "taskType": "SS"},
        {"name": "Brainstorm Session", "taskType": "SS"},
        {"name": "Scripts", "taskType": "SS"},
        {"name": "Scripts Approval", "taskType": "C"},
        {"name": "Model brief to LP", "taskType": "SS"},
        {"name": "Internal KT Production", "taskType": "SS"},
        {"name": "Storyboarding", "taskType": "SS"},
        {"name": "Model list to client", "taskType": "C"},
        {"name": "Model Approval", "taskType": "C"},
        {"name": "PPM", "taskType": "C"},
        {"name": "Shoot", "taskType": "SS"},
        {"name": "Internal KT Post", "taskType": "SS"},
        {"name": "Edits", "taskType": "SS"},
        {"name": "Feedback", "taskType": "C"},
        {"name": "Revision", "taskType": "SS"},
        {"name": "Project Closed", "taskType": "C"}
    ]
    
    return [
        {
            **stage,
            "startDate": None,
            "endDate": None,
            "duration": 0,
            "extraDays": 0,
            "completed": False,
            "status": "not_started"
        }
        for stage in stages
    ]


@api_router.post("/projects", response_model=Project)
async def create_project(input: ProjectCreate):
    if not input.workflowStages:
        input.workflowStages = create_default_workflow_stages()
    
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


@api_router.patch("/projects/{project_id}/stages/{stage_index}")
async def update_stage(project_id: str, stage_index: int, update: StageUpdate):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    stages = project.get("workflowStages", [])
    if stage_index >= len(stages):
        raise HTTPException(status_code=404, detail="Stage not found")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    for key, value in update_data.items():
        stages[stage_index][key] = value
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"workflowStages": stages}}
    )
    
    return {"message": "Stage updated", "stage": stages[stage_index]}


@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    result = await db.projects.delete_one({"id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted"}


@api_router.post("/projects/import-from-sheet")
async def import_from_sheet(data: Dict):
    return {"message": "Import endpoint ready", "received": len(data.get("projects", []))}


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
