"""POST /enroll — register a known/reference voice (Phase 4).

Stores the ECAPA-TDNN embedding (JSON) and the raw clip in
backend/enrolled_voices/ (gitignored, demo data only) plus a row in the
enrolled_voices table. Re-enrolling the same name replaces the previous
reference — friendlier for demo re-takes.
"""

import json
import re
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from db import db
from services import speaker_verification

router = APIRouter(tags=["enroll"])

VOICES_DIR = Path(__file__).resolve().parent.parent / "enrolled_voices"
VOICES_DIR.mkdir(exist_ok=True)

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
ALLOWED_SUFFIXES = {".wav", ".mp3", ".webm", ".ogg", ".m4a", ".flac"}
CONTENT_TYPE_FALLBACKS = {
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/flac": ".flac",
}


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "voice"


def _save_upload(file: UploadFile, name: str) -> Path:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        ctype = (file.content_type or "").split(";")[0].strip().lower()
        suffix = CONTENT_TYPE_FALLBACKS.get(ctype, "")
    if not suffix:
        raise HTTPException(
            status_code=400,
            detail="Unsupported audio type. Use .wav, .mp3, .webm, .ogg, .m4a or .flac.",
        )
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (25 MB max).")
    dest = VOICES_DIR / f"{_slug(name)}-{time.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}{suffix}"
    dest.write_bytes(data)
    return dest


@router.get("/enroll")
async def list_enrollments() -> list[dict]:
    """Enrolled reference voices (used by the Enroll page)."""
    with db() as conn:
        rows = conn.execute("SELECT id, name, created_at FROM enrolled_voices ORDER BY id").fetchall()
    return [{"id": r["id"], "name": r["name"], "created_at": r["created_at"]} for r in rows]


@router.post("/enroll")
async def enroll_voice(name: str = Form(...), file: UploadFile = File(...)) -> dict:
    """Extract the ECAPA-TDNN embedding of `file` and store it as the
    reference voice for `name` (replacing any previous enrollment)."""
    clean_name = name.strip()
    if not clean_name or len(clean_name) > 80:
        raise HTTPException(status_code=400, detail="Provide a display name (1-80 characters).")

    audio_path = _save_upload(file, clean_name)
    wav16 = None
    try:
        wav16 = speaker_verification.prepare_16k_mono(str(audio_path))
        embedding = speaker_verification.extract_embedding(str(wav16))
    except Exception as exc:  # noqa: BLE001
        audio_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Embedding extraction failed: {exc}") from exc
    finally:
        if wav16 is not None:
            wav16.unlink(missing_ok=True)

    embedding_path = VOICES_DIR / f"{_slug(clean_name)}-{uuid.uuid4().hex[:8]}.embedding.json"
    embedding_path.write_text(
        json.dumps(
            {
                "name": clean_name,
                "model": speaker_verification.MODEL_ID,
                "dimensions": len(embedding),
                "embedding": embedding,
            }
        )
    )

    with db() as conn:
        old = conn.execute(
            "SELECT id, embedding_path, audio_path FROM enrolled_voices WHERE name = ?", (clean_name,)
        ).fetchone()
        if old is not None:
            for stale in (old["embedding_path"], old["audio_path"]):
                if stale:
                    Path(stale).unlink(missing_ok=True)
            conn.execute("DELETE FROM enrolled_voices WHERE id = ?", (old["id"],))
        cur = conn.execute(
            "INSERT INTO enrolled_voices (name, embedding_path, audio_path, sample_rate) VALUES (?, ?, ?, ?)",
            (clean_name, str(embedding_path), str(audio_path), 16000),
        )
        enrollment_id = cur.lastrowid

    return {
        "enrollment_id": enrollment_id,
        "name": clean_name,
        "dimensions": len(embedding),
        "audio_file": audio_path.name,
        "message": f"Reference voice '{clean_name}' enrolled — new clips will be compared against it.",
    }
