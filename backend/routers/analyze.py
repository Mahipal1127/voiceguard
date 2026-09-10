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
from services import transcription

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
    "transcription": "active (Phase 3 — faster-whisper base)",
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


def _run_transcription(path: Path) -> dict:
    """Phase 3: faster-whisper transcription with graceful degradation.

    The model is lazy-loaded on first use (services/transcription.py); a
    failure here never fails the whole endpoint — it degrades to a null
    transcript with the error surfaced in pipeline_status / reasons.
    """
    try:
        result = transcription.transcribe(str(path))
    except Exception as exc:  # noqa: BLE001 — pipeline failures are surfaced, not swallowed
        return {"text": None, "language": None, "duration_sec": None, "error": str(exc)}
    return {
        "text": result["text"],
        "language": result["language"],
        "duration_sec": result["duration_sec"],
        "error": None,
    }


@router.post("/warmup")
async def warmup() -> dict:
    """Force-load the transcription model so the first real analysis is fast.

    First call on a fresh machine downloads the base weights (~75 MB) into
    backend/models_store/; later calls are instant.
    """
    try:
        transcription.warmup()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"Model warmup failed: {exc}")
    return {"status": "ready", "model": transcription.DEFAULT_MODEL_SIZE}


@router.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)) -> dict:
    """Intake audio, transcribe it (Phase 3), return the analysis response."""
    path = _save_upload(file)
    duration = _probe_duration_sec(path)

    tr = _run_transcription(path)
    transcript = tr["text"]
    language = tr["language"]
    if tr["duration_sec"]:
        duration = tr["duration_sec"]  # whisper's duration beats container metadata

    reasons = ["Audio received, validated and stored successfully."]
    if tr["error"]:
        reasons.append(f"Transcription failed: {tr['error'][:150]}")
    elif transcript:
        preview = transcript if len(transcript) <= 80 else transcript[:80] + "…"
        reasons.append(f"Transcript generated ({language}, faster-whisper base): '{preview}'")
    else:
        reasons.append("No speech detected in the clip.")
    reasons.append(
        "Scoring placeholder — speaker/AI-voice/behavior signals and the risk engine land in Phases 4-7."
    )

    pipeline_status = dict(PIPELINE_STATUS)
    if tr["error"]:
        pipeline_status["transcription"] = f"error: {tr['error'][:120]}"
    elif not transcript:
        pipeline_status["transcription"] = "active (no speech detected)"

    analysis_id: int | None = None
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO analyses (audio_filename, duration_sec, transcript, decision, reasons, details) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                path.name,
                duration,
                transcript,
                "PENDING",
                json.dumps(reasons),
                json.dumps({
                    "pipeline_status": pipeline_status,
                    "transcription": {"language": language, "duration_sec": tr["duration_sec"]},
                }),
            ),
        )
        analysis_id = cur.lastrowid

    return {
        "analysis_id": analysis_id,
        "status": "error" if tr["error"] else ("no_speech" if not transcript else "transcribed"),
        "audio": {"filename": path.name, "duration_sec": duration},
        "transcript": transcript,
        "language": language,
        "signals": {
            "speaker_match_pct": None,
            "ai_voice_risk_pct": None,
            "behavior_risk_pct": None,
        },
        "overall_risk_pct": None,
        "decision": "PENDING",
        "reasons": reasons,
        "pipeline_status": pipeline_status,
    }
