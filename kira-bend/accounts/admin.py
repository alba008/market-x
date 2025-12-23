from django.contrib import admin
from .models import DealerProfile

@admin.register(DealerProfile)
class DealerProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "dealership_name", "user", "region", "city", "is_verified", "created_at")
    search_fields = ("dealership_name", "user__username", "user__email")
    list_filter = ("country", "region", "is_verified")
