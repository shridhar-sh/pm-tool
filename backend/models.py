"""
Pydantic models for AgencyPM v2 (M1 schema).

Hierarchy:
  Agency -> Department -> Pod (team) -> User
  Client -> Project -> Campaign? -> Deliverable
  Project -> Phase -> Task -> Subtask

Every entity carries agencyId (single-agency now, SaaS-ready later).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


def _uuid() -> str:
    return str(uuid.uuid4())


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class _Base(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    createdAt: str = Field(default_factory=_now_iso)


# ---------------------------------------------------------------------------
# Agency / org structure
# ---------------------------------------------------------------------------

class Agency(_Base):
    name: str
    currency: str = "INR"
    timezone: str = "Asia/Kolkata"
    settings: Dict = Field(default_factory=dict)


class AgencyCreate(BaseModel):
    name: str
    currency: str = "INR"
    timezone: str = "Asia/Kolkata"
    settings: Dict = Field(default_factory=dict)


class Department(_Base):
    agencyId: str
    name: str                       # Strategy, Pre-Production, Production, Post-Production, Accounts, Creative...
    slug: str                       # strategy, pre_production, production, post_production
    color: str = "#0F172A"
    order: int = 0


class DepartmentCreate(BaseModel):
    agencyId: str
    name: str
    slug: str
    color: str = "#0F172A"
    order: int = 0


class Pod(_Base):
    """Sometimes called 'team' internally; UI label stays 'Pod'."""
    agencyId: str
    departmentId: Optional[str] = None
    name: str                       # "POD 1", "POD 2", ...
    leadUserId: Optional[str] = None


class PodCreate(BaseModel):
    agencyId: str
    departmentId: Optional[str] = None
    name: str
    leadUserId: Optional[str] = None


class User(_Base):
    agencyId: str
    podId: Optional[str] = None
    departmentId: Optional[str] = None
    employeeId: str
    name: str
    shortName: Optional[str] = None
    email: Optional[EmailStr] = None
    role: str                       # project_manager | account_manager | line_producer | team_member | strategist | editor | ...
    avatar: Optional[str] = None
    capacityHrsPerWeek: int = 40
    billRateINR: int = 0            # internal cost / billable rate per hour, INR
    active: bool = True


class UserCreate(BaseModel):
    agencyId: str
    podId: Optional[str] = None
    departmentId: Optional[str] = None
    employeeId: str
    name: str
    shortName: Optional[str] = None
    email: Optional[EmailStr] = None
    role: str
    avatar: Optional[str] = None
    capacityHrsPerWeek: int = 40
    billRateINR: int = 0
    active: bool = True


# ---------------------------------------------------------------------------
# Clients
# ---------------------------------------------------------------------------

class ClientContact(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    role: Optional[str] = None


class Client(_Base):
    agencyId: str
    name: str
    contacts: List[ClientContact] = Field(default_factory=list)
    gstin: Optional[str] = None
    currency: str = "INR"
    status: str = "active"          # active | on_hold | archived
    notes: Optional[str] = None


class ClientCreate(BaseModel):
    agencyId: str
    name: str
    contacts: List[ClientContact] = Field(default_factory=list)
    gstin: Optional[str] = None
    currency: str = "INR"
    status: str = "active"
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Projects / Campaigns / Deliverables
# ---------------------------------------------------------------------------

class WorkflowStage(BaseModel):
    """Fixed 11-stage tracker preserved from v1 — project-level status."""
    name: str
    taskType: str
    department: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    duration: int = 0
    extraDays: int = 0
    completed: bool = False
    started: bool = False
    status: str = "not_started"     # not_started | in_progress | done | blocked


DEFAULT_WORKFLOW_STAGES: List[Dict] = [
    {"name": "Onboarding",         "taskType": "SS", "department": "strategy"},
    {"name": "Strategy",           "taskType": "SS", "department": "strategy"},
    {"name": "Strategy Approval",  "taskType": "C",  "department": "strategy"},
    {"name": "Products",           "taskType": "C",  "department": "strategy"},
    {"name": "Pre Production",     "taskType": "SS", "department": "pre_production"},
    {"name": "PPM",                "taskType": "C",  "department": "pre_production"},
    {"name": "Shoot",              "taskType": "SS", "department": "production"},
    {"name": "Edits",              "taskType": "SS", "department": "post_production"},
    {"name": "Feedback",           "taskType": "C",  "department": "post_production"},
    {"name": "Revision",           "taskType": "SS", "department": "post_production"},
    {"name": "Final Approval",     "taskType": "C",  "department": "post_production"},
]


def make_default_workflow_stages() -> List[Dict]:
    return [
        {
            **s,
            "startDate": None, "endDate": None,
            "duration": 0, "extraDays": 0,
            "completed": False, "started": False,
            "status": "not_started",
        }
        for s in DEFAULT_WORKFLOW_STAGES
    ]


class Project(_Base):
    agencyId: str
    clientId: str
    name: str
    sow: str = ""
    csDoneBy: Optional[str] = None
    projectStartDate: Optional[str] = None
    projectEndDate: Optional[str] = None
    statusCategory: str = "active"  # active | on_hold | completed | cancelled
    extraDays: int = 0
    assignedPMUserId: Optional[str] = None
    assignedAMUserId: Optional[str] = None
    assignedLPUserId: Optional[str] = None
    podId: Optional[str] = None
    projectType: Optional[str] = None     # fashion | tech | lifestyle | food | ...
    budgetINR: int = 0
    workflowStages: List[Dict] = Field(default_factory=make_default_workflow_stages)
    createdBy: Optional[str] = None


class ProjectCreate(BaseModel):
    agencyId: str
    clientId: str
    name: str
    sow: str = ""
    csDoneBy: Optional[str] = None
    projectStartDate: Optional[str] = None
    projectEndDate: Optional[str] = None
    statusCategory: str = "active"
    assignedPMUserId: Optional[str] = None
    assignedAMUserId: Optional[str] = None
    assignedLPUserId: Optional[str] = None
    podId: Optional[str] = None
    projectType: Optional[str] = None
    budgetINR: int = 0
    workflowStages: Optional[List[Dict]] = None
    createdBy: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    sow: Optional[str] = None
    statusCategory: Optional[str] = None
    extraDays: Optional[int] = None
    projectStartDate: Optional[str] = None
    projectEndDate: Optional[str] = None
    assignedPMUserId: Optional[str] = None
    assignedAMUserId: Optional[str] = None
    assignedLPUserId: Optional[str] = None
    podId: Optional[str] = None
    projectType: Optional[str] = None
    budgetINR: Optional[int] = None
    workflowStages: Optional[List[Dict]] = None


class StageUpdate(BaseModel):
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    duration: Optional[int] = None
    extraDays: Optional[int] = None
    completed: Optional[bool] = None
    started: Optional[bool] = None
    status: Optional[str] = None


class Campaign(_Base):
    projectId: str
    name: str
    brief: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    status: str = "planned"         # planned | in_progress | done


class CampaignCreate(BaseModel):
    projectId: str
    name: str
    brief: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    status: str = "planned"


class Deliverable(_Base):
    projectId: str
    campaignId: Optional[str] = None
    name: str
    type: str = "video"             # video | static | reel | photo | copy | other
    dueDate: Optional[str] = None
    status: str = "todo"            # todo | in_progress | review | done
    ownerUserId: Optional[str] = None
    notes: Optional[str] = None


class DeliverableCreate(BaseModel):
    projectId: str
    campaignId: Optional[str] = None
    name: str
    type: str = "video"
    dueDate: Optional[str] = None
    status: str = "todo"
    ownerUserId: Optional[str] = None
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Phases / Tasks / Subtasks
# ---------------------------------------------------------------------------

class Phase(_Base):
    projectId: str
    name: str
    order: int = 0
    plannedStart: Optional[str] = None
    plannedEnd: Optional[str] = None
    departmentId: Optional[str] = None
    status: str = "not_started"     # not_started | in_progress | done | blocked


class PhaseCreate(BaseModel):
    projectId: str
    name: str
    order: int = 0
    plannedStart: Optional[str] = None
    plannedEnd: Optional[str] = None
    departmentId: Optional[str] = None
    status: str = "not_started"


class Task(_Base):
    projectId: str
    phaseId: str
    deliverableId: Optional[str] = None
    name: str
    description: Optional[str] = None
    assigneeUserId: Optional[str] = None
    priority: str = "medium"        # low | medium | high
    plannedStart: Optional[str] = None
    plannedEnd: Optional[str] = None
    dependsOnTaskIds: List[str] = Field(default_factory=list)
    status: str = "todo"            # todo | in_progress | review | done | blocked
    estimateHrs: float = 0.0
    actualHrs: float = 0.0


class TaskCreate(BaseModel):
    projectId: str
    phaseId: str
    deliverableId: Optional[str] = None
    name: str
    description: Optional[str] = None
    assigneeUserId: Optional[str] = None
    priority: str = "medium"
    plannedStart: Optional[str] = None
    plannedEnd: Optional[str] = None
    dependsOnTaskIds: List[str] = Field(default_factory=list)
    status: str = "todo"
    estimateHrs: float = 0.0


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    assigneeUserId: Optional[str] = None
    priority: Optional[str] = None
    plannedStart: Optional[str] = None
    plannedEnd: Optional[str] = None
    dependsOnTaskIds: Optional[List[str]] = None
    status: Optional[str] = None
    estimateHrs: Optional[float] = None
    actualHrs: Optional[float] = None


class Subtask(_Base):
    taskId: str
    name: str
    assigneeUserId: Optional[str] = None
    done: bool = False
    order: int = 0


class SubtaskCreate(BaseModel):
    taskId: str
    name: str
    assigneeUserId: Optional[str] = None
    done: bool = False
    order: int = 0


class SubtaskUpdate(BaseModel):
    name: Optional[str] = None
    assigneeUserId: Optional[str] = None
    done: Optional[bool] = None
    order: Optional[int] = None


# ---------------------------------------------------------------------------
# Approvals (internal review + client magic-link)
# ---------------------------------------------------------------------------

class Approval(_Base):
    projectId: str
    scope: str                      # internal | client
    subjectType: str                # deliverable | task | phase | project
    subjectId: str
    requesterUserId: str
    reviewerUserIds: List[str] = Field(default_factory=list)
    magicLinkToken: Optional[str] = None
    status: str = "pending"         # pending | approved | rejected | cancelled
    note: Optional[str] = None
    decidedAt: Optional[str] = None
    decidedBy: Optional[str] = None  # userId for internal, or "client:<contactName>"


class ApprovalCreate(BaseModel):
    projectId: str
    scope: str
    subjectType: str
    subjectId: str
    requesterUserId: str
    reviewerUserIds: List[str] = Field(default_factory=list)
    note: Optional[str] = None


class ApprovalDecision(BaseModel):
    decision: str                   # approved | rejected
    decidedBy: str
    note: Optional[str] = None


# ---------------------------------------------------------------------------
# Holidays (v1 — kept as-is)
# ---------------------------------------------------------------------------

class Holiday(_Base):
    agencyId: Optional[str] = None  # nullable for v1 rows; seed will fill
    date: str                       # YYYY-MM-DD
    name: str
    dayOfWeek: str
    isWorking: bool = False


class HolidayCreate(BaseModel):
    agencyId: Optional[str] = None
    date: str
    name: str
    dayOfWeek: Optional[str] = None
