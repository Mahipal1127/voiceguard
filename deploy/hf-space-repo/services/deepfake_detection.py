"""AI-voice (deepfake) detection (implemented in Phase 5).

OPEN DECISION POINT — do not pick a model silently:
  1. Preferred: a permissively-licensed pretrained anti-spoofing model from
     Hugging Face (shortlist wav2vec2/AASIST-style detectors with license +
     download size, then confirm with the team before integrating).
  2. Fallback: a transparent heuristic score from signal artifacts —
     spectral flatness, pitch jitter/shimmer irregularity, unnaturally low
     background noise. The UI must label heuristic output as a
     "heuristic estimate" — no overclaiming accuracy.
"""


def detect_ai_voice(audio_path: str) -> float:
    """Return 0-100 "AI Voice Risk %"."""
    raise NotImplementedError("lands in Phase 5")
