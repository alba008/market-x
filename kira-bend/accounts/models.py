# accounts/models.py
from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    """
    App-level roles without changing Django's default User model.
    - CUSTOMER: default for all signups
    - DEALER: allowed to post/manage listings (must have DealerProfile for details)
    - STAFF: internal app staff (moderation/approvals); separate from Django admin is_staff
    """
    class Roles(models.TextChoices):
        CUSTOMER = "CUSTOMER", "Customer"
        DEALER = "DEALER", "Dealer/Seller"
        STAFF = "STAFF", "Staff/Admin"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )

    role = models.CharField(
        max_length=20,
        choices=Roles.choices,
        default=Roles.CUSTOMER,
        db_index=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def is_customer(self) -> bool:
        return self.role == self.Roles.CUSTOMER

    def is_dealer(self) -> bool:
        return self.role == self.Roles.DEALER

    def is_staff_role(self) -> bool:
        return self.role == self.Roles.STAFF

    def __str__(self):
        return f"Profile(user_id={self.user_id}, role={self.role})"


class DealerProfile(models.Model):
    """
    Dealer-specific info. This is NOT created for everyone automatically.
    Create it when a user upgrades to DEALER.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="dealer_profile",
    )

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
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.dealership_name} (user_id={self.user_id})"
