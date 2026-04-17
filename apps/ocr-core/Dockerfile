# Stash OCR API: FastAPI + DocTR + PyTorch (CPU).
# Build from repository root:
#   docker build -f apps/ocr-core/Dockerfile -t ocr-core:latest .

FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libglib2.0-0 \
    libgomp1 \
    libgl1 \
    libxcb1 \
    libx11-6 \
    libxext6 \
    libsm6 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    XDG_CACHE_HOME=/app/.cache \
    PORT=8765

WORKDIR /app

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY apps/ocr-core/requirements.txt /tmp/requirements.txt
RUN sed 's/^opencv-python/opencv-python-headless/' /tmp/requirements.txt | \
    grep -vE '^(torch|torchvision)(\[|>|=|<|$)' > /tmp/req.txt && \
    pip install --no-cache-dir -r /tmp/req.txt && \
    pip uninstall -y opencv-python 2>/dev/null || true && \
    pip install --no-cache-dir --force-reinstall "opencv-python-headless>=4.9.0,<5"

COPY apps/ocr-core/stashOrc.py apps/ocr-core/stash_api.py ./

RUN useradd --create-home --uid 1000 appuser && \
    mkdir -p /app/.cache /app/debug_stash && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
    CMD curl -fsS http://127.0.0.1:$$PORT/health || exit 1

CMD ["sh", "-c", "exec python -m uvicorn stash_api:app --host 0.0.0.0 --port ${PORT:-8765}"]
