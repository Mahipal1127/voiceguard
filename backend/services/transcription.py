"""Speech-to-text via faster-whisper (Phase 3).

CTranslate2 Whisper, "base" model on CPU with int8 compute — fast enough for
a 10-30 s clip on a laptop CPU, accurate enough for the demo. "small" is the
accuracy fallback; "large" is deliberately not used (too slow for live).

Model weights download on first use into backend/models_store/ (gitignored):
  - base ~75 MB   |   small ~465 MB
The model is lazy-loaded (thread-safe) and cached per size; POST /warmup
forces the load so the live demo never pays the cost mid-request.
"""

import threading
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parent.parent / "models_store"
MODELS_DIR.mkdir(exist_ok=True)

DEFAULT_MODEL_SIZE = "base"

_models: dict[str, object] = {}
_lock = threading.Lock()


def _get_model(model_size: str = DEFAULT_MODEL_SIZE):
    """Lazy-load and cache a WhisperModel (thread-safe)."""
    from faster_whisper import WhisperModel  # lazy import keeps app startup light

    with _lock:
        model = _models.get(model_size)
        if model is None:
            model = WhisperModel(
                model_size,
                device="cpu",
                compute_type="int8",
                download_root=str(MODELS_DIR),
            )
            _models[model_size] = model
        return model


def warmup(model_size: str = DEFAULT_MODEL_SIZE) -> None:
    """Preload the model — called by POST /analyze/warmup."""
    _get_model(model_size)


def transcribe(audio_path: str, model_size: str = DEFAULT_MODEL_SIZE) -> dict:
    """Transcribe an audio file.

    Returns {"text": str, "language": str, "duration_sec": float}.
    vad_filter trims silence (phone clips are noisy); greedy decoding
    (beam_size=1) keeps latency low for short clips.
    """
    model = _get_model(model_size)
    # language="en" skips auto language detection — saves 1-2 s per clip in
    # the live demo (the prototype targets English phone calls). Pass None
    # to fall back to auto-detection.
    segments, info = model.transcribe(
        audio_path,
        language="en",
        vad_filter=True,
        beam_size=1,
        condition_on_previous_text=False,  # avoids repetition drift on short clips
    )
    text = " ".join(seg.text.strip() for seg in segments).strip()
    return {
        "text": text,
        "language": info.language,
        "duration_sec": info.duration,
    }
