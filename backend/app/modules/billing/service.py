import calendar
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.modules.billing.models import Invoice, InvoiceLine

CENT = Decimal("0.01")
PERIOD_MONTHS = {"monthly": 1, "quarterly": 3, "yearly": 12}


def money(value) -> Decimal:
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def add_months(d: date, n: int) -> date:
    y, m = divmod(d.month - 1 + n, 12)
    year, month = d.year + y, m + 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def compute_period(billing_period: str, start: date) -> tuple[date, date]:
    """Returns (period_start, period_end), both inclusive."""
    if billing_period == "weekly":
        next_start = start + timedelta(days=7)
    else:
        next_start = add_months(start, PERIOD_MONTHS.get(billing_period, 1))
    return start, next_start - timedelta(days=1)


def _tax_rate(db, tax_id) -> Decimal:
    """Uses B's get_tax_rate if it exists, otherwise reads the taxes table."""
    if tax_id is None:
        return Decimal("0")
    try:
        from app.modules.catalog.service import get_tax_rate
        return Decimal(get_tax_rate(db, tax_id))
    except ImportError:
        row = db.execute(text("SELECT rate FROM taxes WHERE id = :i"), {"i": tax_id}).first()
        return Decimal(row[0]) if row and row[0] is not None else Decimal("0")


def _discount(db, subtotal: Decimal, quantity: int, on_date: date) -> Decimal:
    """Uses B's apply_discount if it exists, otherwise no discount."""
    try:
        from app.modules.catalog.service import apply_discount
    except ImportError:
        return Decimal("0")
    return money(apply_discount(db, subtotal, quantity, on_date))


def generate_invoice(db, sub, period_start: date, period_end: date):
    """Creates an invoice with lines. Returns None if this period is already billed."""
    lines, subtotal, tax_total, qty_total = [], Decimal("0"), Decimal("0"), 0

    for l in sub.lines:
        net = money(l.unit_price * l.quantity)
        tax = money(net * _tax_rate(db, l.tax_id) / Decimal("100"))
        subtotal += net
        tax_total += tax
        qty_total += l.quantity
        lines.append(
            InvoiceLine(
                product_id=l.product_id,
                description=f"Product {l.product_id}",
                quantity=l.quantity,
                unit_price=l.unit_price,
                tax_amount=tax,
                line_total=net,
            )
        )

    discount = _discount(db, subtotal, qty_total, period_start)

    invoice = Invoice(
        subscription_id=sub.id,
        customer_id=sub.customer_id,
        status="draft",
        period_start=period_start,
        period_end=period_end,
        due_date=period_end + timedelta(days=7),
        subtotal=subtotal,
        discount_amount=discount,
        tax_amount=tax_total,
        total=subtotal - discount + tax_total,
        lines=lines,
    )
    try:
        with db.begin_nested():  # savepoint, so a duplicate does not break the session
            db.add(invoice)
            db.flush()
    except IntegrityError:
        return None  # unique constraint hit: already billed for this period
    return invoice
