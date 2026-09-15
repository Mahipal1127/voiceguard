# Bake-off v2, one model per process: python test_models.py <model_id> <out.json>
# Process isolation so a native crash in one model cannot kill the others.
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from services import ai_voice_detection as a  # noqa: E402

model_id = sys.argv[1]
out_path = Path(sys.argv[2])

CLIPS = {
    "jfk_real.wav": "REAL human (JFK public-domain)",
    "libri_real.wav": "REAL human (LibriSpeech sample)",
    "sapi_fake.wav": "FAKE (SAPI TTS, doc sentence)",
}

a.MODEL_ID = model_id
entry: dict = {"model": model_id, "clips": {}}
for clip, desc in CLIPS.items():
    try:
        out = a.detect_ai_voice(clip)
        entry["clips"][clip] = {
            "desc": desc,
            "risk_pct": out["risk_pct"],
            "heuristic_risk_pct": out["heuristic_risk_pct"],
            "scores": out["scores"],
            "error": out["error"],
        }
    except Exception as exc:  # noqa: BLE001
        entry["clips"][clip] = {"desc": desc, "error": str(exc)}
    out_path.write_text(json.dumps(entry, indent=2))  # checkpoint after every clip
