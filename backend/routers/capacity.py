"""
Capacity heatmap endpoint.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

import db
from capacity import compute_capacity
from workdays import parse_date

router = APIRouter()


@router.get("/capacity")
async def get_capacity(
    agencyId: Optional[str] = None,
    from_: Optional[str] = Query(default=None, alias="from"),
    to: Optional[str] = None,
    podId: Optional[str] = None,
    role: Optional[str] = None,
    weeks: int = 8,
):
    """
    Per-user weekly load for the agency.

    - `from` / `to` are inclusive YYYY-MM-DD. If both are omitted the window
      is `today` through `today + weeks*7 - 1`.
    - `podId` / `role` filter the user list (rendered rows).
    - `agencyId` filters users + tasks by agency.

    NOTE: query param is exposed as `from` to clients but appears here as
    `from_` because `from` is a Python keyword.
    """
    try:
        f = parse_date(from_) if from_ else date.today()
        t = parse_date(to) if to else (f + timedelta(days=max(1, weeks) * 7 - 1))
    except ValueError:
        raise HTTPException(400, "from/to must be YYYY-MM-DD")
    if t < f:
        raise HTTPException(400, "to must be on or after from")

    user_q = {}
    if agencyId:
        user_q["agencyId"] = agencyId
    users = await db.users().find(user_q, {"_id": 0}).to_list(2000)

    task_q = {}
    if agencyId:
        # Tasks don't carry agencyId directly; filter via project lookup.
        proj_ids = await db.projects().find(
            {"agencyId": agencyId}, {"_id": 0, "id": 1}
        ).to_list(2000)
        task_q["projectId"] = {"$in": [p["id"] for p in proj_ids]}
    tasks = await db.tasks().find(task_q, {"_id": 0}).to_list(20000)

    hol_q = {}
    if agencyId:
        hol_q = {"$or": [{"agencyId": agencyId}, {"agencyId": None}]}
    holidays = await db.holidays().find(hol_q, {"_id": 0}).to_list(2000)

    return compute_capacity(
        users, tasks, holidays, f, t,
        pod_id=podId, role=role,
    )
