"""POST /analyze — the core pipeline endpoint.

Phase 2 scope: accept multipart audio (live recording or file upload),
validate it, persist it temporarily, and return a placeholder response
shaped like the final analysis result so the frontend can render against
it. No scores are faked — signals are null until their phases land.

Phases 3-7 fill in: transcription (faster-whisper), speaker verification
(ECAPA-TDNN), AI-voice detection, behavior analysis, risk engine.

Performance: the three model signals run in PARALLEL worker threads
(asyncio.to_thread) — total latency ~= the slowest signal instead of the
sum — and per-signal timings are returned in the response. This also keeps
the event loop free so /health stays responsive during analysis.
"""

import asyncio
import hashlib
import json
import subprocess
import time
import uuid
from collections import OrderedDict
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from db import db
from services import ai_voice_detection, behavior_analysis, risk_engine, speaker_verification, transcription

router = APIRouter(tags=["analyze"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "tmp_uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Repeat-analysis cache (in-memory, per process): identical audio answers
# instantly with "cached": true — ideal for replaying demo clips. Results are
# honest (the response is flagged) and the cache is small and least-recently-used.
_RESULT_CACHE: OrderedDict[str, dict] = OrderedDict()
_RESULT_CACHE_MAX = 50

# Serialize concurrent pipelines: on Railway's small CPUs, stacking multiple
# analyses multiplies everyone's latency. New requests queue here and get the
# full CPU when their turn comes (cache hits bypass the gate entirely).
_ANALYZE_GATE = asyncio.Semaphore(1)


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
    "speaker_match": "active (Phase 4 — ECAPA-TDNN)",
    "ai_voice_detection": "active (Phase 5 — wav2vec2)",
    "behavior_analysis": "active (Phase 6 — rule-based)",
    "risk_engine": "active (Phase 7)",
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


def _run_ai_voice(path: Path) -> dict:
    """Phase 5: AI-voice likelihood (model primary, labeled heuristic fallback)."""
    try:
        return ai_voice_detection.detect_ai_voice(str(path))
    except Exception as exc:  # noqa: BLE001
        return {
            "model_risk_pct": None, "heuristic_risk_pct": None, "risk_pct": None,
            "source": "unavailable", "scores": [], "features": {}, "error": str(exc),
        }


def _run_behavior(transcript: str | None) -> dict:
    """Phase 6: rule-based suspicious-request analysis over the transcript."""
    try:
        return behavior_analysis.analyze_behavior(transcript or "")
    except Exception as exc:  # noqa: BLE001
        return {
            "risk_pct": None,
            "matched": [],
            "categories_hit": [],
            "matched_count": 0,
            "transcript_empty": not transcript,
            "error": str(exc),
        }


def _run_speaker_match(path: Path) -> dict:
    """Phase 4: compare the clip against enrolled reference voices.

    With no enrollment the result is an explicit unknown/neutral state
    (match_pct=None) — never a silent 0 or 100.
    """
    with db() as conn:
        rows = conn.execute("SELECT name, embedding_path FROM enrolled_voices ORDER BY id").fetchall()
    if not rows:
        return {
            "matched_name": None,
            "match_pct": None,
            "similarity": None,
            "enrolled_count": 0,
            "per_voice": [],
            "error": None,
        }

    wav16: Path | None = None
    try:
        wav16 = speaker_verification.prepare_16k_mono(str(path))
        emb = speaker_verification.extract_embedding(str(wav16))
    except Exception as exc:  # noqa: BLE001
        return {
            "matched_name": None,
            "match_pct": None,
            "similarity": None,
            "enrolled_count": len(rows),
            "per_voice": [],
            "error": str(exc),
        }
    finally:
        if wav16 is not None:
            wav16.unlink(missing_ok=True)

    per_voice = []
    best: tuple[dict, float] | None = None
    for row in rows:
        try:
            ref = json.loads(Path(row["embedding_path"]).read_text())
            sim = speaker_verification.cosine_similarity(emb, ref["embedding"])
        except Exception:  # noqa: BLE001 — skip corrupt references, keep matching the rest
            continue
        entry = {
            "name": row["name"],
            "similarity": round(sim, 4),
            "match_pct": speaker_verification.similarity_to_match_pct(sim),
        }
        per_voice.append(entry)
        if best is None or sim > best[1]:
            best = (entry, sim)

    if best is None:
        return {
            "matched_name": None,
            "match_pct": None,
            "similarity": None,
            "enrolled_count": len(rows),
            "per_voice": [],
            "error": "no readable reference embeddings",
        }
    return {
        "matched_name": best[0]["name"],
        "match_pct": best[0]["match_pct"],
        "similarity": best[0]["similarity"],
        "enrolled_count": len(rows),
        "per_voice": per_voice,
        "error": None,
    }


@router.post("/warmup")
async def warmup() -> dict:
    """Force-load both ML models so the first real analysis is fast.

    First call on a fresh machine downloads weights (~75 MB whisper base +
    ~80 MB ECAPA) into backend/models_store/; later calls are instant.
    """
    notes: dict[str, str] = {}
    for key, load in (
        ("transcription", transcription.warmup),
        ("speaker", speaker_verification.warmup),
        ("ai_voice", ai_voice_detection.warmup),
    ):
        try:
            load()
            notes[key] = "ready"
        except Exception as exc:  # noqa: BLE001
            notes[key] = f"failed: {exc}"
    status = "ready" if all(v == "ready" for v in notes.values()) else "partial"
    return {"status": status, "transcription": notes["transcription"], "speaker": notes["speaker"]}


@router.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)) -> dict:
    """Intake audio, transcribe (Phase 3) + speaker-match (Phase 4), respond."""
    path = _save_upload(file)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()

    # Cache hit: same bytes as a recent analysis — answer instantly.
    if digest in _RESULT_CACHE:
        cached = dict(_RESULT_CACHE[digest])
        cached["cached"] = True
        return cached

    duration = _probe_duration_sec(path)

    # Run the three model signals in parallel threads (they are independent);
    # behavior analysis is instant and depends on the transcript, so it runs after.
    async def _timed(fn, *args):
        started = time.perf_counter()
        res = await asyncio.to_thread(fn, *args)
        return res, round(time.perf_counter() - started, 2)

    pipeline_t0 = time.perf_counter()
    # One pipeline at a time on small CPUs — concurrent requests queue here.
    async with _ANALYZE_GATE:
        (tr, tr_s), (spk, spk_s), (ai, ai_s) = await asyncio.gather(
            _timed(_run_transcription, path),
            _timed(_run_speaker_match, path),
            _timed(_run_ai_voice, path),
        )
    wall_s = round(time.perf_counter() - pipeline_t0, 2)

    transcript = tr["text"]
    language = tr["language"]
    if tr["duration_sec"]:
        duration = tr["duration_sec"]  # whisper's duration beats container metadata

    beh = _run_behavior(transcript)

    reasons = ["Audio received, validated and stored successfully."]
    if tr["error"]:
        reasons.append(f"Transcription failed: {tr['error'][:150]}")
    elif transcript:
        preview = transcript if len(transcript) <= 80 else transcript[:80] + "…"
        reasons.append(f"Transcript generated ({language}, faster-whisper base): '{preview}'")
    else:
        reasons.append("No speech detected in the clip.")
    if spk["error"]:
        reasons.append(f"Speaker check failed: {spk['error'][:120]}")
    elif spk["enrolled_count"] == 0:
        reasons.append("No reference voice enrolled — speaker identity is unknown/neutral (not scored 0 or 100).")
    elif spk["match_pct"] is not None:
        reasons.append(
            f"Speaker match {spk['match_pct']:.0f}% vs closest reference '{spk['matched_name']}' (cosine {spk['similarity']:.3f})."
        )
    if ai["error"] and ai["source"] != "model":
        reasons.append(f"AI-voice model unavailable ({ai['error'][:90]}) — heuristic estimate {ai['heuristic_risk_pct']:.0f}% shown instead." if ai["heuristic_risk_pct"] is not None else f"AI-voice check failed: {ai['error'][:120]}")
    else:
        reasons.append(f"AI-voice risk: {ai['risk_pct']:.0f}% ({ai['source']}, wav2vec2 anti-spoofing; heuristic estimate {ai['heuristic_risk_pct']:.0f}%).")
    for m in beh["matched"]:
        reasons.append(f"Behavior ({m['category']}): matched “{m['phrase']}” — “…{m['context']}…”")
    if beh["risk_pct"] and beh["risk_pct"] > 0:
        reasons.append(f"Behavior risk {beh['risk_pct']:.0f}% from {beh['matched_count']} suspicious phrase(s).")
    elif not beh.get("transcript_empty"):
        reasons.append("Behavior check: no suspicious request phrases found.")

    risk = risk_engine.compute_overall_risk(
        speaker_match_pct=spk["match_pct"],
        ai_voice_risk_pct=ai["risk_pct"] if ai["risk_pct"] is not None else 0.0,
        behavior_risk_pct=beh["risk_pct"] if beh["risk_pct"] is not None else 0.0,
        heuristic_risk_pct=ai["heuristic_risk_pct"],
    )
    reasons.extend(risk["reasons"])

    pipeline_status = dict(PIPELINE_STATUS)
    if tr["error"]:
        pipeline_status["transcription"] = f"error: {tr['error'][:120]}"
    elif not transcript:
        pipeline_status["transcription"] = "active (no speech detected)"
    if spk["error"]:
        pipeline_status["speaker_match"] = f"error: {spk['error'][:120]}"
    elif spk["enrolled_count"] == 0:
        pipeline_status["speaker_match"] = "no reference voice enrolled (unknown/neutral)"
    if ai["source"] == "model" and ai["model_risk_pct"] is None:
        pipeline_status["ai_voice_detection"] = "active (heuristic estimate only — model failed)"
    elif ai["source"] == "heuristic":
        pipeline_status["ai_voice_detection"] = "active (heuristic estimate only — model unavailable)"
    if beh.get("error"):
        pipeline_status["behavior_analysis"] = f"error: {beh['error'][:120]}"

    analysis_id: int | None = None
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO analyses (audio_filename, duration_sec, transcript, speaker_match_pct, ai_voice_risk_pct, behavior_risk_pct, overall_risk_pct, decision, reasons, details) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                path.name,
                duration,
                transcript,
                spk["match_pct"],
                ai["risk_pct"],
                beh["risk_pct"],
                risk["overall_risk_pct"],
                risk["decision"],
                json.dumps(reasons),
                json.dumps({
                    "pipeline_status": pipeline_status,
                    "transcription": {"language": language, "duration_sec": tr["duration_sec"]},
                    "speaker": spk,
                    "ai_voice": ai,
                    "behavior": {"risk_pct": beh["risk_pct"], "matched": beh["matched"]},
                    "timings": {"transcription_s": tr_s, "speaker_s": spk_s, "ai_voice_s": ai_s, "pipeline_parallel_s": wall_s},
                }),
            ),
        )
        analysis_id = cur.lastrowid

    response = {
        "analysis_id": analysis_id,
        "status": "error" if tr["error"] else ("no_speech" if not transcript else "transcribed"),
        "audio": {"filename": path.name, "duration_sec": duration},
        "transcript": transcript,
        "language": language,
        "signals": {
            "speaker_match_pct": spk["match_pct"],
            "ai_voice_risk_pct": ai["risk_pct"],
            "behavior_risk_pct": beh["risk_pct"],
        },
        "speaker": spk,
        "ai_voice": ai,
        "behavior": beh,
        "overall_risk_pct": risk["overall_risk_pct"],
        "decision": risk["decision"],
        "risk_components": risk["components"],
        "timings": {
            "transcription_s": tr_s,
            "speaker_s": spk_s,
            "ai_voice_s": ai_s,
            "pipeline_parallel_s": wall_s,
        },
        "reasons": reasons,
        "pipeline_status": pipeline_status,
    }

    _RESULT_CACHE[digest] = json.loads(json.dumps(response))
    while len(_RESULT_CACHE) > _RESULT_CACHE_MAX:
        _RESULT_CACHE.popitem(last=False)
    return response
