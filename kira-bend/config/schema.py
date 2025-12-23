import strawberry
from strawberry.types import Info
import strawberry_django
from strawberry_django import auth

from typing import Optional, List

from django.contrib.auth import authenticate, get_user_model
from django.db.models import Q

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import DealerProfile
from leads.models import InquiryLead

# V1 (legacy cars) + V2 (universal marketplace)
from market.models import (
    # V1
    CarListing,
    CarImage,
    Favorite,
    ListingStatus,
    # V2
    Category,
    Listing,
    ListingImage,
    CategoryAttribute,
    ListingAttributeValue,
    FavoriteV2,
)


# =====================================================
# Types (shared)
# =====================================================

@strawberry_django.type(get_user_model())
class UserType:
    id: strawberry.auto
    username: strawberry.auto
    email: strawberry.auto


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


# JWT payload types
@strawberry.type
class AuthTokens:
    access: str
    refresh: str


@strawberry.type
class AuthPayload:
    user: UserType
    tokens: AuthTokens


# Pagination result wrapper types (reusable)
@strawberry.type
class PageInfo:
    limit: int
    offset: int
    has_next: bool
    has_prev: bool


# =====================================================
# V1 Types (Legacy Cars) — unchanged behavior
# =====================================================

@strawberry_django.type(CarImage)
class CarImageType:
    id: strawberry.auto
    image: strawberry.auto
    thumbnail: strawberry.auto
    is_cover: strawberry.auto
    sort_order: strawberry.auto

    @strawberry.field
    def image_url(self) -> Optional[str]:
        try:
            return self.image.url
        except Exception:
            return None

    @strawberry.field
    def thumbnail_url(self) -> Optional[str]:
        try:
            return self.thumbnail.url
        except Exception:
            return None


@strawberry_django.type(CarListing)
class CarListingType:
    id: strawberry.auto
    title: strawberry.auto
    slug: strawberry.auto
    price: strawberry.auto
    currency: strawberry.auto

    city: strawberry.auto
    region: strawberry.auto
    country: strawberry.auto

    year: strawberry.auto
    make: strawberry.auto
    model: strawberry.auto
    trim: strawberry.auto
    mileage: strawberry.auto
    fuel_type: strawberry.auto
    transmission: strawberry.auto
    body_type: strawberry.auto
    color: strawberry.auto
    vin: strawberry.auto
    description: strawberry.auto

    status: strawberry.auto
    is_featured: strawberry.auto
    views_count: strawberry.auto

    created_at: strawberry.auto
    updated_at: strawberry.auto

    dealer: DealerType
    images: list[CarImageType]

    @strawberry.field
    def is_favorited(self, info: Info) -> bool:
        user = info.context.request.user
        if not user or not user.is_authenticated:
            return False
        return Favorite.objects.filter(user=user, listing_id=self.id).exists()


@strawberry_django.type(InquiryLead)
class InquiryLeadType:
    id: strawberry.auto
    name: strawberry.auto
    phone: strawberry.auto
    email: strawberry.auto
    message: strawberry.auto
    source: strawberry.auto
    created_at: strawberry.auto

    listing: CarListingType
    dealer: DealerType


@strawberry.type
class ListingsPage:
    total_count: int
    page_info: PageInfo
    results: list[CarListingType]


# =====================================================
# V2 Types (Universal Marketplace)
# =====================================================

@strawberry_django.type(Category)
class CategoryType:
    id: strawberry.auto
    name: strawberry.auto
    slug: strawberry.auto
    created_at: strawberry.auto


@strawberry_django.type(ListingImage)
class ListingImageType:
    id: strawberry.auto
    image: strawberry.auto
    thumbnail: strawberry.auto
    is_cover: strawberry.auto
    sort_order: strawberry.auto
    created_at: strawberry.auto

    @strawberry.field
    def image_url(self) -> Optional[str]:
        try:
            return self.image.url
        except Exception:
            return None

    @strawberry.field
    def thumbnail_url(self) -> Optional[str]:
        try:
            return self.thumbnail.url
        except Exception:
            return None


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
        return FavoriteV2.objects.filter(user=user, listing_id=self.id).exists()


@strawberry.type
class ListingsPageV2:
    total_count: int
    page_info: PageInfo
    results: list[ListingType]


# =====================================================
# Inputs (V1 legacy) — unchanged
# =====================================================

@strawberry.input
class ListingsFilterInput:
    q: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year_min: Optional[int] = None
    year_max: Optional[int] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    country: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None
    featured_only: Optional[bool] = None


@strawberry.input
class PaginationInput:
    limit: int = 24
    offset: int = 0


@strawberry.input
class CreateListingInput:
    title: str
    price: float
    currency: str = "USD"
    city: str = ""
    region: str = ""
    country: str = "Tanzania"
    year: int = 2020
    make: str = ""
    model: str = ""
    trim: str = ""
    mileage: Optional[int] = None
    fuel_type: str = "PETROL"
    transmission: str = "AUTO"
    body_type: str = ""
    color: str = ""
    vin: str = ""
    description: str = ""


@strawberry.input
class UpdateListingInput:
    title: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[float] = None  # keep exactly as-is if your frontend relies on it
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    year: Optional[int] = None
    make: Optional[str] = None
    model: Optional[str] = None
    trim: Optional[str] = None
    mileage: Optional[int] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    body_type: Optional[str] = None
    color: Optional[str] = None
    vin: Optional[str] = None
    description: Optional[str] = None
    is_featured: Optional[bool] = None


@strawberry.input
class CreateDealerProfileInput:
    dealership_name: str
    phone: str = ""
    whatsapp: str = ""
    email_public: str = ""
    city: str = ""
    region: str = ""
    country: str = "Tanzania"
    bio: str = ""


@strawberry.input
class CreateInquiryInput:
    name: str
    phone: str = ""
    email: str = ""
    message: str = ""
    source: str = "web"


# =====================================================
# Inputs (V2 universal) — GraphQL-safe + modern
# =====================================================

@strawberry.input
class AttributeFilterKVInput:
    key: str
    value: str


@strawberry.input
class AttributeKVInput:
    key: str
    value: strawberry.scalars.JSON


@strawberry.input
class ListingsV2FilterInput:
    q: Optional[str] = None
    category_slug: Optional[str] = None

    price_min: Optional[float] = None
    price_max: Optional[float] = None

    country: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None

    featured_only: Optional[bool] = None

    # GraphQL-safe key/value list for dynamic attribute filters
    # Example: [{key:"mileage", value:"50000"}, {key:"fuel_type", value:"DIESEL"}]
    attributes: Optional[list[AttributeFilterKVInput]] = None


@strawberry.input
class CreateListingV2Input:
    category_slug: str
    title: str
    price: float
    currency: str = "USD"
    city: str = ""
    region: str = ""
    country: str = "Tanzania"
    description: str = ""

    # Optional initial attributes for the listing (typed via JSON scalar)
    # Example: [{key:"year", value:2017}, {key:"make", value:"Toyota"}]
    attributes: Optional[list[AttributeKVInput]] = None


@strawberry.input
class UpdateListingV2Input:
    title: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    description: Optional[str] = None
    is_featured: Optional[bool] = None

    # Upsert attributes
    attributes: Optional[list[AttributeKVInput]] = None


# =====================================================
# Helpers
# =====================================================

def require_user(info: Info):
    user = info.context.request.user
    if not user or not user.is_authenticated:
        raise Exception("Authentication required.")
    return user


def get_dealer_profile_or_none(user):
    return getattr(user, "dealer_profile", None)


def require_dealer(info: Info) -> DealerProfile:
    user = require_user(info)
    dealer = get_dealer_profile_or_none(user)
    if not dealer:
        raise Exception("Dealer profile not found. Create it first.")
    return dealer


# -------------------------
# V1 listing queryset helper (unchanged logic)
# -------------------------

def _public_listings_qs(filters: ListingsFilterInput):
    qs = (
        CarListing.objects.select_related("dealer")
        .prefetch_related("images")
        .filter(status=ListingStatus.PUBLISHED)
    )

    if filters.featured_only is True:
        qs = qs.filter(is_featured=True)

    if filters.q:
        q = filters.q.strip()
        qs = qs.filter(
            Q(title__icontains=q)
            | Q(make__icontains=q)
            | Q(model__icontains=q)
            | Q(trim__icontains=q)
            | Q(description__icontains=q)
        )

    if filters.make:
        qs = qs.filter(make__iexact=filters.make)
    if filters.model:
        qs = qs.filter(model__iexact=filters.model)

    if filters.year_min is not None:
        qs = qs.filter(year__gte=filters.year_min)
    if filters.year_max is not None:
        qs = qs.filter(year__lte=filters.year_max)

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

    return qs.order_by("-is_featured", "-created_at")


# -------------------------
# V2 listing queryset helper (modern + category + attributes)
# -------------------------

def _public_listings_v2_qs(filters: ListingsV2FilterInput):
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

    # GraphQL-safe key/value list filtering
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
    """
    Upsert ListingAttributeValue based on attribute keys for the listing's category.
    Unknown keys are ignored (safe default).
    """
    if not attrs:
        return

    allowed = {
        a.key: a
        for a in CategoryAttribute.objects.filter(category=listing.category)
    }

    for kv in attrs:
        key = kv.key
        if key not in allowed:
            continue

        ListingAttributeValue.objects.update_or_create(
            listing=listing,
            attribute=allowed[key],
            defaults={"value": kv.value},
        )


# =====================================================
# Query
# =====================================================

@strawberry.type
class Query:
    me: Optional[UserType] = auth.current_user()

    # -------------------------
    # Dealers (shared)
    # -------------------------
    @strawberry.field
    def dealers(self, pagination: Optional[PaginationInput] = None) -> list[DealerType]:
        if pagination is None:
            pagination = PaginationInput()
        qs = DealerProfile.objects.all().order_by("-created_at")
        return list(qs[pagination.offset: pagination.offset + pagination.limit])

    @strawberry.field
    def dealer(self, dealer_id: strawberry.ID) -> Optional[DealerType]:
        return DealerProfile.objects.filter(id=dealer_id).first()

    # =================================================
    # V1 (Cars) — unchanged endpoints
    # =================================================

    @strawberry.field
    def listings(
        self,
        filters: Optional[ListingsFilterInput] = None,
        pagination: Optional[PaginationInput] = None,
    ) -> list[CarListingType]:
        if filters is None:
            filters = ListingsFilterInput()
        if pagination is None:
            pagination = PaginationInput()
        qs = _public_listings_qs(filters)
        return list(qs[pagination.offset: pagination.offset + pagination.limit])

    @strawberry.field
    def listings_page(
        self,
        filters: Optional[ListingsFilterInput] = None,
        pagination: Optional[PaginationInput] = None,
    ) -> ListingsPage:
        if filters is None:
            filters = ListingsFilterInput()
        if pagination is None:
            pagination = PaginationInput()

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
    def listing(self, listing_id: strawberry.ID) -> Optional[CarListingType]:
        return (
            CarListing.objects.select_related("dealer")
            .prefetch_related("images")
            .filter(id=listing_id, status=ListingStatus.PUBLISHED)
            .first()
        )

    @strawberry.field
    def listing_by_slug(self, slug: str) -> Optional[CarListingType]:
        return (
            CarListing.objects.select_related("dealer")
            .prefetch_related("images")
            .filter(slug=slug, status=ListingStatus.PUBLISHED)
            .first()
        )

    @strawberry.field
    def my_listings(self, info: Info, pagination: Optional[PaginationInput] = None) -> list[CarListingType]:
        user = require_user(info)
        dealer = get_dealer_profile_or_none(user)
        if not dealer:
            return []

        if pagination is None:
            pagination = PaginationInput()

        qs = (
            CarListing.objects.select_related("dealer")
            .prefetch_related("images")
            .filter(dealer=dealer)
            .order_by("-created_at")
        )
        return list(qs[pagination.offset: pagination.offset + pagination.limit])

    @strawberry.field
    def my_leads(self, info: Info, pagination: Optional[PaginationInput] = None) -> list[InquiryLeadType]:
        user = require_user(info)
        dealer = get_dealer_profile_or_none(user)
        if not dealer:
            return []

        if pagination is None:
            pagination = PaginationInput()

        qs = (
            InquiryLead.objects.select_related("dealer", "listing")
            .filter(dealer=dealer)
            .order_by("-created_at")
        )
        return list(qs[pagination.offset: pagination.offset + pagination.limit])

    @strawberry.field
    def my_favorites(self, info: Info, pagination: Optional[PaginationInput] = None) -> list[CarListingType]:
        user = require_user(info)
        if pagination is None:
            pagination = PaginationInput()

        favs = (
            Favorite.objects.filter(user=user)
            .select_related("listing__dealer")
            .prefetch_related("listing__images")
            .order_by("-created_at")
        )
        return [f.listing for f in favs[pagination.offset: pagination.offset + pagination.limit]]

    # =================================================
    # V2 (Universal Marketplace) — modern endpoints
    # =================================================

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
    def listings_v2(
        self,
        filters: Optional[ListingsV2FilterInput] = None,
        pagination: Optional[PaginationInput] = None,
    ) -> list[ListingType]:
        if filters is None:
            filters = ListingsV2FilterInput()
        if pagination is None:
            pagination = PaginationInput()

        qs = _public_listings_v2_qs(filters)
        return list(qs[pagination.offset: pagination.offset + pagination.limit])

    @strawberry.field
    def listings_page_v2(
        self,
        filters: Optional[ListingsV2FilterInput] = None,
        pagination: Optional[PaginationInput] = None,
    ) -> ListingsPageV2:
        if filters is None:
            filters = ListingsV2FilterInput()
        if pagination is None:
            pagination = PaginationInput()

        qs = _public_listings_v2_qs(filters)

        total = qs.count()
        start = pagination.offset
        end = pagination.offset + pagination.limit
        results = list(qs[start:end])

        return ListingsPageV2(
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
    def listing_v2(self, listing_id: strawberry.ID) -> Optional[ListingType]:
        return (
            Listing.objects.select_related("dealer", "category")
            .prefetch_related("images", "attribute_values__attribute")
            .filter(id=listing_id, status=ListingStatus.PUBLISHED)
            .first()
        )

    @strawberry.field
    def listing_by_slug_v2(self, slug: str) -> Optional[ListingType]:
        return (
            Listing.objects.select_related("dealer", "category")
            .prefetch_related("images", "attribute_values__attribute")
            .filter(slug=slug, status=ListingStatus.PUBLISHED)
            .first()
        )

    @strawberry.field
    def my_listings_v2(self, info: Info, pagination: Optional[PaginationInput] = None) -> list[ListingType]:
        user = require_user(info)
        dealer = get_dealer_profile_or_none(user)
        if not dealer:
            return []

        if pagination is None:
            pagination = PaginationInput()

        qs = (
            Listing.objects.select_related("dealer", "category")
            .prefetch_related("images", "attribute_values__attribute")
            .filter(dealer=dealer)
            .order_by("-created_at")
        )
        return list(qs[pagination.offset: pagination.offset + pagination.limit])

    @strawberry.field
    def my_favorites_v2(self, info: Info, pagination: Optional[PaginationInput] = None) -> list[ListingType]:
        user = require_user(info)
        if pagination is None:
            pagination = PaginationInput()

        favs = (
            FavoriteV2.objects.filter(user=user)
            .select_related("listing__dealer", "listing__category")
            .prefetch_related("listing__images", "listing__attribute_values__attribute")
            .order_by("-created_at")
        )
        return [f.listing for f in favs[pagination.offset: pagination.offset + pagination.limit]]


# =====================================================
# Mutations
# =====================================================

@strawberry.type
class Mutation:
    # -------------------------
    # JWT Auth (unchanged pattern)
    # -------------------------

    @strawberry.mutation
    def register(self, username: str, email: str, password: str) -> AuthPayload:
        User = get_user_model()

        if User.objects.filter(username=username).exists():
            raise Exception("Username already taken.")
        if email and User.objects.filter(email=email).exists():
            raise Exception("Email already in use.")

        user = User.objects.create_user(username=username, email=email, password=password)
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

    # =================================================
    # V1 Marketplace (Cars) — unchanged
    # =================================================

    @strawberry.mutation
    def create_dealer_profile(self, info: Info, input: CreateDealerProfileInput) -> DealerType:
        user = require_user(info)
        if hasattr(user, "dealer_profile"):
            raise Exception("Dealer profile already exists.")

        profile = DealerProfile.objects.create(
            user=user,
            dealership_name=input.dealership_name,
            phone=input.phone,
            whatsapp=input.whatsapp,
            email_public=input.email_public,
            city=input.city,
            region=input.region,
            country=input.country,
            bio=input.bio,
        )
        return profile

    @strawberry.mutation
    def create_listing(self, info: Info, input: CreateListingInput) -> CarListingType:
        user = require_user(info)
        dealer = get_dealer_profile_or_none(user)
        if not dealer:
            raise Exception("Dealer profile not found. Create it first.")

        listing = CarListing.objects.create(
            dealer=dealer,
            created_by=user,
            title=input.title,
            price=input.price,
            currency=input.currency,
            city=input.city,
            region=input.region,
            country=input.country,
            year=input.year,
            make=input.make,
            model=input.model,
            trim=input.trim,
            mileage=input.mileage,
            fuel_type=input.fuel_type,
            transmission=input.transmission,
            body_type=input.body_type,
            color=input.color,
            vin=input.vin,
            description=input.description,
        )
        return listing

    @strawberry.mutation
    def update_listing(self, info: Info, listing_id: strawberry.ID, input: UpdateListingInput) -> CarListingType:
        user = require_user(info)
        dealer = get_dealer_profile_or_none(user)
        if not dealer:
            raise Exception("Dealer profile not found. Create it first.")

        listing = CarListing.objects.filter(id=listing_id, dealer=dealer).first()
        if not listing:
            raise Exception("Listing not found.")

        for field, value in input.__dict__.items():
            if value is not None:
                setattr(listing, field, value)

        listing.save()
        return listing

    @strawberry.mutation
    def publish_listing(self, info: Info, listing_id: strawberry.ID) -> CarListingType:
        user = require_user(info)
        dealer = get_dealer_profile_or_none(user)
        if not dealer:
            raise Exception("Dealer profile not found. Create it first.")

        listing = CarListing.objects.filter(id=listing_id, dealer=dealer).first()
        if not listing:
            raise Exception("Listing not found.")

        listing.status = ListingStatus.PUBLISHED
        listing.save()
        return listing

    @strawberry.mutation
    def mark_sold(self, info: Info, listing_id: strawberry.ID) -> CarListingType:
        user = require_user(info)
        dealer = get_dealer_profile_or_none(user)
        if not dealer:
            raise Exception("Dealer profile not found. Create it first.")

        listing = CarListing.objects.filter(id=listing_id, dealer=dealer).first()
        if not listing:
            raise Exception("Listing not found.")

        listing.status = ListingStatus.SOLD
        listing.save()
        return listing

    @strawberry.mutation
    def delete_listing(self, info: Info, listing_id: strawberry.ID) -> bool:
        user = require_user(info)
        dealer = get_dealer_profile_or_none(user)
        if not dealer:
            raise Exception("Dealer profile not found. Create it first.")

        deleted, _ = CarListing.objects.filter(id=listing_id, dealer=dealer).delete()
        return deleted > 0

    @strawberry.mutation
    def create_inquiry(self, listing_id: strawberry.ID, input: CreateInquiryInput) -> InquiryLeadType:
        listing = (
            CarListing.objects.select_related("dealer")
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
        listing = CarListing.objects.filter(id=listing_id, status=ListingStatus.PUBLISHED).first()
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
        listing = CarListing.objects.filter(id=listing_id, status=ListingStatus.PUBLISHED).first()
        if not listing:
            raise Exception("Listing not found.")
        listing.views_count = (listing.views_count or 0) + 1
        listing.save(update_fields=["views_count"])
        return listing.views_count

    # =================================================
    # V2 Marketplace (Universal) — modern
    # =================================================

    @strawberry.mutation
    def create_listing_v2(self, info: Info, input: CreateListingV2Input) -> ListingType:
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
    def update_listing_v2(self, info: Info, listing_id: strawberry.ID, input: UpdateListingV2Input) -> ListingType:
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
    def publish_listing_v2(self, info: Info, listing_id: strawberry.ID) -> ListingType:
        dealer = require_dealer(info)

        listing = Listing.objects.filter(id=listing_id, dealer=dealer).first()
        if not listing:
            raise Exception("Listing not found.")

        listing.status = ListingStatus.PUBLISHED
        listing.save(update_fields=["status"])
        return listing

    @strawberry.mutation
    def mark_sold_v2(self, info: Info, listing_id: strawberry.ID) -> ListingType:
        dealer = require_dealer(info)

        listing = Listing.objects.filter(id=listing_id, dealer=dealer).first()
        if not listing:
            raise Exception("Listing not found.")

        listing.status = ListingStatus.SOLD
        listing.save(update_fields=["status"])
        return listing

    @strawberry.mutation
    def delete_listing_v2(self, info: Info, listing_id: strawberry.ID) -> bool:
        dealer = require_dealer(info)
        deleted, _ = Listing.objects.filter(id=listing_id, dealer=dealer).delete()
        return deleted > 0

    @strawberry.mutation
    def toggle_favorite_v2(self, info: Info, listing_id: strawberry.ID) -> bool:
        user = require_user(info)

        listing = Listing.objects.filter(id=listing_id, status=ListingStatus.PUBLISHED).first()
        if not listing:
            raise Exception("Listing not found.")

        fav = FavoriteV2.objects.filter(user=user, listing=listing).first()
        if fav:
            fav.delete()
            return False

        FavoriteV2.objects.create(user=user, listing=listing)
        return True

    @strawberry.mutation
    def increment_listing_view_v2(self, listing_id: strawberry.ID) -> int:
        listing = Listing.objects.filter(id=listing_id, status=ListingStatus.PUBLISHED).first()
        if not listing:
            raise Exception("Listing not found.")
        listing.views_count = (listing.views_count or 0) + 1
        listing.save(update_fields=["views_count"])
        return listing.views_count


schema = strawberry.Schema(query=Query, mutation=Mutation)
