"""Database-backed catalog logic used by the router and by C (billing)."""
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from .models import Discount, Plan, Product, ProductVariant


def paginate(db: Session, stmt, page: int, size: int) -> dict:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    items = db.scalars(stmt.limit(size).offset((page - 1) * size)).all()
    return {"items": items, "total": total or 0, "page": page, "size": size}


def get_unit_price(product: Product, variant: Optional[ProductVariant] = None) -> Decimal:
    """Product base price plus the variant's extra price (if any)."""
    extra = variant.extra_price if variant is not None else Decimal("0")
    return Decimal(product.base_price) + Decimal(extra)


def consume_discount(db: Session, discount_id: int) -> bool:
    """Atomically count one use of a discount. Returns False if it is inactive or its
    usage limit is already reached. C calls this when an invoice that used the discount
    is created, in the SAME transaction, and commits afterwards.

    A single UPDATE with the limit check inside means two invoices created at the same
    moment cannot both take the last use.
    """
    stmt = (
        update(Discount)
        .where(
            Discount.id == discount_id,
            Discount.is_active.is_(True),
            or_(Discount.usage_limit.is_(None), Discount.used_count < Discount.usage_limit),
        )
        .values(used_count=Discount.used_count + 1)
    )
    return db.execute(stmt).rowcount == 1


def validate_template_lines(db: Session, lines, plan_id: Optional[int] = None) -> None:
    """Raise ValueError (with a readable message) if any template line or plan is invalid."""
    if plan_id is not None:
        plan = db.get(Plan, plan_id)
        if plan is None or not plan.is_active:
            raise ValueError(f"plan {plan_id} not found or inactive")

    for i, line in enumerate(lines, start=1):
        product = db.get(Product, line.product_id)
        if product is None or not product.is_active:
            raise ValueError(f"line {i}: product {line.product_id} not found or inactive")
        if line.quantity < 1:
            raise ValueError(f"line {i}: quantity must be at least 1")
        if line.unit_price is not None and line.unit_price < 0:
            raise ValueError(f"line {i}: unit price must be non-negative")
