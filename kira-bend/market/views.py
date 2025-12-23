from django.http import JsonResponse

from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import CarListing, CarImage


def _dealer_and_listing_or_json_error(request, listing_id: int):
    """
    Helper: return (dealer, listing, None) or (None, None, JsonResponse)
    """
    user = request.user
    dealer = getattr(user, "dealer_profile", None)
    if not dealer:
        return None, None, JsonResponse({"detail": "Dealer profile not found."}, status=403)

    listing = CarListing.objects.filter(id=listing_id, dealer=dealer).first()
    if not listing:
        return None, None, JsonResponse({"detail": "Listing not found."}, status=404)

    return dealer, listing, None


@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def upload_listing_images(request, listing_id: int):
    """
    Upload one or many images for a listing.
    JWT required: Authorization: Bearer <access>
    Form-data field name: images (multiple allowed)

    Optional:
      - is_cover: true/false  (if true, first uploaded becomes cover; clears previous cover)
      - sort_order: int base  (default 0)
    """
    _, listing, err = _dealer_and_listing_or_json_error(request, listing_id)
    if err:
        return err

    files = request.FILES.getlist("images")
    if not files:
        return JsonResponse(
            {"detail": "No images uploaded. Use form field name 'images'."},
            status=400,
        )

    # Parse sort_order safely
    try:
        sort_base = int(request.data.get("sort_order", 0) or 0)
    except (TypeError, ValueError):
        sort_base = 0

    # Parse is_cover safely
    is_cover_flag = str(request.data.get("is_cover", "")).strip().lower() in ("1", "true", "yes", "y")

    # If caller wants a cover, ensure there is only one cover for this listing
    if is_cover_flag:
        CarImage.objects.filter(listing=listing, is_cover=True).update(is_cover=False)

    created = []
    for i, f in enumerate(files):
        img = CarImage.objects.create(
            listing=listing,
            image=f,
            is_cover=(is_cover_flag and i == 0),
            sort_order=sort_base + i,
        )
        created.append(
            {
                "id": img.id,
                "imageUrl": getattr(img.image, "url", None),
                "isCover": img.is_cover,
                "sortOrder": img.sort_order,
            }
        )

    # Ensure there is a cover if none exists and images were added
    if not CarImage.objects.filter(listing=listing, is_cover=True).exists():
        first = CarImage.objects.filter(listing=listing).order_by("sort_order", "id").first()
        if first:
            first.is_cover = True
            first.save(update_fields=["is_cover"])

    return JsonResponse(
        {"listingId": listing.id, "count": len(created), "images": created},
        status=201,
    )


@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def set_cover_image(request, listing_id: int, image_id: int):
    """
    Set a specific image as cover for a listing.
    """
    _, listing, err = _dealer_and_listing_or_json_error(request, listing_id)
    if err:
        return err

    image = CarImage.objects.filter(id=image_id, listing=listing).first()
    if not image:
        return JsonResponse({"detail": "Image not found."}, status=404)

    CarImage.objects.filter(listing=listing, is_cover=True).update(is_cover=False)
    image.is_cover = True
    image.save(update_fields=["is_cover"])

    return JsonResponse(
        {
            "listingId": listing.id,
            "coverImageId": image.id,
            "imageUrl": getattr(image.image, "url", None),
        },
        status=200,
    )


@api_view(["DELETE"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def delete_listing_image(request, listing_id: int, image_id: int):
    """
    Delete an image from a listing (also deletes the underlying file).
    If the deleted image was the cover, we auto-assign a new cover if any remain.
    """
    _, listing, err = _dealer_and_listing_or_json_error(request, listing_id)
    if err:
        return err

    img = CarImage.objects.filter(id=image_id, listing=listing).first()
    if not img:
        return JsonResponse({"detail": "Image not found."}, status=404)

    # delete file from storage
    try:
        if img.image:
            img.image.delete(save=False)
    except Exception:
        pass

    # if thumbnails exist in your model later, delete them too
    if hasattr(img, "thumbnail"):
        try:
            if img.thumbnail:
                img.thumbnail.delete(save=False)
        except Exception:
            pass

    was_cover = bool(img.is_cover)
    img.delete()

    # If cover got removed, assign the first remaining image as cover
    if was_cover and not CarImage.objects.filter(listing=listing, is_cover=True).exists():
        first = CarImage.objects.filter(listing=listing).order_by("sort_order", "id").first()
        if first:
            first.is_cover = True
            first.save(update_fields=["is_cover"])

    return JsonResponse({"deleted": True, "imageId": image_id}, status=200)


@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def reorder_listing_images(request, listing_id: int):
    """
    Reorder images for a listing by setting sort_order.

    JSON body:
      { "order": [3, 1, 2] }   # image IDs in desired order
    """
    _, listing, err = _dealer_and_listing_or_json_error(request, listing_id)
    if err:
        return err

    order = request.data.get("order")
    if not isinstance(order, list) or not order:
        return JsonResponse(
            {"detail": "Invalid payload. Expected JSON like: { \"order\": [imageId, ...] }"},
            status=400,
        )

    # Ensure ints
    try:
        order_ids = [int(x) for x in order]
    except Exception:
        return JsonResponse({"detail": "Order must be a list of numeric image IDs."}, status=400)

    imgs = list(CarImage.objects.filter(listing=listing, id__in=order_ids))
    if len(imgs) != len(order_ids):
        return JsonResponse({"detail": "One or more image IDs do not belong to this listing."}, status=400)

    id_to_img = {img.id: img for img in imgs}

    changed = []
    for idx, image_id in enumerate(order_ids):
        img = id_to_img[image_id]
        if img.sort_order != idx:
            img.sort_order = idx
            changed.append(img)

    if changed:
        CarImage.objects.bulk_update(changed, ["sort_order"])

    ordered = CarImage.objects.filter(listing=listing).order_by("sort_order", "id")

    # Ensure there is a cover
    if not ordered.filter(is_cover=True).exists():
        first = ordered.first()
        if first:
            first.is_cover = True
            first.save(update_fields=["is_cover"])
            ordered = CarImage.objects.filter(listing=listing).order_by("sort_order", "id")

    return JsonResponse(
        {
            "listingId": listing.id,
            "images": [
                {
                    "id": i.id,
                    "imageUrl": getattr(i.image, "url", None),
                    "isCover": i.is_cover,
                    "sortOrder": i.sort_order,
                }
                for i in ordered
            ],
        },
        status=200,
    )
