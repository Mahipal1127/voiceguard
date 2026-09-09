"""VOICEGUARD — FastAPI backend entrypoint.

Run from the backend/ directory:
    .venv\\Scripts\\python -m uvicorn main:app --reload --port 8000

Prototype constraints (SIH demo): everything runs locally — no paid APIs,
no cloud services. SQLite is used for storage (see db.py).
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import init_db
from routers import analyze, enroll


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Create the SQLite schema once at startup (no-op if it already exists)."""
    init_db()
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
