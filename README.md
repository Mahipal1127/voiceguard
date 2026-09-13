# VOICEGUARD

**AI-powered voice-clone impersonation detection for phone / voice-call scenarios.**
Smart India Hackathon prototype — Team TRUETONE.

> **Status:** Phase 7 (risk engine) — the full pipeline is live end-to-end:
> transcript + speaker match + AI-voice risk + behavior analysis -> one
> explainable 0-100 score and an ALLOW / WARN / VERIFY / BLOCK decision
> (doc example reproduces 88 / BLOCK). Phases 8-10 are demo polish.

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
- Speech-to-text: faster-whisper `base` (~75 MB, auto-downloads on first use).
  `POST http://127.0.0.1:8000/warmup` preloads the model so the first analysis is fast.
- AI-voice detection: wav2vec2 anti-spoofing classifier `mo-thecreator/Deepfake-audio-detection`
  (~360 MB, Apache-2.0; 3-model bake-off evidence in `model-compare-results.json`).
  A transparent heuristic estimate (spectral flatness / noise floor / ZCR) is always reported
  alongside and used as the labeled fallback if the model fails. Honest limits: this is
  decision support, not proof — no detection is 100% accurate.
- Speaker verification: speechbrain ECAPA-TDNN (~80 MB + PyTorch CPU, downloads on
  first use). Enroll a reference voice on the **Enroll** page; analyses then report a
  "Speaker Match %" (calibrated cosine mapping; unknown/neutral when nothing is enrolled).
  Windows note: without Developer Mode the model is materialized by file copy instead
  of symlinks (handled automatically).
- Behavior analysis: rule-based regex matcher (urgency, financial, authority,
  isolation, callback-blocking, OTP/PIN) with documented weights — see
  `backend/services/behavior_analysis.py`. Whisper's "lakh"→"lock" mishearing
  is handled in the amount patterns.
- Risk engine: documented weights (base = 100 - speaker match, or a neutral 50
  when nothing is enrolled; AI-voice weight 40 with a +5 model/heuristic
  disagreement penalty; behavior weight 35) plus two explicit Section-11 rules:
  behavior >= 80 floors the score at VERIFY, and AI-voice >= 60 + behavior >= 60
  escalates to 88 (BLOCK) even with a convincing speaker match. Thresholds are
  fixed: 0-29 ALLOW, 30-59 WARN, 60-79 VERIFY, 80-100 BLOCK. See
  `backend/services/risk_engine.py`.
- Full setup + troubleshooting guide (incl. ffmpeg) lands in Phase 10.
