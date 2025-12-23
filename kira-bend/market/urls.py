from django.urls import path

from .views import (
    upload_listing_images,
    set_cover_image,
    delete_listing_image,
    reorder_listing_images,
)

urlpatterns = [
    path("listings/<int:listing_id>/images/upload/", upload_listing_images, name="upload_listing_images"),
    path("listings/<int:listing_id>/images/reorder/", reorder_listing_images, name="reorder_listing_images"),
    path("listings/<int:listing_id>/images/<int:image_id>/set-cover/", set_cover_image, name="set_cover_image"),
    path("listings/<int:listing_id>/images/<int:image_id>/", delete_listing_image, name="delete_listing_image"),
]
