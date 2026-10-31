from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.modules.auth.models import Role, User
from app.modules.billing.models import (
    Invoice, Payment, QuotationTemplate, QuotationTemplateLine,
    Subscription, SubscriptionLine,
)
from app.modules.billing import schemas
from app.modules.billing.scheduler import _billing_period, run_daily_billing
from app.modules.billing.service import compute_period, generate_invoice, money
from app.modules.billing.status import INVOICE_FLOW, SUBSCRIPTION_FLOW, transition

router = APIRouter(tags=["billing"])


def _paginate(db: Session, stmt, page: int, page_size: int):
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    items = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def _get_subscription(db: Session, user: User, sub_id: int) -> Subscription:
    stmt = select(Subscription).where(Subscription.id == sub_id).options(selectinload(Subscription.lines))
    if user.role == Role.customer:
        stmt = stmt.where(Subscription.customer_id == user.id)
    sub = db.scalars(stmt).first()
    if not sub:
        raise HTTPException(404, "Subscription not found")
    return sub


def _get_invoice(db: Session, user: User, invoice_id: int) -> Invoice:
    stmt = (
        select(Invoice).where(Invoice.id == invoice_id)
        .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
    )
    if user.role == Role.customer:
        stmt = stmt.where(Invoice.customer_id == user.id)
    inv = db.scalars(stmt).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return inv


# ---------------- Subscriptions ----------------
@router.post("/subscriptions", response_model=schemas.SubscriptionRead, status_code=201)
def create_subscription(body: schemas.SubscriptionCreate, db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)):
    customer_id = user.id if user.role == Role.customer else (body.customer_id or user.id)
    sub = Subscription(
        customer_id=customer_id, plan_id=body.plan_id, template_id=body.template_id,
        start_date=body.start_date, end_date=body.end_date, status="draft",
        lines=[SubscriptionLine(**l.model_dump()) for l in body.lines],
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.get("/subscriptions", response_model=schemas.Page[schemas.SubscriptionRead])
def list_subscriptions(status: str | None = None, page: int = Query(1, ge=1),
                       page_size: int = Query(20, ge=1, le=100),
                       db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(Subscription).options(selectinload(Subscription.lines)).order_by(Subscription.id.desc())
    if user.role == Role.customer:
        stmt = stmt.where(Subscription.customer_id == user.id)
    if status:
        stmt = stmt.where(Subscription.status == status)
    return _paginate(db, stmt, page, page_size)


@router.get("/subscriptions/{sub_id}", response_model=schemas.SubscriptionRead)
def get_subscription(sub_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _get_subscription(db, user, sub_id)


@router.patch("/subscriptions/{sub_id}/status", response_model=schemas.SubscriptionRead)
def update_subscription_status(sub_id: int, body: schemas.SubscriptionStatusUpdate,
                               db: Session = Depends(get_db),
                               user: User = Depends(require_role(Role.admin, Role.staff))):
    sub = _get_subscription(db, user, sub_id)
    transition(sub, body.status, SUBSCRIPTION_FLOW)
    if body.status == "active":
        sub.start_date = sub.start_date or date.today()
        sub.next_billing_date = sub.next_billing_date or sub.start_date
    db.commit()
    db.refresh(sub)
    return sub


@router.post("/subscriptions/{sub_id}/invoices", response_model=schemas.InvoiceRead, status_code=201)
def create_invoice_manually(sub_id: int, db: Session = Depends(get_db),
                            user: User = Depends(require_role(Role.admin, Role.staff))):
    sub = _get_subscription(db, user, sub_id)
    if sub.status != "active":
        raise HTTPException(409, "Only active subscriptions can be invoiced")
    start = sub.next_billing_date or sub.start_date or date.today()
    period_start, period_end = compute_period(_billing_period(db, sub), start)
    invoice = generate_invoice(db, sub, period_start, period_end)
    if invoice is None:
        raise HTTPException(409, "This period is already invoiced")
    db.commit()
    return _get_invoice(db, user, invoice.id)


# ---------------- Quotation templates ----------------
@router.post("/quotation-templates", response_model=schemas.QuotationTemplateRead, status_code=201)
def create_template(body: schemas.QuotationTemplateCreate, db: Session = Depends(get_db),
                    user: User = Depends(require_role(Role.admin, Role.staff))):
    tpl = QuotationTemplate(
        name=body.name, plan_id=body.plan_id, validity_days=body.validity_days,
        lines=[QuotationTemplateLine(**l.model_dump()) for l in body.lines],
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.get("/quotation-templates", response_model=schemas.Page[schemas.QuotationTemplateRead])
def list_templates(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                   db: Session = Depends(get_db), user: User = Depends(require_role(Role.admin, Role.staff))):
    stmt = select(QuotationTemplate).options(selectinload(QuotationTemplate.lines)).order_by(QuotationTemplate.id)
    return _paginate(db, stmt, page, page_size)


# ---------------- Invoices ----------------
@router.get("/invoices", response_model=schemas.Page[schemas.InvoiceRead])
def list_invoices(status: str | None = None, subscription_id: int | None = None,
                  page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                  db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = (
        select(Invoice)
        .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
        .order_by(Invoice.id.desc())
    )
    if user.role == Role.customer:
        stmt = stmt.where(Invoice.customer_id == user.id)
    if status:
        stmt = stmt.where(Invoice.status == status)
    if subscription_id:
        stmt = stmt.where(Invoice.subscription_id == subscription_id)
    return _paginate(db, stmt, page, page_size)


@router.get("/invoices/{invoice_id}", response_model=schemas.InvoiceRead)
def get_invoice(invoice_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _get_invoice(db, user, invoice_id)


@router.post("/invoices/{invoice_id}/confirm", response_model=schemas.InvoiceRead)
def confirm_invoice(invoice_id: int, db: Session = Depends(get_db),
                    user: User = Depends(require_role(Role.admin, Role.staff))):
    inv = _get_invoice(db, user, invoice_id)
    transition(inv, "confirmed", INVOICE_FLOW)
    db.commit()
    db.refresh(inv)
    return inv


@router.post("/invoices/{invoice_id}/cancel", response_model=schemas.InvoiceRead)
def cancel_invoice(invoice_id: int, db: Session = Depends(get_db),
                   user: User = Depends(require_role(Role.admin, Role.staff))):
    inv = _get_invoice(db, user, invoice_id)
    transition(inv, "cancelled", INVOICE_FLOW)
    db.commit()
    db.refresh(inv)
    return inv


@router.post("/invoices/{invoice_id}/payments", response_model=schemas.PaymentRead, status_code=201)
def record_payment(invoice_id: int, body: schemas.PaymentCreate, db: Session = Depends(get_db),
                   user: User = Depends(require_role(Role.admin, Role.staff))):
    inv = _get_invoice(db, user, invoice_id)
    if inv.status != "confirmed":
        raise HTTPException(409, "Payments can only be recorded on confirmed invoices")
    paid = sum((p.amount for p in inv.payments), money(0))
    if paid + body.amount > inv.total:
        raise HTTPException(409, "Payment exceeds the outstanding amount")
    payment = Payment(invoice_id=inv.id, amount=body.amount, method=body.method)
    db.add(payment)
    if paid + body.amount == inv.total:
        transition(inv, "paid", INVOICE_FLOW)
    db.commit()
    db.refresh(payment)
    return payment


# ---------------- Manual scheduler trigger ----------------
@router.post("/admin/run-billing")
def run_billing_now(user: User = Depends(require_role(Role.admin))):
    return run_daily_billing()
