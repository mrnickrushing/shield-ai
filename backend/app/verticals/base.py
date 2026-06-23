"""Vertical framework — the reusable decision-assistant engine.

A *vertical* points Shield AI's existing pipeline (deterministic rule pack +
LLM interpretation + blended verdict) at a new high-stakes domain. Each vertical
supplies only what is domain-specific: an analyzer, score weights, an LLM system
hint + category vocabulary, and the headline output it generates (a dispute
letter, a list of questions, a recovery pack, ...).

The shared ``run_vertical()`` reuses ``ai_analyzer`` + ``risk_engine.combine()`` so
the trust model (evidence shown separately from conclusion; deterministic signals
never overridden by the LLM alone) is identical to the core scam scanner.

NOTE (scaffold): vertical verdicts are returned in-memory and not yet persisted
to ``scan_history`` / ``risk_reports``. History + quota integration lands when each
vertical is deepened past the skeleton.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from app.services import ai_analyzer, risk_engine


@dataclass
class VerticalResult:
    """What a vertical's analyzer returns before LLM interpretation."""

    score: int = 0
    flags: list[str] = field(default_factory=list)
    category: str = "unknown"
    evidence: dict = field(default_factory=dict)
    next_steps: list[str] = field(default_factory=list)
    output_title: str = ""
    output_artifact: str = ""
    content_for_llm: str | None = None


@dataclass
class VerticalSpec:
    """Declarative definition of one vertical app."""

    key: str
    name: str
    tagline: str
    accent: str
    icon: str
    input_label: str
    input_placeholder: str
    analyze: Callable[[str, dict], VerticalResult]
    system_hint: str
    categories: tuple[str, ...] = ()
    input_multiline: bool = True
    accepts_files: bool = False


def run_vertical(spec: VerticalSpec, input_text: str, context: dict | None = None) -> dict:
    """Run one vertical end-to-end: analyzer -> LLM interpretation -> blended verdict."""
    result = spec.analyze(input_text, context or {})
    content = result.content_for_llm if result.content_for_llm is not None else input_text

    llm = ai_analyzer.analyze(
        content,
        result.evidence,
        artifact_type=spec.key,
        system_hint=spec.system_hint,
        categories=spec.categories or None,
    )
    report = risk_engine.combine(
        min(max(result.score, 0), 100),
        result.flags,
        result.category,
        llm,
    )

    # The vertical owns its next-steps and headline output artifact.
    if result.next_steps:
        report["recommended_actions"] = result.next_steps
    report["evidence"] = result.evidence
    report["vertical"] = spec.key
    report["vertical_name"] = spec.name
    report["output_title"] = result.output_title
    report["output_artifact"] = result.output_artifact
    return report
