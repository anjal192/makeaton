from decimal import Decimal
from sqlalchemy import select
from app.core.db import SessionLocal
from app.modules.catalog.models import Plan, Product, Tax


def seed():
    with SessionLocal() as db:
        if not db.scalar(select(Plan).where(Plan.id == 1)):
            db.add(Plan(id=1, name="Basic", billing_period="monthly"))
        if not db.scalar(select(Product).where(Product.id == 1)):
            db.add(Product(id=1, name="Widget"))
        if not db.scalar(select(Tax).where(Tax.id == 1)):
            db.add(Tax(id=1, rate=Decimal("18.00")))
        db.commit()
        print("Catalog seeded successfully.")


if __name__ == "__main__":
    seed()
