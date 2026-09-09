"""POST /analyze — the core pipeline endpoint.

Phase 2 scope: accept multipart audio (live recording or file upload),
validate it, persist it temporarily, and return a placeholder response
shaped like the final analysis result so the frontend can render against
it. No scores are faked — signals are null until their phases land.

Phases 3-7 fill in: transcription (faster-whisper), speaker verification
(ECAPA-TDNN), AI-voice detection, behavior analysis, risk engine.
"""

import json
import subprocess
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from db import db

router = APIRouter(tags=["analyze"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "tmp_uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB — generous for 10-30 s clips
ALLOWED_SUFFIXES = {".wav", ".mp3", ".webm", ".ogg", ".m4a", ".flac"}

# MediaRecorder in Chromium emits webm/opus; Safari emits mp4. These map a
# content-type to a suffix when the client filename has no usable extension.
CONTENT_TYPE_FALLBACKS = {
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/flac": ".flac",
}

PIPELINE_STATUS = {
    "transcription": "planned (Phase 3 — faster-whisper)",
    "speaker_match": "planned (Phase 4 — ECAPA-TDNN)",
    "ai_voice_detection": "planned (Phase 5)",
    "behavior_analysis": "planned (Phase 6)",
    "risk_engine": "planned (Phase 7)",
}


def _probe_duration_sec(path: Path) -> float | None:
    """Duration via ffprobe (ffmpeg is a documented system prerequisite).

    Returns None when ffprobe is unavailable or the container has no
    computable duration — duration is treated as optional metadata.
    """
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "json", str(path),
            ],
            capture_output=True, text=True, timeout=15, check=False,
        )
        if out.returncode != 0:
            return None
        return float(json.loads(out.stdout)["format"]["duration"])
    except Exception:
        return None


def _save_upload(file: UploadFile) -> Path:
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

    dest = UPLOAD_DIR / f"{time.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}{suffix}"
    dest.write_bytes(data)
    return dest


@router.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)) -> dict:
    """Intake audio and return the placeholder analysis response."""
    path = _save_upload(file)
    duration = _probe_duration_sec(path)

    analysis_id: int | None = None
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO analyses (audio_filename, duration_sec, decision, reasons, details) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                path.name,
                duration,
                "PENDING",
                json.dumps([
                    "Audio received, validated and stored successfully.",
                    "Placeholder response — ML signals are wired in Phases 3-7.",
                ]),
                json.dumps({"pipeline_status": PIPELINE_STATUS}),
            ),
        )
        analysis_id = cur.lastrowid

    return {
        "analysis_id": analysis_id,
        "status": "placeholder",
        "audio": {"filename": path.name, "duration_sec": duration},
        "transcript": None,
        "signals": {
            "speaker_match_pct": None,
            "ai_voice_risk_pct": None,
            "behavior_risk_pct": None,
        },
        "overall_risk_pct": None,
        "decision": "PENDING",
        "reasons": [
            "Audio received, validated and stored successfully.",
            "Placeholder response — ML signals are wired in Phases 3-7.",
        ],
        "pipeline_status": PIPELINE_STATUS,
    }
