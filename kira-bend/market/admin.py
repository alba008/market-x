from django.contrib import admin
from django.core.exceptions import ValidationError

from .models import (
    # V1
    CarListing, CarImage, Favorite,

    # V2
    Category, CategoryAttribute,
    Listing, ListingImage,
    ListingAttributeValue,
    FavoriteV2,
    ModerationStatus, ListingStatus,
)

# =========================================================
# Shared Admin Actions
# =========================================================

@admin.action(description="✅ Approve selected (keeps current status)")
def approve_selected(modeladmin, request, queryset):
    updated = queryset.update(moderation_status=ModerationStatus.APPROVED)
    modeladmin.message_user(request, f"Approved: {updated}")


@admin.action(description="⛔ Reject selected (moves to DRAFT)")
def reject_selected(modeladmin, request, queryset):
    # Rejected listings should not be public
    updated = 0
    for obj in queryset:
        obj.moderation_status = ModerationStatus.REJECTED
        if getattr(obj, "status", None) == ListingStatus.PUBLISHED:
            obj.status = ListingStatus.DRAFT
        obj.save()
        updated += 1
    modeladmin.message_user(request, f"Rejected: {updated} (public listings moved to DRAFT if needed)")


@admin.action(description="🚀 Approve & Publish (requires plate number + plate photo)")
def approve_and_publish(modeladmin, request, queryset):
    ok, skipped = 0, 0
    for obj in queryset:
        try:
            obj.moderation_status = ModerationStatus.APPROVED
            obj.status = ListingStatus.PUBLISHED
            obj.save()  # model-level validation will enforce plate/photo rules
            ok += 1
        except ValidationError:
            skipped += 1
    modeladmin.message_user(
        request,
        f"Published: {ok}. Skipped: {skipped} (missing plate number/photo or not eligible)."
    )


@admin.action(description="📦 Archive selected")
def archive_selected(modeladmin, request, queryset):
    updated = queryset.update(status=ListingStatus.ARCHIVED)
    modeladmin.message_user(request, f"Archived: {updated}")


# =========================
# V1 ADMIN (CarListing)
# =========================

class CarImageInline(admin.TabularInline):
    model = CarImage
    extra = 1
    fields = ("image", "thumbnail", "is_cover", "sort_order")
    readonly_fields = ("thumbnail",)


@admin.register(CarListing)
class CarListingAdmin(admin.ModelAdmin):
    list_display = (
        "id", "title", "price", "currency",
        "year", "make", "model",
        "status", "moderation_status", "is_featured",
        "plate_number",
        "created_at",
    )
    list_filter = (
        "status", "moderation_status", "is_featured",
        "country", "region", "make", "model", "year",
    )
    search_fields = (
        "title", "make", "model", "trim", "vin",
        "plate_number",
        "dealer__dealershipName", "dealer__phone", "dealer__whatsapp",
    )
    inlines = [CarImageInline]
    ordering = ("-created_at",)

    # Quick edits
    list_editable = ("status", "moderation_status", "is_featured")

    actions = [
        approve_selected,
        approve_and_publish,
        reject_selected,
        archive_selected,
    ]


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "listing", "created_at")
    search_fields = ("user__username", "user__email", "listing__title", "listing__slug")
    autocomplete_fields = ("user", "listing")
    ordering = ("-created_at",)


# =========================
# V2 ADMIN (multi-vertical)
# =========================

class ListingImageInline(admin.TabularInline):
    model = ListingImage
    extra = 1
    fields = ("image", "thumbnail", "is_cover", "sort_order")
    readonly_fields = ("thumbnail",)


class ListingAttributeValueInline(admin.TabularInline):
    model = ListingAttributeValue
    extra = 0
    autocomplete_fields = ("attribute",)
    fields = ("attribute", "value")


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "created_at")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("name",)


@admin.register(CategoryAttribute)
class CategoryAttributeAdmin(admin.ModelAdmin):
    list_display = (
        "id", "category", "key", "label", "data_type",
        "is_filterable", "is_required", "sort_order",
    )
    list_filter = ("category", "data_type", "is_filterable", "is_required")
    search_fields = ("key", "label", "category__name", "category__slug")
    ordering = ("category__name", "sort_order", "key")


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = (
        "id", "title", "category", "dealer",
        "price", "currency",
        "city", "region", "country",
        "status", "moderation_status", "is_featured",
        "plate_number",
        "views_count", "created_at",
    )
    list_filter = ("status", "moderation_status", "is_featured", "category", "country", "region")
    search_fields = (
        "title", "slug",
        "plate_number",
        "dealer__dealershipName", "dealer__phone", "dealer__whatsapp",
        "city", "region", "country",
    )
    autocomplete_fields = ("dealer", "created_by", "category")
    prepopulated_fields = {"slug": ("title",)}
    inlines = [ListingImageInline, ListingAttributeValueInline]
    ordering = ("-created_at",)

    # Quick edits
    list_editable = ("status", "moderation_status", "is_featured")

    actions = [
        approve_selected,
        approve_and_publish,
        reject_selected,
        archive_selected,
    ]


@admin.register(FavoriteV2)
class FavoriteV2Admin(admin.ModelAdmin):
    list_display = ("id", "user", "listing", "created_at")
    search_fields = ("user__username", "user__email", "listing__title", "listing__slug")
    autocomplete_fields = ("user", "listing")
    ordering = ("-created_at",)
