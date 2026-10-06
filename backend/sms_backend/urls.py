"""
sms_backend/urls.py — URLs principales du projet SMS
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView


def home(request):
    return JsonResponse({
        "message": "Bienvenue sur l'API SMS",
        "endpoints": {
            "admin": "/admin/",
            "api": "/api/",
            "login": "/api/auth/login/",
            "docs": "/api/docs/",
        }
    })

urlpatterns = [
    path("", home),
    path('admin/', admin.site.urls),
    # ── Documentation API (drf-spectacular) ───────────────────────────────────
    path('api/schema/',       SpectacularAPIView.as_view(),                          name='schema'),
    path('api/docs/',         SpectacularSwaggerView.as_view(url_name='schema'),     name='swagger-ui'),
    path('api/redoc/',        SpectacularRedocView.as_view(url_name='schema'),       name='redoc'),
    path('', include('api.urls')),   # toutes les routes /api/... sont dans api/urls.py
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
