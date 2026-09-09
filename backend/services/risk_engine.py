"""Risk engine (Phase 7) — combines the three signals into one 0-100 score.

Fixed decision thresholds from the source document (do NOT change without
explicit sign-off):
    0-29   -> ALLOW
    30-59  -> WARN
    60-79  -> VERIFY
    80-100 -> BLOCK

Weighting intent (documented so it can be explained to judges):
  - Low/unknown speaker match + high AI-voice risk dominates the score.
  - Behavior risk acts as a modifier that can push a borderline case across a
    threshold (convincing voice + suspicious money request => VERIFY/BLOCK).
  - We never claim 100% detection — the score is decision support, not proof.
"""


def compute_overall_risk(
    speaker_match_pct: float | None,
    ai_voice_risk_pct: float,
    behavior_risk_pct: float,
) -> dict:
    """Return {"overall_risk_pct": float, "decision": str, "reasons": list[str]}."""
    raise NotImplementedError("lands in Phase 7")
