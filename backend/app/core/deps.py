import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import decode_access_token
from app.modules.auth.models import User, Role

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme),
                     db: Session = Depends(get_db)) -> User:
    try:
        payload = decode_access_token(token)
        user = db.get(User, int(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Invalid or expired token",
                            headers={"WWW-Authenticate": "Bearer"})
    if not user or not user.is_active:
        raise HTTPException(401, "Account not found or disabled",
                            headers={"WWW-Authenticate": "Bearer"})
    return user

def require_role(*roles: Role):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise AppError(403, "You do not have permission to do this")
        return user
    return checker

def scope_to_customer(query, user: User, customer_column):
    """Customers only see their own rows; admin/staff see everything."""
    if user.role == Role.customer:
        return query.where(customer_column == user.id)
    return query