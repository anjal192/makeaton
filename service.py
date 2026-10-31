from datetime import timedelta
from decimal import Decimal
from sqlalchemy.exc import IntegrityError

def generate_invoice(db, sub, period_start, period_end):
    subtotal = sum((l.unit_price * l.quantity for l in sub.lines), Decimal("0"))
    tax = Decimal("0")  # calculate per line using B's tax rate
    discount = Decimal("0")  # call B's discount function here

    invoice = Invoice(
        subscription_id=sub.id,
        customer_id=sub.customer_id,
        period_start=period_start,
        period_end=period_end,
        due_date=period_end + timedelta(days=7),
        subtotal=subtotal,
        discount_amount=discount,
        tax_amount=tax,
        total=subtotal - discount + tax,
    )
    try:
        with db.begin_nested():   # savepoint
            db.add(invoice)
            db.flush()
    except IntegrityError:
        return None               # already billed for this period
    return invoice