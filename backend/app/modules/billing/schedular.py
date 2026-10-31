from datetime import date, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text

from app.core.db import SessionLocal
from app.modules.billing.models import Subscription
from app.modules.billing.service import compute_period, generate_invoice
from app.modules.billing.status import SUBSCRIPTION_FLOW, transition


def _billing_period(db, sub) -> str:
    row = db.execute(
        text("SELECT billing_period FROM plans WHERE id = :i"),
        {"i": sub.plan_id},
    ).first()
    return row[0] if row and row[0] else "monthly"


def run_daily_billing() -> dict:
    today = date.today()
    created = closed = 0
    with SessionLocal() as db:
        due = (
            db.query(Subscription)
            .filter(Subscription.status == "active", Subscription.next_billing_date <= today)
            .all()
        )
        for sub in due:
            start = sub.next_billing_date
            period_start, period_end = compute_period(_billing_period(db, sub), start)
            if generate_invoice(db, sub, period_start, period_end):
                created += 1
            sub.next_billing_date = period_end + timedelta(days=1)

        expired = (
            db.query(Subscription)
            .filter(Subscription.status == "active", Subscription.end_date < today)
            .all()
        )
        for sub in expired:
            transition(sub, "closed", SUBSCRIPTION_FLOW)
            closed += 1

        db.commit()
    return {"invoices_created": created, "subscriptions_closed": closed}


scheduler = BackgroundScheduler()
scheduler.add_job(run_daily_billing, CronTrigger(hour=1, minute=0), id="daily_billing", replace_existing=True)
