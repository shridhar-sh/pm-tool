"""
Agency / Department / Pod / User / Client CRUD.
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException

import db
from models import (
    Agency, AgencyCreate,
    Department, DepartmentCreate,
    Pod, PodCreate,
    User, UserCreate,
    Client, ClientCreate,
)

router = APIRouter()


# ------------------ Agencies ------------------

@router.get("/agencies", response_model=List[Agency])
async def list_agencies():
    return await db.agencies().find({}, {"_id": 0}).to_list(100)


@router.post("/agencies", response_model=Agency)
async def create_agency(body: AgencyCreate):
    obj = Agency(**body.model_dump())
    await db.agencies().insert_one(obj.model_dump())
    return obj


@router.get("/agencies/{agency_id}", response_model=Agency)
async def get_agency(agency_id: str):
    doc = await db.agencies().find_one({"id": agency_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Agency not found")
    return doc


# ------------------ Departments ------------------

@router.get("/departments", response_model=List[Department])
async def list_departments(agencyId: str | None = None):
    q = {"agencyId": agencyId} if agencyId else {}
    return await db.departments().find(q, {"_id": 0}).sort("order", 1).to_list(500)


@router.post("/departments", response_model=Department)
async def create_department(body: DepartmentCreate):
    obj = Department(**body.model_dump())
    await db.departments().insert_one(obj.model_dump())
    return obj


@router.patch("/departments/{dept_id}", response_model=Department)
async def update_department(dept_id: str, patch: dict):
    res = await db.departments().update_one({"id": dept_id}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(404, "Department not found")
    return await db.departments().find_one({"id": dept_id}, {"_id": 0})


@router.delete("/departments/{dept_id}")
async def delete_department(dept_id: str):
    res = await db.departments().delete_one({"id": dept_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Department not found")
    return {"deleted": True}


# ------------------ Pods ------------------

@router.get("/pods", response_model=List[Pod])
async def list_pods(agencyId: str | None = None, departmentId: str | None = None):
    q: dict = {}
    if agencyId:
        q["agencyId"] = agencyId
    if departmentId:
        q["departmentId"] = departmentId
    return await db.pods().find(q, {"_id": 0}).to_list(500)


@router.post("/pods", response_model=Pod)
async def create_pod(body: PodCreate):
    obj = Pod(**body.model_dump())
    await db.pods().insert_one(obj.model_dump())
    return obj


@router.patch("/pods/{pod_id}", response_model=Pod)
async def update_pod(pod_id: str, patch: dict):
    res = await db.pods().update_one({"id": pod_id}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(404, "Pod not found")
    return await db.pods().find_one({"id": pod_id}, {"_id": 0})


@router.delete("/pods/{pod_id}")
async def delete_pod(pod_id: str):
    res = await db.pods().delete_one({"id": pod_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Pod not found")
    return {"deleted": True}


# ------------------ Users ------------------

@router.get("/users", response_model=List[User])
async def list_users(
    agencyId: str | None = None,
    podId: str | None = None,
    departmentId: str | None = None,
    role: str | None = None,
    active: bool | None = None,
):
    q: dict = {}
    if agencyId:     q["agencyId"] = agencyId
    if podId:        q["podId"] = podId
    if departmentId: q["departmentId"] = departmentId
    if role:         q["role"] = role
    if active is not None: q["active"] = active
    return await db.users().find(q, {"_id": 0}).to_list(2000)


@router.get("/users/by-email/{email}", response_model=User)
async def get_user_by_email(email: str):
    doc = await db.users().find_one({"email": email}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "User not found")
    return doc


@router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    doc = await db.users().find_one({"id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "User not found")
    return doc


@router.post("/users", response_model=User)
async def create_user(body: UserCreate):
    obj = User(**body.model_dump())
    await db.users().insert_one(obj.model_dump())
    return obj


@router.patch("/users/{user_id}", response_model=User)
async def update_user(user_id: str, patch: dict):
    res = await db.users().update_one({"id": user_id}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(404, "User not found")
    return await db.users().find_one({"id": user_id}, {"_id": 0})


@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    res = await db.users().delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "User not found")
    return {"deleted": True}


# ------------------ Clients ------------------

@router.get("/clients", response_model=List[Client])
async def list_clients(agencyId: str | None = None, status: str | None = None):
    q: dict = {}
    if agencyId: q["agencyId"] = agencyId
    if status:   q["status"] = status
    return await db.clients().find(q, {"_id": 0}).to_list(2000)


@router.get("/clients/{client_id}", response_model=Client)
async def get_client(client_id: str):
    doc = await db.clients().find_one({"id": client_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Client not found")
    return doc


@router.post("/clients", response_model=Client)
async def create_client(body: ClientCreate):
    obj = Client(**body.model_dump())
    await db.clients().insert_one(obj.model_dump())
    return obj


@router.patch("/clients/{client_id}", response_model=Client)
async def update_client(client_id: str, patch: dict):
    res = await db.clients().update_one({"id": client_id}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(404, "Client not found")
    return await db.clients().find_one({"id": client_id}, {"_id": 0})


@router.delete("/clients/{client_id}")
async def delete_client(client_id: str):
    res = await db.clients().delete_one({"id": client_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Client not found")
    return {"deleted": True}
