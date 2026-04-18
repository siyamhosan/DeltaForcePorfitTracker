import argparse
import json
import math
import os
import re
import resource
import sys
import time
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Tuple, Union

import cv2
import numpy as np
from doctr.models import detection_predictor, recognition_predictor
from doctr.utils.geometry import detach_scores, extract_crops


# Total Assets in this HUD: NNNN.NM or solid amounts like 34M.
STASH_M_VALUE_RE = re.compile(r"^\$?\d{1,4}(?:\.\d)?M$", re.IGNORECASE)
# Fallback when OCR drops leading zeros or uses K/B
ASSET_VALUE_RELAXED_RE = re.compile(r"^\$?\d{1,3}(?:[.,]\d{1,2})?[KMB]$", re.IGNORECASE)


@dataclass
class StashSearchConfig:
    """Search distances are *reference pixels* at ``ref_width``×``ref_height`` (default 2559×1438).
    At runtime, :meth:`resolve` scales them to the actual OCR frame size so any resolution works."""

    ref_width: int = 2559
    ref_height: int = 1438
    anchor_x_band_ref: int = 100
    y_min_below_anchor_ref: int = 8
    stash_value_box_height_ref: int = 50
    row_group_y_ref: int = 20
    score_y_ref_below_anchor_ref: int = 33
    score_y_scale_ref: float = 25.0
    score_x_scale_ref: float = 100.0
    max_stash_millions_m: float = 1000.0

    def to_public_dict(self) -> Dict[str, Union[int, float]]:
        return {k: getattr(self, k) for k in self.__dataclass_fields__}

    def resolve(self, image_w: int, image_h: int) -> "ResolvedStashSearch":
        rw = max(1, self.ref_width)
        rh = max(1, self.ref_height)
        sx = image_w / float(rw)
        sy = image_h / float(rh)
        return ResolvedStashSearch(
            image_w=image_w,
            image_h=image_h,
            scale_x=round(sx, 6),
            scale_y=round(sy, 6),
            anchor_x_band_px=max(1, int(round(self.anchor_x_band_ref * sx))),
            y_min_below_anchor_px=max(0, int(round(self.y_min_below_anchor_ref * sy))),
            stash_value_box_height_px=max(1, int(round(self.stash_value_box_height_ref * sy))),
            row_group_y_px=max(1, int(round(self.row_group_y_ref * sy))),
            score_y_ref_below_anchor_px=max(1, int(round(self.score_y_ref_below_anchor_ref * sy))),
            score_y_scale_px=max(1e-6, float(self.score_y_scale_ref * sy)),
            score_x_scale_px=max(1e-6, float(self.score_x_scale_ref * sx)),
        )


@dataclass(frozen=True)
class ResolvedStashSearch:
    image_w: int
    image_h: int
    scale_x: float
    scale_y: float
    anchor_x_band_px: int
    y_min_below_anchor_px: int
    stash_value_box_height_px: int
    row_group_y_px: int
    score_y_ref_below_anchor_px: int
    score_y_scale_px: float
    score_x_scale_px: float

    def to_public_dict(self) -> Dict[str, Union[int, float]]:
        return {k: getattr(self, k) for k in self.__dataclass_fields__}


# Single source of truth for CLI defaults
_SEARCH_DEFAULTS = StashSearchConfig()


def _rss_mb_peak() -> float:
    usage = resource.getrusage(resource.RUSAGE_SELF)
    rss = float(usage.ru_maxrss)
    if sys.platform == "darwin":
        return rss / (1024.0 * 1024.0)
    return rss / 1024.0


def _normalize_text(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def _span_joined_norm(tokens: List[Dict]) -> str:
    return _normalize_text(" ".join(t["text"] for t in tokens))


def _clean_amount_text(text: str) -> str:
    return text.strip().replace(" ", "").upper().replace("O", "0")


def _value_to_millions(text: str) -> Optional[float]:
    cleaned = _clean_amount_text(text).replace("$", "")
    match = re.match(r"^(\d{1,4}(?:[.,]\d{1,2})?)([KMB])?$", cleaned)
    if not match:
        return None
    value = float(match.group(1).replace(",", "."))
    suffix = (match.group(2) or "M").upper()
    factor = {"K": 0.001, "M": 1.0, "B": 1000.0}
    return value * factor[suffix]


def _stash_m_within_cap(cleaned: str, cfg: StashSearchConfig) -> bool:
    if not STASH_M_VALUE_RE.match(cleaned):
        return True
    m = _value_to_millions(cleaned)
    if m is None:
        return False
    return m <= cfg.max_stash_millions_m + 1e-6


def _conf_to_pct_int(conf: float) -> int:
    return max(0, min(100, int(round(float(conf) * 100.0))))


def _find_value_crop_only(
    items: List[Dict],
    image_w: int,
    image_h: int,
    cfg: StashSearchConfig,
) -> Optional[Dict[str, Any]]:
    """When the image is a tight crop with only the stash amount (no Total Assets label)."""
    cx, cy = image_w / 2.0, image_h / 2.0
    radius = math.hypot(image_w, image_h) / 2.0
    stash_strict: List[Tuple[float, Dict]] = []
    relaxed_kmb: List[Tuple[float, Dict]] = []

    for token in items:
        cleaned = _clean_amount_text(token["text"])
        dist = math.hypot(float(token["x"]) - cx, float(token["y"]) - cy)
        center_boost = 0.35 * (1.0 - min(1.0, dist / max(radius, 1e-6)))

        if STASH_M_VALUE_RE.match(cleaned):
            if not _stash_m_within_cap(cleaned, cfg):
                continue
            score = float(token["conf"]) + center_boost
            stash_strict.append((score, token))
        elif ASSET_VALUE_RELAXED_RE.match(cleaned) and re.search(r"[KMB]$", cleaned, re.IGNORECASE):
            score = float(token["conf"]) * 0.88 + center_boost * 0.6
            relaxed_kmb.append((score, token))

    pool = stash_strict if stash_strict else relaxed_kmb
    if not pool:
        return None

    pool.sort(key=lambda pair: pair[0], reverse=True)
    best = pool[0][1]
    cleaned_best = _clean_amount_text(best["text"])
    return {
        "text": cleaned_best,
        "confidence": float(best["conf"]),
        "x": int(best["x"]),
        "y": int(best["y"]),
        "bbox": [float(x) for x in best["bbox"]],
        "millions": _value_to_millions(best["text"]),
        "format": "stash_m" if STASH_M_VALUE_RE.match(cleaned_best) else "relaxed",
        "mode": "crop_only",
    }


def _find_value_full_crop_only(page_rgb: np.ndarray, cfg: StashSearchConfig) -> Optional[Dict[str, Any]]:
    """Recognition-only fallback for tiny crops where detection fails."""
    h, w = page_rgb.shape[0], page_rgb.shape[1]
    if h <= 0 or w <= 0:
        return None
    scales = [2.0] if not _should_try_tiny_upscale(w, h) else [2.0, 3.0, 4.0]
    _, reco_model = _get_models()
    best: Optional[Tuple[int, float, str]] = None
    for scale in scales:
        probe = cv2.resize(page_rgb, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC) if scale != 1.0 else page_rgb
        pred = reco_model([probe])[0]
        text, conf = str(pred[0]).strip(), float(pred[1])
        cleaned = _clean_amount_text(text)
        if STASH_M_VALUE_RE.match(cleaned):
            if not _stash_m_within_cap(cleaned, cfg):
                continue
            rank = 2
        elif ASSET_VALUE_RELAXED_RE.match(cleaned) and re.search(r"[KMB]$", cleaned, re.IGNORECASE):
            rank = 1
        else:
            continue
        if best is None or (rank, conf) > (best[0], best[1]):
            best = (rank, conf, cleaned)
    if best is None:
        return None
    cleaned = best[2]
    return {
        "text": cleaned,
        "confidence": float(best[1]),
        "x": int(round(w / 2.0)),
        "y": int(round(h / 2.0)),
        "bbox": [0.0, 0.0, 1.0, 1.0],
        "millions": _value_to_millions(cleaned),
        "format": "stash_m" if STASH_M_VALUE_RE.match(cleaned) else "relaxed",
        "mode": "full_crop_reco",
    }


@dataclass
class StashApiResult:
    FoundTotalAssetsAnchor: bool
    TotalAssetsAnchorConfidence: int
    StashValue: str
    StashValueConfidence: int
    TimeTakenMs: int = 0
    StashValueBoundingBox: Optional[Dict[str, int]] = None
    StashSearchBandPx: Optional[Dict[str, int]] = None
    DebugOutputDir: Optional[str] = None

    def to_api_dict(self) -> Dict[str, Union[bool, int, str, Dict[str, int], None]]:
        return {
            "FoundTotalAssetsAnchor": self.FoundTotalAssetsAnchor,
            "TotalAssetsAnchorConfidence": self.TotalAssetsAnchorConfidence,
            "StashValue": self.StashValue,
            "StashValueConfidence": self.StashValueConfidence,
            "TimeTakenMs": self.TimeTakenMs,
            "StashValueBoundingBox": self.StashValueBoundingBox,
            "StashSearchBandPx": self.StashSearchBandPx,
            "DebugOutputDir": self.DebugOutputDir,
        }


def process_stash_image_bgr(
    image_bgr: np.ndarray,
    *,
    search_config: Optional[StashSearchConfig] = None,
    debug: Optional[bool] = None,
    debug_dir: Optional[Union[str, Path]] = None,
) -> StashApiResult:
    """Run stash OCR on a BGR image (OpenCV). Full HUD or tight crop of the value only."""
    t0 = time.perf_counter()
    cfg = search_config or StashSearchConfig()
    do_debug = _env_api_debug_enabled() if debug is None else bool(debug)
    out_root: Optional[Path] = None
    if image_bgr is None or image_bgr.size == 0:
        return StashApiResult(False, 0, "", 0, _elapsed_ms(t0))

    page_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    h, w = page_rgb.shape[0], page_rgb.shape[1]
    rs = cfg.resolve(w, h)
    ocr_expand = max(1, int(round(3 * min(rs.scale_x, rs.scale_y))))
    items = _ocr_items(page_rgb, expand_px=ocr_expand)

    anchor = _find_assets_anchor(items, h, w, rs)
    anchor_conf = _conf_to_pct_int(anchor["conf"]) if anchor else 0
    search_band: Optional[Tuple[int, int, int, int]] = (
        _search_band_rect(anchor, h, w, rs) if anchor else None
    )

    value: Optional[Dict[str, Any]] = None
    if anchor:
        value = _find_value_under_anchor(items, anchor, h, cfg, rs, include_candidates=False)

    if value is None:
        value = _find_value_crop_only(items, w, h, cfg)
    if value is None:
        value = _find_value_full_crop_only(page_rgb, cfg)

    stash_text = _clean_amount_text(value["text"]) if value else ""
    stash_conf = _conf_to_pct_int(value["confidence"]) if value else 0

    stash_value_box: Optional[Dict[str, int]] = None
    stash_search_api: Optional[Dict[str, int]] = None
    if value and stash_text and value.get("bbox") is not None:
        stash_value_box = _pixel_rect_to_api_box(_bbox_rel_to_px(value["bbox"], w, h))
    if anchor and search_band is not None and stash_text:
        stash_search_api = _pixel_rect_to_api_box(search_band)

    debug_dir_s: Optional[str] = None
    if do_debug:
        out_root = _resolve_api_ingest_debug_dir(debug_dir)
        out_root.mkdir(parents=True, exist_ok=True)
        debug_dir_s = str(out_root)
        _write_bgr_png(out_root / "00_input_bgr.png", image_bgr)
        if items:
            _write_bgr_png(out_root / "01_ocr_all_boxes.png", _draw_ocr_overlay(page_rgb, items))
        _write_bgr_png(
            out_root / "02_ocr_parsed.png",
            _draw_ocr_overlay(
                page_rgb,
                items,
                anchor=anchor,
                value=value,
                search_band=search_band,
            ),
        )

    return StashApiResult(
        FoundTotalAssetsAnchor=anchor is not None,
        TotalAssetsAnchorConfidence=anchor_conf,
        StashValue=stash_text,
        StashValueConfidence=stash_conf,
        TimeTakenMs=_elapsed_ms(t0),
        StashValueBoundingBox=stash_value_box,
        StashSearchBandPx=stash_search_api,
        DebugOutputDir=debug_dir_s,
    )


def _elapsed_ms(t0: float) -> int:
    return int(round((time.perf_counter() - t0) * 1000.0))


def process_stash_image_path(
    path: Union[str, Path],
    *,
    search_config: Optional[StashSearchConfig] = None,
    debug: Optional[bool] = None,
    debug_dir: Optional[Union[str, Path]] = None,
) -> StashApiResult:
    t0 = time.perf_counter()
    p = Path(path)
    bgr = cv2.imread(str(p))
    if bgr is None:
        return StashApiResult(False, 0, "", 0, _elapsed_ms(t0))
    r = process_stash_image_bgr(bgr, search_config=search_config, debug=debug, debug_dir=debug_dir)
    return StashApiResult(
        FoundTotalAssetsAnchor=r.FoundTotalAssetsAnchor,
        TotalAssetsAnchorConfidence=r.TotalAssetsAnchorConfidence,
        StashValue=r.StashValue,
        StashValueConfidence=r.StashValueConfidence,
        TimeTakenMs=_elapsed_ms(t0),
        StashValueBoundingBox=r.StashValueBoundingBox,
        StashSearchBandPx=r.StashSearchBandPx,
        DebugOutputDir=r.DebugOutputDir,
    )


def _iter_preprocess_variants(image_bgr: np.ndarray, mode: str = "raw") -> Iterator[Tuple[str, np.ndarray, float]]:
    t0 = time.perf_counter()
    raw = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    yield "01_raw_rgb", raw, time.perf_counter() - t0
    ih, iw = int(image_bgr.shape[0]), int(image_bgr.shape[1])
    if _should_try_tiny_upscale(iw, ih):
        t0 = time.perf_counter()
        scale = _tiny_ocr_upscale_factor(iw, ih)
        tiny_upscaled = cv2.resize(image_bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        yield "01b_tiny_upscale_rgb", cv2.cvtColor(tiny_upscaled, cv2.COLOR_BGR2RGB), time.perf_counter() - t0
    if (mode or "raw").lower() != "all":
        return
    t0 = time.perf_counter()
    upscaled = cv2.resize(image_bgr, None, fx=1.8, fy=1.8, interpolation=cv2.INTER_CUBIC)
    lab = cv2.cvtColor(upscaled, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    l_channel = clahe.apply(l_channel)
    enhanced = cv2.cvtColor(cv2.merge([l_channel, a_channel, b_channel]), cv2.COLOR_LAB2BGR)
    yield "02_clahe_upscale", cv2.cvtColor(enhanced, cv2.COLOR_BGR2RGB), time.perf_counter() - t0


def _write_rgb_png(path: Path, rgb: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    cv2.imwrite(str(path), bgr)


def _write_bgr_png(path: Path, bgr: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), bgr)


def _bbox_rel_to_px(bbox: List[float], w: int, h: int) -> Tuple[int, int, int, int]:
    xmin, ymin, xmax, ymax = bbox
    max_x = max(0, w - 1)
    max_y = max(0, h - 1)
    x0 = max(0, min(max_x, int(round(float(xmin) * max_x))))
    y0 = max(0, min(max_y, int(round(float(ymin) * max_y))))
    x1 = max(0, min(max_x, int(round(float(xmax) * max_x))))
    y1 = max(0, min(max_y, int(round(float(ymax) * max_y))))
    return x0, y0, x1, y1


def _draw_ocr_overlay(
    page_rgb: np.ndarray,
    items: List[Dict],
    *,
    anchor: Optional[Dict] = None,
    value: Optional[Dict] = None,
    search_band: Optional[Tuple[int, int, int, int]] = None,
) -> np.ndarray:
    vis = cv2.cvtColor(page_rgb.copy(), cv2.COLOR_RGB2BGR)
    h, w = vis.shape[:2]
    if search_band is not None:
        sx0, sy0, sx1, sy1 = search_band
        cv2.rectangle(vis, (sx0, sy0), (sx1, sy1), (255, 180, 0), 1)
    for it in items:
        x0, y0, x1, y1 = _bbox_rel_to_px(it["bbox"], w, h)
        cv2.rectangle(vis, (x0, y0), (x1, y1), (0, 220, 0), 1)
        label = f"{it['text'][:24]} {it['conf']:.2f}"
        cv2.putText(vis, label, (x0, max(12, y0 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1, cv2.LINE_AA)
    if anchor is not None:
        ax, ay = anchor["x"], anchor["y"]
        cv2.circle(vis, (ax, ay), 8, (255, 0, 255), 2)
        cv2.putText(vis, "anchor", (ax + 10, ay), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 0, 255), 1, cv2.LINE_AA)
    if value is not None:
        vx, vy = value["x"], value["y"]
        cv2.circle(vis, (vx, vy), 8, (0, 165, 255), 2)
        cv2.putText(vis, value.get("text", ""), (vx + 10, vy), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 165, 255), 1, cv2.LINE_AA)
    return vis


@lru_cache(maxsize=1)
def _get_models():
    det_model = detection_predictor(
        arch="db_mobilenet_v3_large",
        pretrained=True,
        assume_straight_pages=True,
        batch_size=1,
    )
    reco_model = recognition_predictor(arch="crnn_vgg16_bn", pretrained=True)
    return det_model, reco_model


def _expand_relative_boxes(boxes: np.ndarray, img_shape: Tuple[int, int, int], expand_px: int) -> np.ndarray:
    if boxes.size == 0:
        return boxes
    h, w = img_shape[:2]
    dx = float(expand_px) / max(1, w)
    dy = float(expand_px) / max(1, h)
    expanded = boxes.copy()
    expanded[:, 0] = np.clip(expanded[:, 0] - dx, 0.0, 1.0)
    expanded[:, 1] = np.clip(expanded[:, 1] - dy, 0.0, 1.0)
    expanded[:, 2] = np.clip(expanded[:, 2] + dx, 0.0, 1.0)
    expanded[:, 3] = np.clip(expanded[:, 3] + dy, 0.0, 1.0)
    return expanded


def _ocr_items(page_rgb: np.ndarray, *, expand_px: int = 3) -> List[Dict]:
    det_model, reco_model = _get_models()
    loc_pred = det_model([page_rgb], return_maps=False)[0]
    boxes_with_scores = list(loc_pred.values())[0]
    boxes_rel_list, scores_list = detach_scores([boxes_with_scores])
    boxes_rel = _expand_relative_boxes(boxes_rel_list[0], page_rgb.shape, expand_px=expand_px)
    scores = scores_list[0]

    crops = extract_crops(page_rgb, boxes_rel)
    preds = reco_model(crops) if crops else []

    h, w = page_rgb.shape[:2]
    items: List[Dict] = []
    for (xmin, ymin, xmax, ymax), _det_score, (text, conf) in zip(boxes_rel, scores, preds):
        token = text.strip()
        if not token or conf < 0.2:
            continue
        x_center = int(((xmin + xmax) / 2.0) * w)
        y_center = int(((ymin + ymax) / 2.0) * h)
        items.append(
            {
                "text": token,
                "conf": float(conf),
                "x": x_center,
                "y": y_center,
                "bbox": [float(xmin), float(ymin), float(xmax), float(ymax)],
            }
        )
    items.sort(key=lambda it: (it["y"], it["x"]))
    return items


def _group_rows(items: List[Dict], y_thresh: int) -> List[List[Dict]]:
    rows: List[List[Dict]] = []
    for item in items:
        assigned = False
        for row in rows:
            row_y = sum(it["y"] for it in row) / len(row)
            if abs(item["y"] - row_y) <= y_thresh:
                row.append(item)
                assigned = True
                break
        if not assigned:
            rows.append([item])
    for row in rows:
        row.sort(key=lambda it: it["x"])
    rows.sort(key=lambda row: sum(it["y"] for it in row) / len(row))
    return rows


def _total_assets_label_tokens(row: List[Dict]) -> Optional[List[Dict]]:
    row_sorted = sorted(row, key=lambda t: t["x"])
    n = len(row_sorted)
    if n == 0:
        return None

    best_span: Optional[List[Dict]] = None
    best_len = 10**9
    for i in range(n):
        for j in range(i, n):
            span = row_sorted[i : j + 1]
            joined = _span_joined_norm(span)
            if "totalassets" not in joined:
                continue
            if len(span) < best_len:
                best_len = len(span)
                best_span = span

    if best_span is not None:
        return best_span

    assets_tokens = [t for t in row_sorted if "assets" in _normalize_text(t["text"])]
    if not assets_tokens:
        return None
    anchor_tok = max(assets_tokens, key=lambda t: t["x"])
    totals_left = [t for t in row_sorted if t["x"] <= anchor_tok["x"] and "total" in _normalize_text(t["text"])]
    if totals_left:
        left_total = max(totals_left, key=lambda t: t["x"])
        return [left_total, anchor_tok]
    return [anchor_tok]


def _anchor_from_label_tokens(label_tokens: List[Dict], page_w: int, page_h: int) -> Dict:
    xs0: List[int] = []
    xs1: List[int] = []
    ys: List[float] = []
    for t in label_tokens:
        x0, y0, x1, y1 = _bbox_rel_to_px(t["bbox"], page_w, page_h)
        xs0.append(x0)
        xs1.append(x1)
        ys.append((y0 + y1) / 2.0)
    cx = int((min(xs0) + max(xs1)) / 2.0)
    cy = int(sum(ys) / len(ys))
    text = " ".join(t["text"] for t in sorted(label_tokens, key=lambda t: t["x"]))
    conf = sum(float(t["conf"]) for t in label_tokens) / max(1, len(label_tokens))
    return {"text": text, "x": cx, "y": cy, "conf": float(conf)}


def _find_assets_anchor(
    items: List[Dict], page_h: int, page_w: int, rs: ResolvedStashSearch
) -> Optional[Dict]:
    rows = _group_rows(items, y_thresh=rs.row_group_y_px)
    best_anchor = None
    best_score = -1.0
    for row in rows:
        row_text = " ".join(token["text"] for token in row)
        row_norm = _normalize_text(row_text)
        has_total_assets = "totalassets" in row_norm or ("total" in row_norm and "assets" in row_norm)
        if not has_total_assets:
            continue
        label_tokens = _total_assets_label_tokens(row)
        if not label_tokens:
            continue
        anchor = _anchor_from_label_tokens(label_tokens, page_w, page_h)
        row_conf = sum(float(t["conf"]) for t in label_tokens) / max(1, len(label_tokens))
        if row_conf > best_score:
            best_score = row_conf
            best_anchor = anchor
    return best_anchor


def _find_value_under_anchor(
    items: List[Dict],
    anchor: Dict,
    image_h: int,
    cfg: StashSearchConfig,
    rs: ResolvedStashSearch,
    *,
    include_candidates: bool = False,
) -> Optional[Dict]:
    anchor_x, anchor_y = anchor["x"], anchor["y"]
    y_min = anchor_y + rs.y_min_below_anchor_px
    y_max = min(image_h - 1, y_min + max(0, rs.stash_value_box_height_px) - 1)
    x_band = rs.anchor_x_band_px

    stash_strict: List[Tuple[float, Dict]] = []
    relaxed: List[Tuple[float, Dict]] = []

    for token in items:
        cleaned = _clean_amount_text(token["text"])
        if token["y"] < y_min or token["y"] > y_max:
            continue
        if abs(token["x"] - anchor_x) > x_band:
            continue

        if STASH_M_VALUE_RE.match(cleaned):
            if not _stash_m_within_cap(cleaned, cfg):
                continue
            y_bonus = 1.5 - min(
                1.5,
                abs(token["y"] - (anchor_y + rs.score_y_ref_below_anchor_px)) / rs.score_y_scale_px,
            )
            x_bonus = 1.5 - min(1.5, abs(token["x"] - anchor_x) / rs.score_x_scale_px)
            score = token["conf"] + y_bonus + x_bonus
            stash_strict.append((score, token))
        elif ASSET_VALUE_RELAXED_RE.match(cleaned):
            score = token["conf"] * 0.8
            relaxed.append((score, token))

    candidates = stash_strict if stash_strict else relaxed

    if not candidates:
        return None

    candidates.sort(key=lambda pair: pair[0], reverse=True)
    best = candidates[0][1]
    out: Dict[str, Any] = {
        "text": _clean_amount_text(best["text"]),
        "confidence": float(best["conf"]),
        "x": int(best["x"]),
        "y": int(best["y"]),
        "bbox": [float(x) for x in best["bbox"]],
        "millions": _value_to_millions(best["text"]),
        "format": "stash_m" if STASH_M_VALUE_RE.match(_clean_amount_text(best["text"])) else "relaxed",
        "candidate_counts": {"stash_m": len(stash_strict), "relaxed": len(relaxed)},
    }
    if include_candidates:
        out["_candidates_debug"] = {
            "used": "stash_m" if stash_strict else "relaxed",
            "stash_m": [(round(s, 4), t["text"], float(t["conf"])) for s, t in stash_strict[:8]],
            "relaxed": [(round(s, 4), t["text"], float(t["conf"])) for s, t in relaxed[:8]],
        }
    return out


def _value_rank_tuple(value: Dict) -> Tuple[int, int, float]:
    text = _clean_amount_text(value.get("text", ""))
    stash_m = 1 if STASH_M_VALUE_RE.match(text) else 0
    has_suffix = 1 if re.search(r"[KMB]$", text, re.IGNORECASE) else 0
    tier = 2 if stash_m else (1 if has_suffix else 0)
    conf = float(value.get("confidence", 0.0))
    not_plain_int = 0 if (text.isdigit() or re.fullmatch(r"\d{1,4}", text)) else 1
    return (tier, not_plain_int, conf)


def _is_better_result(candidate: Dict, current_best: Optional[Dict]) -> bool:
    if current_best is None:
        return True
    vc, vb = candidate["value"], current_best["value"]
    rc, rb = _value_rank_tuple(vc), _value_rank_tuple(vb)
    if rc != rb:
        return rc > rb
    return candidate["variant_index"] < current_best["variant_index"]


def _resolve_debug_dir(image_path: Path, debug_dir: Optional[Union[str, Path]]) -> Path:
    if debug_dir is not None:
        return Path(debug_dir).expanduser().resolve()
    stem = image_path.stem or "screenshot"
    return (Path.cwd() / "debug_stash" / f"{stem}_{int(time.time())}").resolve()


def _search_band_rect(
    anchor: Dict, image_h: int, image_w: int, rs: ResolvedStashSearch
) -> Tuple[int, int, int, int]:
    y_min = anchor["y"] + rs.y_min_below_anchor_px
    y_max = min(image_h - 1, y_min + max(0, rs.stash_value_box_height_px) - 1)
    x_band = rs.anchor_x_band_px
    return (
        max(0, anchor["x"] - x_band),
        y_min,
        min(image_w - 1, anchor["x"] + x_band),
        y_max,
    )


def _search_band_to_dict(rect: Tuple[int, int, int, int]) -> Dict[str, int]:
    x0, y0, x1, y1 = rect
    return {
        "x0": x0,
        "y0": y0,
        "x1": x1,
        "y1": y1,
        "width_px": x1 - x0 + 1,
        "height_px": y1 - y0 + 1,
    }


def _tiny_ocr_upscale_factor(image_w: int, image_h: int) -> float:
    shortest = min(image_w, image_h)
    if shortest < 28:
        return 6.0
    if shortest < 40:
        return 5.0
    if shortest < 56:
        return 4.0
    if shortest < 72:
        return 3.0
    return 2.5


def _should_try_tiny_upscale(image_w: int, image_h: int) -> bool:
    return image_w <= 240 or image_h <= 90


def _pixel_rect_to_api_box(rect: Tuple[int, int, int, int]) -> Dict[str, int]:
    d = _search_band_to_dict(rect)
    return {
        "X0": d["x0"],
        "Y0": d["y0"],
        "X1": d["x1"],
        "Y1": d["y1"],
        "WidthPx": d["width_px"],
        "HeightPx": d["height_px"],
    }


def _env_api_debug_enabled() -> bool:
    v = os.environ.get("STASH_API_DEBUG")
    if v is None:
        return True
    return v.strip().lower() not in ("0", "false", "no", "off")


def _resolve_api_ingest_debug_dir(debug_dir: Optional[Union[str, Path]]) -> Path:
    if debug_dir is not None:
        return Path(debug_dir).expanduser().resolve()
    return (Path.cwd() / "debug_stash" / f"api_{int(time.time() * 1000)}").resolve()


def extract_total_assets(
    image_path: str,
    *,
    debug: bool = False,
    debug_dir: Optional[Union[str, Path]] = None,
    preprocess: str = "raw",
    stats: bool = False,
    search_config: Optional[StashSearchConfig] = None,
    verbose: bool = False,
) -> Dict:
    cfg = search_config or StashSearchConfig()
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(str(path))

    t_wall0 = time.perf_counter()
    image_bgr = cv2.imread(str(path))
    read_image_s = time.perf_counter() - t_wall0
    if image_bgr is None:
        raise ValueError(f"Could not decode image: {path}")

    iw, ih = int(image_bgr.shape[1]), int(image_bgr.shape[0])
    telemetry: Dict[str, Any] = {
        "v": 1,
        "ms_total": 0.0,
        "outcome": "pending",
        "fail_stage": None,
        "variants_tried": [],
        "picked_variant": None,
        "anchor_seen": False,
        "value_tokens_considered": 0,
        "input_image_px": {"w": iw, "h": ih},
        "search_ref": cfg.to_public_dict(),
        "search_resolved": None,
        "search_box_px": None,
    }

    variant_timings: List[Dict[str, Union[str, float, int]]] = []
    out_root: Optional[Path] = None
    if debug:
        out_root = _resolve_debug_dir(path, debug_dir)
        out_root.mkdir(parents=True, exist_ok=True)
        _write_bgr_png(out_root / "00_input_bgr.png", image_bgr)

    def vlog(scope: str, name: str, *vals: object) -> None:
        if not verbose:
            return
        tail = (" " + " ".join(str(v) for v in vals)) if vals else ""
        print(f"🚀 ~ stashOrc ~ {scope} ~ {name}:{tail}", flush=True)

    best_result: Optional[Dict] = None
    variant_idx = 0
    for variant_name, page_rgb, preprocess_s in _iter_preprocess_variants(image_bgr, mode=preprocess):
        telemetry["variants_tried"].append(variant_name)
        if out_root is not None:
            _write_rgb_png(out_root / f"{variant_name}_preprocess.png", page_rgb)

        page_h, page_w = page_rgb.shape[0], page_rgb.shape[1]
        rs = cfg.resolve(page_w, page_h)
        ocr_expand = max(1, int(round(3 * min(rs.scale_x, rs.scale_y))))
        t_ocr0 = time.perf_counter()
        items = _ocr_items(page_rgb, expand_px=ocr_expand)
        ocr_s = time.perf_counter() - t_ocr0

        t_parse0 = time.perf_counter()
        anchor = _find_assets_anchor(items, page_h, page_w, rs)
        image_h = page_h
        value = None
        search_band = None
        if anchor:
            telemetry["anchor_seen"] = True
            value = _find_value_under_anchor(
                items,
                anchor=anchor,
                image_h=image_h,
                cfg=cfg,
                rs=rs,
                include_candidates=debug,
            )
            search_band = _search_band_rect(anchor, image_h, page_w, rs)
            if value:
                cc = value.get("candidate_counts") or {}
                telemetry["value_tokens_considered"] = max(
                    telemetry["value_tokens_considered"],
                    int(cc.get("stash_m", 0)) + int(cc.get("relaxed", 0)),
                )
        if value is None:
            value = _find_value_crop_only(items, page_w, page_h, cfg)
        if value is None:
            value = _find_value_full_crop_only(page_rgb, cfg)
        parse_s = time.perf_counter() - t_parse0
        variant_wall_s = float(preprocess_s) + ocr_s + parse_s

        if stats:
            variant_timings.append(
                {
                    "variant_index": variant_idx,
                    "variant_name": variant_name,
                    "preprocess_s": round(float(preprocess_s), 6),
                    "ocr_s": round(ocr_s, 6),
                    "parse_s": round(parse_s, 6),
                    "variant_wall_s": round(variant_wall_s, 6),
                    "ocr_items": len(items),
                }
            )
            vlog(
                "timing",
                "variant",
                variant_name,
                f"preprocess={preprocess_s:.4f}s",
                f"ocr={ocr_s:.4f}s",
                f"parse={parse_s:.4f}s",
            )

        vlog("variant", "ocr_items", variant_name, len(items))

        if out_root is not None and items:
            _write_bgr_png(out_root / f"{variant_name}_ocr_all_boxes.png", _draw_ocr_overlay(page_rgb, items))

        if not items:
            variant_idx += 1
            continue

        if not anchor:
            vlog("variant", "no_anchor", variant_name)
            if out_root is not None:
                _write_bgr_png(
                    out_root / f"{variant_name}_ocr_no_anchor.png",
                    _draw_ocr_overlay(page_rgb, items, value=value),
                )
        else:
            vlog("variant", "anchor", variant_name, anchor.get("text", ""))

        if value:
            value.pop("_candidates_debug", None)
            vlog("variant", "value", variant_name, value.get("text"), value.get("millions"))
        else:
            vlog("variant", "no_value", variant_name)

        if out_root is not None:
            _write_bgr_png(
                out_root / f"{variant_name}_ocr_parsed.png",
                _draw_ocr_overlay(
                    page_rgb,
                    items,
                    anchor=anchor,
                    value=value,
                    search_band=search_band,
                ),
            )

        if not value:
            variant_idx += 1
            continue

        result = {
            "found": True,
            "variant_index": variant_idx,
            "variant_name": variant_name,
            "label": anchor,
            "value": value,
        }

        if _is_better_result(result, best_result):
            best_result = result
            telemetry["picked_variant"] = variant_name
            if anchor and search_band is not None:
                telemetry["search_box_px"] = _search_band_to_dict(search_band)
                telemetry["search_resolved"] = rs.to_public_dict()
            if out_root is not None:
                _write_bgr_png(
                    out_root / "99_best_variant_overlay.png",
                    _draw_ocr_overlay(
                        page_rgb,
                        items,
                        anchor=anchor,
                        value=value,
                        search_band=search_band,
                    ),
                )

        variant_idx += 1

    total_s = time.perf_counter() - t_wall0
    telemetry["ms_total"] = round(total_s * 1000.0, 2)

    timing_block: Optional[Dict[str, Any]] = None
    resources_block: Optional[Dict[str, float]] = None
    if stats:
        rss_mb = _rss_mb_peak()
        timing_block = {
            "read_image_s": round(read_image_s, 6),
            "pipeline_total_s": round(total_s, 6),
            "variants": variant_timings,
            "note_first_variant_ocr_s_includes_model_load": True,
        }
        resources_block = {"max_rss_mb_peak": round(rss_mb, 3)}
        vlog("timing", "pipeline_total", f"{total_s:.4f}s")
        vlog("resources", "max_rss_mb_peak", f"{rss_mb:.1f}")

    if best_result is None:
        telemetry["outcome"] = "fail"
        telemetry["fail_stage"] = "no_anchor" if not telemetry["anchor_seen"] else "no_value"
        payload: Dict[str, Any] = {
            "found": False,
            "label": None,
            "value": None,
            "error": "Unable to find 'Total Assets' and value using current OCR rules.",
            "telemetry": telemetry,
        }
        if out_root is not None:
            payload["debug_dir"] = str(out_root)
        if stats and timing_block and resources_block:
            payload["timing"] = timing_block
            payload["resources"] = resources_block
        return payload

    telemetry["outcome"] = "ok"
    telemetry["fail_stage"] = None
    best_result["telemetry"] = telemetry
    if out_root is not None:
        best_result["debug_dir"] = str(out_root)
    if stats and timing_block and resources_block:
        best_result["timing"] = timing_block
        best_result["resources"] = resources_block

    return best_result


def _stash_config_from_args(ns: argparse.Namespace) -> StashSearchConfig:
    return StashSearchConfig(
        ref_width=ns.stash_ref_w,
        ref_height=ns.stash_ref_h,
        anchor_x_band_ref=ns.stash_x_band,
        y_min_below_anchor_ref=ns.stash_y_min,
        stash_value_box_height_ref=ns.stash_box_height,
        row_group_y_ref=ns.stash_row_y,
        score_y_ref_below_anchor_ref=ns.stash_score_y_ref,
        score_y_scale_ref=ns.stash_score_y_scale,
        score_x_scale_ref=ns.stash_score_x_scale,
        max_stash_millions_m=ns.stash_max_m,
    )


def _parse_args() -> argparse.Namespace:
    d = _SEARCH_DEFAULTS
    p = argparse.ArgumentParser(description="Extract Total Assets value from a game profile screenshot.")
    p.add_argument("image", help="Path to input screenshot")
    p.add_argument("--pretty", action="store_true", help="Pretty-print JSON output")
    p.add_argument("--debug", action="store_true", help="Write debug images under debug_stash/")
    p.add_argument("--debug-dir", default=None, help="Override debug output directory")
    p.add_argument(
        "--preprocess",
        choices=("raw", "all"),
        default="raw",
        help="raw = RGB only; all = + CLAHE upscale",
    )
    p.add_argument("--stats", action="store_true", help="Full timing + RSS in JSON (cost: one getrusage)")
    p.add_argument("--verbose", action="store_true", help="Print legacy debug lines to stdout")
    p.add_argument(
        "--stash-ref-w",
        type=int,
        default=d.ref_width,
        metavar="PX",
        help="Reference screenshot width for distance definitions (scales to actual image width)",
    )
    p.add_argument(
        "--stash-ref-h",
        type=int,
        default=d.ref_height,
        metavar="PX",
        help="Reference screenshot height for distance definitions (scales to actual image height)",
    )
    p.add_argument(
        "--stash-x-band",
        type=int,
        default=d.anchor_x_band_ref,
        metavar="PX",
        help="Half-width (px) at reference resolution; scaled to actual frame width",
    )
    p.add_argument(
        "--stash-y-min",
        type=int,
        default=d.y_min_below_anchor_ref,
        metavar="PX",
        help="Gap below anchor (px at reference height); scaled to frame",
    )
    p.add_argument(
        "--stash-box-height",
        type=int,
        default=d.stash_value_box_height_ref,
        dest="stash_box_height",
        metavar="PX",
        help="Value box height (px at reference height); scaled to frame",
    )
    p.add_argument(
        "--stash-row-y",
        type=int,
        default=d.row_group_y_ref,
        help="Row grouping Y threshold (px at reference height); scaled",
    )
    p.add_argument(
        "--stash-score-y-ref",
        type=int,
        default=d.score_y_ref_below_anchor_ref,
        help="Label→value drop for scoring (px at reference height); scaled",
    )
    p.add_argument(
        "--stash-score-y-scale",
        type=float,
        default=d.score_y_scale_ref,
        help="Y score normalization (at reference height); scaled",
    )
    p.add_argument(
        "--stash-score-x-scale",
        type=float,
        default=d.score_x_scale_ref,
        help="X score normalization (at reference width); scaled",
    )
    p.add_argument(
        "--stash-max-m",
        type=float,
        default=d.max_stash_millions_m,
        help="Reject stash …M OCR above this many millions (game cap)",
    )
    return p.parse_args()


def main() -> None:
    args = _parse_args()
    cfg = _stash_config_from_args(args)
    result = extract_total_assets(
        args.image,
        debug=args.debug,
        debug_dir=args.debug_dir,
        preprocess=args.preprocess,
        stats=args.stats,
        search_config=cfg,
        verbose=args.verbose,
    )
    if args.pretty:
        print(json.dumps(result, indent=2))
    else:
        print(json.dumps(result))


if __name__ == "__main__":
    main()
