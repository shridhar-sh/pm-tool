"""
Time entries, live timers, and per-project financials.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pymongo.errors import DuplicateKeyError

import db
from models import (
    TimeEntry, TimeEntryCreate, TimeEntryUpdate,
    TimerSession, TimerStart,
)

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------- TimeEntry CRUD ----------------

@router.get("/time-entries", response_model=List[TimeEntry])
async def list_time_entries(
    agencyId: Optional[str] = None,
    projectId: Optional[str] = None,
    userId: Optional[str] = None,
    taskId: Optional[str] = None,
    fromDate: Optional[str] = None,    # YYYY-MM-DD inclusive
    toDate: Optional[str] = None,
    billable: Optional[bool] = None,
):
    q: dict = {}
    if agencyId:   q["agencyId"] = agencyId
    if projectId:  q["projectId"] = projectId
    if userId:     q["userId"] = userId
    if taskId:     q["taskId"] = taskId
    if billable is not None: q["billable"] = billable
    if fromDate or toDate:
        d: dict = {}
        if fromDate: d["$gte"] = fromDate
        if toDate:   d["$lte"] = toDate
        q["date"] = d
    cur = db.time_entries().find(q, {"_id": 0}).sort("date", -1)
    return await cur.to_list(10000)


@router.post("/time-entries", response_model=TimeEntry)
async def create_time_entry(body: TimeEntryCreate):
    # Snapshot the user's bill rate at log time if not provided.
    rate = body.billRateINRSnapshot
    if rate is None:
        user = await db.users().find_one({"id": body.userId}, {"_id": 0, "billRateINR": 1})
        rate = (user or {}).get("billRateINR", 0)

    obj = TimeEntry(
        agencyId=body.agencyId,
        projectId=body.projectId,
        taskId=body.taskId,
        userId=body.userId,
        date=body.date,
        hours=float(body.hours),
        billable=bool(body.billable),
        billRateINRSnapshot=int(rate or 0),
        notes=body.notes,
        timerStartedAt=body.timerStartedAt,
        timerStoppedAt=body.timerStoppedAt,
    )
    await db.time_entries().insert_one(obj.model_dump())
    # If this entry came from a task, accumulate actualHrs on the task.
    if body.taskId:
        await db.tasks().update_one(
            {"id": body.taskId},
            {"$inc": {"actualHrs": float(body.hours)}},
        )
    return obj


@router.patch("/time-entries/{entry_id}", response_model=TimeEntry)
async def update_time_entry(entry_id: str, patch: TimeEntryUpdate):
    cur = await db.time_entries().find_one({"id": entry_id}, {"_id": 0})
    if not cur:
        raise HTTPException(404, "Time entry not found")
    data = {k: v for k, v in patch.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "No update data provided")
    await db.time_entries().update_one({"id": entry_id}, {"$set": data})
    new_doc = await db.time_entries().find_one({"id": entry_id}, {"_id": 0})

    # If hours changed and the entry has a task, fix the task accumulator.
    if "hours" in data and cur.get("taskId"):
        delta = float(data["hours"]) - float(cur.get("hours", 0))
        if delta:
            await db.tasks().update_one(
                {"id": cur["taskId"]},
                {"$inc": {"actualHrs": delta}},
            )
    return new_doc


@router.delete("/time-entries/{entry_id}")
async def delete_time_entry(entry_id: str):
    cur = await db.time_entries().find_one({"id": entry_id}, {"_id": 0})
    if not cur:
        raise HTTPException(404, "Time entry not found")
    await db.time_entries().delete_one({"id": entry_id})
    if cur.get("taskId"):
        await db.tasks().update_one(
            {"id": cur["taskId"]},
            {"$inc": {"actualHrs": -float(cur.get("hours", 0))}},
        )
    return {"deleted": True}


# ---------------- Live timer ----------------

@router.get("/time-entries/timer/active")
async def get_active_timer(userId: str):
    doc = await db.timer_sessions().find_one({"userId": userId}, {"_id": 0})
    return doc or None


@router.post("/time-entries/timer/start", response_model=TimerSession)
async def start_timer(body: TimerStart):
    """Only one running timer per user; existing session is replaced."""
    session = TimerSession(
        agencyId=body.agencyId,
        userId=body.userId,
        projectId=body.projectId,
        taskId=body.taskId,
        notes=body.notes,
        billable=body.billable,
    )
    # upsert by userId
    await db.timer_sessions().replace_one(
        {"userId": body.userId},
        session.model_dump(),
        upsert=True,
    )
    return session


@router.post("/time-entries/timer/stop", response_model=TimeEntry)
async def stop_timer(userId: str):
    """Convert the user's running timer into a TimeEntry."""
    sess = await db.timer_sessions().find_one({"userId": userId}, {"_id": 0})
    if not sess:
        raise HTTPException(404, "No running timer")
    started = datetime.fromisoformat(sess["startedAt"])
    ended = datetime.now(timezone.utc)
    elapsed_h = max(0.0, (ended - started).total_seconds() / 3600.0)
    # Snapshot user bill rate.
    user = await db.users().find_one({"id": sess["userId"]}, {"_id": 0, "billRateINR": 1})
    rate = (user or {}).get("billRateINR", 0)

    entry = TimeEntry(
        agencyId=sess["agencyId"],
        projectId=sess["projectId"],
        taskId=sess.get("taskId"),
        userId=sess["userId"],
        date=ended.date().isoformat(),
        hours=round(elapsed_h, 2),
        billable=sess.get("billable", True),
        billRateINRSnapshot=int(rate or 0),
        notes=sess.get("notes"),
        timerStartedAt=sess["startedAt"],
        timerStoppedAt=ended.isoformat(),
    )
    await db.time_entries().insert_one(entry.model_dump())
    if sess.get("taskId"):
        await db.tasks().update_one(
            {"id": sess["taskId"]},
            {"$inc": {"actualHrs": entry.hours}},
        )
    await db.timer_sessions().delete_one({"userId": userId})
    return entry


# ---------------- Project financials ----------------

@router.get("/projects/{project_id}/financials")
async def project_financials(project_id: str):
    proj = await db.projects().find_one({"id": project_id}, {"_id": 0})
    if not proj:
        raise HTTPException(404, "Project not found")

    entries = await db.time_entries().find(
        {"projectId": project_id}, {"_id": 0}
    ).to_list(20000)

    billable_hours = 0.0
    internal_hours = 0.0
    billable_inr = 0       # sum(hours * snapshot rate) for billable entries
    internal_cost_inr = 0  # same for internal (treated as cost)
    by_user: dict = {}
    by_task: dict = {}

    for e in entries:
        h = float(e.get("hours", 0))
        rate = int(e.get("billRateINRSnapshot", 0))
        amt = int(round(h * rate))
        if e.get("billable"):
            billable_hours += h
            billable_inr += amt
        else:
            internal_hours += h
            internal_cost_inr += amt
        uid = e.get("userId")
        if uid:
            row = by_user.setdefault(uid, {
                "userId": uid, "hours": 0.0, "billableInr": 0, "internalCostInr": 0
            })
            row["hours"] += h
            if e.get("billable"):
                row["billableInr"] += amt
            else:
                row["internalCostInr"] += amt
        tid = e.get("taskId")
        if tid:
            trow = by_task.setdefault(tid, {
                "taskId": tid, "hours": 0.0, "billableInr": 0
            })
            trow["hours"] += h
            if e.get("billable"):
                trow["billableInr"] += amt

    budget = int(proj.get("budgetINR") or 0)
    profit = billable_inr - internal_cost_inr
    margin = (profit / billable_inr) if billable_inr > 0 else None

    return {
        "projectId": project_id,
        "currency": "INR",
        "budgetINR": budget,
        "billableHours": round(billable_hours, 2),
        "internalHours": round(internal_hours, 2),
        "totalHours": round(billable_hours + internal_hours, 2),
        "billableInr": billable_inr,
        "internalCostInr": internal_cost_inr,
        "profit": profit,
        "marginPct": round(margin * 100, 1) if margin is not None else None,
        "budgetUsedPct": round((billable_inr / budget) * 100, 1) if budget else None,
        "byUser": list(by_user.values()),
        "byTask": list(by_task.values()),
        "entryCount": len(entries),
    }
