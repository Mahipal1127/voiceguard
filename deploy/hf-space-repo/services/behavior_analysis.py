"""Rule-based suspicious-request detection over the transcript (Phase 6).

Fast, explainable, demo-safe: regex pattern families over the faster-whisper
transcript. Returns a 0-100 Behavior Risk % plus the specific matched phrases
with context — the matched-phrase list is what makes the analysis feel
intelligent rather than a black box (and is honest: it only sees words, not
prosody or call metadata).

Documented weights (fixed, so judges can audit them):
    financial request 35 · urgency 20 · OTP/PIN 25 · authority claim 15 ·
    isolation 15 · callback-blocking 10  (clamped to 100; extra distinct
    matches inside one category add +5 each)

Note on "lock": whisper-base mishears Indian-English "lakh" as "lock"
(verified in Phase 3), so the amount matcher treats lock/lac/lak as lakh
variants. Empty transcript => risk 0 (absence of words is not suspicion).
"""

import re

# Each category: (weight, patterns). Patterns are case-insensitive regex.
CATEGORIES: dict[str, tuple[int, list[str]]] = {
    "financial": (
        35,
        [
            r"\btransfer\b",
            r"\bsend\s+(?:me\s+)?(?:the\s+)?money\b",
            r"\bwire\s+(?:the\s+)?money\b",
            r"\bdeposit\b",
            r"\bupi\b",
            r"\bbank\s+account\b",
            r"\baccount\s+number\b",
            r"\bifsc\b",
            r"\bgift\s+card\b",
            r"\bvoucher\b",
            # Amount with magnitude/currency. "lock/lac/lak" = whisper's
            # mishearing of "lakh" (Phase 3 finding).
            r"\b\d+(?:\.\d+)?\s*(?:lakh|lock|lac|lak|crore|k|thousand|million)\b",
            r"\b(?:rs\.?|inr|rupees|dollars|usd)\s*\d+",
        ],
    ),
    "urgency": (
        20,
        [
            r"\bimmediately\b",
            r"\bright\s+now\b",
            r"\basap\b",
            r"\bas\s+soon\s+as\s+possible\b",
            r"\burgent\b",
            r"\bno\s+time\b",
            r"\bdon'?t\s+wait\b",
            r"\bthis\s+minute\b",
            r"\bhurry\b",
        ],
    ),
    "otp": (
        25,
        [
            r"\botp\b",
            r"\bone\s*time\s+password\b",
            r"\bpin\b",
            r"\bpassword\b",
            r"\bverification\s+code\b",
            r"\bcvv\b",
            r"\b(?:share|read|tell)\s+(?:me\s+)?(?:the\s+)?code\b",
        ],
    ),
    "authority": (
        15,
        [
            r"\bi\s+am\s+your\s+(?:ceo|boss|manager|father|mother|son|daughter|brother|sister|uncle|aunt)\b",
            r"\bthis\s+is\s+your\s+(?:ceo|boss|manager)\b",
            r"\bi\s+am\s+calling\s+from\s+(?:the\s+)?(?:bank|police|income\s+tax|head\s*office)\b",
            r"\bi\s+am\s+from\s+the\s+(?:bank|police|income\s+tax)\b",
        ],
    ),
    "isolation": (
        15,
        [
            r"\bdon'?t\s+tell\s+anyone\b",
            r"\bkeep\s+this\s+confidential\b",
            r"\bdon'?t\s+(?:tell|mention|discuss)\s+(?:this|anyone|mom|dad)\b",
            r"\b(?:only\s+)?between\s+us\b",
            r"\bkeep\s+it\s+between\s+us\b",
        ],
    ),
    "callback": (
        10,
        [
            r"\bdon'?t\s+call\s+me\s+back\b",
            r"\bdon'?t\s+call\s+back\b",
            r"\bdon'?t\s+return\s+my\s+call\b",
            r"\bi\s+am\s+busy\b",
            r"\bcan'?t\s+talk\s+long\b",
        ],
    ),
}

_EXTRA_MATCH_BONUS = 5  # per additional distinct match within one category
_CONTEXT_WORDS = 4  # words of transcript context shown for each match


def _context_around(transcript: str, start: int, end: int) -> str:
    """A few words of surrounding transcript for the matched-phrase list."""
    words: list[tuple[int, int]] = [(m.start(), m.end()) for m in re.finditer(r"\S+", transcript)]
    idx = [i for i, (s, e) in enumerate(words) if s < end and e > start]
    if not idx:
        return transcript[start:end]
    lo = max(0, idx[0] - _CONTEXT_WORDS)
    hi = min(len(words), idx[-1] + 1 + _CONTEXT_WORDS)
    prefix = "…" if lo > 0 else ""
    suffix = "…" if hi < len(words) else ""
    return prefix + transcript[words[lo][0] : words[hi][1]] + suffix


def analyze_behavior(transcript: str) -> dict:
    """Return {"risk_pct", "matched", "categories_hit", "matched_count"}.

    "matched" entries carry the category, the matched phrase and transcript
    context — the reasons list the UI renders.
    """
    if not transcript or not transcript.strip():
        return {"risk_pct": 0.0, "matched": [], "categories_hit": [], "matched_count": 0, "transcript_empty": True}

    text = transcript.strip()
    matched: list[dict] = []
    per_category: dict[str, set[str]] = {}

    for category, (_, patterns) in CATEGORIES.items():
        for pattern in patterns:
            for m in re.finditer(pattern, text, flags=re.IGNORECASE):
                phrase = m.group(0)
                seen = per_category.setdefault(category, set())
                if phrase.lower() in seen:
                    continue
                seen.add(phrase.lower())
                matched.append(
                    {
                        "category": category,
                        "phrase": phrase,
                        "context": _context_around(text, m.start(), m.end()),
                    }
                )

    risk = 0.0
    for category, (weight, _) in CATEGORIES.items():
        n = len(per_category.get(category, ()))
        if n:
            risk += weight + (n - 1) * _EXTRA_MATCH_BONUS

    return {
        "risk_pct": round(min(100.0, risk), 1),
        "matched": matched,
        "categories_hit": sorted(per_category.keys()),
        "matched_count": len(matched),
        "transcript_empty": False,
    }
