"""
Project scheduling: topo-sort tasks, forward-pass for effective dates,
find the critical path.

Inputs (plain dicts as stored in Mongo):
  tasks:   id, phaseId, name, plannedStart?, plannedEnd?, estimateHrs?,
           dependsOnTaskIds[]
  phases:  id, plannedStart?, plannedEnd?, name, order, departmentId?
  project: projectStartDate, projectEndDate
  holidays: {date, isWorking}

Output: ScheduleResult dict consumed by the Gantt frontend.

Assumptions:
  - 8 hours of capacity per working day. Used only when a task has
    estimateHrs but no plannedEnd.
  - If plannedStart is missing, we fall back to the project start, then
    push by dependency constraints in the forward pass.
  - Dependencies that point at unknown task ids are silently skipped
    (data integrity is loose during the demo phase) but recorded as
    warnings so the UI can surface them.
"""
from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

from workdays import (
    add_working_days, build_calendar, is_working_day, next_working_day,
    parse_date, working_days_between,
)

HOURS_PER_DAY = 8


def _safe_parse(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return parse_date(value)
    except (TypeError, ValueError):
        return None


def _task_duration_days(task: Mapping) -> int:
    """Working-day duration with sensible fallbacks."""
    start = _safe_parse(task.get("plannedStart"))
    end = _safe_parse(task.get("plannedEnd"))
    if start and end and end >= start:
        # +1 because a 1-day task with same start/end is one day.
        return max(1, (end - start).days + 1)
    estimate = task.get("estimateHrs") or 0
    if estimate > 0:
        return max(1, math.ceil(estimate / HOURS_PER_DAY))
    return 1


def _topo_sort(tasks: Sequence[Mapping]) -> Tuple[List[str], List[str]]:
    """
    Kahn's algorithm. Returns (ordered_ids, cycle_ids). cycle_ids is
    non-empty only when there's a cycle — those tasks are appended at
    the end so the schedule still renders.
    """
    by_id = {t["id"]: t for t in tasks}
    indeg: Dict[str, int] = {tid: 0 for tid in by_id}
    out_edges: Dict[str, List[str]] = {tid: [] for tid in by_id}
    for t in tasks:
        for dep in t.get("dependsOnTaskIds") or []:
            if dep in by_id:
                out_edges[dep].append(t["id"])
                indeg[t["id"]] = indeg.get(t["id"], 0) + 1

    queue = [tid for tid, n in indeg.items() if n == 0]
    order: List[str] = []
    while queue:
        # Stable order: pop the earliest-added id (queue, not stack).
        tid = queue.pop(0)
        order.append(tid)
        for nxt in out_edges[tid]:
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                queue.append(nxt)

    cycle = [tid for tid, n in indeg.items() if n > 0]
    return order + cycle, cycle


def schedule_project(
    project: Mapping,
    phases: Sequence[Mapping],
    tasks: Sequence[Mapping],
    holidays: Iterable[Mapping],
) -> Dict:
    cal = build_calendar(holidays)
    by_id = {t["id"]: t for t in tasks}
    warnings: List[str] = []

    project_start = _safe_parse(project.get("projectStartDate")) or date.today()
    project_start = next_working_day(project_start, cal)

    ordered, cycle = _topo_sort(tasks)
    if cycle:
        warnings.append(
            f"Cyclic dependency among {len(cycle)} task(s) — scheduling proceeds best-effort"
        )

    computed: Dict[str, Dict] = {}

    for tid in ordered:
        t = by_id[tid]
        duration = _task_duration_days(t)

        # Earliest the task can start: max of (explicit plannedStart, each
        # dep's computed end + 1 working day, project start).
        candidate_start = _safe_parse(t.get("plannedStart")) or project_start
        candidate_start = next_working_day(max(candidate_start, project_start), cal)

        for dep_id in t.get("dependsOnTaskIds") or []:
            dep_comp = computed.get(dep_id)
            if not dep_comp:
                if dep_id not in by_id:
                    warnings.append(f"Task {tid[:8]}… depends on unknown {dep_id[:8]}…")
                continue
            day_after = parse_date(dep_comp["computedEnd"]) + timedelta(days=1)
            day_after = next_working_day(day_after, cal)
            if day_after > candidate_start:
                candidate_start = day_after

        comp_end = add_working_days(candidate_start, duration, cal)

        # If the user pinned a plannedEnd later than our computed end, respect it.
        pinned_end = _safe_parse(t.get("plannedEnd"))
        if pinned_end and pinned_end > comp_end:
            comp_end = pinned_end

        computed[tid] = {
            "id": tid,
            "name": t.get("name", ""),
            "phaseId": t.get("phaseId"),
            "assigneeUserId": t.get("assigneeUserId"),
            "status": t.get("status", "todo"),
            "priority": t.get("priority", "medium"),
            "dependsOnTaskIds": list(t.get("dependsOnTaskIds") or []),
            "plannedStart": t.get("plannedStart"),
            "plannedEnd": t.get("plannedEnd"),
            "computedStart": candidate_start.isoformat(),
            "computedEnd": comp_end.isoformat(),
            "durationDays": duration,
            "workingDaysSpan": working_days_between(candidate_start, comp_end, cal),
            "isCritical": False,
        }

    # Critical path: longest finishing chain.
    critical_path: List[str] = []
    if computed:
        last_tid = max(computed.values(), key=lambda c: c["computedEnd"])["id"]
        cursor: Optional[str] = last_tid
        seen = set()
        while cursor and cursor not in seen:
            seen.add(cursor)
            critical_path.append(cursor)
            computed[cursor]["isCritical"] = True
            # Pick the dep with the latest computedEnd.
            best: Optional[str] = None
            best_end = ""
            for dep_id in computed[cursor]["dependsOnTaskIds"]:
                dep_c = computed.get(dep_id)
                if not dep_c:
                    continue
                if dep_c["computedEnd"] > best_end:
                    best_end = dep_c["computedEnd"]
                    best = dep_id
            cursor = best
        critical_path.reverse()

    # Per-phase span = span of its tasks.
    phase_out: List[Dict] = []
    project_min = None
    project_max = None
    for ph in sorted(phases, key=lambda p: p.get("order", 0)):
        in_phase = [c for c in computed.values() if c["phaseId"] == ph["id"]]
        if in_phase:
            ph_start = min(c["computedStart"] for c in in_phase)
            ph_end = max(c["computedEnd"] for c in in_phase)
        else:
            ph_start = ph.get("plannedStart")
            ph_end = ph.get("plannedEnd")
        if ph_start and (project_min is None or ph_start < project_min):
            project_min = ph_start
        if ph_end and (project_max is None or ph_end > project_max):
            project_max = ph_end
        phase_out.append({
            "id": ph["id"],
            "name": ph.get("name", ""),
            "order": ph.get("order", 0),
            "departmentId": ph.get("departmentId"),
            "plannedStart": ph.get("plannedStart"),
            "plannedEnd": ph.get("plannedEnd"),
            "computedStart": ph_start,
            "computedEnd": ph_end,
            "taskIds": [c["id"] for c in in_phase],
        })

    project_end_explicit = project.get("projectEndDate")
    if project_end_explicit and (project_max is None or project_end_explicit > project_max):
        project_max = project_end_explicit
    if not project_min:
        project_min = project.get("projectStartDate") or project_start.isoformat()
    if not project_max:
        project_max = project.get("projectEndDate") or project_min

    # Pull out the actual holidays so the frontend can draw stripes.
    holiday_strip = [
        {"date": h["date"], "isWorking": bool(h.get("isWorking", False)),
         "name": h.get("name", "")}
        for h in holidays
        if h.get("date") and project_min <= h["date"] <= project_max
    ]
    holiday_strip.sort(key=lambda h: h["date"])

    return {
        "projectId": project.get("id"),
        "projectStart": project_min,
        "projectEnd": project_max,
        "phases": phase_out,
        "tasks": [computed[tid] for tid in ordered if tid in computed],
        "criticalPath": critical_path,
        "holidays": holiday_strip,
        "warnings": warnings,
    }
