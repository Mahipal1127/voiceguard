# VOICEGUARD

**AI-powered voice-clone impersonation detection for phone / voice-call scenarios.**
Smart India Hackathon prototype — Team TRUETONE.

Record or upload a voice clip → VOICEGUARD analyses it across three signals —
speaker identity match, AI-voice (deepfake) likelihood and suspicious-request
language — and returns one explainable 0-100 risk score with an
**ALLOW / WARN / VERIFY / BLOCK** decision. Everything runs locally; no paid
APIs, no cloud services, no signup-required SDKs.

> **Status:** complete (Phases 1-10). For the live presentation follow
> **`DEMO_SCRIPT.md`** — a 3-minute, 3-scenario run sheet (ALLOW / VERIFY /
> BLOCK) with prep checklist and fallbacks.

## Architecture (single monorepo)

```
backend/
  main.py                     FastAPI app: /health, CORS, routers, DB init
  db.py                       SQLite (enrolled_voices, analyses) — swap point for Postgres
  routers/analyze.py          POST /analyze — full pipeline; POST /warmup
  routers/enroll.py           POST/GET /enroll — reference voices
  services/
    transcription.py          faster-whisper base, CPU int8 (STT)
    speaker_verification.py   speechbrain ECAPA-TDNN (Speaker Match %)
    ai_voice_detection.py     wav2vec2 anti-spoofing + labeled heuristic
    behavior_analysis.py      rule-based suspicious-request matcher
    risk_engine.py            weighted score + fixed decision thresholds
  models_store/               downloaded weights (gitignored)
  enrolled_voices/            reference embeddings + audio (gitignored)
  tmp_uploads/                uploaded/recorded clips (gitignored)
frontend/                     React + Vite + TypeScript + Tailwind CSS
  src/pages/                  OverviewPage, RecordPage, ResultPage, EnrollPage
  src/components/             AudioRecorder, RiskGauge, SignalBreakdown, BuildRoadmap
  src/api/client.ts           typed backend client (VITE_API_URL override)
demo_samples/                 cloned-voice clip + instructions for the two
                              real-voice recordings (see its README)
DEMO_SCRIPT.md                click-by-click 3-minute run sheet
```

## Prerequisites

- **Python 3.10+** — 3.14 verified working (PyTorch 2.14 / CTranslate2 4.8 /
  transformers 5.x all ship 3.14-compatible wheels)
- **Node.js 18+** (26 verified)
- **ffmpeg + ffprobe on PATH** — audio decode/probe for the whole stack.
  Windows: `winget install Gyan.FFmpeg` (or the gyan.dev full build), then
  reopen the terminal and check `ffmpeg -version`.

## Install & run (fresh machine, ~15 min excluding model downloads)

Backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn main:app --reload --port 8000
# -> http://127.0.0.1:8000/health
```

Frontend (second terminal):

```powershell
cd frontend
npm install
npm run dev
# -> http://localhost:5173
```

Or both at once (hidden windows): `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start_all.ps1`

Then open **http://localhost:5173** — the Overview page shows "Backend online".

## ML models — downloads & caching

Weights download automatically on first use into `backend/models_store/`
(gitignored). Sizes and where each is used:

| Model | Size | Used by |
|---|---|---|
| faster-whisper `base` (CTranslate2) | ~75 MB | transcription |
| speechbrain `spkrec-ecapa-voxceleb` | ~80 MB | speaker match (Enroll + analyze) |
| `Bisher/wav2vec2_ASV_deepfake_audio_detection` (Apache-2.0) | ~360 MB | AI-voice risk |

`POST http://127.0.0.1:8000/warmup` force-loads all three (~1-2 min first
time incl. downloads; ~20 s after) — run it before any demo so analyses stay
fast. Model swapping (e.g. a different anti-spoofing classifier) is a
one-line change in the relevant service module.

## API summary

- `GET  /health` — liveness probe
- `POST /warmup` — preload all ML models
- `POST /enroll` — multipart `name` + `file`: store a reference voice (upsert)
- `GET  /enroll` — list enrolled voices
- `POST /analyze` — multipart `file`: full analysis (transcript, speaker
  match, AI-voice risk + heuristic, behavior matches, overall score, decision,
  reasons)

## Troubleshooting

- **`ffmpeg` not found / duration null / "Unsupported audio type"** — ffmpeg
  is a system requirement (pip packages cannot ship it). Install per
  Prerequisites and reopen the terminal; verify with `ffprobe -version`.
- **Slow first analysis / model download stalls** — first `/analyze` downloads
  weights (see table). Run `POST /warmup` first; if a download stalls, delete
  the partial folder under `backend/models_store/` (or `~/.cache/huggingface`)
  and retry on a stable connection.
- **"No space left on device"** — the ML stack needs ~4 GB (torch + models).
  If your system drive is full, relocate the pip cache:
  `python -m pip config set global.cache-dir E:\pip-cache`.
- **Port 8000 / 5173 already in use** — the Vite dev server uses
  `strictPort`; stop the stale process or free the port, then restart.
- **"Backend unreachable" on the Overview page** — backend not running, or
  the frontend is not on port 5173 (the backend CORS whitelist expects
  localhost:5173 / 127.0.0.1:5173).
- **Mic button errors** — browser needs microphone permission; use Chrome/
  Edge and allow the prompt. MediaRecorder emits webm/opus — supported by the
  backend natively.
- **Enroll fails with a symlink error (Windows)** — handled automatically
  (snapshot is materialized by file copy); if it persists, enable Windows
  Developer Mode or re-run once online.
- **Python wheel errors during install** — the stack is validated on Python
  3.14; on older 3.10/3.11 systems all pinned versions also publish wheels.

## Model & scoring notes

- Everything runs locally during the demo — no cloud APIs, no signup-required SDKs.
- Database: SQLite file at `backend/voiceguard.db` (auto-created at startup).
- ML model weights download on first use into `backend/models_store/` (gitignored);
  download sizes are stated before each install.
- Speech-to-text: faster-whisper `base` (~75 MB, auto-downloads on first use).
  `POST http://127.0.0.1:8000/warmup` preloads the model so the first analysis is fast.
- AI-voice detection: wav2vec2 anti-spoofing classifier `Bisher/wav2vec2_ASV_deepfake_audio_detection`
  (~360 MB, Apache-2.0, ASVspoof lineage) — chosen by bake-off with REAL human clips
  (JFK, LibriSpeech: scored 0.2-0.3% fake) + synthetic probes (SAPI TTS: 96.7% fake);
  evidence in `model-compare-results.json`. Known blind spot: some legacy TTS sentences
  can be missed. A transparent heuristic estimate (spectral flatness / noise floor / ZCR)
  is always reported alongside and used as the labeled fallback if the model fails.
  Honest limits: this is decision support, not proof — no detection is 100% accurate.
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

## Honest limitations (by design — see the source doc's Section 11)

- Decision support, **not proof**: no detection method is 100% accurate and we
  claim no accuracy figures beyond measured behavior.
- The deepfake classifier is strongest on modern neural TTS / voice-clone
  audio; a transparent heuristic estimate (spectral flatness / noise floor /
  ZCR) is always reported alongside and used as the labeled fallback if the
  model fails — the UI names the source ("model" vs "heuristic estimate").
- Speaker match is similarity-to-a-trusted-reference, not cryptographic identity.
- The behavior matcher sees words only (no prosody); weights and thresholds
  are documented and auditable in the service modules.

