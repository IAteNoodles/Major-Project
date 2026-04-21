from __future__ import annotations

import math
from typing import Any

import cv2
import numpy as np
from PIL import Image, ImageEnhance


def pil_to_cv(image: Image.Image) -> np.ndarray:
    arr = np.array(image.convert("RGB"))
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def cv_to_pil(image: np.ndarray) -> Image.Image:
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def to_grayscale(image: Image.Image) -> Image.Image:
    return image.convert("L").convert("RGB")


def denoise(image: Image.Image) -> Image.Image:
    src = pil_to_cv(image)
    out = cv2.fastNlMeansDenoisingColored(src, None, 5, 5, 7, 21)
    return cv_to_pil(out)


def threshold_binarize(image: Image.Image) -> Image.Image:
    gray = np.array(image.convert("L"))
    out = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        15,
    )
    return Image.fromarray(out).convert("RGB")


def enhance_contrast(image: Image.Image, factor: float = 1.35) -> Image.Image:
    return ImageEnhance.Contrast(image).enhance(factor)


def detect_skew_angle(gray: np.ndarray) -> float:
    coords = np.column_stack(np.where(gray < 250))
    if len(coords) < 100:
        return 0.0
    rect = cv2.minAreaRect(coords)
    angle = rect[-1]
    if angle < -45:
        angle = 90 + angle
    return float(angle)


def deskew(image: Image.Image) -> Image.Image:
    src = pil_to_cv(image)
    gray = cv2.cvtColor(src, cv2.COLOR_BGR2GRAY)
    angle = detect_skew_angle(gray)
    if math.isclose(angle, 0.0, abs_tol=0.7):
        return image
    (h, w) = src.shape[:2]
    center = (w // 2, h // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(src, matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    return cv_to_pil(rotated)


def orientation_correction(image: Image.Image) -> Image.Image:
    """
    Lightweight orientation check via tesseract OSD when available.
    If unavailable, returns original image.
    """
    try:
        import pytesseract

        osd = pytesseract.image_to_osd(image)
        rotate = 0
        for line in osd.splitlines():
            if line.lower().startswith("rotate:"):
                rotate = int(line.split(":", 1)[1].strip())
                break
        if rotate in {90, 180, 270}:
            return image.rotate(360 - rotate, expand=True)
    except Exception:
        return image
    return image


def preprocess_image(image: Image.Image, profile_cfg: dict[str, Any]) -> Image.Image:
    out = image
    out = enhance_contrast(out)
    out = to_grayscale(out)
    out = denoise(out)
    if profile_cfg.get("enable_threshold", False):
        out = threshold_binarize(out)
    if profile_cfg.get("enable_deskew", False):
        out = deskew(out)
    if profile_cfg.get("enable_orientation_correction", False):
        out = orientation_correction(out)
    return out
