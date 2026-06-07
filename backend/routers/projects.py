"""
Project / Campaign / Deliverable / Phase CRUD + workflow-stage updates.
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException

import db
from models import (
    Project, ProjectCreate, ProjectUpdate, StageUpdate, make_default_workflow_stages,
    Campaign, CampaignCreate,
    Deliverable, DeliverableCreate,
    Phase, PhaseCreate,
)

router = APIRouter()


# ------------------ Projects ------------------

@router.get("/projects", response_model=List[Project])
async def list_projects(
    agencyId: str | None = None,
    clientId: str | None = None,
    podId: str | None = None,
    statusCategory: str | None = None,
    assignedAMUserId: str | None = None,
    assignedLPUserId: str | None = None,
    assignedPMUserId: str | None = None,
):
    q: dict = {}
    if agencyId:          q["agencyId"] = agencyId
    if clientId:          q["clientId"] = clientId
    if podId:             q["podId"] = podId
    if statusCategory:    q["statusCategory"] = statusCategory
    if assignedAMUserId:  q["assignedAMUserId"] = assignedAMUserId
    if assignedLPUserId:  q["assignedLPUserId"] = assignedLPUserId
    if assignedPMUserId:  q["assignedPMUserId"] = assignedPMUserId
    return await db.projects().find(q, {"_id": 0}).to_list(5000)


@router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    doc = await db.projects().find_one({"id": project_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Project not found")
    return doc


@router.post("/projects", response_model=Project)
async def create_project(body: ProjectCreate):
    payload = body.model_dump()
    if not payload.get("workflowStages"):
        payload["workflowStages"] = make_default_workflow_stages()
    obj = Project(**payload)
    await db.projects().insert_one(obj.model_dump())
    return obj


@router.patch("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, patch: ProjectUpdate):
    update_data = {k: v for k, v in patch.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(400, "No update data provided")
    res = await db.projects().update_one({"id": project_id}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(404, "Project not found")
    return await db.projects().find_one({"id": project_id}, {"_id": 0})


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    res = await db.projects().delete_one({"id": project_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Project not found")
    # cascade — small enough to do inline; revisit if collections grow
    await db.campaigns().delete_many({"projectId": project_id})
    await db.deliverables().delete_many({"projectId": project_id})
    await db.phases().delete_many({"projectId": project_id})
    await db.tasks().delete_many({"projectId": project_id})
    await db.approvals().delete_many({"projectId": project_id})
    return {"deleted": True}


@router.patch("/projects/{project_id}/stages/{stage_index}")
async def update_stage(project_id: str, stage_index: int, patch: StageUpdate):
    project = await db.projects().find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")
    stages = project.get("workflowStages", [])
    if stage_index < 0 or stage_index >= len(stages):
        raise HTTPException(404, "Stage not found")
    update_data = {k: v for k, v in patch.model_dump().items() if v is not None}
    stages[stage_index].update(update_data)
    await db.projects().update_one(
        {"id": project_id}, {"$set": {"workflowStages": stages}}
    )
    return {"stage": stages[stage_index]}


# ------------------ Campaigns ------------------

@router.get("/projects/{project_id}/campaigns", response_model=List[Campaign])
async def list_campaigns(project_id: str):
    return await db.campaigns().find({"projectId": project_id}, {"_id": 0}).to_list(500)


@router.post("/campaigns", response_model=Campaign)
async def create_campaign(body: CampaignCreate):
    obj = Campaign(**body.model_dump())
    await db.campaigns().insert_one(obj.model_dump())
    return obj


@router.patch("/campaigns/{campaign_id}", response_model=Campaign)
async def update_campaign(campaign_id: str, patch: dict):
    res = await db.campaigns().update_one({"id": campaign_id}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(404, "Campaign not found")
    return await db.campaigns().find_one({"id": campaign_id}, {"_id": 0})


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str):
    res = await db.campaigns().delete_one({"id": campaign_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Campaign not found")
    # detach deliverables but don't delete them — they may have been re-homed
    await db.deliverables().update_many(
        {"campaignId": campaign_id}, {"$set": {"campaignId": None}}
    )
    return {"deleted": True}


# ------------------ Deliverables ------------------

@router.get("/projects/{project_id}/deliverables", response_model=List[Deliverable])
async def list_deliverables(project_id: str, campaignId: str | None = None):
    q: dict = {"projectId": project_id}
    if campaignId:
        q["campaignId"] = campaignId
    return await db.deliverables().find(q, {"_id": 0}).to_list(2000)


@router.post("/deliverables", response_model=Deliverable)
async def create_deliverable(body: DeliverableCreate):
    obj = Deliverable(**body.model_dump())
    await db.deliverables().insert_one(obj.model_dump())
    return obj


@router.patch("/deliverables/{deliverable_id}", response_model=Deliverable)
async def update_deliverable(deliverable_id: str, patch: dict):
    res = await db.deliverables().update_one({"id": deliverable_id}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(404, "Deliverable not found")
    return await db.deliverables().find_one({"id": deliverable_id}, {"_id": 0})


@router.delete("/deliverables/{deliverable_id}")
async def delete_deliverable(deliverable_id: str):
    res = await db.deliverables().delete_one({"id": deliverable_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Deliverable not found")
    return {"deleted": True}


# ------------------ Phases ------------------

@router.get("/projects/{project_id}/phases", response_model=List[Phase])
async def list_phases(project_id: str):
    return await db.phases().find(
        {"projectId": project_id}, {"_id": 0}
    ).sort("order", 1).to_list(500)


@router.post("/phases", response_model=Phase)
async def create_phase(body: PhaseCreate):
    obj = Phase(**body.model_dump())
    await db.phases().insert_one(obj.model_dump())
    return obj


@router.patch("/phases/{phase_id}", response_model=Phase)
async def update_phase(phase_id: str, patch: dict):
    res = await db.phases().update_one({"id": phase_id}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(404, "Phase not found")
    return await db.phases().find_one({"id": phase_id}, {"_id": 0})


@router.delete("/phases/{phase_id}")
async def delete_phase(phase_id: str):
    res = await db.phases().delete_one({"id": phase_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Phase not found")
    await db.tasks().delete_many({"phaseId": phase_id})
    return {"deleted": True}
