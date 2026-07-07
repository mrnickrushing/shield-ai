"""Education center routes."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_optional_current_user
from app.db.session import get_db
from app.models.models import EducationLesson, EducationProgress, User
from app.schemas.schemas import LessonOut, QuizSubmit
from app.services import education_service

router = APIRouter(prefix="/education", tags=["education"])


@router.get("/lessons")
def list_lessons(threat_category: str | None = None, db: Session = Depends(get_db), user: User | None = Depends(get_optional_current_user)):
    education_service.seed_lessons(db)
    return education_service.get_lessons_for_user(db, user.id if user else None, threat_category)


@router.get("/lessons/{lesson_id}", response_model=LessonOut)
def get_lesson(lesson_id: str, db: Session = Depends(get_db), user: User | None = Depends(get_optional_current_user)):
    education_service.seed_lessons(db)
    lesson = db.get(EducationLesson, lesson_id)
    if not lesson:
        lesson = db.query(EducationLesson).filter(EducationLesson.slug == lesson_id).first()
    if not lesson:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found")
    return lesson


@router.post("/lessons/{lesson_id}/complete")
def complete_lesson(lesson_id: str, payload: QuizSubmit, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    lesson = db.get(EducationLesson, lesson_id)
    if not lesson:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found")
    score = None
    if payload.answers and lesson.quiz_questions:
        correct = sum(1 for i, q in enumerate(lesson.quiz_questions) if i < len(payload.answers) and payload.answers[i] == q.get("answer_index"))
        score = round(100 * correct / len(lesson.quiz_questions))
    prog = db.query(EducationProgress).filter(EducationProgress.user_id == user.id, EducationProgress.lesson_id == lesson_id).first()
    if prog is None:
        prog = EducationProgress(user_id=user.id, lesson_id=lesson_id)
        db.add(prog)
    prog.completed = True
    prog.quiz_score = score
    prog.completed_at = datetime.now(timezone.utc)
    db.commit()
    return {"completed": True, "quiz_score": score}
