import smtplib
from email.message import EmailMessage
from app.core.config import settings

def send_email(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = "no-reply@brightloop.local"
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        server.send_message(msg)