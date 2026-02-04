from __future__ import annotations

import io
from django.core.files.base import ContentFile
from PIL import Image, ImageOps

def make_thumbnail(image_field, size=(600, 600), quality=80) -> ContentFile:
    """
    Create a JPEG thumbnail ContentFile from a Django ImageField/File.

    - Handles EXIF rotation
    - Converts to RGB
    - Uses thumbnail() to maintain aspect ratio
    """
    # image_field can be FieldFile; open it as a file-like object
    image_field.open("rb")
    try:
        img = Image.open(image_field)
        img.load()
    finally:
        try:
            image_field.close()
        except Exception:
            pass

    img = ImageOps.exif_transpose(img)

    if img.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    img.thumbnail(size, Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    return ContentFile(buf.getvalue())
