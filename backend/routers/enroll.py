"""POST /enroll — register a known/reference voice for speaker matching.

Implemented in Phase 4 (speaker verification with speechbrain ECAPA-TDNN):
stores the embedding vector (and raw audio for demo purposes) keyed by a
name/ID, then /analyze compares new audio against enrolled voices.
"""

from fastapi import APIRouter

router = APIRouter(tags=["enroll"])


@router.post("/enroll")
async def enroll_voice() -> dict:
    return {
        "status": "not_implemented",
        "message": "/enroll is wired in Phase 4 (speaker verification).",
    }
