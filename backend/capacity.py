"""
Per-user weekly capacity load.

Each task contributes `estimateHrs` distributed evenly across the task's
working days (Sat/Sun and non-working holidays skipped). Daily hours are
bucketed into ISO weeks (Mon = week start).

Tasks without an assignee are skipped silently.
Tasks without enough scheduling data to place them are skipped silently.
"""
from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Iterable, List, Mapping, Optional, Sequence

from workdays import (
    add_working_days, build_calendar, is_working_day, parse_date,
)

HOURS_PER_DAY = 8


def _safe_parse(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return parse_date(s)
    except (TypeError, ValueError):
        return None


def iso_week_start(d: date) -> date:
    """Monday of d's week. weekday(): Mon=0 ... Sun=6."""
    return d - timedelta(days=d.weekday())


def _walk_working_days(start: date, end: date, cal) -> List[date]:
    out: List[date] = []
    cur = start
    while cur <= end:
        if is_working_day(cur, cal):
            out.append(cur)
        cur += timedelta(days=1)
    return out


def task_daily_hours(task: Mapping, cal) -> List[tuple[date, float]]:
    """
    Return a list of (date, hours) pairs distributing the task across its
    working days. Default daily allowance is 8h when an estimate is missing
    but dates are present.
    """
    start = _safe_parse(task.get("plannedStart"))
    end = _safe_parse(task.get("plannedEnd"))
    estimate = float(task.get("estimateHrs") or 0)

    if not start and not end:
        return []

    if start and end:
        if end < start:
            return []
        days = _walk_working_days(start, end, cal)
    elif start:
        duration = max(1, math.ceil(estimate / HOURS_PER_DAY)) if estimate > 0 else 1
        derived_end = add_working_days(start, duration, cal)
        days = _walk_working_days(start, derived_end, cal)
    else:  # only end
        days = [end] if is_working_day(end, cal) else []

    if not days:
        return []

    hours = estimate if estimate > 0 else len(days) * HOURS_PER_DAY
    per_day = hours / len(days)
    return [(d, per_day) for d in days]


def compute_capacity(
    users: Sequence[Mapping],
    tasks: Sequence[Mapping],
    holidays: Iterable[Mapping],
    from_date: date,
    to_date: date,
    *,
    pod_id: Optional[str] = None,
    role: Optional[str] = None,
) -> dict:
    """
    Returns {from, to, weekStarts[], rows[{userId, name, role, podId,
    capacityHrsPerWeek, loadByWeek[], peakHours, peakRatio,
    overbookedWeeks}]}.
    """
    cal = build_calendar(holidays)

    # ----- filter users -----
    filtered_users = [u for u in users if u.get("active", True) is not False]
    if pod_id:
        filtered_users = [u for u in filtered_users if u.get("podId") == pod_id]
    if role:
        filtered_users = [u for u in filtered_users if u.get("role") == role]

    user_ids = {u["id"] for u in filtered_users}

    # ----- compute week starts in the window -----
    week_starts: List[date] = []
    cur = iso_week_start(from_date)
    while cur <= to_date:
        week_starts.append(cur)
        cur += timedelta(days=7)
    week_idx = {ws.isoformat(): i for i, ws in enumerate(week_starts)}

    loads: dict[str, List[float]] = {
        uid: [0.0] * len(week_starts) for uid in user_ids
    }

    for t in tasks:
        uid = t.get("assigneeUserId")
        if not uid or uid not in loads:
            continue
        # Skip done tasks — they no longer consume capacity.
        if t.get("status") == "done":
            continue
        for d, hrs in task_daily_hours(t, cal):
            if d < from_date or d > to_date:
                continue
            ws_key = iso_week_start(d).isoformat()
            wi = week_idx.get(ws_key)
            if wi is not None:
                loads[uid][wi] += hrs

    rows = []
    for u in filtered_users:
        load = loads[u["id"]]
        cap = int(u.get("capacityHrsPerWeek") or 40)
        peak = max(load) if load else 0.0
        over_weeks = sum(1 for h in load if h > cap)
        rows.append({
            "userId": u["id"],
            "name": u.get("name"),
            "shortName": u.get("shortName"),
            "role": u.get("role"),
            "podId": u.get("podId"),
            "departmentId": u.get("departmentId"),
            "capacityHrsPerWeek": cap,
            "loadByWeek": [round(h, 1) for h in load],
            "peakHours": round(peak, 1),
            "peakRatio": round((peak / cap) if cap else 0.0, 2),
            "overbookedWeeks": over_weeks,
        })

    # Most-loaded users first.
    rows.sort(key=lambda r: (-r["peakRatio"], -r["peakHours"], r["name"] or ""))

    return {
        "from": from_date.isoformat(),
        "to": to_date.isoformat(),
        "weekStarts": [ws.isoformat() for ws in week_starts],
        "rows": rows,
    }
