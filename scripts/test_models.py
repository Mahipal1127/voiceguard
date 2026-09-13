# Compare the shortlisted anti-spoofing models on the same TTS probes.
# Results are written to a file (stdout can be lost when piped on Windows).
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from services import ai_voice_detection as a  # noqa: E402

OUT = ROOT / "model-compare-results.json"
CLIPS = ["tts_probe1.wav", "tts_probe2.wav"]
MODELS = [
    "MelodyMachine/Deepfake-audio-detection-V2",
    "mo-thecreator/Deepfake-audio-detection",
    "Bisher/wav2vec2_ASV_deepfake_audio_detection",
]

results: list[dict] = []
for model_id in MODELS:
    a._pipeline = None
    a.MODEL_ID = model_id
    entry: dict = {"model": model_id, "clips": {}}
    try:
        for clip in CLIPS:
            out = a.detect_ai_voice(clip)
            entry["clips"][clip] = {
                "risk_pct": out["risk_pct"],
                "heuristic_risk_pct": out["heuristic_risk_pct"],
                "scores": out["scores"],
                "error": out["error"],
            }
    except Exception as exc:  # noqa: BLE001
        entry["fatal"] = str(exc)
    results.append(entry)
    OUT.write_text(json.dumps(results, indent=2))
