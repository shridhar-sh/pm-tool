"""
AgencyPM v2 — FastAPI entrypoint.

server.py is intentionally thin: app + middleware + router mounts + lifespan.
All endpoint logic lives in routers/.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

import db
from routers import capacity as capacity_router
from routers import holidays as holidays_router
from routers import org as org_router
from routers import projects as projects_router
from routers import rounds as rounds_router
from routers import tasks as tasks_router
from routers import time as time_router
from storage import ensure_upload_dir

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_upload_dir()
    await db.ensure_indexes()
    logger.info("AgencyPM v2 backend ready")
    yield
    db.close_client()


app = FastAPI(title="AgencyPM API", version="2.0.0", lifespan=lifespan)

api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"message": "AgencyPM API v2", "ok": True}


@api.get("/health")
async def health():
    return {"status": "healthy"}


# ---- Mount feature routers ----
api.include_router(org_router.router,       tags=["org"])
api.include_router(projects_router.router,  tags=["projects"])
api.include_router(tasks_router.router,     tags=["tasks"])
api.include_router(rounds_router.router,    tags=["rounds"])
api.include_router(time_router.router,      tags=["time"])
api.include_router(capacity_router.router,  tags=["capacity"])
api.include_router(holidays_router.router,  tags=["holidays"])


# ---- Admin (seed) — wired here to avoid import cycles ----
import seed as seed_module


@api.post("/admin/seed")
async def run_seed(wipe: bool = True):
    """Run the dev seed. POST /api/admin/seed?wipe=true."""
    result = await seed_module.run(wipe=wipe)
    return result


@api.post("/admin/wipe")
async def wipe_collections():
    """Drop the v2 collections — dev convenience."""
    return await seed_module.wipe_all()


app.include_router(api)

# Serve uploaded assets so the frontend can render images/videos inline.
# Mounted under /files (not /api/files) so it sits next to the API surface
# but isn't subject to /api prefixing.
app.mount("/files", StaticFiles(directory=str(ensure_upload_dir())), name="files")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
