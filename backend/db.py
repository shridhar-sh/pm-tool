"""
Shared Mongo client + collection accessors.

Reads MONGO_URL / DB_NAME from the env (same as v1).
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

load_dotenv(Path(__file__).parent / ".env")

_MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_DB_NAME = os.environ.get("DB_NAME", "agencypm")

_client: AsyncIOMotorClient = AsyncIOMotorClient(_MONGO_URL)
db: AsyncIOMotorDatabase = _client[_DB_NAME]


# Collection accessors — single source of truth for collection names.
def agencies():     return db["agencies"]
def departments():  return db["departments"]
def pods():         return db["pods"]
def users():        return db["users"]
def clients():      return db["clients"]
def projects():     return db["projects"]
def campaigns():    return db["campaigns"]
def deliverables(): return db["deliverables"]
def phases():       return db["phases"]
def tasks():        return db["tasks"]
def subtasks():     return db["subtasks"]
def approvals():    return db["approvals"]
def rounds():       return db["rounds"]
def holidays():    return db["holidays"]


async def ensure_indexes() -> None:
    """Idempotent — safe to run on every startup."""
    await departments().create_index("agencyId")
    await pods().create_index("agencyId")
    await users().create_index("agencyId")
    await users().create_index("email")
    await users().create_index("employeeId")
    await clients().create_index("agencyId")
    await projects().create_index("agencyId")
    await projects().create_index("clientId")
    await campaigns().create_index("projectId")
    await deliverables().create_index("projectId")
    await deliverables().create_index("campaignId")
    await phases().create_index("projectId")
    await tasks().create_index("projectId")
    await tasks().create_index("phaseId")
    await tasks().create_index("assigneeUserId")
    await subtasks().create_index("taskId")
    await approvals().create_index("projectId")
    await approvals().create_index("magicLinkToken")
    await rounds().create_index("deliverableId")
    await holidays().create_index("date")


def close_client() -> None:
    _client.close()
