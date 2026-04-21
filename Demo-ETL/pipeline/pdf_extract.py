from __future__ import annotations

import io
import logging
from pathlib import Path
from typing import Any

from PIL import Image

logger = logging.getLogger(__name__)


def get_pdf_page_count(path: str) -> int:
    try:
        from pypdf import PdfReader

        reader = PdfReader(path)
        return len(reader.pages)
    except Exception:
        pass

    try:
        import fitz

        doc = fitz.open(path)
        count = doc.page_count
        doc.close()
        return count
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(f"Failed to read PDF page count for {path}: {exc}") from exc


def extract_text_pypdf(path: str) -> list[str]:
    from pypdf import PdfReader

    reader = PdfReader(path)
    out: list[str] = []
    for page in reader.pages:
        try:
            out.append(page.extract_text() or "")
        except Exception:
            out.append("")
    return out


def extract_text_pymupdf(path: str) -> list[str]:
    import fitz

    doc = fitz.open(path)
    out: list[str] = []
    try:
        for i in range(doc.page_count):
            page = doc.load_page(i)
            out.append(page.get_text("text") or "")
    finally:
        doc.close()
    return out


def render_pdf_pages(path: str, dpi: int = 220, max_side: int = 2200) -> list[Image.Image]:
    import fitz

    scale = dpi / 72.0
    matrix = fitz.Matrix(scale, scale)
    doc = fitz.open(path)
    pages: list[Image.Image] = []
    try:
        for idx in range(doc.page_count):
            page = doc.load_page(idx)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            pil = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
            pil = resize_max_side(pil, max_side=max_side)
            pages.append(pil)
    finally:
        doc.close()
    return pages


def resize_max_side(image: Image.Image, max_side: int) -> Image.Image:
    w, h = image.size
    side = max(w, h)
    if side <= max_side:
        return image
    ratio = max_side / float(side)
    new_size = (max(1, int(w * ratio)), max(1, int(h * ratio)))
    return image.resize(new_size, Image.Resampling.LANCZOS)


def detect_pdf_nature(path: str, sample_pages: int = 3) -> dict[str, Any]:
    """
    Returns:
      - source_kind: native_text_pdf | scanned_pdf
      - confidence: float [0,1]
      - details: dict
    """
    pages = extract_text_pypdf(path)
    sample = pages[:sample_pages] if pages else []
    non_empty = sum(1 for text in sample if len((text or "").strip()) >= 30)
    avg_chars = (sum(len((text or "").strip()) for text in sample) / len(sample)) if sample else 0.0
    if non_empty >= max(1, len(sample) // 2) and avg_chars > 80:
        return {
            "source_kind": "native_text_pdf",
            "confidence": 0.82,
            "details": {"non_empty_pages": non_empty, "avg_chars": avg_chars},
        }
    return {
        "source_kind": "scanned_pdf",
        "confidence": 0.68,
        "details": {"non_empty_pages": non_empty, "avg_chars": avg_chars},
    }
