from django.conf import settings
from django.db import models
from django.utils.text import slugify

from accounts.models import DealerProfile


# -------------------------
# Enums (keep)
# -------------------------

class ListingStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PUBLISHED = "PUBLISHED", "Published"
    SOLD = "SOLD", "Sold"
    ARCHIVED = "ARCHIVED", "Archived"


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


# -------------------------
# NEW: Category (multi-vertical)
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
        indexes = [
            models.Index(fields=["slug"]),
        ]

    def __str__(self) -> str:
        return self.name


# -------------------------
# NEW: Universal Listing (V2)
# -------------------------

class Listing(models.Model):
    """
    Universal listing model for all categories.
    Car-specific fields will move to dynamic attributes.
    """
    dealer = models.ForeignKey(DealerProfile, on_delete=models.CASCADE, related_name="listings_v2")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="listings")

    title = models.CharField(max_length=140)
    slug = models.SlugField(max_length=180, blank=True)

    price = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=8, default="USD")

    city = models.CharField(max_length=80, blank=True)
    region = models.CharField(max_length=80, blank=True)
    country = models.CharField(max_length=80, default="Tanzania")

    description = models.TextField(blank=True)

    status = models.CharField(max_length=16, choices=ListingStatus.choices, default=ListingStatus.DRAFT)
    is_featured = models.BooleanField(default=False)

    views_count = models.PositiveIntegerField(default=0)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_listings_v2"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["country", "region", "city"]),
            models.Index(fields=["price"]),
            models.Index(fields=["category", "status"]),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)[:120] or "listing"
            self.slug = base
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.title} ({self.status})"


# -------------------------
# NEW: Dynamic attributes for per-category specs
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
    key = models.SlugField(max_length=50)         # "mileage", "bedrooms", "storage_gb"
    label = models.CharField(max_length=100)      # "Mileage", "Bedrooms", "Storage (GB)"
    data_type = models.CharField(max_length=10, choices=AttributeDataType.choices, default=AttributeDataType.TEXT)

    # Optional UI hints
    is_filterable = models.BooleanField(default=True)
    is_required = models.BooleanField(default=False)

    # Optional: for choice fields
    # e.g. ["AUTO", "MANUAL", "CVT"]
    choices = models.JSONField(null=True, blank=True)

    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["category", "key"], name="uniq_category_attribute_key")
        ]
        indexes = [
            models.Index(fields=["category", "key"]),
        ]

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
        constraints = [
            models.UniqueConstraint(fields=["listing", "attribute"], name="uniq_listing_attribute_value")
        ]
        indexes = [
            models.Index(fields=["attribute"]),
            models.Index(fields=["listing"]),
        ]

    def __str__(self) -> str:
        return f"{self.listing_id}:{self.attribute.key}={self.value}"


# -------------------------
# NEW: Listing Images (V2)
# -------------------------

def listing_v2_image_path(instance: "ListingImage", filename: str) -> str:
    return f"listings/v2/{instance.listing_id}/{filename}"


def listing_v2_thumb_path(instance: "ListingImage", filename: str) -> str:
    return f"listings/v2/{instance.listing_id}/thumbs/{filename}"


class ListingImage(models.Model):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="images")

    image = models.ImageField(upload_to=listing_v2_image_path)
    thumbnail = models.ImageField(upload_to=listing_v2_thumb_path, null=True, blank=True)

    is_cover = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["listing"],
                condition=models.Q(is_cover=True),
                name="uniq_cover_per_listing_v2",
            )
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        if self.is_cover:
            ListingImage.objects.filter(listing=self.listing, is_cover=True).exclude(id=self.id).update(is_cover=False)

    def __str__(self) -> str:
        return f"Image {self.id} for listing {self.listing_id}"


# -------------------------
# NEW: Favorites (V2) - for universal listings
# -------------------------

class FavoriteV2(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites_v2")
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "listing"], name="uniq_favorite_user_listing_v2")
        ]

    def __str__(self) -> str:
        return f"{self.user_id} ♥ {self.listing_id}"


# ======================================================================
# LEGACY MODELS (V1) — keep temporarily so current GraphQL/UI won't break
# ======================================================================

class CarListing(models.Model):
    dealer = models.ForeignKey(DealerProfile, on_delete=models.CASCADE, related_name="listings")

    title = models.CharField(max_length=140)
    slug = models.SlugField(max_length=180, blank=True)

    price = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=8, default="USD")

    city = models.CharField(max_length=80, blank=True)
    region = models.CharField(max_length=80, blank=True)
    country = models.CharField(max_length=80, default="Tanzania")

    year = models.PositiveIntegerField()
    make = models.CharField(max_length=60)   # Toyota, Nissan...
    model = models.CharField(max_length=60)  # RAV4...
    trim = models.CharField(max_length=60, blank=True)

    mileage = models.PositiveIntegerField(null=True, blank=True)
    fuel_type = models.CharField(max_length=16, choices=FuelType.choices, default=FuelType.PETROL)
    transmission = models.CharField(max_length=16, choices=Transmission.choices, default=Transmission.AUTO)

    body_type = models.CharField(max_length=40, blank=True)  # SUV, Sedan...
    color = models.CharField(max_length=40, blank=True)
    vin = models.CharField(max_length=64, blank=True)

    description = models.TextField(blank=True)

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
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)[:120] or "car"
            self.slug = base
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} ({self.status})"


def listing_image_path(instance: "CarImage", filename: str) -> str:
    return f"listings/{instance.listing_id}/{filename}"


def listing_thumb_path(instance: "CarImage", filename: str) -> str:
    return f"listings/{instance.listing_id}/thumbs/{filename}"


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
                condition=models.Q(is_cover=True),
                name="uniq_cover_per_listing",
            )
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        if self.is_cover:
            CarImage.objects.filter(listing=self.listing, is_cover=True).exclude(id=self.id).update(is_cover=False)

    def __str__(self):
        return f"Image {self.id} for listing {self.listing_id}"


class Favorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites")
    listing = models.ForeignKey(CarListing, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "listing"], name="uniq_favorite_user_listing")
        ]

    def __str__(self):
        return f"{self.user_id} ♥ {self.listing_id}"
