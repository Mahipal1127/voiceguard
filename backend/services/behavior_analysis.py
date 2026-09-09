"""Rule-based suspicious-request detection over the transcript (Phase 6).

Pattern families checked: urgency language, financial requests (amounts,
transfers, account numbers), authority claims ("I am your CEO/boss"),
isolation tactics ("don't tell anyone"), OTP/password/PIN requests.

Returns a 0-100 Behavior Risk % plus the list of matched phrases — the
matched-phrase list is what makes the demo explainable to judges.
"""


def analyze_behavior(transcript: str) -> dict:
    """Return {"risk_pct": float, "reasons": list[str]}."""
    raise NotImplementedError("lands in Phase 6")
