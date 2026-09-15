"""Local database access for VOICEGUARD.

Prototype scope: SQLite (zero-setup, file-based, lives next to the backend
code). The schema is plain SQL — swapping to PostgreSQL later only requires
changing the connection helpers in this file, not the rest of the app.
"""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

# Override with VOICEGUARD_DB_PATH when the DB lives on a mounted volume
# (e.g. Railway/HF persistent storage) — otherwise it sits next to the code.
DB_PATH = Path(
    os.environ.get("VOICEGUARD_DB_PATH")
    or (Path(__file__).resolve().parent / "voiceguard.db")
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS enrolled_voices (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL UNIQUE,
    embedding_path TEXT NOT NULL,   -- JSON file holding the ECAPA-TDNN vector (Phase 4)
    audio_path     TEXT,            -- raw reference audio kept for demo purposes
    sample_rate    INTEGER,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analyses (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    audio_filename    TEXT,
    duration_sec      REAL,
    transcript        TEXT,
    speaker_match_pct REAL,   -- 0-100, NULL when no reference voice is enrolled (unknown/neutral)
    ai_voice_risk_pct REAL,   -- 0-100 (Phase 5)
    behavior_risk_pct REAL,   -- 0-100 (Phase 6)
    overall_risk_pct  REAL,   -- 0-100 (Phase 7)
    decision          TEXT,   -- ALLOW | WARN | VERIFY | BLOCK
    reasons           TEXT,   -- JSON array of human-readable explanations
    details           TEXT,   -- JSON blob with full per-signal details
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    """Open a connection, commit on success, always close."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Create tables if they do not exist. Called once at app startup."""
    with db() as conn:
        conn.executescript(_SCHEMA)


if __name__ == "__main__":
    init_db()
    print(f"Database initialised at {DB_PATH}")
