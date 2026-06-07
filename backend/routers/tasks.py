"""
Tasks / Subtasks / Approvals — the v1 documentation gap.

Tasks live under Phases. Subtasks under Tasks. Approvals are independent
records that reference any subject (deliverable, task, phase, project) and
optionally carry a magic-link token for external client review.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException

import db
from models import (
    Task, TaskCreate, TaskUpdate,
    Subtask, SubtaskCreate, SubtaskUpdate,
    Approval, ApprovalCreate, ApprovalDecision,
)

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ------------------ Tasks ------------------

@router.get("/tasks", response_model=List[Task])
async def list_tasks(
    projectId: str | None = None,
    phaseId: str | None = None,
    assigneeUserId: str | None = None,
    status: str | None = None,
):
    q: dict = {}
    if projectId:      q["projectId"] = projectId
    if phaseId:        q["phaseId"] = phaseId
    if assigneeUserId: q["assigneeUserId"] = assigneeUserId
    if status:         q["status"] = status
    return await db.tasks().find(q, {"_id": 0}).to_list(5000)


# v1 compat: paths the v1 docs claimed (so legacy frontend code doesn't 404)
@router.get("/tasks/project/{project_id}", response_model=List[Task])
async def list_tasks_by_project(project_id: str):
    return await db.tasks().find({"projectId": project_id}, {"_id": 0}).to_list(5000)


@router.get("/tasks/user/{user_id}", response_model=List[Task])
async def list_tasks_by_user(user_id: str):
    return await db.tasks().find({"assigneeUserId": user_id}, {"_id": 0}).to_list(5000)


@router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str):
    doc = await db.tasks().find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Task not found")
    return doc


@router.post("/tasks", response_model=Task)
async def create_task(body: TaskCreate):
    obj = Task(**body.model_dump())
    await db.tasks().insert_one(obj.model_dump())
    return obj


@router.patch("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, patch: TaskUpdate):
    data = {k: v for k, v in patch.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "No update data provided")
    res = await db.tasks().update_one({"id": task_id}, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(404, "Task not found")
    return await db.tasks().find_one({"id": task_id}, {"_id": 0})


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    res = await db.tasks().delete_one({"id": task_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Task not found")
    await db.subtasks().delete_many({"taskId": task_id})
    # Remove this task from any dependsOn arrays
    await db.tasks().update_many(
        {"dependsOnTaskIds": task_id},
        {"$pull": {"dependsOnTaskIds": task_id}},
    )
    return {"deleted": True}


# ------------------ Subtasks ------------------

@router.get("/tasks/{task_id}/subtasks", response_model=List[Subtask])
async def list_subtasks(task_id: str):
    return await db.subtasks().find(
        {"taskId": task_id}, {"_id": 0}
    ).sort("order", 1).to_list(500)


@router.post("/subtasks", response_model=Subtask)
async def create_subtask(body: SubtaskCreate):
    obj = Subtask(**body.model_dump())
    await db.subtasks().insert_one(obj.model_dump())
    return obj


@router.patch("/subtasks/{subtask_id}", response_model=Subtask)
async def update_subtask(subtask_id: str, patch: SubtaskUpdate):
    data = {k: v for k, v in patch.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "No update data provided")
    res = await db.subtasks().update_one({"id": subtask_id}, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(404, "Subtask not found")
    return await db.subtasks().find_one({"id": subtask_id}, {"_id": 0})


@router.delete("/subtasks/{subtask_id}")
async def delete_subtask(subtask_id: str):
    res = await db.subtasks().delete_one({"id": subtask_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Subtask not found")
    return {"deleted": True}


# ------------------ Approvals ------------------

@router.get("/approvals", response_model=List[Approval])
async def list_approvals(
    projectId: str | None = None,
    scope: str | None = None,
    status: str | None = None,
    reviewerUserId: str | None = None,
):
    q: dict = {}
    if projectId:       q["projectId"] = projectId
    if scope:           q["scope"] = scope
    if status:          q["status"] = status
    if reviewerUserId:  q["reviewerUserIds"] = reviewerUserId
    return await db.approvals().find(q, {"_id": 0}).to_list(2000)


# v1 compat path
@router.get("/approvals/project/{project_id}", response_model=List[Approval])
async def list_approvals_by_project(project_id: str):
    return await db.approvals().find({"projectId": project_id}, {"_id": 0}).to_list(2000)


@router.post("/approvals", response_model=Approval)
async def create_approval(body: ApprovalCreate):
    payload = body.model_dump()
    if payload["scope"] == "client":
        payload["magicLinkToken"] = secrets.token_urlsafe(24)
    obj = Approval(**payload)
    await db.approvals().insert_one(obj.model_dump())
    return obj


@router.patch("/approvals/{approval_id}", response_model=Approval)
async def decide_approval(approval_id: str, decision: ApprovalDecision):
    if decision.decision not in ("approved", "rejected"):
        raise HTTPException(400, "decision must be 'approved' or 'rejected'")
    update = {
        "status": decision.decision,
        "decidedAt": _now_iso(),
        "decidedBy": decision.decidedBy,
        "note": decision.note,
    }
    res = await db.approvals().update_one({"id": approval_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Approval not found")
    return await db.approvals().find_one({"id": approval_id}, {"_id": 0})


@router.delete("/approvals/{approval_id}")
async def cancel_approval(approval_id: str):
    res = await db.approvals().update_one(
        {"id": approval_id}, {"$set": {"status": "cancelled"}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Approval not found")
    return {"cancelled": True}


# Public magic-link endpoint — no auth, token is the secret.
@router.get("/public/approvals/{token}", response_model=Approval)
async def get_approval_by_token(token: str):
    doc = await db.approvals().find_one({"magicLinkToken": token}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Approval not found")
    return doc


@router.post("/public/approvals/{token}/decide", response_model=Approval)
async def decide_via_magic_link(token: str, decision: ApprovalDecision):
    doc = await db.approvals().find_one({"magicLinkToken": token}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Approval not found")
    if doc["status"] != "pending":
        raise HTTPException(409, "Already decided")
    if decision.decision not in ("approved", "rejected"):
        raise HTTPException(400, "decision must be 'approved' or 'rejected'")
    update = {
        "status": decision.decision,
        "decidedAt": _now_iso(),
        "decidedBy": f"client:{decision.decidedBy}",
        "note": decision.note,
    }
    await db.approvals().update_one({"id": doc["id"]}, {"$set": update})

    # If the subject is a creative round, flip its status too so the
    # internal UI immediately reflects the client decision.
    if doc.get("subjectType") == "creative_round":
        round_status = "approved" if decision.decision == "approved" else "revisions_requested"
        await db.rounds().update_one(
            {"id": doc["subjectId"]},
            {"$set": {"status": round_status}},
        )

    return await db.approvals().find_one({"id": doc["id"]}, {"_id": 0})
