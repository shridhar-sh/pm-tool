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


# Holiday Model
class Holiday(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # YYYY-MM-DD format
    name: str
    dayOfWeek: str
    isWorking: bool = False  # If marked as working day (overrides holiday)


class HolidayCreate(BaseModel):
    date: str
    name: str
    dayOfWeek: Optional[str] = None


class WorkflowStage(BaseModel):
    name: str
    taskType: str
    department: Optional[str] = None
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
    pod: Optional[str] = "POD 1"
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
    pod: Optional[str] = "POD 1"
    workflowStages: List[Dict] = []
    extraDayMarkers: Dict[str, bool] = Field(default_factory=dict)
    extraDayVisual: Dict[str, bool] = Field(default_factory=dict)
    workingDays: Dict[str, bool] = Field(default_factory=dict)
    workingDaysVisual: Dict[str, bool] = Field(default_factory=dict)
    stageOverlaps: Dict[str, int] = Field(default_factory=dict)
    createdBy: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


if __package__:
    from .project_models import ProjectUpdate
    from .workflow import progress_signature, workflow_status
    from .work_items import TaskCreate, TaskUpdate, ApprovalCreate, ApprovalUpdate
else:
    from project_models import ProjectUpdate
    from workflow import progress_signature, workflow_status
    from work_items import TaskCreate, TaskUpdate, ApprovalCreate, ApprovalUpdate


class TeamMember(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employeeId: str
    name: str
    shortName: Optional[str] = None
    role: str
    department: str
    pod: Optional[str] = None
    active: bool = True


class BulkTeamMembersCreate(BaseModel):
    members: List[Dict]


@api_router.patch("/team-members/{member_id}")
async def update_team_member(member_id: str, update_data: Dict):
    result = await db.team_members.update_one(
        {"id": member_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Team member not found")
    member = await db.team_members.find_one({"id": member_id}, {"_id": 0})
    return member


class StageUpdate(BaseModel):
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    duration: Optional[int] = None
    extraDays: Optional[int] = None
    completed: Optional[bool] = None
    status: Optional[str] = None
    started: Optional[bool] = None


@api_router.get("/")
async def root():
    return {"message": "Agency PM API v2"}


def create_default_workflow_stages():
    stages = [
        # Strategy Phase
        {"name": "Onboarding", "taskType": "SS", "department": "strategy"},
        {"name": "Strategy", "taskType": "SS", "department": "strategy"},
        {"name": "Strategy Approval", "taskType": "C", "department": "strategy"},
        {"name": "Products", "taskType": "C", "department": "strategy"},
        
        # Pre-Production Phase
        {"name": "Pre Production", "taskType": "SS", "department": "pre_production"},
        {"name": "PPM", "taskType": "C", "department": "pre_production"},
        
        # Production Phase
        {"name": "Shoot", "taskType": "SS", "department": "production"},
        
        # Post-Production Phase
        {"name": "Edits", "taskType": "SS", "department": "post_production"},
        {"name": "Feedback", "taskType": "C", "department": "post_production"},
        {"name": "Revision", "taskType": "SS", "department": "post_production"},
        {"name": "Final Approval", "taskType": "C", "department": "post_production"}
    ]
    
    return [
        {
            **stage,
            "startDate": None,
            "endDate": None,
            "duration": 0,
            "extraDays": 0,
            "completed": False,
            "started": False,
            "status": "not_started"
        }
        for stage in stages
    ]


@api_router.post("/projects", response_model=Project)
async def create_project(input: ProjectCreate):
    if not input.workflowStages:
        input.workflowStages = create_default_workflow_stages()
    
    project_obj = Project(**input.model_dump())
    if any(s.get("completed") or s.get("started") for s in project_obj.workflowStages):
        project_obj.statusCategory = workflow_status(project_obj.workflowStages)
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
    
    existing = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Project not found")
    if "workflowStages" in update_data and progress_signature(update_data["workflowStages"]) != progress_signature(existing.get("workflowStages", [])):
        update_data["statusCategory"] = workflow_status(update_data["workflowStages"])
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
    old_progress = progress_signature(stages)
    if stage_index < 0 or stage_index >= len(stages):
        raise HTTPException(status_code=404, detail="Stage not found")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    for key, value in update_data.items():
        stages[stage_index][key] = value
    
    if "completed" in update_data:
        stages[stage_index]["status"] = "completed" if update_data["completed"] else "not_started"
    elif "status" in update_data:
        stages[stage_index]["completed"] = update_data["status"] == "completed"
    fields = {"workflowStages": stages}
    if progress_signature(stages) != old_progress:
        fields["statusCategory"] = workflow_status(stages)
    await db.projects.update_one(
        {"id": project_id},
        {"$set": fields}
    )
    
    return {"message": "Stage updated", "stage": stages[stage_index]}


@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    result = await db.projects.delete_one({"id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.tasks.delete_many({"projectId": project_id})
    await db.approvals.delete_many({"projectId": project_id})
    return {"message": "Project deleted"}


@api_router.post("/projects/import-from-sheet")
async def import_from_sheet(data: Dict):
    return {"message": "Import endpoint ready", "received": len(data.get("projects", []))}


@api_router.get("/team-members", response_model=List[TeamMember])
async def get_team_members():
    members = await db.team_members.find({}, {"_id": 0}).to_list(1000)
    return members


@api_router.post("/team-members/bulk")
async def create_bulk_team_members(input: BulkTeamMembersCreate):
    members_to_insert = []
    for member_data in input.members:
        member = TeamMember(
            employeeId=member_data["employeeId"],
            shortName=member_data.get("shortName"),
            name=member_data["name"],
            role=member_data["role"],
            department=member_data["department"],
            pod=member_data.get("pod")
        )
        members_to_insert.append(member.model_dump())
    
    if members_to_insert:
        await db.team_members.insert_many(members_to_insert)
    
    return {"message": f"Added {len(members_to_insert)} team members"}


@api_router.delete("/team-members/{member_id}")
async def delete_team_member(member_id: str):
    result = await db.team_members.delete_one({"id": member_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Team member not found")
    return {"message": "Team member deleted"}


# ============== HOLIDAYS API ==============

@api_router.get("/holidays")
async def get_holidays():
    holidays = await db.holidays.find({}, {"_id": 0}).to_list(1000)
    return holidays


@api_router.post("/holidays")
async def create_holiday(holiday: HolidayCreate):
    # Calculate day of week if not provided
    from datetime import datetime as dt
    date_obj = dt.strptime(holiday.date, "%Y-%m-%d")
    day_of_week = holiday.dayOfWeek or date_obj.strftime("%a")
    
    new_holiday = {
        "id": str(uuid.uuid4()),
        "date": holiday.date,
        "name": holiday.name,
        "dayOfWeek": day_of_week,
        "isWorking": False
    }
    await db.holidays.insert_one(new_holiday)
    return {k: v for k, v in new_holiday.items() if k != "_id"}


@api_router.patch("/holidays/{holiday_id}")
async def update_holiday(holiday_id: str, update_data: Dict):
    result = await db.holidays.update_one(
        {"id": holiday_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    holiday = await db.holidays.find_one({"id": holiday_id}, {"_id": 0})
    return holiday


@api_router.delete("/holidays/{holiday_id}")
async def delete_holiday(holiday_id: str):
    result = await db.holidays.delete_one({"id": holiday_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    return {"message": "Holiday deleted"}


@api_router.post("/holidays/seed")
async def seed_holidays():
    """Seed the database with 2026 holidays"""
    holidays_2026 = [
        {"date": "2026-01-01", "name": "New Year", "dayOfWeek": "Thu"},
        {"date": "2026-01-02", "name": "Official Holidays", "dayOfWeek": "Fri"},
        {"date": "2026-01-14", "name": "Sankranti/Pongal", "dayOfWeek": "Wed"},
        {"date": "2026-01-26", "name": "Republic Day", "dayOfWeek": "Mon"},
        {"date": "2026-02-15", "name": "Maha Shivaratri", "dayOfWeek": "Sun"},
        {"date": "2026-03-03", "name": "Holi", "dayOfWeek": "Tue"},
        {"date": "2026-03-19", "name": "Ugadi", "dayOfWeek": "Thu"},
        {"date": "2026-03-20", "name": "Eid al-Fitr", "dayOfWeek": "Fri"},
        {"date": "2026-05-01", "name": "May Day", "dayOfWeek": "Fri"},
        {"date": "2026-08-15", "name": "Independence Day", "dayOfWeek": "Sat"},
        {"date": "2026-09-14", "name": "Ganesh Chaturthi", "dayOfWeek": "Mon"},
        {"date": "2026-10-02", "name": "Gandhi Jayanti", "dayOfWeek": "Fri"},
        {"date": "2026-10-19", "name": "Vijaya Dashami", "dayOfWeek": "Mon"},
        {"date": "2026-10-20", "name": "Vijaya Dashami", "dayOfWeek": "Tue"},
        {"date": "2026-11-01", "name": "Kannada Rajyotsava", "dayOfWeek": "Sun"},
        {"date": "2026-11-08", "name": "Diwali", "dayOfWeek": "Sun"},
        {"date": "2026-11-09", "name": "Diwali", "dayOfWeek": "Mon"},
        {"date": "2026-12-25", "name": "Christmas", "dayOfWeek": "Fri"}
    ]
    
    # Clear existing and insert new
    await db.holidays.delete_many({})
    
    holidays_to_insert = [
        {
            "id": str(uuid.uuid4()),
            "date": h["date"],
            "name": h["name"],
            "dayOfWeek": h["dayOfWeek"],
            "isWorking": False
        }
        for h in holidays_2026
    ]
    
    await db.holidays.insert_many(holidays_to_insert)
    return {"message": f"Seeded {len(holidays_to_insert)} holidays for 2026"}


# Tasks and approvals share the project id; project names are read from the project
# so a rename never requires a second manual edit.
async def require_project(project_id):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def task_with_project(task):
    project = await require_project(task["projectId"])
    return {**task, "projectName": project["name"]}


@api_router.post("/tasks")
async def create_task(input: TaskCreate):
    await require_project(input.projectId)
    task = {**input.model_dump(mode="json"), "id": str(uuid.uuid4()),
            "createdAt": datetime.now(timezone.utc).isoformat()}
    await db.tasks.insert_one(dict(task))
    return await task_with_project(task)


@api_router.get("/tasks/project/{project_id}")
async def project_tasks(project_id: str):
    project = await require_project(project_id)
    tasks = await db.tasks.find({"projectId": project_id}, {"_id": 0}).to_list(None)
    return [{**task, "projectName": project["name"]} for task in tasks]


@api_router.get("/tasks/user/{user_name}")
async def user_tasks(user_name: str):
    tasks = await db.tasks.find({"assignedTo": user_name}, {"_id": 0}).to_list(None)
    projects = await db.projects.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(None)
    names = {p["id"]: p["name"] for p in projects}
    return [{**t, "projectName": names[t["projectId"]]} for t in tasks if t["projectId"] in names]


@api_router.patch("/tasks/{task_id}")
async def update_task(task_id: str, input: TaskUpdate):
    data = input.model_dump(mode="json", exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No update data provided")
    if "completed" in data:
        data["completedAt"] = datetime.now(timezone.utc).isoformat() if data["completed"] else None
    result = await db.tasks.update_one({"id": task_id}, {"$set": data})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Task not found")
    return await task_with_project(await db.tasks.find_one({"id": task_id}, {"_id": 0}))


@api_router.post("/approvals")
async def create_approval(input: ApprovalCreate):
    await require_project(input.projectId)
    approval = {**input.model_dump(), "id": str(uuid.uuid4()), "status": "pending",
                "requestedAt": datetime.now(timezone.utc).isoformat()}
    await db.approvals.insert_one(dict(approval))
    return approval


@api_router.get("/approvals/project/{project_id}")
async def project_approvals(project_id: str):
    await require_project(project_id)
    return await db.approvals.find({"projectId": project_id}, {"_id": 0}).to_list(None)


@api_router.patch("/approvals/{approval_id}")
async def review_approval(approval_id: str, input: ApprovalUpdate):
    data = {**input.model_dump(), "reviewedAt": datetime.now(timezone.utc).isoformat()}
    result = await db.approvals.update_one({"id": approval_id, "status": "pending"}, {"$set": data})
    if not result.matched_count:
        existing = await db.approvals.find_one({"id": approval_id})
        raise HTTPException(status_code=409 if existing else 404,
                            detail="Approval already reviewed" if existing else "Approval not found")
    return await db.approvals.find_one({"id": approval_id}, {"_id": 0})


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

