"""Speech-to-text via faster-whisper (implemented in Phase 3).

Plan: CTranslate2 Whisper, "base" model on CPU (fall back to "small" only if
accuracy is poor in testing — never "large", too slow for the live demo).
Note: ffmpeg must be installed system-wide for audio handling.

Model download size (heads-up before the Phase 3 install):
  - faster-whisper "base": ~75 MB  |  "small": ~465 MB
  - plus the CTranslate2 runtime wheel (~40-60 MB) and PyTorch CPU (~200 MB)
"""


def transcribe(audio_path: str, model_size: str = "base") -> dict:
    """Return {"text": str, "language": str, "duration_sec": float}."""
    raise NotImplementedError("transcription.transcribe is implemented in Phase 3")
