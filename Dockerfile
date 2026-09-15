# Railway deploy (repo root) — Railway/Railpack auto-detects this file, so no
# "Root Directory" setting is needed. Backend-only image: the UI lives on
# Netlify. (Same image as backend/Dockerfile and deploy/hf-space/Dockerfile.)
#
# Linux wheels: PyTorch / CTranslate2 / transformers publish cp312 linux wheels.
FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pre-install the CPU build of PyTorch: on Linux the default PyPI wheel pulls
# a multi-GB CUDA stack. Installing this first satisfies speechbrain's
# torch requirement, so `pip install -r requirements.txt` keeps the CPU build.
RUN python -m pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r backend/requirements.txt

# Bake the model weights into the image: no Hugging Face downloads at
# container startup (their anonymous rate-limiting made first analyses hang
# for minutes on Railway). Weights come from the local models_store (~590 MB).
COPY backend/models_store /app/models_store

COPY backend/ .

# Railway injects PORT; 8000 keeps local docker runs identical.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
