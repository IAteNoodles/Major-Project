from __future__ import annotations

import mimetypes
from pathlib import Path


IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"}


def detect_input_type(path: str) -> dict[str, str]:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Input file not found: {path}")

    ext = p.suffix.lower()
    mime, _ = mimetypes.guess_type(str(p))
    if ext == ".pdf":
        return {
            "file_type": "pdf",
            "source_kind": "pdf",
            "mime": mime or "application/pdf",
        }
    if ext in IMAGE_EXTS:
        return {
            "file_type": "image",
            "source_kind": "image",
            "mime": mime or "image/*",
        }

    raise ValueError(f"Unsupported input type: {ext}. Supported: PDF and image formats")
