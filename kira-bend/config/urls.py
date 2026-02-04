from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from django.views.decorators.csrf import csrf_exempt
from strawberry.django.views import GraphQLView
from market.api_views import upload_listing_image


from .schema import schema


def health(_request):
    return JsonResponse({"ok": True})

graphql_view = csrf_exempt(GraphQLView.as_view(schema=schema))


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health),

    # GraphQL
    path("graphql", graphql_view),
    path("graphql/", graphql_view),


    path("api/listings/<int:listing_id>/images/", upload_listing_image),


    # App APIs
    path("api/market/", include("market.urls")),
]


urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
