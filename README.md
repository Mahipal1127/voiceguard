# VOICEGUARD

**AI-powered voice-clone impersonation detection for phone / voice-call scenarios.**
Smart India Hackathon prototype — Team TRUETONE.

> **Status:** Phase 2 (audio capture & upload) — record with the microphone or
> upload a clip and get a structured (placeholder) analysis response. The ML
> pipeline (transcription, speaker verification, AI-voice detection, behavior
> analysis, risk engine) is added phase by phase. The roadmap is shown on the
> app homepage.

## Architecture (single monorepo)

```
backend/       FastAPI + local ML — no paid APIs, no cloud services
frontend/      React + Vite + TypeScript + Tailwind CSS
demo_samples/  Pre-recorded genuine / fake clips for the live demo
```

## Prerequisites

- Python 3.10+ (3.14 verified working for Phase 1; ML stack validated in Phase 3)
- Node.js 18+
- ffmpeg on PATH (audio decoding — required by the speech stack from Phase 3)

## Run the backend (Phase 1)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn main:app --reload --port 8000
# -> http://127.0.0.1:8000/health
```

## Run the frontend (Phase 1)

```powershell
cd frontend
npm install
npm run dev
# -> http://localhost:5173
```

## Run both at once (dev helper)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start_all.ps1
```

## Notes

- Everything runs locally during the demo — no cloud APIs, no signup-required SDKs.
- Database: SQLite file at `backend/voiceguard.db` (auto-created at startup).
- ML model weights download on first use into `backend/models_store/` (gitignored);
  download sizes are stated before each install.
- Full setup + troubleshooting guide (incl. ffmpeg) lands in Phase 10.
