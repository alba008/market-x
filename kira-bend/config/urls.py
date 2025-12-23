from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from strawberry.django.views import GraphQLView
from django.urls import path, include


from .schema import schema

urlpatterns = [
    path("admin/", admin.site.urls),

    # CSRF exempt for API clients (curl/Postman/React)
    path("graphql/", csrf_exempt(GraphQLView.as_view(schema=schema))),
    path("api/market/", include("market.urls")),  # ✅ add this

]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
