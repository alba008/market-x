import datetime
import hashlib
from typing import Optional, List

import strawberry
import strawberry_django
from strawberry.types import Info
from strawberry.file_uploads import Upload

from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.db.models import Q, F, Sum, Count
from django.utils import timezone

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import DealerProfile, UserProfile
from leads.models import InquiryLead
from market.models import (
    Category,
    Listing,
    ListingImage,
    CategoryAttribute,
    ListingAttributeValue,
    FavoriteV2 as Favorite,  # ✅ unify favorites to ONE table
    ListingStatus,
    Currency,
    FuelType,
    Transmission,
    ModerationStatus,
)

# =====================================================
# Helpers
# =====================================================

def _abs_url(info: Info, maybe_url: Optional[str]) -> Optional[str]:
    """Return absolute URL for a media file URL."""
    if not maybe_url:
        return None
    try:
        req = info.context.request
        if maybe_url.startswith("http://") or maybe_url.startswith("https://"):
            return maybe_url
        return req.build_absolute_uri(maybe_url)
    except Exception:
        return maybe_url


def require_user(info: Info):
    user = info.context.request.user
    if not user or not user.is_authenticated:
        raise Exception("Authentication required.")
    return user


def _get_profile(user) -> Optional[UserProfile]:
    return getattr(user, "profile", None)


def require_profile(user) -> UserProfile:
    prof = _get_profile(user)
    if prof:
        return prof
    prof, _ = UserProfile.objects.get_or_create(user=user)
    return prof


def get_dealer_profile_or_none(user):
    return getattr(user, "dealer_profile", None)


def require_staff(info: Info) -> UserProfile:
    user = require_user(info)
    prof = require_profile(user)
    if prof.role == UserProfile.Roles.STAFF or user.is_staff or user.is_superuser:
        return prof
    raise Exception("Staff access required.")


def require_dealer(info: Info) -> DealerProfile:
    user = require_user(info)
    prof = require_profile(user)

    is_allowed = (
        prof.role in (UserProfile.Roles.DEALER, UserProfile.Roles.STAFF)
        or user.is_staff
        or user.is_superuser
    )
    if not is_allowed:
        raise Exception("Dealer access required.")

    dealer = get_dealer_profile_or_none(user)
    if not dealer:
        raise Exception("Dealer profile not found. Create it first.")
    return dealer


def _daily_featured_pick_id(featured_ids: list[int], day: datetime.date) -> Optional[int]:
    """
    Deterministic daily pick: same day -> same listing, changes next day.
    Uses SHA256(day) modulo number of featured IDs.
    """
    if not featured_ids:
        return None
    seed = day.isoformat().encode("utf-8")
    h = hashlib.sha256(seed).hexdigest()
    idx = int(h[:8], 16) % len(featured_ids)
    return featured_ids[idx]


# =====================================================
# Meta (Enums -> Dropdown Options)
# =====================================================

@strawberry.type
class Option:
    value: str
    label: str


@strawberry.type
class MarketMeta:
    currencies: list[Option]
    fuel_types: list[Option]
    transmissions: list[Option]
    listing_statuses: list[Option]
    moderation_statuses: list[Option]


def _choices_to_options(choices) -> list[Option]:
    return [Option(value=v, label=l) for v, l in choices]


# =====================================================
# Auth Types
# =====================================================

@strawberry_django.type(get_user_model())
class UserType:
    id: strawberry.auto
    username: strawberry.auto
    email: strawberry.auto

    @strawberry.field
    def role(self) -> str:
        prof = getattr(self, "profile", None)
        return getattr(prof, "role", UserProfile.Roles.CUSTOMER)

    @strawberry.field
    def is_staff(self) -> bool:
        return bool(getattr(self, "is_staff", False))

    @strawberry.field
    def is_superuser(self) -> bool:
        return bool(getattr(self, "is_superuser", False))


@strawberry.type
class AuthTokens:
    access: str
    refresh: str


@strawberry.type
class AuthPayload:
    user: UserType
    tokens: AuthTokens


# =====================================================
# Pagination
# =====================================================

@strawberry.input
class PaginationInput:
    limit: int = 24
    offset: int = 0


@strawberry.type
class PageInfo:
    limit: int
    offset: int
    has_next: bool
    has_prev: bool


# =====================================================
# Dealer
# =====================================================

@strawberry_django.type(DealerProfile)
class DealerType:
    id: strawberry.auto
    dealership_name: strawberry.auto
    phone: strawberry.auto
    whatsapp: strawberry.auto
    email_public: strawberry.auto
    city: strawberry.auto
    region: strawberry.auto
    country: strawberry.auto
    bio: strawberry.auto
    is_verified: strawberry.auto
    created_at: strawberry.auto
    updated_at: strawberry.auto


@strawberry.input
class DealerProfileInput:
    dealership_name: str
    phone: str = ""
    whatsapp: str = ""
    email_public: str = ""
    city: str = ""
    region: str = ""
    country: str = "Tanzania"
    bio: str = ""


# =====================================================
# Category + Attributes
# =====================================================

@strawberry_django.type(Category)
class CategoryType:
    id: strawberry.auto
    name: strawberry.auto
    slug: strawberry.auto
    created_at: strawberry.auto


@strawberry_django.type(CategoryAttribute)
class CategoryAttributeType:
    id: strawberry.auto
    key: strawberry.auto
    label: strawberry.auto
    data_type: strawberry.auto
    is_filterable: strawberry.auto
    is_required: strawberry.auto
    choices: strawberry.auto
    sort_order: strawberry.auto
    category: CategoryType


@strawberry_django.type(ListingAttributeValue)
class ListingAttributeValueType:
    id: strawberry.auto
    value: strawberry.auto
    attribute: CategoryAttributeType


@strawberry.input
class AttributeFilterKVInput:
    key: str
    value: str


@strawberry.input
class AttributeKVInput:
    key: str
    value: strawberry.scalars.JSON


# =====================================================
# Listing Images
# =====================================================

@strawberry_django.type(ListingImage)
class ListingImageType:
    id: strawberry.auto
    is_cover: strawberry.auto
    sort_order: strawberry.auto
    created_at: strawberry.auto

    image: strawberry.auto
    thumbnail: strawberry.auto

    @strawberry.field
    def image_url(self, info: Info) -> Optional[str]:
        try:
            return _abs_url(info, self.image.url)
        except Exception:
            return None

    @strawberry.field
    def thumbnail_url(self, info: Info) -> Optional[str]:
        """
        ✅ fallback to image_url if thumbnail missing
        """
        try:
            thumb = getattr(self, "thumbnail", None)
            if thumb and getattr(thumb, "url", None):
                return _abs_url(info, thumb.url)
        except Exception:
            pass
        try:
            return _abs_url(info, self.image.url)
        except Exception:
            return None


# =====================================================
# Listing
# =====================================================

@strawberry_django.type(Listing)
class ListingType:
    id: strawberry.auto
    title: strawberry.auto
    slug: strawberry.auto
    price: strawberry.auto
    currency: strawberry.auto

    city: strawberry.auto
    region: strawberry.auto
    country: strawberry.auto

    description: strawberry.auto
    status: strawberry.auto
    is_featured: strawberry.auto
    views_count: strawberry.auto

    # ✅ Listing of the Day fields
    spotlight_date: strawberry.auto
    spotlight_pinned: strawberry.auto

    created_at: strawberry.auto
    updated_at: strawberry.auto

    dealer: DealerType
    category: CategoryType
    images: list[ListingImageType]
    attribute_values: list[ListingAttributeValueType]

    @strawberry.field
    def is_favorited(self, info: Info) -> bool:
        user = info.context.request.user
        if not user or not user.is_authenticated:
            return False
        return Favorite.objects.filter(user=user, listing_id=self.id).exists()


@strawberry.type
class ListingsPage:
    total_count: int
    page_info: PageInfo
    results: list[ListingType]


# ✅ NEW: totals for advertiser-friendly stats
@strawberry.type
class CategoryViewsTotal:
    category_id: strawberry.ID
    name: str
    slug: str
    listings_count: int
    total_views: int


# =====================================================
# Public Filters (Unified)
# =====================================================

@strawberry.input
class ListingsFilterInput:
    q: Optional[str] = None
    category_slug: Optional[str] = None

    price_min: Optional[float] = None
    price_max: Optional[float] = None

    country: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None

    featured_only: Optional[bool] = None
    attributes: Optional[list[AttributeFilterKVInput]] = None


def _public_listings_qs(filters: ListingsFilterInput):
    qs = (
        Listing.objects.select_related("dealer", "category")
        .prefetch_related("images", "attribute_values__attribute")
        .filter(status=ListingStatus.PUBLISHED)
    )

    if filters.featured_only is True:
        qs = qs.filter(is_featured=True)

    if filters.category_slug:
        qs = qs.filter(category__slug=filters.category_slug)

    if filters.q:
        q = filters.q.strip()
        qs = qs.filter(
            Q(title__icontains=q)
            | Q(description__icontains=q)
            | Q(city__icontains=q)
            | Q(region__icontains=q)
            | Q(country__icontains=q)
        )

    if filters.price_min is not None:
        qs = qs.filter(price__gte=filters.price_min)
    if filters.price_max is not None:
        qs = qs.filter(price__lte=filters.price_max)

    if filters.country:
        qs = qs.filter(country__iexact=filters.country)
    if filters.region:
        qs = qs.filter(region__iexact=filters.region)
    if filters.city:
        qs = qs.filter(city__iexact=filters.city)

    if filters.attributes:
        for kv in filters.attributes:
            key = (kv.key or "").strip()
            raw = (kv.value or "").strip()
            if not key:
                continue
            qs = qs.filter(
                attribute_values__attribute__key=key,
                attribute_values__value__icontains=str(raw),
            )

    return qs.order_by("-is_featured", "-created_at").distinct()


def _upsert_listing_attributes(listing: Listing, attrs: list[AttributeKVInput]):
    if not attrs:
        return

    allowed = {a.key: a for a in CategoryAttribute.objects.filter(category=listing.category)}

    for kv in attrs:
        key = (kv.key or "").strip()
        if not key or key not in allowed:
            continue
        ListingAttributeValue.objects.update_or_create(
            listing=listing,
            attribute=allowed[key],
            defaults={"value": kv.value},
        )


# =====================================================
# Listing Inputs (Unified)
# =====================================================

@strawberry.input
class CreateListingInput:
    category_slug: str
    title: str
    price: float
    currency: str = "USD"
    city: str = ""
    region: str = ""
    country: str = "Tanzania"
    description: str = ""
    attributes: Optional[list[AttributeKVInput]] = None


@strawberry.input
class UpdateListingInput:
    title: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    description: Optional[str] = None
    is_featured: Optional[bool] = None
    spotlight_date: Optional[datetime.date] = None
    spotlight_pinned: Optional[bool] = None
    attributes: Optional[list[AttributeKVInput]] = None


# =====================================================
# Leads
# =====================================================

@strawberry_django.type(InquiryLead)
class InquiryLeadType:
    id: strawberry.auto
    name: strawberry.auto
    phone: strawberry.auto
    email: strawberry.auto
    message: strawberry.auto
    source: strawberry.auto
    created_at: strawberry.auto

    is_read: strawberry.auto
    read_at: strawberry.auto

    listing: ListingType
    dealer: DealerType


@strawberry.input
class CreateInquiryInput:
    name: str
    phone: str = ""
    email: str = ""
    message: str = ""
    source: str = "web"


# =====================================================
# Query
# =====================================================

@strawberry.type
class Query:
    @strawberry.field
    def me(self, info: Info) -> Optional[UserType]:
        user = info.context.request.user
        if not user or not user.is_authenticated:
            return None
        require_profile(user)
        return user

    @strawberry.field
    def market_meta(self) -> MarketMeta:
        return MarketMeta(
            currencies=_choices_to_options(Currency.choices),
            fuel_types=_choices_to_options(FuelType.choices),
            transmissions=_choices_to_options(Transmission.choices),
            listing_statuses=_choices_to_options(ListingStatus.choices),
            moderation_statuses=_choices_to_options(ModerationStatus.choices),
        )

    # ---------- Public ----------
    @strawberry.field
    def categories(self) -> list[CategoryType]:
        return list(Category.objects.all().order_by("name"))

    @strawberry.field
    def category(self, slug: str) -> Optional[CategoryType]:
        return Category.objects.filter(slug=slug).first()

    @strawberry.field
    def category_attributes(self, category_slug: str) -> list[CategoryAttributeType]:
        return list(
            CategoryAttribute.objects.select_related("category")
            .filter(category__slug=category_slug)
            .order_by("sort_order", "id")
        )

    @strawberry.field
    def listings(
        self,
        filters: Optional[ListingsFilterInput] = None,
        pagination: Optional[PaginationInput] = None,
    ) -> list[ListingType]:
        filters = filters or ListingsFilterInput()
        pagination = pagination or PaginationInput()
        qs = _public_listings_qs(filters)
        return list(qs[pagination.offset : pagination.offset + pagination.limit])

    @strawberry.field
    def listings_page(
        self,
        filters: Optional[ListingsFilterInput] = None,
        pagination: Optional[PaginationInput] = None,
    ) -> ListingsPage:
        filters = filters or ListingsFilterInput()
        pagination = pagination or PaginationInput()

        qs = _public_listings_qs(filters)
        total = qs.count()
        start = pagination.offset
        end = pagination.offset + pagination.limit
        results = list(qs[start:end])

        return ListingsPage(
            total_count=total,
            page_info=PageInfo(
                limit=pagination.limit,
                offset=pagination.offset,
                has_prev=pagination.offset > 0,
                has_next=end < total,
            ),
            results=results,
        )

    @strawberry.field
    def listing(self, listing_id: strawberry.ID) -> Optional[ListingType]:
        return (
            Listing.objects.select_related("dealer", "category")
            .prefetch_related("images", "attribute_values__attribute")
            .filter(id=listing_id, status=ListingStatus.PUBLISHED)
            .first()
        )

    @strawberry.field
    def listing_by_slug(self, slug: str) -> Optional[ListingType]:
        return (
            Listing.objects.select_related("dealer", "category")
            .prefetch_related("images", "attribute_values__attribute")
            .filter(slug=slug, status=ListingStatus.PUBLISHED)
            .first()
        )

    # ✅ NEW: totals per category
    @strawberry.field
    def category_views_totals(self, info: Info, limit: int = 20) -> list[CategoryViewsTotal]:
        rows = (
            Listing.objects.filter(status=ListingStatus.PUBLISHED)
            .values("category_id", "category__name", "category__slug")
            .annotate(
                listings_count=Count("id"),
                total_views=Sum("views_count"),
            )
            .order_by("-total_views")[:limit]
        )

        out: list[CategoryViewsTotal] = []
        for r in rows:
            out.append(
                CategoryViewsTotal(
                    category_id=str(r["category_id"]),
                    name=str(r["category__name"] or ""),
                    slug=str(r["category__slug"] or ""),
                    listings_count=int(r["listings_count"] or 0),
                    total_views=int(r["total_views"] or 0),
                )
            )
        return out

    # ✅ NEW: trending listings
    @strawberry.field
    def trending_listings(self, info: Info, limit: int = 12) -> list[ListingType]:
        return list(
            Listing.objects.select_related("dealer", "category")
            .prefetch_related("images", "attribute_values__attribute")
            .filter(status=ListingStatus.PUBLISHED)
            .order_by("-views_count", "-created_at")[:limit]
        )

    # ✅ Listing of the Day
    @strawberry.field
    def listing_of_day(self, info: Info) -> Optional[ListingType]:
        today = timezone.localdate()

        base_qs = (
            Listing.objects.select_related("dealer", "category")
            .prefetch_related("images", "attribute_values__attribute")
            .filter(status=ListingStatus.PUBLISHED, is_featured=True)
        )

        forced = base_qs.filter(spotlight_date=today).order_by("-updated_at", "-created_at").first()
        if forced:
            return forced

        pinned = base_qs.filter(spotlight_pinned=True).order_by("-updated_at", "-created_at").first()
        if pinned:
            return pinned

        ids = list(base_qs.order_by("id").values_list("id", flat=True))
        picked_id = _daily_featured_pick_id(ids, today)
        if not picked_id:
            return None

        return base_qs.filter(id=picked_id).first()

    # ---------- Private ----------
    @strawberry.field
    def my_dealer_profile(self, info: Info) -> Optional[DealerType]:
        user = require_user(info)
        require_profile(user)
        return DealerProfile.objects.filter(user=user).first()

    @strawberry.field
    def my_listings(self, info: Info, pagination: Optional[PaginationInput] = None) -> list[ListingType]:
        dealer = require_dealer(info)
        pagination = pagination or PaginationInput()
        qs = (
            Listing.objects.select_related("dealer", "category")
            .prefetch_related("images", "attribute_values__attribute")
            .filter(dealer=dealer)
            .order_by("-created_at")
        )
        return list(qs[pagination.offset : pagination.offset + pagination.limit])

    @strawberry.field
    def my_listing(self, info: Info, listing_id: strawberry.ID) -> Optional[ListingType]:
        dealer = require_dealer(info)
        return (
            Listing.objects.select_related("dealer", "category")
            .prefetch_related("images", "attribute_values__attribute")
            .filter(dealer=dealer, id=listing_id)
            .first()
        )

    @strawberry.field
    def my_leads(self, info: Info, pagination: Optional[PaginationInput] = None) -> list[InquiryLeadType]:
        dealer = require_dealer(info)
        pagination = pagination or PaginationInput()
        qs = (
            InquiryLead.objects.select_related("dealer", "listing")
            .filter(dealer=dealer)
            .order_by("-created_at")
        )
        return list(qs[pagination.offset : pagination.offset + pagination.limit])

    @strawberry.field
    def unread_leads_count(self, info: Info) -> int:
        dealer = require_dealer(info)
        return InquiryLead.objects.filter(dealer=dealer, is_read=False).count()

    @strawberry.field
    def my_favorites(self, info: Info, pagination: Optional[PaginationInput] = None) -> list[ListingType]:
        user = require_user(info)
        require_profile(user)
        pagination = pagination or PaginationInput()

        favs = (
            Favorite.objects.filter(user=user)
            .select_related("listing__dealer", "listing__category")
            .prefetch_related("listing__images", "listing__attribute_values__attribute")
            .order_by("-created_at")
        )
        return [f.listing for f in favs[pagination.offset : pagination.offset + pagination.limit]]


# =====================================================
# Mutations
# =====================================================

@strawberry.type
class Mutation:
    # ---------- Auth ----------
    @strawberry.mutation
    def register(self, username: str, email: str, password: str) -> AuthPayload:
        User = get_user_model()
        if User.objects.filter(username=username).exists():
            raise Exception("Username already taken.")
        if email and User.objects.filter(email=email).exists():
            raise Exception("Email already in use.")

        with transaction.atomic():
            user = User.objects.create_user(username=username, email=email, password=password)
            UserProfile.objects.get_or_create(user=user, defaults={"role": UserProfile.Roles.CUSTOMER})

        refresh = RefreshToken.for_user(user)
        return AuthPayload(
            user=user,
            tokens=AuthTokens(access=str(refresh.access_token), refresh=str(refresh)),
        )

    @strawberry.mutation
    def login(self, info: Info, username: str, password: str) -> AuthPayload:
        user = authenticate(username=username, password=password)
        if not user:
            raise Exception("Invalid username or password.")
        require_profile(user)
        refresh = RefreshToken.for_user(user)
        return AuthPayload(
            user=user,
            tokens=AuthTokens(access=str(refresh.access_token), refresh=str(refresh)),
        )

    @strawberry.mutation
    def refresh_token(self, refresh: str) -> AuthTokens:
        try:
            token = RefreshToken(refresh)
            access = str(token.access_token)
            return AuthTokens(access=access, refresh=refresh)
        except Exception:
            raise Exception("Invalid refresh token.")

    @strawberry.mutation
    def logout(self, refresh: str) -> bool:
        return True

    # ---------- Dealer ----------
    @strawberry.mutation
    def become_dealer(self, info: Info, input: DealerProfileInput) -> DealerType:
        user = require_user(info)
        prof = require_profile(user)

        with transaction.atomic():
            prof.role = UserProfile.Roles.DEALER
            prof.save(update_fields=["role", "updated_at"])

            dealer, _ = DealerProfile.objects.update_or_create(
                user=user,
                defaults={
                    "dealership_name": input.dealership_name,
                    "phone": input.phone,
                    "whatsapp": input.whatsapp,
                    "email_public": input.email_public,
                    "city": input.city,
                    "region": input.region,
                    "country": input.country,
                    "bio": input.bio,
                },
            )
        return dealer

    @strawberry.mutation
    def upsert_dealer_profile(self, info: Info, input: DealerProfileInput) -> DealerType:
        user = require_user(info)
        prof = require_profile(user)

        with transaction.atomic():
            if prof.role == UserProfile.Roles.CUSTOMER:
                prof.role = UserProfile.Roles.DEALER
                prof.save(update_fields=["role", "updated_at"])

            profile, _ = DealerProfile.objects.update_or_create(
                user=user,
                defaults={
                    "dealership_name": input.dealership_name,
                    "phone": input.phone,
                    "whatsapp": input.whatsapp,
                    "email_public": input.email_public,
                    "city": input.city,
                    "region": input.region,
                    "country": input.country,
                    "bio": input.bio,
                },
            )
        return profile

    # ---------- Listing ----------
    @strawberry.mutation
    def create_listing(self, info: Info, input: CreateListingInput) -> ListingType:
        dealer = require_dealer(info)

        category = Category.objects.filter(slug=input.category_slug).first()
        if not category:
            raise Exception("Category not found.")

        listing = Listing.objects.create(
            dealer=dealer,
            created_by=info.context.request.user,
            category=category,
            title=input.title,
            price=input.price,
            currency=input.currency,
            city=input.city,
            region=input.region,
            country=input.country,
            description=input.description,
        )

        if input.attributes:
            _upsert_listing_attributes(listing, input.attributes)

        return listing

    @strawberry.mutation
    def update_listing(self, info: Info, listing_id: strawberry.ID, input: UpdateListingInput) -> ListingType:
        dealer = require_dealer(info)
        listing = Listing.objects.filter(id=listing_id, dealer=dealer).first()
        if not listing:
            raise Exception("Listing not found.")

        for field, value in input.__dict__.items():
            if field == "attributes":
                continue
            if value is not None:
                setattr(listing, field, value)

        listing.save()

        if input.attributes:
            _upsert_listing_attributes(listing, input.attributes)

        return listing

    @strawberry.mutation
    def publish_listing(self, info: Info, listing_id: strawberry.ID) -> ListingType:
        dealer = require_dealer(info)
        listing = Listing.objects.filter(id=listing_id, dealer=dealer).first()
        if not listing:
            raise Exception("Listing not found.")
        listing.status = ListingStatus.PUBLISHED
        listing.save(update_fields=["status"])
        return listing

    @strawberry.mutation
    def unpublish_listing(self, info: Info, listing_id: strawberry.ID) -> ListingType:
        dealer = require_dealer(info)
        listing = Listing.objects.filter(id=listing_id, dealer=dealer).first()
        if not listing:
            raise Exception("Listing not found.")
        listing.status = ListingStatus.DRAFT
        listing.save(update_fields=["status"])
        return listing

    @strawberry.mutation
    def mark_sold(self, info: Info, listing_id: strawberry.ID) -> ListingType:
        dealer = require_dealer(info)
        listing = Listing.objects.filter(id=listing_id, dealer=dealer).first()
        if not listing:
            raise Exception("Listing not found.")
        listing.status = ListingStatus.SOLD
        listing.save(update_fields=["status"])
        return listing

    @strawberry.mutation
    def delete_listing(self, info: Info, listing_id: strawberry.ID) -> bool:
        dealer = require_dealer(info)
        deleted, _ = Listing.objects.filter(id=listing_id, dealer=dealer).delete()
        return deleted > 0

    # ---------- Listing Images ----------
    @strawberry.mutation
    def set_listing_cover_image(self, info: Info, image_id: strawberry.ID) -> bool:
        dealer = require_dealer(info)
        image = (
            ListingImage.objects.select_related("listing")
            .filter(id=image_id, listing__dealer=dealer)
            .first()
        )
        if not image:
            raise Exception("Image not found.")

        with transaction.atomic():
            ListingImage.objects.filter(listing=image.listing, is_cover=True).update(is_cover=False)
            image.is_cover = True
            image.save(update_fields=["is_cover"])
        return True

    @strawberry.mutation
    def delete_listing_image(self, info: Info, image_id: strawberry.ID) -> bool:
        dealer = require_dealer(info)
        deleted, _ = ListingImage.objects.filter(id=image_id, listing__dealer=dealer).delete()
        return deleted > 0

    @strawberry.mutation
    def reorder_listing_images(self, info: Info, listing_id: strawberry.ID, image_ids: list[strawberry.ID]) -> bool:
        dealer = require_dealer(info)

        listing = Listing.objects.filter(id=listing_id, dealer=dealer).first()
        if not listing:
            raise Exception("Listing not found.")

        images = {str(img.id): img for img in ListingImage.objects.filter(listing=listing)}

        with transaction.atomic():
            for index, img_id in enumerate(image_ids):
                img = images.get(str(img_id))
                if img:
                    img.sort_order = index
                    img.save(update_fields=["sort_order"])
        return True

    @strawberry.mutation
    def upload_listing_images(self, info: Info, listing_id: strawberry.ID, files: List[Upload]) -> List[ListingImageType]:
        dealer = require_dealer(info)
        listing = Listing.objects.filter(id=listing_id, dealer=dealer).first()
        if not listing:
            raise Exception("Listing not found.")

        max_sort = (
            ListingImage.objects.filter(listing=listing)
            .order_by("-sort_order")
            .values_list("sort_order", flat=True)
            .first()
        )
        next_sort = int(max_sort or 0)

        created = []
        with transaction.atomic():
            has_cover = ListingImage.objects.filter(listing=listing, is_cover=True).exists()

            for f in files:
                next_sort += 1
                img = ListingImage.objects.create(
                    listing=listing,
                    image=f,
                    sort_order=next_sort,
                    is_cover=False,
                )
                created.append(img)

            if not has_cover and created:
                created[0].is_cover = True
                created[0].save(update_fields=["is_cover"])

        return created

    # ---------- Leads ----------
    @strawberry.mutation
    def mark_all_leads_read(self, info: Info) -> bool:
        dealer = require_dealer(info)
        InquiryLead.objects.filter(dealer=dealer, is_read=False).update(
            is_read=True,
            read_at=timezone.now(),
        )
        return True

    # ---------- Public actions ----------
    @strawberry.mutation
    def create_inquiry(self, listing_id: strawberry.ID, input: CreateInquiryInput) -> InquiryLeadType:
        listing = (
            Listing.objects.select_related("dealer", "category")
            .filter(id=listing_id, status=ListingStatus.PUBLISHED)
            .first()
        )
        if not listing:
            raise Exception("Listing not found or not published.")

        lead = InquiryLead.objects.create(
            listing=listing,
            dealer=listing.dealer,
            name=input.name,
            phone=input.phone,
            email=input.email,
            message=input.message,
            source=input.source,
        )
        return lead

    @strawberry.mutation
    def toggle_favorite(self, info: Info, listing_id: strawberry.ID) -> bool:
        user = require_user(info)
        listing = Listing.objects.filter(id=listing_id, status=ListingStatus.PUBLISHED).first()
        if not listing:
            raise Exception("Listing not found.")

        fav = Favorite.objects.filter(user=user, listing=listing).first()
        if fav:
            fav.delete()
            return False

        Favorite.objects.create(user=user, listing=listing)
        return True

    @strawberry.mutation
    def increment_listing_view(self, listing_id: strawberry.ID) -> int:
        listing = Listing.objects.filter(id=listing_id, status=ListingStatus.PUBLISHED).first()
        if not listing:
            raise Exception("Listing not found.")
        Listing.objects.filter(pk=listing.pk).update(views_count=F("views_count") + 1)
        listing.refresh_from_db(fields=["views_count"])
        return listing.views_count


schema = strawberry.Schema(query=Query, mutation=Mutation)
