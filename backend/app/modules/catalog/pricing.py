"""Pure pricing logic (no database, no FastAPI). Easy to test, and C can call it directly.

    from app.modules.catalog.pricing import price_line

Order of operations (confirm against the brief):
    subtotal = unit_price * quantity
    discount = applied on the subtotal (capped so subtotal never goes negative)
    tax      = (subtotal - discount) * rate / 100
    total    = subtotal - discount + tax
Each amount is rounded to 2 decimals (half-up) exactly once, so the parts always add up.
"""
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

CENT = Decimal("0.01")
ZERO = Decimal("0.00")


def money(value) -> Decimal:
    if isinstance(value, float):
        value = str(value)
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class LineTotals:
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total: Decimal
    discount_applied: bool
    discount_reason: str  # why a given discount was NOT applied ("" if applied or none given)


def check_discount(discount, subtotal: Decimal, quantity: int, today: date) -> tuple[bool, str]:
    """Return (applicable, reason_if_not). `discount` can be a Discount row or any object
    with the same attributes."""
    if not discount.is_active:
        return False, "discount is inactive"
    if discount.start_date is not None and today < discount.start_date:
        return False, "discount has not started yet"
    if discount.end_date is not None and today > discount.end_date:
        return False, "discount has expired"
    if discount.min_amount is not None and subtotal < Decimal(discount.min_amount):
        return False, "minimum amount not reached"
    if discount.min_quantity is not None and quantity < discount.min_quantity:
        return False, "minimum quantity not reached"
    if discount.usage_limit is not None and discount.used_count >= discount.usage_limit:
        return False, "usage limit reached"
    return True, ""


def discount_amount_for(discount, subtotal: Decimal) -> Decimal:
    kind = getattr(discount.discount_type, "value", discount.discount_type)
    value = Decimal(discount.value)
    raw = subtotal * value / Decimal(100) if kind == "percent" else value
    return min(money(raw), subtotal)


def price_line(
    unit_price,
    quantity: int,
    tax_rate_percent=None,
    discount=None,
    today: Optional[date] = None,
) -> LineTotals:
    if quantity < 1:
        raise ValueError("quantity must be at least 1")
    unit = Decimal(str(unit_price)) if isinstance(unit_price, float) else Decimal(unit_price)
    if unit < 0:
        raise ValueError("unit_price cannot be negative")

    today = today or date.today()
    subtotal = money(unit * quantity)

    discount_amount, applied, reason = ZERO, False, ""
    if discount is not None:
        applied, reason = check_discount(discount, subtotal, quantity, today)
        if applied:
            discount_amount = discount_amount_for(discount, subtotal)

    taxable = subtotal - discount_amount
    rate = Decimal(str(tax_rate_percent)) if tax_rate_percent is not None else Decimal(0)
    tax_amount = money(taxable * rate / Decimal(100)) if rate else ZERO

    return LineTotals(
        subtotal=subtotal,
        discount_amount=discount_amount,
        tax_amount=tax_amount,
        total=taxable + tax_amount,
        discount_applied=applied,
        discount_reason=reason,
    )
