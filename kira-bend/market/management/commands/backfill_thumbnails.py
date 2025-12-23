from django.core.management.base import BaseCommand
from market.models import CarImage
from market.signals import generate_thumbnail

class Command(BaseCommand):
    help = "Generate missing thumbnails for CarImage rows."

    def handle(self, *args, **options):
        qs = CarImage.objects.filter(thumbnail__isnull=True).exclude(image="")
        count = 0
        for img in qs.iterator():
            generate_thumbnail(CarImage, img, created=False)
            img.refresh_from_db()
            if img.thumbnail:
                count += 1
        self.stdout.write(self.style.SUCCESS(f"Generated thumbnails: {count}"))
