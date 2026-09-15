# Railway deployment (Path C in DEPLOY.md).
# Railway builds this Dockerfile when the service "Root Directory" is set to
# backend/ — it injects PORT, which the start command below honors.
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

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Railway injects PORT; 8000 keeps local docker runs identical.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
