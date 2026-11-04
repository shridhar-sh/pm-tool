"""Serve the built frontend with the API for local browser tests only."""
from pathlib import Path
from fastapi.responses import FileResponse
from backend.server import app

BUILD = Path(__file__).resolve().parents[2] / "frontend" / "build"


@app.get("/{path:path}")
async def frontend(path: str):
    target = (BUILD / path).resolve()
    if not target.is_relative_to(BUILD.resolve()) or not target.is_file():
        target = BUILD / "index.html"
    return FileResponse(target)
