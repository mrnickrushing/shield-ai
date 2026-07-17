"""AI scam coach — conversational "is this a scam?" help.

Stateless by design: the client sends the running thread on every turn, so
nothing conversational is persisted server-side (scan content is sensitive,
and coach threads double down on that). Subscription-gated like every other
feature.
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.config import settings
from app.models.models import User
from app.schemas.schemas import CoachChatRequest, CoachChatResponse
from app.services.subscription import is_premium_active

router = APIRouter(prefix="/coach", tags=["coach"])

_SYSTEM_PROMPT = """You are the Shield AI scam coach — a calm, practical safety expert people talk to when something feels off: a weird text, a caller pressuring them, a deal that seems too good, a family member acting on a stranger's instructions.

How to respond:
- Ask one clarifying question when the situation is ambiguous; otherwise give your read immediately.
- Name the scam pattern if you recognize it (grandparent scam, pig butchering, fake invoice, refund scam, tech-support scam, romance scam, task scam...).
- Give concrete next steps: what to do right now, what not to do, and how to verify independently (call the real number on the back of the card, not the one in the message).
- Never tell someone something is definitely safe. Say what you'd check.
- If money already moved, immediately point them to their bank's fraud line, reporting at reportfraud.ftc.gov, and the app's Scam Recovery wizard.
- Plain language, short paragraphs, no jargon, no lecturing. 150 words max unless walking through steps.
- Stay on scams, fraud, and personal digital safety. For anything else, redirect gently to what you can help with."""


@router.post("/chat", response_model=CoachChatResponse)
def coach_chat(payload: CoachChatRequest, user: User = Depends(get_current_user)):
    if not is_premium_active(user):
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            "The scam coach requires Shield AI Premium.",
        )
    # Guard the context window: keep the most recent turns only.
    messages = [{"role": m.role, "content": m.content} for m in payload.messages[-20:]]
    if messages[-1]["role"] != "user":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Last message must be from the user")

    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The coach is temporarily unavailable. Please try again soon.",
        )

    try:
        import anthropic

        from app.services.model_router import get_config

        cfg = get_config("message")
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        resp = client.messages.create(
            model=cfg.model,
            temperature=0.3,
            max_tokens=700,
            system=_SYSTEM_PROMPT,
            messages=messages,
        )
        reply = resp.content[0].text.strip()
    except Exception:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The coach is temporarily unavailable. Please try again soon.",
        )
    if not reply:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The coach is temporarily unavailable. Please try again soon.",
        )
    return CoachChatResponse(reply=reply)
