from django.db import models
from accounts.models import DealerProfile


class InquiryLead(models.Model):
    listing = models.ForeignKey(
        "market.Listing",
        on_delete=models.CASCADE,
        related_name="inquiries",
    )
    dealer = models.ForeignKey(
        DealerProfile,
        on_delete=models.CASCADE,
        related_name="leads",
    )

    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    message = models.TextField(blank=True)

    source = models.CharField(max_length=40, default="WEB")
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)


    class Meta:
        indexes = [models.Index(fields=["dealer", "-created_at"])]
        ordering = ["-created_at"]

    def __str__(self):
        return f"Lead {self.id} -> listing {self.listing_id}"
