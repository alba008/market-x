from django.contrib import admin
from .models import InquiryLead

@admin.register(InquiryLead)
class InquiryLeadAdmin(admin.ModelAdmin):
    list_display = ("id", "dealer", "listing", "name", "phone", "email", "created_at")
    search_fields = ("name", "phone", "email", "listing__title", "dealer__dealership_name")
    list_filter = ("source", "created_at")
