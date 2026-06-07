"""
Creative rounds + file attachments + send-to-client (magic-link).

A round groups creative assets (cuts, statics, mockups) for one delivery.
Rounds belong to a Deliverable. Status moves through:
   draft -> internal_review -> client_review -> approved | revisions_requested
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, Form

import db
from models import (
    CreativeRound, CreativeRoundCreate, CreativeRoundUpdate,
    SendToClientBody, ROUND_STATUSES,
)
from storage import storage

router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ------------------ Rounds ------------------

@router.get("/deliverables/{deliverable_id}/rounds", response_model=List[CreativeRound])
async def list_rounds(deliverable_id: str):
    cur = db.rounds().find({"deliverableId": deliverable_id}, {"_id": 0}).sort("roundNumber", 1)
    return await cur.to_list(200)


@router.get("/rounds/{round_id}", response_model=CreativeRound)
async def get_round(round_id: str):
    doc = await db.rounds().find_one({"id": round_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Round not found")
    return doc


@router.post("/rounds", response_model=CreativeRound)
async def create_round(body: CreativeRoundCreate):
    # Confirm deliverable exists.
    deliv = await db.deliverables().find_one({"id": body.deliverableId}, {"_id": 0})
    if not deliv:
        raise HTTPException(404, "Deliverable not found")

    # Auto-assign round number = max existing + 1.
    if body.roundNumber is None:
        existing = await db.rounds().find(
            {"deliverableId": body.deliverableId}, {"_id": 0, "roundNumber": 1}
        ).to_list(200)
        next_num = (max((r.get("roundNumber", 0) for r in existing), default=0) or 0) + 1
    else:
        next_num = body.roundNumber

    obj = CreativeRound(
        deliverableId=body.deliverableId,
        roundNumber=next_num,
        notes=body.notes,
        internalReviewerUserIds=body.internalReviewerUserIds,
        createdByUserId=body.createdByUserId,
    )
    await db.rounds().insert_one(obj.model_dump())
    return obj


@router.patch("/rounds/{round_id}", response_model=CreativeRound)
async def update_round(round_id: str, patch: CreativeRoundUpdate):
    data = {k: v for k, v in patch.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "No update data provided")
    if "status" in data and data["status"] not in ROUND_STATUSES:
        raise HTTPException(400, f"status must be one of {ROUND_STATUSES}")
    res = await db.rounds().update_one({"id": round_id}, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(404, "Round not found")
    return await db.rounds().find_one({"id": round_id}, {"_id": 0})


@router.delete("/rounds/{round_id}")
async def delete_round(round_id: str):
    doc = await db.rounds().find_one({"id": round_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Round not found")
    # Clean up files on disk best-effort.
    for f in doc.get("files", []) or []:
        try:
            storage.delete(f.get("url", ""))
        except Exception:
            pass
    await db.rounds().delete_one({"id": round_id})
    # Cancel any linked approvals so they stop appearing in queues.
    for fld in ("clientApprovalId", "internalApprovalId"):
        aid = doc.get(fld)
        if aid:
            await db.approvals().update_one(
                {"id": aid, "status": "pending"},
                {"$set": {"status": "cancelled"}},
            )
    return {"deleted": True}


# ------------------ File attachments ------------------

@router.post("/rounds/{round_id}/files", response_model=CreativeRound)
async def upload_file_to_round(
    round_id: str,
    file: UploadFile = File(...),
    uploadedByUserId: Optional[str] = Form(default=None),
):
    rnd = await db.rounds().find_one({"id": round_id}, {"_id": 0})
    if not rnd:
        raise HTTPException(404, "Round not found")

    attachment = await storage.save(file, uploaded_by=uploadedByUserId)
    attachment["uploadedAt"] = _now()

    files = (rnd.get("files") or []) + [attachment]
    await db.rounds().update_one({"id": round_id}, {"$set": {"files": files}})
    return await db.rounds().find_one({"id": round_id}, {"_id": 0})


@router.delete("/rounds/{round_id}/files/{file_id}", response_model=CreativeRound)
async def remove_file_from_round(round_id: str, file_id: str):
    rnd = await db.rounds().find_one({"id": round_id}, {"_id": 0})
    if not rnd:
        raise HTTPException(404, "Round not found")
    keep = []
    removed = None
    for f in rnd.get("files") or []:
        if f.get("id") == file_id:
            removed = f
            continue
        keep.append(f)
    if removed is None:
        raise HTTPException(404, "File not found")
    storage.delete(removed.get("url", ""))
    await db.rounds().update_one({"id": round_id}, {"$set": {"files": keep}})
    return await db.rounds().find_one({"id": round_id}, {"_id": 0})


# ------------------ Send to client (magic-link) ------------------

@router.post("/rounds/{round_id}/send-to-client", response_model=CreativeRound)
async def send_round_to_client(round_id: str, body: SendToClientBody):
    rnd = await db.rounds().find_one({"id": round_id}, {"_id": 0})
    if not rnd:
        raise HTTPException(404, "Round not found")
    deliv = await db.deliverables().find_one({"id": rnd["deliverableId"]}, {"_id": 0})
    if not deliv:
        raise HTTPException(404, "Linked deliverable not found")

    # If a pending client approval already exists for this round, return it
    # instead of issuing a duplicate.
    existing_id = rnd.get("clientApprovalId")
    if existing_id:
        existing = await db.approvals().find_one({"id": existing_id}, {"_id": 0})
        if existing and existing.get("status") == "pending":
            return rnd

    token = secrets.token_urlsafe(24)
    approval = {
        "id": secrets.token_hex(16),  # short, opaque
        "projectId": deliv["projectId"],
        "scope": "client",
        "subjectType": "creative_round",
        "subjectId": round_id,
        "requesterUserId": body.requesterUserId,
        "reviewerUserIds": [],
        "magicLinkToken": token,
        "status": "pending",
        "note": body.note,
        "decidedAt": None,
        "decidedBy": None,
        "createdAt": _now(),
    }
    await db.approvals().insert_one(approval)
    await db.rounds().update_one(
        {"id": round_id},
        {"$set": {
            "clientApprovalId": approval["id"],
            "clientMagicLinkToken": token,
            "status": "client_review",
        }},
    )
    return await db.rounds().find_one({"id": round_id}, {"_id": 0})
