from django.contrib import admin

from .models import (
    # V1
    CarListing, CarImage, Favorite,

    # V2
    Category, CategoryAttribute,
    Listing, ListingImage,
    ListingAttributeValue,
    FavoriteV2,
)

# =========================
# V1 ADMIN (unchanged)
# =========================

class CarImageInline(admin.TabularInline):
    model = CarImage
    extra = 1


@admin.register(CarListing)
class CarListingAdmin(admin.ModelAdmin):
    list_display = (
        "id", "title", "price", "currency",
        "year", "make", "model",
        "status", "is_featured", "created_at",
    )
    list_filter = ("status", "is_featured", "country", "region", "make", "model", "year")
    search_fields = ("title", "make", "model", "trim", "vin")
    inlines = [CarImageInline]


admin.site.register(Favorite)

# =========================
# V2 ADMIN (new)
# =========================

class ListingImageInline(admin.TabularInline):
    model = ListingImage
    extra = 1


class ListingAttributeValueInline(admin.TabularInline):
    model = ListingAttributeValue
    extra = 0
    autocomplete_fields = ("attribute",)
    # Keeps admin cleaner
    fields = ("attribute", "value")


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


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
        "status", "is_featured", "views_count", "created_at",
    )
    list_filter = ("status", "is_featured", "category", "country", "region")
    search_fields = ("title", "slug", "dealer__dealershipName", "city", "region", "country")
    autocomplete_fields = ("dealer", "created_by", "category")
    prepopulated_fields = {"slug": ("title",)}
    inlines = [ListingImageInline, ListingAttributeValueInline]
    ordering = ("-created_at",)

    # Optional: makes it easier to edit featured/status quickly
    list_editable = ("status", "is_featured")


@admin.register(FavoriteV2)
class FavoriteV2Admin(admin.ModelAdmin):
    list_display = ("id", "user", "listing", "created_at")
    search_fields = ("user__username", "user__email", "listing__title", "listing__slug")
    autocomplete_fields = ("user", "listing")
    ordering = ("-created_at",)
