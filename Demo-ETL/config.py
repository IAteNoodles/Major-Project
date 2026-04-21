from __future__ import annotations

import copy
import os
from pathlib import Path
from typing import Any

try:
    import yaml
except Exception:  # pragma: no cover
    yaml = None


DEFAULT_CONFIG: dict[str, Any] = {
    "app": {
        "output_dir": "output",
        "history_file": "output/history.jsonl",
        "log_level": "INFO",
        "save_debug_files": False,
    },
    "hardware": {
        "use_cuda": True,
        "use_fp16": True,
        "low_vram_mode": True,
        "max_gpu_memory_gb": 5.2,
    },
    "profiles": {
        "fast": {
            "render_dpi": 180,
            "max_page_side": 1800,
            "native_accept_score": 0.60,
            "ocr_accept_score": 0.58,
            "ocr_poor_score": 0.35,
            "enable_orientation_correction": False,
            "enable_deskew": False,
            "enable_threshold": False,
            "prefer_engine_order": ["tesseract", "paddleocr", "trocr", "deepseek_ocr"],
        },
        "balanced": {
            "render_dpi": 220,
            "max_page_side": 2200,
            "native_accept_score": 0.62,
            "ocr_accept_score": 0.64,
            "ocr_poor_score": 0.38,
            "enable_orientation_correction": True,
            "enable_deskew": True,
            "enable_threshold": True,
            "prefer_engine_order": ["tesseract", "paddleocr", "trocr", "deepseek_ocr"],
        },
        "high_accuracy": {
            "render_dpi": 300,
            "max_page_side": 2800,
            "native_accept_score": 0.68,
            "ocr_accept_score": 0.72,
            "ocr_poor_score": 0.42,
            "enable_orientation_correction": True,
            "enable_deskew": True,
            "enable_threshold": True,
            "prefer_engine_order": ["tesseract", "paddleocr", "trocr", "deepseek_ocr"],
        },
    },
    "quality": {
        "near_blank_char_count": 24,
        "native_min_char_count": 40,
        "max_garbage_ratio": 0.24,
        "min_dictionary_ratio": 0.12,
        "debug_cross_engine_compare": False,
    },
    "classification": {
        "min_best_score": 3.0,
        "min_confidence_for_specific_label": 0.45,
        "unknown_if_char_below": 20,
    },
    "ocr": {
        "tesseract": {
            "enabled": True,
            "lang": "eng",
            "oem": 1,
            "psm": 6,
            "extra_config": "",
        },
        "paddleocr": {
            "enabled": True,
            "lang": "en",
            "use_angle_cls": True,
            "det_limit_side_len": 1536,
            "rec_batch_num": 4,
            "det_db_box_thresh": 0.45,
        },
        "trocr": {
            "enabled": True,
            "model_name": "microsoft/trocr-small-printed",
            "max_new_tokens": 192,
            "trocr_on_low_conf_only": True,
            "low_conf_threshold": 60.0,
            "max_regions_per_page": 8,
            "min_quality_to_skip": 0.62,
        },
        "deepseek_ocr": {
            "enabled": False,
            "backend": "none",
            "model_id": "",
            "api_endpoint": "",
            "api_key": "",
            "timeout_seconds": 45,
            "quantization": "4bit",
            "default_prompt": "<image>\nFree OCR.",
            "markdown_prompt": "<image>\n<|grounding|>Convert the document to markdown.",
        },
    },
    "benchmark": {
        "enabled": True,
        "save_report_dir": "output",
        "public_data_dir": "data/public_samples",
        "stop_if_no_medical_like_docs": True,
    },
}


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = copy.deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def load_config(config_path: str | os.PathLike[str] | None = None) -> dict[str, Any]:
    cfg = copy.deepcopy(DEFAULT_CONFIG)
    if config_path:
        path = Path(config_path)
        if not path.exists():
            raise FileNotFoundError(f"Config file not found: {path}")
        if yaml is None:
            raise RuntimeError("PyYAML not installed. Install pyyaml to read config files.")
        loaded = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if not isinstance(loaded, dict):
            raise ValueError("Config root must be a mapping/dict.")
        cfg = _deep_merge(cfg, loaded)

    output_dir_env = os.getenv("ETL_OUTPUT_DIR")
    if output_dir_env:
        cfg["app"]["output_dir"] = output_dir_env
        cfg["app"]["history_file"] = str(Path(output_dir_env) / "history.jsonl")

    log_level_env = os.getenv("ETL_LOG_LEVEL")
    if log_level_env:
        cfg["app"]["log_level"] = log_level_env.upper()

    return cfg


def get_profile_config(cfg: dict[str, Any], profile: str) -> dict[str, Any]:
    name = profile.strip().lower().replace("-", "_")
    if name not in cfg["profiles"]:
        valid = ", ".join(sorted(cfg["profiles"].keys()))
        raise ValueError(f"Unknown profile '{profile}'. Valid: {valid}")
    return cfg["profiles"][name]
