# market/utils/emails.py
from __future__ import annotations

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string


def send_app_email(
    *,
    to: list[str],
    subject: str,
    template_txt: str | None = None,
    template_html: str | None = None,
    context: dict | None = None,
    reply_to: list[str] | None = None,
) -> None:
    """
    Send a text email (and optional HTML alternative) using Django SMTP settings.

    template_txt/template_html are paths under templates/, e.g. "emails/test_email.txt"
    """
    context = context or {}

    prefix = getattr(settings, "EMAIL_SUBJECT_PREFIX", "")
    full_subject = f"{prefix}{subject}".strip()

    from_email = settings.DEFAULT_FROM_EMAIL

    text_body = render_to_string(template_txt, context) if template_txt else context.get("text", "")
    html_body = render_to_string(template_html, context) if template_html else ""

    msg = EmailMultiAlternatives(
        subject=full_subject,
        body=text_body or "(no content)",
        from_email=from_email,
        to=to,
        reply_to=reply_to or None,
    )

    if html_body:
        msg.attach_alternative(html_body, "text/html")

    msg.send(fail_silently=False)


def send_welcome_email(user) -> None:
    email = (getattr(user, "email", "") or "").strip()
    if not email:
        return

    first_name = (getattr(user, "first_name", "") or "").strip()

    base_url = getattr(settings, "FRONTEND_BASE_URL", "").strip()
    if not base_url:
        base_url = "https://makutanoni.com"

    login_url = f"{base_url.rstrip('/')}/login"

    send_app_email(
        to=[email],
        subject="Welcome to Makutanoni",
        template_txt="emails/welcome.txt",
        template_html="emails/welcome.html",
        context={
            "first_name": first_name,
            "login_url": login_url,
        },
    )