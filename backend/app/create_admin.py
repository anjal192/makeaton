import sys
from sqlalchemy import select
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.modules.auth.models import User, Role
from app.modules.auth.schemas import validate_password_strength

def main(email: str, password: str, name: str = "Admin"):
    validate_password_strength(password)
    with SessionLocal() as db:
        email = email.strip().lower()
        if db.scalar(select(User).where(User.email == email)):
            print("User already exists"); return
        db.add(User(email=email, full_name=name,
                    password_hash=hash_password(password), role=Role.admin))
        db.commit()
        print(f"Admin created: {email}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])