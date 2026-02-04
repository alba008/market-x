from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status

from market.models import Listing, ListingImage
from accounts.models import DealerProfile

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_listing_image(request, listing_id: int):
    """
    Auth required.
    Only the dealer who owns the listing can upload images.
    """
    user = request.user
    dealer = getattr(user, "dealer_profile", None)
    if not dealer:
        return Response({"detail": "Dealer profile not found."}, status=status.HTTP_400_BAD_REQUEST)

    listing = Listing.objects.filter(id=listing_id, dealer=dealer).first()
    if not listing:
        return Response({"detail": "Listing not found."}, status=status.HTTP_404_NOT_FOUND)

    img = request.FILES.get("image")
    if not img:
        return Response({"detail": "Missing 'image' file."}, status=status.HTTP_400_BAD_REQUEST)

    sort_order = int(request.data.get("sort_order", 0) or 0)
    is_cover = str(request.data.get("is_cover", "false")).lower() in ("1", "true", "yes")

    li = ListingImage.objects.create(
        listing=listing,
        image=img,
        sort_order=sort_order,
        is_cover=is_cover,
    )

    # Optional: if is_cover=true, unset others
    if is_cover:
        ListingImage.objects.filter(listing=listing).exclude(id=li.id).update(is_cover=False)

    return Response(
        {
            "id": li.id,
            "imageUrl": request.build_absolute_uri(li.image.url) if li.image else None,
            "thumbnailUrl": request.build_absolute_uri(li.thumbnail.url) if li.thumbnail else None,
            "isCover": li.is_cover,
            "sortOrder": li.sort_order,
        },
        status=status.HTTP_201_CREATED,
    )
