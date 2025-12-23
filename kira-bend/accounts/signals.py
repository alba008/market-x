from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import DealerProfile

User = get_user_model()

@receiver(post_save, sender=User)
def ensure_dealer_profile(sender, instance, created, **kwargs):
    # Only create on demand in real apps; for MVP we don't auto-create to avoid junk profiles.
    return
