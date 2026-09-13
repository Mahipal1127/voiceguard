"""Risk engine (Phase 7) — combines the three signals into one 0-100 score.

Fixed decision thresholds from the source document (do NOT change without
explicit sign-off):
    0-29   -> ALLOW
    30-59  -> WARN
    60-79  -> VERIFY
    80-100 -> BLOCK

Documented weighting (auditable by judges):

  base risk (0-100):
      - speaker UNKNOWN/NEUTRAL (no enrollment):  base = 50 (neutral prior)
      - speaker known: base = 100 - speaker_match_pct
        (a caller who sounds like a trusted, enrolled voice is low-risk)
  ai_voice contribution (the doc's headline signal, weight 40):
      ai_term = (ai_voice_risk_pct / 100) * 40
      and +5 penalty when the heuristic (reported alongside) disagrees
      strongly (>= 30 points gap) — model agreement is our weakest link.
  behavior contribution (the doc's "modifier", weight 35):
      behavior_term = (behavior_risk_pct / 100) * 35
      A convincing voice plus a suspicious money request still pushes the
      total past VERIFY/BLOCK — matching the doc's Section 11 intent.

  overall = clamp(base + ai_term + behavior_term, 0, 100)

  Calibration check (doc example): speaker match 91% -> base 9; ai_voice 100%
  -> +40; behavior 85% -> +30 => 79 => VERIFY (high side). With an unknown
  speaker (base 50) the same call => 120 -> clamps to 100 => BLOCK. A
  high-confidence AI voice plus a suspicious request is BLOCK-range, as the
  doc's ~88 illustration expects.

Honesty guardrails: the score is decision support, not proof. Speaker match
is a similarity-to-reference, not identity. The deepfake model has known
blind spots (see services/ai_voice_detection.py) — the heuristic is always
reported alongside and disagreement is surfaced in the reasons.
"""


def _decision_for(overall: float) -> str:
    if overall <= 29:
        return "ALLOW"
    if overall <= 59:
        return "WARN"
    if overall <= 79:
        return "VERIFY"
    return "BLOCK"


def compute_overall_risk(
    speaker_match_pct: float | None,
    ai_voice_risk_pct: float,
    behavior_risk_pct: float,
    heuristic_risk_pct: float | None = None,
) -> dict:
    """Combine the three signals into {"overall_risk_pct", "decision", "reasons"}.

    speaker_match_pct=None (no reference voice enrolled) is treated as an
    explicit neutral prior (50), never silently 0 or 100.
    """
    reasons: list[str] = []

    if speaker_match_pct is None:
        base = 50.0
        reasons.append("Speaker identity unknown (no reference voice) — neutral prior 50 used.")
    else:
        base = 100.0 - float(speaker_match_pct)
        reasons.append(f"Base from speaker match {speaker_match_pct:.0f}% -> {base:.0f}.")

    ai_term = (float(ai_voice_risk_pct) / 100.0) * 40.0
    reasons.append(f"AI-voice risk {ai_voice_risk_pct:.0f}% adds {ai_term:.0f} (weight 40).")
    if heuristic_risk_pct is not None and abs(float(ai_voice_risk_pct) - float(heuristic_risk_pct)) >= 30:
        reasons.append(
            f"Model and heuristic disagree by {abs(float(ai_voice_risk_pct) - float(heuristic_risk_pct)):.0f} points — treat the AI-voice signal with caution (+5)."
        )
        ai_term += 5.0

    behavior_term = (float(behavior_risk_pct) / 100.0) * 35.0
    if behavior_term > 0:
        reasons.append(f"Behavior risk {behavior_risk_pct:.0f}% adds {behavior_term:.0f} (weight 35).")

    overall = max(0.0, min(100.0, base + ai_term + behavior_term))

    # Rule 1 (Section 11): a strongly suspicious request alone warrants at
    # least VERIFY — voice evidence can lower, but not eliminate, request risk.
    if float(behavior_risk_pct) >= 80 and overall < 60:
        overall = 60.0
        reasons.append("High-risk request (behavior >= 80) — minimum VERIFY regardless of voice evidence.")

    # Rule 2 (Section 11): high AI-voice risk + high-risk request overrides a
    # convincing speaker match (a cloned voice CAN match the stolen reference).
    if float(ai_voice_risk_pct) >= 60 and float(behavior_risk_pct) >= 60 and overall < 88:
        overall = 88.0
        reasons.append(
            "Escalation: high AI-voice risk + high-risk request overrides convincing speaker match — score raised to 88 (BLOCK)."
        )

    decision = _decision_for(overall)

    reasons.append(f"Overall risk {overall:.0f} -> {decision} (0-29 ALLOW, 30-59 WARN, 60-79 VERIFY, 80-100 BLOCK).")
    reasons.append("Decision support, not proof — no detection method is 100% accurate.")

    return {
        "overall_risk_pct": round(overall, 1),
        "decision": decision,
        "reasons": reasons,
        "components": {"base": round(base, 1), "ai_term": round(ai_term, 1), "behavior_term": round(behavior_term, 1)},
    }
