"""AI-voice (deepfake) detection (Phase 5).

Primary: Bisher/wav2vec2_ASV_deepfake_audio_detection (Apache-2.0; ASVspoof
lineage — trained real vs TTS/voice-conversion). Chosen after a bake-off with
genuine human clips (JFK, LibriSpeech) + synthetic probes: it is the only
shortlisted model that scored real speech as real (0.2-0.3%) AND the SAPI-TTS
fake as fake (96.7%) — mo-thecreator and MelodyMachine-V2 both false-flagged
clean real speech. wav2vec2-base + classification head via the transformers
`audio-classification` pipeline, CPU. Known blind spot: some legacy TTS
sentences can be missed; the heuristic is always reported alongside.

Also computed: a transparent heuristic estimate (spectral flatness, noise
floor, zero-crossing irregularity) — always returned alongside so the UI can
label the source ("model" vs "heuristic estimate"). We never claim 100%
detection; this is decision support, not proof.
"""

import os

# Cap torch threading BEFORE torch is imported anywhere — the three signals
# run in parallel worker threads, so each model gets a share of the cores.
os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("MKL_NUM_THREADS", "4")

import threading
from pathlib import Path

from services.speaker_verification import load_wav16k_mono, prepare_16k_mono

MODELS_DIR = Path(__file__).resolve().parent.parent / "models_store"
MODELS_DIR.mkdir(exist_ok=True)

MODEL_ID = "Bisher/wav2vec2_ASV_deepfake_audio_detection"

_pipeline = None
_lock = threading.Lock()


def _get_pipeline():
    """Lazy-load the wav2vec2 anti-spoofing classifier (thread-safe)."""
    global _pipeline
    from transformers import AutoFeatureExtractor, AutoModelForAudioClassification, pipeline

    with _lock:
        if _pipeline is None:
            model = AutoModelForAudioClassification.from_pretrained(
                MODEL_ID, cache_dir=str(MODELS_DIR / "hf-cache")
            )
            extractor = AutoFeatureExtractor.from_pretrained(
                MODEL_ID, cache_dir=str(MODELS_DIR / "hf-cache")
            )
            _pipeline = pipeline(
                "audio-classification", model=model, feature_extractor=extractor, device="cpu"
            )
        return _pipeline


def warmup() -> None:
    """Preload the model — called by POST /warmup."""
    _get_pipeline()


_FAKE_LABEL_MARKERS = ("fake", "synthetic", "spoof", "generated", "tts")
_REAL_LABEL_MARKERS = ("real", "bona", "genuine", "human")


def _fake_probability(scores: list[dict]) -> float | None:
    """Map the classifier's label scores to a 'fake' probability."""
    for s in scores:
        if any(m in s["label"].lower() for m in _FAKE_LABEL_MARKERS):
            return float(s["score"])
    for s in scores:
        if any(m in s["label"].lower() for m in _REAL_LABEL_MARKERS):
            return 1.0 - float(s["score"])
    return None

def heuristic_estimate(audio) -> dict:
    """Transparent signal-artifact heuristic on a 16 kHz mono waveform (numpy).

    Components (documented so the estimate can be explained, and labeled a
    heuristic in the UI — it is NOT a trained classifier):
      - spectral flatness: geometric/arithmetic mean ratio of the frame power
        spectrum; noise-like audio approaches 1.0, natural speech sits low
      - noise floor: 10th percentile frame RMS; an unnaturally silent
        background is common in studio-grade synthetic audio
      - zero-crossing irregularity: frame-level ZCR variability
    Weighted blend 50/30/20, clamped to 0-100. Weaknesses are real: a quiet
    studio recording scores higher on the floor term — hence "estimate".
    """
    import numpy as np

    x = np.asarray(audio, dtype=np.float32)
    frame, hop = 1024, 512
    flat, rms, zcr = [], [], []
    for i in range(0, max(1, len(x) - frame), hop):
        seg = x[i : i + frame]
        if float(np.abs(seg).max()) < 1e-4:
            continue
        spec = np.abs(np.fft.rfft(seg * np.hanning(frame))) ** 2 + 1e-12
        flat.append(float(np.exp(np.log(spec).mean()) / spec.mean()))
        rms.append(float(np.sqrt(np.mean(seg**2))))
        zcr.append(float(np.mean(np.abs(np.diff(np.signbit(seg))))))

    if not flat:
        return {"spectral_flatness": None, "noise_floor": None, "zcr_irregularity": None, "heuristic_risk_pct": 50.0}

    flatness = float(np.mean(flat))
    floor = float(np.percentile(rms, 10))
    zirr = float(np.std(zcr) / (np.mean(zcr) + 1e-9))

    s_flat = min(1.0, max(0.0, (flatness - 0.05) / 0.45))
    s_floor = min(1.0, max(0.0, (0.02 - floor) / 0.02))
    s_zirr = min(1.0, max(0.0, (zirr - 0.15) / 0.45))
    risk = round((0.5 * s_flat + 0.3 * s_floor + 0.2 * s_zirr) * 100, 1)
    return {"spectral_flatness": round(flatness, 5), "noise_floor": round(floor, 5), "zcr_irregularity": round(zirr, 4), "heuristic_risk_pct": risk}


def detect_ai_voice(audio_path: str) -> dict:
    """Return the AI-voice risk assessment for a clip.

    Returns {"model_risk_pct", "heuristic_risk_pct", "risk_pct", "source",
    "scores", "features", "error"} — risk_pct is the model score when the
    model is available, otherwise the labeled heuristic estimate.
    """
    wav16 = None
    try:
        wav16 = prepare_16k_mono(str(audio_path))
        audio = load_wav16k_mono(str(wav16))
    except Exception as exc:  # noqa: BLE001
        return {
            "model_risk_pct": None, "heuristic_risk_pct": None, "risk_pct": None,
            "source": "unavailable", "scores": [], "features": {},
            "error": f"audio prep failed: {exc}",
        }
    finally:
        if wav16 is not None:
            wav16.unlink(missing_ok=True)

    heur = heuristic_estimate(audio.numpy())
    # Bound CPU latency: classification runs on at most the first 8 s —
    # plenty for a deepfake decision and keeps 30 s uploads fast.
    audio_for_model = audio[: 16000 * 8]
    result = {
        "model_risk_pct": None,
        "heuristic_risk_pct": heur["heuristic_risk_pct"],
        "risk_pct": heur["heuristic_risk_pct"],
        "source": "heuristic",
        "scores": [],
        "features": {k: v for k, v in heur.items() if k != "heuristic_risk_pct"},
        "error": None,
    }

    try:
        clf = _get_pipeline()
        scores = clf({"raw": audio_for_model.numpy(), "sampling_rate": 16000})
        p = _fake_probability(scores)
        if p is not None:
            result.update(
                model_risk_pct=round(p * 100, 1),
                risk_pct=round(p * 100, 1),
                source="model",
                scores=[{"label": s["label"], "score": round(float(s["score"]), 4)} for s in scores],
            )
        else:
            result["error"] = f"unrecognized labels: {[s['label'] for s in scores]}"
    except Exception as exc:  # noqa: BLE001 — degrade to the heuristic estimate
        result["error"] = str(exc)
    return result
