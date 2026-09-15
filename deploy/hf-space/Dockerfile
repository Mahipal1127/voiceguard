# Dockerfile for the free Hugging Face Space deployment (Path B in DEPLOY.md).
# The Space repo root must contain: the contents of backend/ + this Dockerfile
# + a README.md starting with the front-matter shown in deploy/hf-space-readme.md
#
# Linux wheels: PyTorch / CTranslate2 / transformers all publish cp312 linux
# wheels, so the Space runs Python 3.12 (validated on 3.14 for local dev).
FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# HF Spaces expose one HTTP port (7860 by default for the docker SDK).
# Set ALLOWED_ORIGINS in Space → Settings → Variables to your Netlify URL.
ENV ALLOWED_ORIGINS=""
EXPOSE 7860

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
