# market/models.py
from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils.text import slugify

from accounts.models import DealerProfile
from market.utils.thumbnails import make_thumbnail


# ============================================================
# Backward-compat: migrations import these symbols by name
# ============================================================
def listing_v2_image_path(instance, filename: str) -> str:
    """
    ✅ DO NOT REMOVE / RENAME.
    Old migration 0003 references: market.models.listing_v2_image_path
    """
    listing_id = getattr(instance, "listing_id", None) or getattr(
        getattr(instance, "listing", None), "id", "unknown"
    )
    return f"listings/v2/{listing_id}/{filename}"


def listing_v2_thumb_path(instance, filename: str) -> str:
    """
    ✅ DO NOT REMOVE / RENAME.
    Old migration 0003 references: market.models.listing_v2_thumb_path
    """
    listing_id = getattr(instance, "listing_id", None) or getattr(
        getattr(instance, "listing", None), "id", "unknown"
    )
    return f"listings/v2/{listing_id}/thumbs/{filename}"


# ============================================================
# Config: which V2 categories require plate verification?
# ============================================================
VEHICLE_CATEGORY_SLUGS = {
    "vehicles",
    "cars",
    "car",
    "automotive",
    "heavy-machines",
    "motorcycles",
}


def normalize_plate(value: str | None) -> str | None:
    if not value:
        return value
    return value.replace(" ", "").replace("-", "").upper().strip()


# -------------------------
# Enums
# -------------------------
class ListingStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PUBLISHED = "PUBLISHED", "Published"
    SOLD = "SOLD", "Sold"
    ARCHIVED = "ARCHIVED", "Archived"


class ModerationStatus(models.TextChoices):
    """
    Manual review flow:
      - PENDING: submitted, not public
      - APPROVED: can be public
      - REJECTED: blocked
    """
    PENDING = "PENDING", "Pending review"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"


class Transmission(models.TextChoices):
    AUTO = "AUTO", "Automatic"
    MANUAL = "MANUAL", "Manual"
    CVT = "CVT", "CVT"
    OTHER = "OTHER", "Other"


class FuelType(models.TextChoices):
    PETROL = "PETROL", "Petrol"
    DIESEL = "DIESEL", "Diesel"
    HYBRID = "HYBRID", "Hybrid"
    ELECTRIC = "ELECTRIC", "Electric"
    OTHER = "OTHER", "Other"


class Currency(models.TextChoices):
    USD = "USD", "USD ($)"
    TZS = "TZS", "TSh"
    EUR = "EUR", "EUR (€)"


# ============================================================
# Shared publish rule mixin (backend-only verification)
# ============================================================
class PublishRulesMixin:
    """
    Enforces (when enabled):
      - If status=PUBLISHED AND listing is vehicle-like:
          plate_number required
          plate_photo required
          moderation_status must be APPROVED

    Also supports anti bait-and-switch:
      - if plate/photo changes after approval -> reset to PENDING + DRAFT

    Toggle with:
      settings.MARKET_REQUIRE_PLATE_FOR_PUBLISH = True/False
    """

    def is_vehicle_like(self) -> bool:
        return True

    def _publish_rules_enabled(self) -> bool:
        # ✅ kill-switch (default True if setting missing)
        return bool(getattr(settings, "MARKET_REQUIRE_PLATE_FOR_PUBLISH", True))

    def _publish_requirements_ok(self) -> bool:
        plate_ok = bool(normalize_plate(getattr(self, "plate_number", None)))
        photo_ok = bool(getattr(self, "plate_photo", None))
        approved_ok = getattr(self, "moderation_status", None) == ModerationStatus.APPROVED
        return plate_ok and photo_ok and approved_ok

    def _raise_if_publish_invalid(self) -> None:
        if getattr(self, "status", None) != ListingStatus.PUBLISHED:
            return
        if not self.is_vehicle_like():
            return

        # ✅ TEMP bypass
        if not self._publish_rules_enabled():
            return

        if not self._publish_requirements_ok():
            raise ValidationError(
                {
                    "status": (
                        "Cannot publish: vehicle listings must be APPROVED "
                        "and must include plate number + plate photo."
                    )
                }
            )


# -------------------------
# Category (multi-vertical)
# -------------------------
class Category(models.Model):
    """
    Marketplace category / vertical.
    Examples: Cars, Real Estate, Electronics, Heavy Machines...
    """
    name = models.CharField(max_length=80)
    slug = models.SlugField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["slug"])]

    def __str__(self) -> str:
        return self.name


# -------------------------
# Universal Listing (V2)
# -------------------------
class Listing(PublishRulesMixin, models.Model):
    """
    Universal listing model for all categories.
    Vehicle-specific verification enforced only for vehicle-like categories.
    """
    dealer = models.ForeignKey(DealerProfile, on_delete=models.CASCADE, related_name="listings_v2")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="listings")

    title = models.CharField(max_length=140)
    slug = models.SlugField(max_length=180, blank=True)

    price = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=8, choices=Currency.choices, default=Currency.USD)

    city = models.CharField(max_length=80, blank=True)
    region = models.CharField(max_length=80, blank=True)
    country = models.CharField(max_length=80, default="Tanzania")

    description = models.TextField(blank=True)

    # --- Anti-duplicate (vehicles): stored server-side only ---
    plate_number = models.CharField(
        max_length=32,
        blank=True,
        null=True,
        db_index=True,
        help_text="Vehicle registration/plate number. Required for vehicles before publishing.",
    )
    plate_photo = models.ImageField(
        upload_to="listings/v2/plates/",
        blank=True,
        null=True,
        help_text="Photo showing the plate. Required for vehicles before publishing.",
    )
    moderation_status = models.CharField(
        max_length=16,
        choices=ModerationStatus.choices,
        default=ModerationStatus.PENDING,
        db_index=True,
        help_text="Manual moderation for fraud/duplicate control.",
    )

    status = models.CharField(max_length=16, choices=ListingStatus.choices, default=ListingStatus.DRAFT)
    is_featured = models.BooleanField(default=False)

    # ✅ Required: migration 0005 added these and code references them
    spotlight_pinned = models.BooleanField(default=False, db_index=True)
    spotlight_date = models.DateField(null=True, blank=True, db_index=True)

    views_count = models.PositiveIntegerField(default=0)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_listings_v2",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["country", "region", "city"]),
            models.Index(fields=["price"]),
            models.Index(fields=["category", "status"]),
            models.Index(fields=["plate_number"]),
            models.Index(fields=["moderation_status", "status"]),
            models.Index(fields=["spotlight_pinned", "-spotlight_date"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["plate_number"],
                condition=Q(status=ListingStatus.PUBLISHED) & Q(plate_number__isnull=False),
                name="uniq_published_plate_number_v2",
            ),
        ]

    def is_vehicle_like(self) -> bool:
        try:
            slug = (self.category.slug or "").strip().lower()
        except Exception:
            slug = ""
        return slug in VEHICLE_CATEGORY_SLUGS

    def clean(self):
        super().clean()
        self._raise_if_publish_invalid()

    def save(self, *args, **kwargs):
        if self.plate_number:
            self.plate_number = normalize_plate(self.plate_number)

        if not self.slug:
            base = slugify(self.title)[:120] or "listing"
            self.slug = base

        # ✅ Anti bait-and-switch only when plate rules are enabled
        if (
            self.pk
            and self.is_vehicle_like()
            and bool(getattr(settings, "MARKET_REQUIRE_PLATE_FOR_PUBLISH", True))
        ):
            old = Listing.objects.filter(pk=self.pk).values(
                "plate_number", "plate_photo", "moderation_status", "status"
            ).first()
            if old:
                old_plate = normalize_plate(old.get("plate_number"))
                new_plate = normalize_plate(self.plate_number)
                plate_changed = old_plate != new_plate

                old_photo = old.get("plate_photo") or ""
                new_photo = self.plate_photo.name if self.plate_photo else ""
                photo_changed = old_photo != new_photo

                if (plate_changed or photo_changed) and old.get("moderation_status") == ModerationStatus.APPROVED:
                    self.moderation_status = ModerationStatus.PENDING
                    self.status = ListingStatus.DRAFT

        self._raise_if_publish_invalid()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.title} ({self.status})"


# -------------------------
# Dynamic attributes for per-category specs
# -------------------------
class AttributeDataType(models.TextChoices):
    INT = "int", "int"
    FLOAT = "float", "float"
    TEXT = "text", "text"
    BOOL = "bool", "bool"
    CHOICE = "choice", "choice"


class CategoryAttribute(models.Model):
    """
    Defines a spec field for a given category.
    Example: category=cars, key='mileage', label='Mileage', data_type='int'
    Example: category=real-estate, key='bedrooms', label='Bedrooms', data_type='int'
    """
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="attributes")
    key = models.SlugField(max_length=50)
    label = models.CharField(max_length=100)
    data_type = models.CharField(max_length=10, choices=AttributeDataType.choices, default=AttributeDataType.TEXT)

    is_filterable = models.BooleanField(default=True)
    is_required = models.BooleanField(default=False)

    # for choice fields
    choices = models.JSONField(null=True, blank=True)

    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [models.UniqueConstraint(fields=["category", "key"], name="uniq_category_attribute_key")]
        indexes = [models.Index(fields=["category", "key"])]

    def __str__(self) -> str:
        return f"{self.category.slug}:{self.key}"


class ListingAttributeValue(models.Model):
    """
    Stores a listing's value for an attribute.
    value is JSON so it can hold int/float/text/bool cleanly.
    """
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="attribute_values")
    attribute = models.ForeignKey(CategoryAttribute, on_delete=models.CASCADE, related_name="values")
    value = models.JSONField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["listing", "attribute"], name="uniq_listing_attribute_value")]
        indexes = [models.Index(fields=["attribute"]), models.Index(fields=["listing"])]

    def __str__(self) -> str:
        return f"{self.listing_id}:{self.attribute.key}={self.value}"


# -------------------------
# Listing Images (V2)
# -------------------------
class ListingImage(models.Model):
    listing = models.ForeignKey(Listing, related_name="images", on_delete=models.CASCADE)

    # Keep these paths stable for new code; old migrations still reference listing_v2_image_path via Migration file
    image = models.ImageField(upload_to="listings/v2/images/")
    thumbnail = models.ImageField(upload_to="listings/v2/thumbs/", null=True, blank=True)

    is_cover = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["listing"],
                condition=Q(is_cover=True),
                name="uniq_cover_per_listing_v2",
            )
        ]

    def save(self, *args, **kwargs):
        creating = self.pk is None
        super().save(*args, **kwargs)

        if self.image and not self.thumbnail:
            thumb_content = make_thumbnail(self.image, size=(600, 600))
            filename = f"thumb_{self.pk}.jpg"
            self.thumbnail.save(filename, thumb_content, save=False)
            super().save(update_fields=["thumbnail"])

        if creating and self.listing.images.count() == 1:
            self.is_cover = True
            super().save(update_fields=["is_cover"])

        if self.is_cover:
            ListingImage.objects.filter(listing=self.listing, is_cover=True).exclude(id=self.id).update(is_cover=False)

    def __str__(self) -> str:
        return f"Image {self.id} for listing {self.listing_id}"


# -------------------------
# Favorites (V2)
# -------------------------
class FavoriteV2(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites_v2")
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "listing"], name="uniq_favorite_user_listing_v2")]

    def __str__(self) -> str:
        return f"{self.user_id} ♥ {self.listing_id}"


# ======================================================================
# LEGACY MODELS (V1) — keep temporarily so current GraphQL/UI won't break
# ======================================================================
def listing_image_path(instance: "CarImage", filename: str) -> str:
    return f"listings/{instance.listing_id}/{filename}"


def listing_thumb_path(instance: "CarImage", filename: str) -> str:
    return f"listings/{instance.listing_id}/thumbs/{filename}"


class CarListing(PublishRulesMixin, models.Model):
    dealer = models.ForeignKey(DealerProfile, on_delete=models.CASCADE, related_name="listings")

    title = models.CharField(max_length=140)
    slug = models.SlugField(max_length=180, blank=True)

    price = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=8, choices=Currency.choices, default=Currency.USD)

    city = models.CharField(max_length=80, blank=True)
    region = models.CharField(max_length=80, blank=True)
    country = models.CharField(max_length=80, default="Tanzania")

    year = models.PositiveIntegerField()
    make = models.CharField(max_length=60)
    model = models.CharField(max_length=60)
    trim = models.CharField(max_length=60, blank=True)

    mileage = models.PositiveIntegerField(null=True, blank=True)
    fuel_type = models.CharField(max_length=16, choices=FuelType.choices, default=FuelType.PETROL)
    transmission = models.CharField(max_length=16, choices=Transmission.choices, default=Transmission.AUTO)

    body_type = models.CharField(max_length=40, blank=True)
    color = models.CharField(max_length=40, blank=True)
    vin = models.CharField(max_length=64, blank=True)

    description = models.TextField(blank=True)

    plate_number = models.CharField(
        max_length=32,
        blank=True,
        null=True,
        db_index=True,
        help_text="Vehicle registration/plate number. Required for publishing vehicles.",
    )
    plate_photo = models.ImageField(
        upload_to="listings/plates/",
        blank=True,
        null=True,
        help_text="Photo showing the plate (manual review).",
    )
    moderation_status = models.CharField(
        max_length=16,
        choices=ModerationStatus.choices,
        default=ModerationStatus.PENDING,
        db_index=True,
    )

    status = models.CharField(max_length=16, choices=ListingStatus.choices, default=ListingStatus.DRAFT)
    is_featured = models.BooleanField(default=False)

    views_count = models.PositiveIntegerField(default=0)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["make", "model", "year"]),
            models.Index(fields=["country", "region", "city"]),
            models.Index(fields=["price"]),
            models.Index(fields=["plate_number"]),
            models.Index(fields=["moderation_status", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["plate_number"],
                condition=Q(status=ListingStatus.PUBLISHED) & Q(plate_number__isnull=False),
                name="uniq_published_plate_number_v1",
            ),
        ]

    def is_vehicle_like(self) -> bool:
        return True

    def clean(self):
        super().clean()
        self._raise_if_publish_invalid()

    def save(self, *args, **kwargs):
        if self.plate_number:
            self.plate_number = normalize_plate(self.plate_number)

        if not self.slug:
            base = slugify(self.title)[:120] or "car"
            self.slug = base

        # ✅ Anti bait-and-switch only when plate rules are enabled
        if self.pk and bool(getattr(settings, "MARKET_REQUIRE_PLATE_FOR_PUBLISH", True)):
            old = CarListing.objects.filter(pk=self.pk).values(
                "plate_number", "plate_photo", "moderation_status", "status"
            ).first()
            if old:
                old_plate = normalize_plate(old.get("plate_number"))
                new_plate = normalize_plate(self.plate_number)
                plate_changed = old_plate != new_plate

                old_photo = old.get("plate_photo") or ""
                new_photo = self.plate_photo.name if self.plate_photo else ""
                photo_changed = old_photo != new_photo

                if (plate_changed or photo_changed) and old.get("moderation_status") == ModerationStatus.APPROVED:
                    self.moderation_status = ModerationStatus.PENDING
                    self.status = ListingStatus.DRAFT

        self._raise_if_publish_invalid()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} ({self.status})"


class CarImage(models.Model):
    listing = models.ForeignKey(CarListing, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to=listing_image_path)
    thumbnail = models.ImageField(upload_to=listing_thumb_path, null=True, blank=True)

    is_cover = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["listing"],
                condition=Q(is_cover=True),
                name="uniq_cover_per_listing",
            )
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        if self.image and not self.thumbnail:
            thumb_content = make_thumbnail(self.image, size=(600, 600))
            filename = f"thumb_{self.pk}.jpg"
            self.thumbnail.save(filename, thumb_content, save=False)
            super().save(update_fields=["thumbnail"])

        if self.is_cover:
            CarImage.objects.filter(listing=self.listing, is_cover=True).exclude(id=self.id).update(is_cover=False)

    def __str__(self):
        return f"Image {self.id} for listing {self.listing_id}"


class Favorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites")
    listing = models.ForeignKey(CarListing, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "listing"], name="uniq_favorite_user_listing")]

    def __str__(self):
        return f"{self.user_id} ♥ {self.listing_id}"
