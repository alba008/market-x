# accounts/signals.py
import logging
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserProfile
from market.utils.emails import send_welcome_email

log = logging.getLogger(__name__)
User = get_user_model()


@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance, created, **kwargs):
    """
    Always ensure a UserProfile exists for every user.
    This gives everyone a role (default CUSTOMER) from day one.
    """
    UserProfile.objects.get_or_create(user=instance)


@receiver(post_save, sender=User)
def send_welcome_on_create(sender, instance, created, **kwargs):
    """
    Send welcome email only when user is created.
    """
    if not created:
        return

    # Skip staff/admin accounts
    if getattr(instance, "is_staff", False) or getattr(instance, "is_superuser", False):
        return

    # If user has no email, do nothing
    if not (getattr(instance, "email", "") or "").strip():
        return

    try:
        send_welcome_email(instance)
        log.warning("✅ Welcome email sent to %s (user_id=%s)", instance.email, instance.id)
    except Exception:
        log.exception("❌ Welcome email failed for user_id=%s email=%s", instance.id, instance.email)
