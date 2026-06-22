"""Vertical registry — every portfolio app declared in one place."""
from __future__ import annotations

from app.verticals import call, contract, family, job, medbill, recovery
from app.verticals.base import VerticalSpec

# Display order in the Shield Labs hub.
_SPECS: list[VerticalSpec] = [
    medbill.SPEC,
    contract.SPEC,
    job.SPEC,
    call.SPEC,
    family.SPEC,
    recovery.SPEC,
]

REGISTRY: dict[str, VerticalSpec] = {spec.key: spec for spec in _SPECS}


def list_verticals() -> list[VerticalSpec]:
    """All verticals, in display order."""
    return list(_SPECS)


def get_vertical(key: str) -> VerticalSpec | None:
    """Look up a vertical by key, or None if unknown."""
    return REGISTRY.get(key)
