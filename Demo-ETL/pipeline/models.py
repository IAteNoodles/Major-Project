from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class OCRToken:
    text: str
    confidence: float
    bbox: tuple[int, int, int, int] | None = None


@dataclass
class OCRResult:
    engine: str
    text: str
    confidence: float
    tokens: list[OCRToken] = field(default_factory=list)
    elapsed_seconds: float = 0.0
    error: str | None = None


@dataclass
class QualityResult:
    score: float
    char_count: int
    avg_confidence: float
    dictionary_ratio: float
    garbage_ratio: float
    repeated_token_ratio: float
    fragmented_token_ratio: float
    blank: bool
    line_coherence: float
    notes: list[str] = field(default_factory=list)


@dataclass
class PageResult:
    page_index: int
    text: str
    chosen_engine: str
    confidence: float
    quality_score: float
    fallback_chain: list[str] = field(default_factory=list)
    engine_timings: dict[str, float] = field(default_factory=dict)
    quality_breakdown: dict[str, Any] = field(default_factory=dict)


@dataclass
class ClassificationResult:
    label: str
    confidence: float
    scores: dict[str, float]
    evidence: dict[str, list[str]] = field(default_factory=dict)


@dataclass
class DocumentResult:
    doc_id: str
    input_path: str
    file_type: str
    source_kind: str
    mode: str
    profile: str
    pages: list[PageResult]
    full_text: str
    classification: ClassificationResult
    timings: dict[str, float]
    metadata: dict[str, Any] = field(default_factory=dict)
    output_text_path: str | None = None
    output_json_path: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["classification"] = asdict(self.classification)
        payload["pages"] = [asdict(page) for page in self.pages]
        return payload
