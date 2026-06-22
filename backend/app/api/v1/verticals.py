"""Vertical apps — portfolio scaffold built on the shared Verdict Engine.

Each vertical reuses the core pipeline (deterministic rule pack + LLM
interpretation + blended verdict) for a new high-stakes domain. Verdicts are
returned in-memory; persistence/quota integration lands when a vertical is
deepened past the skeleton.
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import (
    get_user_from_api_key_or_jwt as get_user,
    get_user_from_api_key_or_jwt_write as get_user_write,
)
from app.models.models import User
from app.schemas.schemas import VerdictOut, VerticalInfo, VerticalScanRequest
from app.verticals import get_vertical, list_verticals, run_vertical

router = APIRouter(prefix="/verticals", tags=["verticals"])


@router.get("", response_model=list[VerticalInfo])
def catalog(user: User = Depends(get_user)):
    """List every vertical app in the portfolio for the Shield Labs hub."""
    return [
        VerticalInfo(
            key=s.key,
            name=s.name,
            tagline=s.tagline,
            accent=s.accent,
            icon=s.icon,
            input_label=s.input_label,
            input_placeholder=s.input_placeholder,
            input_multiline=s.input_multiline,
        )
        for s in list_verticals()
    ]


@router.post("/{key}/scan", response_model=VerdictOut)
def scan(key: str, payload: VerticalScanRequest, user: User = Depends(get_user_write)):
    """Run a single vertical's analyzer + verdict pipeline on user-provided input."""
    spec = get_vertical(key)
    if not spec:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown vertical: {key}")
    return run_vertical(spec, payload.input, payload.context)
