"""
Holidays — preserved from v1, lifted into its own router.
"""
from __future__ import annotations

import uuid
from datetime import datetime as dt
from typing import List

from fastapi import APIRouter, HTTPException

import db
from models import Holiday, HolidayCreate

router = APIRouter()


HOLIDAYS_2026 = [
    {"date": "2026-01-01", "name": "New Year",            "dayOfWeek": "Thu"},
    {"date": "2026-01-02", "name": "Official Holidays",   "dayOfWeek": "Fri"},
    {"date": "2026-01-14", "name": "Sankranti/Pongal",    "dayOfWeek": "Wed"},
    {"date": "2026-01-26", "name": "Republic Day",        "dayOfWeek": "Mon"},
    {"date": "2026-02-15", "name": "Maha Shivaratri",     "dayOfWeek": "Sun"},
    {"date": "2026-03-03", "name": "Holi",                "dayOfWeek": "Tue"},
    {"date": "2026-03-19", "name": "Ugadi",               "dayOfWeek": "Thu"},
    {"date": "2026-03-20", "name": "Eid al-Fitr",         "dayOfWeek": "Fri"},
    {"date": "2026-05-01", "name": "May Day",             "dayOfWeek": "Fri"},
    {"date": "2026-08-15", "name": "Independence Day",    "dayOfWeek": "Sat"},
    {"date": "2026-09-14", "name": "Ganesh Chaturthi",    "dayOfWeek": "Mon"},
    {"date": "2026-10-02", "name": "Gandhi Jayanti",      "dayOfWeek": "Fri"},
    {"date": "2026-10-19", "name": "Vijaya Dashami",      "dayOfWeek": "Mon"},
    {"date": "2026-10-20", "name": "Vijaya Dashami",      "dayOfWeek": "Tue"},
    {"date": "2026-11-01", "name": "Kannada Rajyotsava",  "dayOfWeek": "Sun"},
    {"date": "2026-11-08", "name": "Diwali",              "dayOfWeek": "Sun"},
    {"date": "2026-11-09", "name": "Diwali",              "dayOfWeek": "Mon"},
    {"date": "2026-12-25", "name": "Christmas",           "dayOfWeek": "Fri"},
]


@router.get("/holidays", response_model=List[Holiday])
async def list_holidays(agencyId: str | None = None):
    q: dict = {}
    if agencyId:
        q["agencyId"] = agencyId
    return await db.holidays().find(q, {"_id": 0}).sort("date", 1).to_list(1000)


@router.post("/holidays", response_model=Holiday)
async def create_holiday(body: HolidayCreate):
    date_obj = dt.strptime(body.date, "%Y-%m-%d")
    day_of_week = body.dayOfWeek or date_obj.strftime("%a")
    doc = {
        "id": str(uuid.uuid4()),
        "agencyId": body.agencyId,
        "date": body.date,
        "name": body.name,
        "dayOfWeek": day_of_week,
        "isWorking": False,
        "createdAt": dt.utcnow().isoformat(),
    }
    await db.holidays().insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.patch("/holidays/{holiday_id}", response_model=Holiday)
async def update_holiday(holiday_id: str, patch: dict):
    res = await db.holidays().update_one({"id": holiday_id}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(404, "Holiday not found")
    return await db.holidays().find_one({"id": holiday_id}, {"_id": 0})


@router.delete("/holidays/{holiday_id}")
async def delete_holiday(holiday_id: str):
    res = await db.holidays().delete_one({"id": holiday_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Holiday not found")
    return {"deleted": True}


@router.post("/holidays/seed")
async def seed_holidays(agencyId: str | None = None):
    """Wipe and re-seed the 2026 holiday list."""
    await db.holidays().delete_many({})
    to_insert = [
        {
            "id": str(uuid.uuid4()),
            "agencyId": agencyId,
            "date": h["date"],
            "name": h["name"],
            "dayOfWeek": h["dayOfWeek"],
            "isWorking": False,
            "createdAt": dt.utcnow().isoformat(),
        }
        for h in HOLIDAYS_2026
    ]
    await db.holidays().insert_many(to_insert)
    return {"seeded": len(to_insert)}
