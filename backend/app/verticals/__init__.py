"""Shield AI vertical apps — a portfolio built on the shared Verdict Engine.

Each vertical reuses the core pipeline (deterministic rule pack + LLM
interpretation + blended verdict) for a new high-stakes "should I?" decision.
"""
from app.verticals.base import VerticalResult, VerticalSpec, run_vertical
from app.verticals.registry import REGISTRY, get_vertical, list_verticals

__all__ = [
    "VerticalResult",
    "VerticalSpec",
    "run_vertical",
    "REGISTRY",
    "get_vertical",
    "list_verticals",
]
