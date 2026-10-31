from datetime import date
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

def run_daily_billing():
    today = date.today()
    with SessionLocal() as db:
        due = db.query(Subscription).filter(
            Subscription.status == "active",
            Subscription.next_billing_date <= today,
        ).all()
        for sub in due:
            # compute period from the plan's billing period (monthly, yearly...)
            invoice = generate_invoice(db, sub, period_start, period_end)
            if invoice:
                sub.next_billing_date = period_end + timedelta(days=1)

        # auto-close expired plans
        expired = db.query(Subscription).filter(
            Subscription.status == "active",
            Subscription.end_date < today,
        ).all()
        for sub in expired:
            transition(sub, "closed", SUBSCRIPTION_FLOW)
        db.commit()

scheduler = BackgroundScheduler()
scheduler.add_job(run_daily_billing, CronTrigger(hour=1, minute=0))