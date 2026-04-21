from __future__ import annotations

import hashlib
import json
import logging
import re
import string
import time
from contextlib import contextmanager
from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generator


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value)
    return value.strip("-")


def compute_doc_id(file_path: str, include_ts: bool = True) -> str:
    path = Path(file_path)
    stem = slugify(path.stem) or "document"
    digest = hashlib.sha1(str(path).encode("utf-8")).hexdigest()[:8]
    if include_ts:
        ts = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        return f"{stem}-{ts}-{digest}"
    return f"{stem}-{digest}"


def ensure_dir(path: str | Path) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def safe_json_dump(data: Any, path: str | Path) -> None:
    p = Path(path)
    ensure_dir(p.parent)
    if is_dataclass(data):
        data = asdict(data)
    p.write_text(json.dumps(data, indent=2, ensure_ascii=True), encoding="utf-8")


def append_jsonl(path: str | Path, row: dict[str, Any]) -> None:
    p = Path(path)
    ensure_dir(p.parent)
    with p.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=True) + "\n")


def write_text(path: str | Path, text: str) -> None:
    p = Path(path)
    ensure_dir(p.parent)
    p.write_text(text, encoding="utf-8")


@contextmanager
def timer(metrics: dict[str, float], key: str) -> Generator[None, None, None]:
    start = time.perf_counter()
    try:
        yield
    finally:
        metrics[key] = metrics.get(key, 0.0) + (time.perf_counter() - start)


def has_cuda() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:
        return False


def normalize_whitespace(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\t+", " ", text)
    text = re.sub(r"[ \x0b\x0c]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def token_split(text: str) -> list[str]:
    return re.findall(r"[A-Za-z0-9][A-Za-z0-9\-/.]*", text)


def garbage_char_ratio(text: str) -> float:
    if not text:
        return 1.0
    allowed = set(string.ascii_letters + string.digits + string.whitespace + ".,;:!?()[]{}<>+-=*/%$#@&_'\"\\|")
    bad = sum(1 for ch in text if ch not in allowed)
    return bad / max(1, len(text))


COMMON_DICT_WORDS = {
    "the",
    "and",
    "patient",
    "name",
    "date",
    "hospital",
    "doctor",
    "diagnosis",
    "test",
    "result",
    "report",
    "invoice",
    "amount",
    "medicine",
    "tablet",
    "mg",
    "ml",
    "history",
    "advice",
    "discharge",
    "admission",
    "total",
    "tax",
    "payment",
}


def dictionary_ratio(text: str) -> float:
    tokens = [t.lower() for t in token_split(text)]
    if not tokens:
        return 0.0
    hit = sum(1 for token in tokens if token in COMMON_DICT_WORDS or (len(token) > 2 and token.isalpha()))
    return hit / len(tokens)


def line_coherence(text: str) -> float:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return 0.0
    good = 0
    for line in lines:
        letters = sum(ch.isalpha() for ch in line)
        digits = sum(ch.isdigit() for ch in line)
        punct = sum(ch in ".,;:-/()%" for ch in line)
        if (letters + digits + punct) / max(1, len(line)) > 0.65:
            good += 1
    return good / len(lines)


def repeated_token_ratio(text: str) -> float:
    tokens = [t.lower() for t in token_split(text)]
    if len(tokens) < 6:
        return 0.0
    repeats = 0
    for idx in range(1, len(tokens)):
        if tokens[idx] == tokens[idx - 1]:
            repeats += 1
    return repeats / max(1, len(tokens) - 1)


def fragmented_token_ratio(text: str) -> float:
    tokens = token_split(text)
    if not tokens:
        return 1.0
    frag = sum(1 for t in tokens if len(t) <= 2 and t.isalpha())
    return frag / len(tokens)


def avg(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)
