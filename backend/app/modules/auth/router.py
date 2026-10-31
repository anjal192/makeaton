
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.core.errors import AppError
from app.core.mailer import send_email
from app.core.security import (hash_password, verify_password, create_access_token,
                               generate_reset_token, hash_token)
from app.modules.auth.models import User, Role, PasswordResetToken
from app.modules.auth.schemas import (SignupIn, StaffCreateIn, ForgotPasswordIn,
                                      ResetPasswordIn, UserOut, TokenOut)

router = APIRouter(prefix="/auth", tags=["auth"])


def _create_user(db: Session, data: SignupIn, role: Role) -> User:
    if db.scalar(select(User).where(User.email == data.email)):
        raise AppError(409, "An account with this email already exists", "email")
    user = User(email=data.email, full_name=data.full_name,
                password_hash=hash_password(data.password), role=role)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # two signups at the same moment
        db.rollback()
        raise AppError(409, "An account with this email already exists", "email")
    db.refresh(user)
    return user


@router.post("/signup", response_model=UserOut, status_code=201)
def signup(data: SignupIn, db: Session = Depends(get_db)):
    return _create_user(db, data, Role.customer)


@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == form.username.strip().lower()))
    if not user or not user.is_active or not verify_password(form.password, user.password_hash):
        raise AppError(401, "Incorrect email or password")
    return {"access_token": create_access_token(user.id, user.role.value),
            "token_type": "bearer", "user": user}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordIn, background: BackgroundTasks,
                    db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email))
    if user and user.is_active:
        raw, hashed = generate_reset_token()
        db.add(PasswordResetToken(
            user_id=user.id, token_hash=hashed,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.RESET_TOKEN_MINUTES)))
        db.commit()
        link = f"{settings.FRONTEND_URL}/reset-password?token={raw}"
        background.add_task(send_email, user.email, "Reset your Brightloop password",
                            f"Click the link to reset your password (valid for "
                            f"{settings.RESET_TOKEN_MINUTES} minutes):\n\n{link}")
    # Same answer either way, so attackers can't discover which emails are registered
    return {"detail": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(data: ResetPasswordIn, db: Session = Depends(get_db)):
    rec = db.scalar(select(PasswordResetToken)
                    .where(PasswordResetToken.token_hash == hash_token(data.token)))
    now = datetime.now(timezone.utc)
    if not rec or rec.used_at is not None or rec.expires_at < now:
        raise AppError(400, "This reset link is invalid or has expired", "token")
    user = db.get(User, rec.user_id)
    user.password_hash = hash_password(data.new_password)
    rec.used_at = now
    db.commit()
    return {"detail": "Password updated. You can now log in."}


@router.post("/staff", response_model=UserOut, status_code=201)
def create_staff(data: StaffCreateIn, db: Session = Depends(get_db),
                 admin: User = Depends(require_role(Role.admin))):
    return _create_user(db, data, Role.staff)