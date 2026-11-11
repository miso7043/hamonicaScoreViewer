from django.contrib import admin
from django.urls import include, path

from scores import google_auth

urlpatterns = [path("auth/google/", google_auth.login, name="google-login"),
    path("auth/logout/", google_auth.logout, name="google-logout"),
    path("auth/google/callback", google_auth.callback, name="google-callback"), path("admin/", admin.site.urls), path("", include("scores.urls"))]
