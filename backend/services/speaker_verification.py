"""Speaker verification via speechbrain ECAPA-TDNN (Phase 4).

Model: speechbrain/spkrec-ecapa-voxceleb (free, pip-installable, pretrained
on VoxCeleb, ~80 MB — downloads into backend/models_store/ on first use).

Enrollment (POST /enroll) stores the 192-dim embedding as JSON plus the raw
clip; /analyze compares the clip's embedding against every enrolled voice
and reports the best match as a 0-100 "Speaker Match %".

Calibration (documented so it can be explained to judges):
  raw cosine similarity s in [-1, 1]
  typical same speaker ~ 0.80-0.95, different speakers ~ 0.20-0.50
  match% = clamp((s - MATCH_FLOOR) / (MATCH_CEIL - MATCH_FLOOR)) * 100
Guardrail: with no reference voice enrolled the caller gets an explicit
"unknown/neutral" state — never a silent 0 or 100.
"""

import os

# Cap torch threading BEFORE torch is imported anywhere — the three signals
# run in parallel worker threads, so each model gets a share of the cores
# instead of every model fighting over all of them.
os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("MKL_NUM_THREADS", "4")

import threading
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parent.parent / "models_store"
MODELS_DIR.mkdir(exist_ok=True)

MODEL_ID = "speechbrain/spkrec-ecapa-voxceleb"

MATCH_FLOOR = 0.20
MATCH_CEIL = 0.85

_classifier = None
_lock = threading.Lock()


def _materialize_from_hf_cache() -> None:
    """Copy the HF snapshot into savedir where symlinks are unavailable.

    On Windows without Developer Mode, speechbrain's fetch cannot symlink
    the huggingface cache into savedir (WinError 1314). We clear any partial
    savedir and copy the snapshot files with plain file copies instead;
    from_hparams then finds everything locally on retry.
    """
    import shutil

    from huggingface_hub import snapshot_download

    target = MODELS_DIR / "ecapa-voxceleb"
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True, exist_ok=True)
    snapshot_dir = Path(snapshot_download(MODEL_ID))
    for item in snapshot_dir.iterdir():
        dst = target / item.name
        if item.is_dir():
            shutil.copytree(item, dst, dirs_exist_ok=True)
        else:
            shutil.copy2(item, dst)
            # speechbrain 1.x fetches e.g. "label_encoder.ckpt" while the HF
            # repo ships "label_encoder.txt" — provide the renamed twin so
            # savedir satisfies the lookup without a symlink.
            if item.suffix == ".txt":
                shutil.copy2(item, target / (item.stem + ".ckpt"))


def _get_classifier():
    """Lazy-load and cache the ECAPA-TDNN encoder (thread-safe)."""
    global _classifier
    from speechbrain.inference.speaker import EncoderClassifier

    with _lock:
        if _classifier is None:
            try:
                _classifier = EncoderClassifier.from_hparams(
                    source=MODEL_ID,
                    savedir=str(MODELS_DIR / "ecapa-voxceleb"),
                    run_opts={"device": "cpu"},
                )
            except Exception:
                # Windows without Developer Mode: symlink creation is denied
                # (WinError 1314) — materialize the snapshot by copy, retry.
                _materialize_from_hf_cache()
                _classifier = EncoderClassifier.from_hparams(
                    source=MODEL_ID,
                    savedir=str(MODELS_DIR / "ecapa-voxceleb"),
                    run_opts={"device": "cpu"},
                )
        return _classifier


def warmup() -> None:
    """Preload the model — called by POST /warmup."""
    _get_classifier()


def prepare_16k_mono(audio_path: str) -> Path:
    """Convert any supported clip to 16 kHz mono WAV via ffmpeg.

    ECAPA-TDNN expects 16 kHz audio; the browser records 48 kHz opus and
    uploads vary, so inputs are normalized deterministically. The caller
    deletes the temp file when done.
    """
    import subprocess
    import uuid

    src = Path(audio_path)
    dst = src.parent / f"{src.stem}-{uuid.uuid4().hex[:8]}.16k.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", "16000", str(dst)],
        check=True,
        capture_output=True,
        timeout=60,
    )
    return dst


def load_wav16k_mono(path: str):
    """Read the ffmpeg-normalized 16 kHz WAV with the stdlib wave module.

    torchaudio 2.11 routes .load through torchcodec (not available on this
    Windows setup), so we decode with the stdlib instead. prepare_16k_mono
    guarantees 16 kHz mono 16-bit PCM output.
    """
    import wave

    import numpy as np
    import torch

    with wave.open(path, "rb") as wf:
        sr = wf.getframerate()
        channels = wf.getnchannels()
        width = wf.getsampwidth()
        frames = wf.readframes(wf.getnframes())
    if sr != 16000 or channels != 1 or width != 2:
        raise ValueError(f"expected 16 kHz mono 16-bit WAV, got {sr} Hz / {channels} ch / {width * 8}-bit")
    return torch.from_numpy(np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0)


def extract_embedding(audio_path: str) -> list[float]:
    """Return the 192-dim ECAPA-TDNN embedding as a plain list."""
    import torch

    classifier = _get_classifier()
    audio = load_wav16k_mono(audio_path)
    # 10 s is plenty for a stable voiceprint — bounds CPU time on long clips.
    audio = audio[: 16000 * 10]
    # speechbrain 1.1.x exposes encode_batch (batch, time); torchaudio.load
    # routes through torchcodec on this setup, so decode via ffmpeg + wave.
    with torch.no_grad():
        emb = classifier.encode_batch(audio.unsqueeze(0))
    return emb.squeeze().tolist()


def cosine_similarity(a: list[float], b: list[float]) -> float:
    import math

    if not a or len(a) != len(b):
        raise ValueError("embeddings must be non-empty and same length")
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return max(-1.0, min(1.0, dot / (na * nb)))


def similarity_to_match_pct(similarity: float) -> float:
    """Map raw cosine similarity to a calibrated 0-100 match percentage."""
    span = MATCH_CEIL - MATCH_FLOOR
    clamped = max(0.0, min(1.0, (similarity - MATCH_FLOOR) / span))
    return round(clamped * 100, 1)
