"""
sms_backend/urls.py — URLs principales du projet SMS
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def home(request):                    
    return JsonResponse({
        "message": "Bienvenue sur l'API SMS",
        "endpoints": {
            "admin": "/admin/",
            "api": "/api/",
            "login": "/api/auth/login/",
        }
    })

urlpatterns = [
    path("", home),
    path('admin/', admin.site.urls), 
    path('', include('api.urls')),   # toutes les routes /api/... sont dans api/urls.py
]
