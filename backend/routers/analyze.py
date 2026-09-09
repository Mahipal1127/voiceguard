"""POST /analyze — the core pipeline endpoint.

Phase 2 wires up multipart audio intake and returns a placeholder result so
the frontend can render against the response shape. Phases 3-7 then layer in
transcription, speaker verification, AI-voice detection, behavior analysis
and the risk engine.
"""

from fastapi import APIRouter

router = APIRouter(tags=["analyze"])


@router.post("/analyze")
async def analyze_audio() -> dict:
    # Phase 2: accept multipart audio (record live or upload), save to a
    # temp location, and return a placeholder analysis result.
    return {
        "status": "not_implemented",
        "message": "/analyze is wired in Phase 2 (audio capture + upload).",
    }
