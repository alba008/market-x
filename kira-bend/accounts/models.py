from django.conf import settings
from django.db import models


class DealerProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="dealer_profile")

    dealership_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=40, blank=True)
    whatsapp = models.CharField(max_length=40, blank=True)
    email_public = models.EmailField(blank=True)

    city = models.CharField(max_length=80, blank=True)
    region = models.CharField(max_length=80, blank=True)  # e.g., Dar es Salaam / Ilala
    country = models.CharField(max_length=80, default="Tanzania")

    bio = models.TextField(blank=True)
    is_verified = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.dealership_name} ({self.user_id})"
