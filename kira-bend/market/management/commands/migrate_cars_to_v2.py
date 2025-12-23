from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from market.models import (
    Category, Listing, ListingImage, FavoriteV2,
    CategoryAttribute, ListingAttributeValue,
    CarListing, CarImage, Favorite,
)

# ---- helpers ----

def unique_slug(base: str) -> str:
    base = (base or "").strip()[:120] or "listing"
    slug = slugify(base) or "listing"
    if not Listing.objects.filter(slug=slug).exists():
        return slug
    i = 2
    while True:
        candidate = f"{slug}-{i}"
        if not Listing.objects.filter(slug=candidate).exists():
            return candidate
        i += 1


def ensure_cars_category():
    cat, _ = Category.objects.get_or_create(name="Cars", slug="cars")
    return cat


def ensure_car_attributes(cars_cat: Category):
    """
    Create V2 attributes for Cars category (safe to run repeatedly).
    """
    attrs = [
        ("year", "Year", "int", True, True, None, 10),
        ("make", "Make", "text", True, True, None, 20),
        ("model", "Model", "text", True, True, None, 30),
        ("trim", "Trim", "text", True, False, None, 40),
        ("mileage", "Mileage", "int", True, False, None, 50),
        ("fuel_type", "Fuel Type", "choice", True, False, None, 60),
        ("transmission", "Transmission", "choice", True, False, None, 70),
        ("body_type", "Body Type", "text", True, False, None, 80),
        ("color", "Color", "text", True, False, None, 90),
        ("vin", "VIN", "text", False, False, None, 100),
    ]

    # Optional choices (nice for UI later)
    # If you use enums in your models, you can keep these aligned with those values.
    choice_map = {
        "fuel_type": ["PETROL", "DIESEL", "HYBRID", "ELECTRIC", "OTHER"],
        "transmission": ["AUTO", "MANUAL", "CVT", "OTHER"],
    }

    created = 0
    for key, label, data_type, is_filterable, is_required, choices, sort_order in attrs:
        obj, was_created = CategoryAttribute.objects.get_or_create(
            category=cars_cat,
            key=key,
            defaults={
                "label": label,
                "data_type": data_type,
                "is_filterable": is_filterable,
                "is_required": is_required,
                "choices": choice_map.get(key),
                "sort_order": sort_order,
            },
        )
        # Update any missing metadata safely
        changed = False
        if obj.label != label:
            obj.label = label; changed = True
        if obj.data_type != data_type:
            obj.data_type = data_type; changed = True
        if obj.is_filterable != is_filterable:
            obj.is_filterable = is_filterable; changed = True
        if obj.is_required != is_required:
            obj.is_required = is_required; changed = True
        if obj.sort_order != sort_order:
            obj.sort_order = sort_order; changed = True
        desired_choices = choice_map.get(key)
        if desired_choices is not None and obj.choices != desired_choices:
            obj.choices = desired_choices; changed = True
        if changed:
            obj.save()
        if was_created:
            created += 1

    return created


def set_attr(listing: Listing, cars_cat: Category, key: str, value):
    if value is None:
        return
    attr = CategoryAttribute.objects.filter(category=cars_cat, key=key).first()
    if not attr:
        return
    ListingAttributeValue.objects.update_or_create(
        listing=listing,
        attribute=attr,
        defaults={"value": value},
    )


class Command(BaseCommand):
    help = "Migrate legacy CarListing/CarImage/Favorite into V2 Listing system (Category + attributes)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Show what would happen without writing.")
        parser.add_argument("--limit", type=int, default=0, help="Limit number of car listings to migrate (0 = all).")

    @transaction.atomic
    def handle(self, *args, **opts):
        dry = opts["dry_run"]
        limit = opts["limit"]

        cars_cat = ensure_cars_category()
        created_attrs = ensure_car_attributes(cars_cat)

        qs = CarListing.objects.select_related("dealer").prefetch_related("images").order_by("id")
        if limit and limit > 0:
            qs = qs[:limit]

        self.stdout.write(self.style.SUCCESS(f"Cars category ready: {cars_cat.id} (attrs created this run: {created_attrs})"))

        created_listings = 0
        skipped_listings = 0
        created_images = 0
        created_favs = 0

        # map legacy id -> new listing
        id_map = {}

        for car in qs:
            # idempotency key: dealer + category + slug
            existing = Listing.objects.filter(
                dealer=car.dealer,
                category=cars_cat,
                slug=car.slug,
            ).first()

            if existing:
                skipped_listings += 1
                id_map[car.id] = existing.id
                continue

            if dry:
                created_listings += 1
                continue

            # Create new Listing
            new_slug = car.slug or unique_slug(car.title)
            if Listing.objects.filter(slug=new_slug).exists():
                new_slug = unique_slug(new_slug)

            listing = Listing.objects.create(
                dealer=car.dealer,
                created_by=car.created_by,
                category=cars_cat,
                title=car.title,
                slug=new_slug,
                price=car.price,
                currency=car.currency,
                city=car.city,
                region=car.region,
                country=car.country,
                description=car.description,
                status=car.status,
                is_featured=car.is_featured,
                views_count=car.views_count or 0,
            )

            created_listings += 1
            id_map[car.id] = listing.id

            # Attributes
            set_attr(listing, cars_cat, "year", car.year)
            set_attr(listing, cars_cat, "make", car.make)
            set_attr(listing, cars_cat, "model", car.model)
            set_attr(listing, cars_cat, "trim", car.trim)
            set_attr(listing, cars_cat, "mileage", car.mileage)
            set_attr(listing, cars_cat, "fuel_type", car.fuel_type)
            set_attr(listing, cars_cat, "transmission", car.transmission)
            set_attr(listing, cars_cat, "body_type", car.body_type)
            set_attr(listing, cars_cat, "color", car.color)
            set_attr(listing, cars_cat, "vin", car.vin)

            # Images
            imgs = CarImage.objects.filter(listing=car).order_by("sort_order", "id")
            for im in imgs:
                ListingImage.objects.create(
                    listing=listing,
                    image=im.image,
                    thumbnail=im.thumbnail,
                    is_cover=im.is_cover,
                    sort_order=im.sort_order,
                )
                created_images += 1

        # Favorites migration
        if not dry:
            favs = Favorite.objects.select_related("listing", "user").order_by("id")
            for fav in favs:
                new_listing_id = id_map.get(fav.listing_id)
                if not new_listing_id:
                    # listing might have been skipped earlier; try to resolve by dealer+slug
                    car = fav.listing
                    if not car:
                        continue
                    found = Listing.objects.filter(dealer=car.dealer, category=cars_cat, slug=car.slug).first()
                    if not found:
                        continue
                    new_listing_id = found.id

                obj, was_created = FavoriteV2.objects.get_or_create(
                    user=fav.user,
                    listing_id=new_listing_id,
                )
                if was_created:
                    created_favs += 1

        if dry:
            self.stdout.write(self.style.WARNING("DRY RUN: no changes written."))

        self.stdout.write(self.style.SUCCESS(
            f"Done. Listings created: {created_listings}, skipped(existing): {skipped_listings}, "
            f"images created: {created_images}, favorites created: {created_favs}"
        ))
