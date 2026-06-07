"""
File-storage adapter.

Local-disk implementation now; the StorageAdapter interface is the only
contract M4+ needs to honor when we swap to S3/R2/blob storage.
"""
from __future__ import annotations

import mimetypes
import re
import uuid
from pathlib import Path
from typing import Optional

from fastapi import UploadFile


# Directory siblings of this file: backend/uploads/
UPLOAD_ROOT: Path = Path(__file__).parent / "uploads"


def ensure_upload_dir() -> Path:
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    return UPLOAD_ROOT


_SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_filename(name: str) -> str:
    """Lower-risk filename: strip path components, replace odd chars."""
    base = Path(name).name or "file"
    base = _SAFE_FILENAME_RE.sub("_", base)
    # cap length so OS path limits don't bite us
    if len(base) > 120:
        stem = Path(base).stem[:100]
        suffix = Path(base).suffix[:20]
        base = f"{stem}{suffix}"
    return base or "file"


class LocalStorage:
    """Save uploads to backend/uploads/ and expose them via /files/<stored>."""

    public_prefix = "/files"

    def __init__(self, root: Optional[Path] = None) -> None:
        self.root: Path = root or UPLOAD_ROOT
        self.root.mkdir(parents=True, exist_ok=True)

    async def save(self, upload: UploadFile, uploaded_by: Optional[str] = None) -> dict:
        """
        Read the UploadFile in chunks (no full-file in memory) and persist
        under a uuid prefix to avoid collisions. Returns an Attachment-shaped
        dict that the caller can append to CreativeRound.files.
        """
        safe = _safe_filename(upload.filename or "file")
        stored = f"{uuid.uuid4().hex}_{safe}"
        target = self.root / stored

        size = 0
        # Stream chunks; UploadFile is backed by a SpooledTemporaryFile.
        await upload.seek(0)
        with target.open("wb") as out:
            while True:
                chunk = await upload.read(1024 * 1024)  # 1 MiB
                if not chunk:
                    break
                out.write(chunk)
                size += len(chunk)

        mime = upload.content_type or mimetypes.guess_type(safe)[0]

        return {
            "id": str(uuid.uuid4()),
            "name": upload.filename or safe,
            "url": f"{self.public_prefix}/{stored}",
            "sizeBytes": size,
            "mimeType": mime,
            "uploadedByUserId": uploaded_by,
        }

    def delete(self, url: str) -> bool:
        """Best-effort: remove the file backing a stored URL."""
        if not url.startswith(self.public_prefix + "/"):
            return False
        stored = url[len(self.public_prefix) + 1:]
        # Disallow path escapes.
        if "/" in stored or "\\" in stored or stored.startswith(".."):
            return False
        path = self.root / stored
        try:
            if path.exists():
                path.unlink()
                return True
        except OSError:
            return False
        return False


# Singleton — swap implementation here when moving off disk.
storage: LocalStorage = LocalStorage()
