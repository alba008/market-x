from io import BytesIO
from PIL import Image

from django.core.files.base import ContentFile
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import CarImage

THUMB_SIZE = (700, 700)  # good for cards/grids

@receiver(post_save, sender=CarImage)
def generate_thumbnail(sender, instance: CarImage, created, **kwargs):
    # Only generate when original exists and thumbnail missing
    if not instance.image or instance.thumbnail:
        return

    try:
        img = Image.open(instance.image)
        img = img.convert("RGB")          # safe for PNG w/ alpha
        img.thumbnail(THUMB_SIZE)

        buf = BytesIO()
        img.save(buf, format="JPEG", quality=82, optimize=True)
        buf.seek(0)

        base = instance.image.name.split("/")[-1].rsplit(".", 1)[0]
        thumb_name = f"{base}_thumb.jpg"

        instance.thumbnail.save(thumb_name, ContentFile(buf.read()), save=False)
        instance.save(update_fields=["thumbnail"])
    except Exception:
        # don't break uploads if thumbnail fails
        return
