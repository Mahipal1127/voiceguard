"""Speaker verification via speechbrain ECAPA-TDNN (implemented in Phase 4).

Model: speechbrain/spkrec-ecapa-voxceleb (free, pip-installable, no API key,
pretrained on VoxCeleb). Enrollment stores the 192-dim embedding; /analyze
computes cosine similarity against enrolled voices and converts it to a
0-100 "Speaker Match %".

Guardrail: if no reference voice is enrolled, the result must be an explicit
"unknown / neutral" state — never a silent 0 or 100.
"""


def extract_embedding(audio_path: str) -> list[float]:
    raise NotImplementedError("lands in Phase 4")


def cosine_similarity(a: list[float], b: list[float]) -> float:
    raise NotImplementedError("lands in Phase 4")
