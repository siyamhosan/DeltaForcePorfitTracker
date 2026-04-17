"""HTTP API for stash OCR: POST image → structured stash fields."""

import time
from dataclasses import replace
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from stashOrc import StashApiResult, process_stash_image_bgr

app = FastAPI(title="Stash OCR", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _decode_upload(content: bytes) -> Optional[np.ndarray]:
    arr = np.frombuffer(content, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return bgr


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)) -> dict:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty body")
    t0 = time.perf_counter()
    bgr = _decode_upload(raw)
    if bgr is None:
        raise HTTPException(status_code=400, detail="Could not decode image bytes (use PNG/JPEG/WebP)")
    result: StashApiResult = process_stash_image_bgr(bgr)
    elapsed_ms = int(round((time.perf_counter() - t0) * 1000.0))
    return replace(result, TimeTakenMs=elapsed_ms).to_api_dict()


def main() -> None:
    import uvicorn

    uvicorn.run("stash_api:app", host="0.0.0.0", port=8765, reload=False)


if __name__ == "__main__":
    main()
