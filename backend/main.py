"""VOICEGUARD — FastAPI backend entrypoint.

Run from the backend/ directory:
    .venv\\Scripts\\python -m uvicorn main:app --reload --port 8000

Prototype constraints (SIH demo): everything runs locally — no paid APIs,
no cloud services. SQLite is used for storage (see db.py).
"""

from contextlib import asynccontextmanager
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import init_db
from routers import analyze, enroll


def _prewarm_models() -> None:
    """Load all ML models in a background thread at startup.

    Without this, the FIRST analysis after a restart pays ~100 s of model
    loading, which looks like a hang in the UI. The services are thread-safe
    (lazy singletons under locks), so warming here is safe.
    """
    from services import ai_voice_detection, speaker_verification, transcription

    for module in (transcription, speaker_verification, ai_voice_detection):
        try:
            module.warmup()
        except Exception:  # noqa: BLE001 — a failed warmup degrades per-signal, never crashes startup
            pass


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Create the SQLite schema once at startup (no-op if it already exists)."""
    init_db()
    threading.Thread(target=_prewarm_models, name="voiceguard-prewarm", daemon=True).start()
    yield


app = FastAPI(title="VOICEGUARD API", version="0.1.0", lifespan=lifespan)

# Only the local Vite dev/preview servers call this API in prototype mode.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router)
app.include_router(enroll.router)


@app.get("/health")
def health() -> dict:
    """Liveness probe used by the frontend status indicator (Phase 1)."""
    return {"status": "ok", "service": "voiceguard-backend", "version": "0.1.0"}
