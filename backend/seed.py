"""
Dev seed for AgencyPM v2.

Run either way:
    python seed.py            # from inside backend/ — wipes and seeds
    POST /api/admin/seed      # via the running API

Produces:
  - 1 agency
  - 4 departments (Strategy, Pre-Prod, Production, Post-Prod)
  - 2 pods (POD 1, POD 2)
  - ~10 users — 4 demo logins + 6 team members
  - 2 clients (Nike, Tesla)
  - 3 sample projects with phases, tasks, subtasks
  - 1 client approval (with magic-link) + 1 internal approval
  - Seeded 2026 Indian holidays
"""
from __future__ import annotations

import asyncio
import secrets
from datetime import datetime, timezone
from typing import Dict, List

import db
from models import make_default_workflow_stages
from routers.holidays import HOLIDAYS_2026

# Collections that v2 owns and the seed should reset.
V2_COLLECTIONS = [
    "agencies", "departments", "pods", "users", "clients",
    "projects", "campaigns", "deliverables",
    "phases", "tasks", "subtasks", "approvals", "holidays",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id() -> str:
    import uuid
    return str(uuid.uuid4())


async def wipe_all() -> Dict:
    counts = {}
    for name in V2_COLLECTIONS:
        res = await db.db[name].delete_many({})
        counts[name] = res.deleted_count
    return {"wiped": counts}


async def run(wipe: bool = True) -> Dict:
    if wipe:
        await wipe_all()

    # ---------- Agency ----------
    agency = {
        "id": _id(),
        "name": "AgencyPM Demo",
        "currency": "INR",
        "timezone": "Asia/Kolkata",
        "settings": {},
        "createdAt": _now(),
    }
    await db.agencies().insert_one(agency)
    A = agency["id"]

    # ---------- Departments ----------
    dept_specs = [
        ("Strategy",        "strategy",        "#7C3AED", 1),
        ("Pre-Production",  "pre_production",  "#0EA5E9", 2),
        ("Production",      "production",      "#F59E0B", 3),
        ("Post-Production", "post_production", "#10B981", 4),
    ]
    depts: Dict[str, str] = {}
    for name, slug, color, order in dept_specs:
        doc = {
            "id": _id(), "agencyId": A, "name": name,
            "slug": slug, "color": color, "order": order,
            "createdAt": _now(),
        }
        await db.departments().insert_one(doc)
        depts[slug] = doc["id"]

    # ---------- Pods ----------
    pod_specs = [("POD 1", "production"), ("POD 2", "post_production")]
    pods: Dict[str, str] = {}
    for name, dept_slug in pod_specs:
        doc = {
            "id": _id(), "agencyId": A,
            "departmentId": depts[dept_slug],
            "name": name, "leadUserId": None,
            "createdAt": _now(),
        }
        await db.pods().insert_one(doc)
        pods[name] = doc["id"]

    # ---------- Users ----------
    # 4 demo logins (match frontend Login.jsx) + extra team
    user_specs = [
        # email, name, shortName, role, dept_slug, pod, capacity, rate
        ("pm@agency.com",   "Shridhar Bahubali S", "Shridhar", "project_manager",  None,              None,    40, 2000),
        ("am@agency.com",   "Maya Mahadevan",      "Maya",     "account_manager",  None,              None,    40, 1500),
        ("lp@agency.com",   "Mohammed Burhan",     "Burhan",   "line_producer",    "production",      "POD 1", 40, 1500),
        ("team@agency.com", "Pradeep",             "Pradeep",  "team_member",      "post_production", "POD 2", 40, 1000),
        # Extra teammates
        ("strat1@agency.com", "Anika Rao",         "Anika",    "strategist",       "strategy",        None,    40, 1200),
        ("strat2@agency.com", "Karan Mehta",       "Karan",    "strategist",       "strategy",        None,    40, 1200),
        ("prep1@agency.com",  "Priya Iyer",        "Priya",    "pre_production",   "pre_production",  "POD 1", 40, 1000),
        ("prod1@agency.com",  "Rahul Nair",        "Rahul",    "production",       "production",      "POD 1", 40, 1200),
        ("post1@agency.com",  "Sneha Pillai",      "Sneha",    "editor",           "post_production", "POD 2", 40, 1100),
        ("post2@agency.com",  "Vikram Singh",      "Vikram",   "editor",           "post_production", "POD 2", 40, 1100),
    ]
    users: Dict[str, str] = {}   # email -> id
    for idx, (email, name, short, role, dept_slug, pod_name, cap, rate) in enumerate(user_specs, start=1):
        doc = {
            "id": _id(), "agencyId": A,
            "podId": pods.get(pod_name) if pod_name else None,
            "departmentId": depts.get(dept_slug) if dept_slug else None,
            "employeeId": f"AGY-{idx:03d}",
            "name": name, "shortName": short, "email": email,
            "role": role, "avatar": None,
            "capacityHrsPerWeek": cap, "billRateINR": rate,
            "active": True,
            "createdAt": _now(),
        }
        await db.users().insert_one(doc)
        users[email] = doc["id"]

    pm   = users["pm@agency.com"]
    am   = users["am@agency.com"]
    lp   = users["lp@agency.com"]
    team = users["team@agency.com"]
    strat1 = users["strat1@agency.com"]
    sneha  = users["post1@agency.com"]

    # ---------- Clients ----------
    clients_data = [
        {
            "id": _id(), "agencyId": A,
            "name": "Nike India",
            "contacts": [{"name": "Aarav Sharma", "email": "aarav@nike.example",
                          "phone": "+91-90000-11111", "role": "Brand Manager"}],
            "gstin": "29ABCDE1234F1Z5",
            "currency": "INR", "status": "active",
            "notes": "Retainer client. Summer campaign + always-on socials.",
            "createdAt": _now(),
        },
        {
            "id": _id(), "agencyId": A,
            "name": "Tesla India",
            "contacts": [{"name": "Diya Verma", "email": "diya@tesla.example",
                          "phone": "+91-90000-22222", "role": "Marketing Lead"}],
            "gstin": "29XYZAB5678C1Z2",
            "currency": "INR", "status": "active",
            "notes": "Project-based. Launch comms for Model X.",
            "createdAt": _now(),
        },
    ]
    for c in clients_data:
        await db.clients().insert_one(c)
    nike_id, tesla_id = clients_data[0]["id"], clients_data[1]["id"]

    # ---------- Projects ----------
    proj_specs = [
        {
            "name": "Nike Summer Campaign 2026",
            "clientId": nike_id, "sow": "Hero film + 6 social cutdowns",
            "projectType": "fashion",
            "projectStartDate": "2026-06-01", "projectEndDate": "2026-08-31",
            "budgetINR": 4500000, "podId": pods["POD 1"],
            "assignedPMUserId": pm, "assignedAMUserId": am, "assignedLPUserId": lp,
        },
        {
            "name": "Tesla Model X Launch",
            "clientId": tesla_id, "sow": "Launch film + dealership reels",
            "projectType": "tech",
            "projectStartDate": "2026-07-15", "projectEndDate": "2026-10-15",
            "budgetINR": 7800000, "podId": pods["POD 1"],
            "assignedPMUserId": pm, "assignedAMUserId": am, "assignedLPUserId": lp,
        },
        {
            "name": "Nike Always-On Socials Q3",
            "clientId": nike_id, "sow": "12 reels + 24 statics over 90 days",
            "projectType": "lifestyle",
            "projectStartDate": "2026-07-01", "projectEndDate": "2026-09-30",
            "budgetINR": 1800000, "podId": pods["POD 2"],
            "assignedPMUserId": pm, "assignedAMUserId": am, "assignedLPUserId": lp,
        },
    ]
    project_ids: List[str] = []
    for p in proj_specs:
        doc = {
            "id": _id(), "agencyId": A,
            "clientId": p["clientId"],
            "name": p["name"], "sow": p["sow"],
            "csDoneBy": None,
            "projectStartDate": p["projectStartDate"],
            "projectEndDate": p["projectEndDate"],
            "statusCategory": "active", "extraDays": 0,
            "assignedPMUserId": p["assignedPMUserId"],
            "assignedAMUserId": p["assignedAMUserId"],
            "assignedLPUserId": p["assignedLPUserId"],
            "podId": p["podId"],
            "projectType": p["projectType"],
            "budgetINR": p["budgetINR"],
            "workflowStages": make_default_workflow_stages(),
            "createdBy": pm,
            "createdAt": _now(),
        }
        await db.projects().insert_one(doc)
        project_ids.append(doc["id"])

    p1, p2, p3 = project_ids

    # ---------- Campaigns (only on project 1) ----------
    campaign = {
        "id": _id(), "projectId": p1,
        "name": "Hero Film", "brief": "60s film + cutdowns for socials",
        "startDate": "2026-06-15", "endDate": "2026-07-30",
        "status": "in_progress",
        "createdAt": _now(),
    }
    await db.campaigns().insert_one(campaign)

    # ---------- Deliverables ----------
    deliv_specs = [
        (p1, campaign["id"], "60s Hero Film",       "video",  "2026-07-25", "in_progress", sneha),
        (p1, campaign["id"], "15s Cutdown — IG",    "video",  "2026-07-28", "todo",        sneha),
        (p1, None,           "Static Key Visual",   "static", "2026-07-10", "review",      strat1),
        (p2, None,           "Launch Film 90s",     "video",  "2026-10-01", "todo",        sneha),
        (p3, None,           "Reel #1 — Run Club",  "reel",   "2026-07-15", "in_progress", sneha),
    ]
    deliv_ids: Dict[str, str] = {}
    for proj_id, camp_id, name, dtype, due, status, owner in deliv_specs:
        d = {
            "id": _id(), "projectId": proj_id, "campaignId": camp_id,
            "name": name, "type": dtype, "dueDate": due,
            "status": status, "ownerUserId": owner, "notes": None,
            "createdAt": _now(),
        }
        await db.deliverables().insert_one(d)
        deliv_ids[name] = d["id"]

    # ---------- Phases (Nike Summer only — show the layered model) ----------
    phase_specs = [
        ("Discovery & Brief",  1, "2026-06-01", "2026-06-07", "strategy",        "done"),
        ("Concepting",         2, "2026-06-08", "2026-06-21", "strategy",        "done"),
        ("Pre-Production",     3, "2026-06-22", "2026-07-05", "pre_production",  "in_progress"),
        ("Shoot",              4, "2026-07-06", "2026-07-12", "production",      "not_started"),
        ("Post & Delivery",    5, "2026-07-13", "2026-07-30", "post_production", "not_started"),
    ]
    phase_ids: Dict[str, str] = {}
    for name, order, ps, pe, slug, status in phase_specs:
        ph = {
            "id": _id(), "projectId": p1, "name": name, "order": order,
            "plannedStart": ps, "plannedEnd": pe,
            "departmentId": depts[slug], "status": status,
            "createdAt": _now(),
        }
        await db.phases().insert_one(ph)
        phase_ids[name] = ph["id"]

    # ---------- Tasks + Subtasks ----------
    # Discovery & Brief
    t_brief = {
        "id": _id(), "projectId": p1, "phaseId": phase_ids["Discovery & Brief"],
        "deliverableId": None,
        "name": "Client onboarding call",
        "description": "Capture brief, audience, success metrics.",
        "assigneeUserId": am, "priority": "high",
        "plannedStart": "2026-06-01", "plannedEnd": "2026-06-02",
        "dependsOnTaskIds": [], "status": "done",
        "estimateHrs": 4, "actualHrs": 4,
        "createdAt": _now(),
    }
    await db.tasks().insert_one(t_brief)

    # Concepting
    t_concept = {
        "id": _id(), "projectId": p1, "phaseId": phase_ids["Concepting"],
        "deliverableId": deliv_ids["Static Key Visual"],
        "name": "3 concept routes for hero film",
        "description": "Mood, narrative, casting direction per route.",
        "assigneeUserId": strat1, "priority": "high",
        "plannedStart": "2026-06-08", "plannedEnd": "2026-06-18",
        "dependsOnTaskIds": [t_brief["id"]], "status": "done",
        "estimateHrs": 24, "actualHrs": 27,
        "createdAt": _now(),
    }
    await db.tasks().insert_one(t_concept)

    # Pre-Production
    t_prep = {
        "id": _id(), "projectId": p1, "phaseId": phase_ids["Pre-Production"],
        "deliverableId": None,
        "name": "Scout 2 locations in Bengaluru",
        "description": "Indoor studio + outdoor turf option.",
        "assigneeUserId": lp, "priority": "high",
        "plannedStart": "2026-06-22", "plannedEnd": "2026-06-28",
        "dependsOnTaskIds": [t_concept["id"]], "status": "in_progress",
        "estimateHrs": 16, "actualHrs": 6,
        "createdAt": _now(),
    }
    await db.tasks().insert_one(t_prep)

    subtasks_for_prep = [
        ("Studio site visits", lp,   False, 1),
        ("Permission letters", am,   False, 2),
        ("Vendor quotes",      lp,   True,  3),
    ]
    for name, who, done, order in subtasks_for_prep:
        await db.subtasks().insert_one({
            "id": _id(), "taskId": t_prep["id"], "name": name,
            "assigneeUserId": who, "done": done, "order": order,
            "createdAt": _now(),
        })

    # Shoot
    t_shoot = {
        "id": _id(), "projectId": p1, "phaseId": phase_ids["Shoot"],
        "deliverableId": deliv_ids["60s Hero Film"],
        "name": "3-day production shoot",
        "description": "Hero film + B-roll for cutdowns.",
        "assigneeUserId": lp, "priority": "high",
        "plannedStart": "2026-07-06", "plannedEnd": "2026-07-08",
        "dependsOnTaskIds": [t_prep["id"]], "status": "todo",
        "estimateHrs": 36, "actualHrs": 0,
        "createdAt": _now(),
    }
    await db.tasks().insert_one(t_shoot)

    # Post
    t_edit = {
        "id": _id(), "projectId": p1, "phaseId": phase_ids["Post & Delivery"],
        "deliverableId": deliv_ids["60s Hero Film"],
        "name": "Offline edit — hero cut",
        "description": "First cut of the 60s film.",
        "assigneeUserId": sneha, "priority": "medium",
        "plannedStart": "2026-07-13", "plannedEnd": "2026-07-22",
        "dependsOnTaskIds": [t_shoot["id"]], "status": "todo",
        "estimateHrs": 40, "actualHrs": 0,
        "createdAt": _now(),
    }
    await db.tasks().insert_one(t_edit)

    # ---------- Approvals ----------
    # 1) internal approval — strategy lead reviews concept routes
    await db.approvals().insert_one({
        "id": _id(), "projectId": p1,
        "scope": "internal", "subjectType": "task",
        "subjectId": t_concept["id"],
        "requesterUserId": strat1,
        "reviewerUserIds": [pm],
        "magicLinkToken": None,
        "status": "pending",
        "note": "Picked Route B — please sanity-check before client send.",
        "decidedAt": None, "decidedBy": None,
        "createdAt": _now(),
    })
    # 2) client approval — magic-link for the static key visual
    await db.approvals().insert_one({
        "id": _id(), "projectId": p1,
        "scope": "client", "subjectType": "deliverable",
        "subjectId": deliv_ids["Static Key Visual"],
        "requesterUserId": am,
        "reviewerUserIds": [],
        "magicLinkToken": secrets.token_urlsafe(24),
        "status": "pending",
        "note": "Sharing the key visual for your sign-off.",
        "decidedAt": None, "decidedBy": None,
        "createdAt": _now(),
    })

    # ---------- Holidays ----------
    holiday_docs = [
        {
            "id": _id(), "agencyId": A,
            "date": h["date"], "name": h["name"],
            "dayOfWeek": h["dayOfWeek"], "isWorking": False,
            "createdAt": _now(),
        }
        for h in HOLIDAYS_2026
    ]
    await db.holidays().insert_many(holiday_docs)

    return {
        "ok": True,
        "agencyId": A,
        "counts": {
            "agencies": 1,
            "departments": len(depts),
            "pods": len(pods),
            "users": len(users),
            "clients": len(clients_data),
            "projects": len(project_ids),
            "campaigns": 1,
            "deliverables": len(deliv_specs),
            "phases": len(phase_ids),
            "tasks": 5,
            "subtasks": len(subtasks_for_prep),
            "approvals": 2,
            "holidays": len(holiday_docs),
        },
        "demo_logins": [
            "pm@agency.com / demo123",
            "am@agency.com / demo123",
            "lp@agency.com / demo123",
            "team@agency.com / demo123",
        ],
    }


if __name__ == "__main__":
    result = asyncio.run(run(wipe=True))
    import json
    print(json.dumps(result, indent=2))
