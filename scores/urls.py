from django.urls import path
from . import views

app_name = "scores"
urlpatterns = [
    path("m", views.score_list, {"mobile": True}, name="mobile-list"),
    path("m/", views.score_list, {"mobile": True}),
    path("m/scores/<int:pk>/", views.score_detail, {"mobile": True}, name="mobile-detail"),
    path("", views.score_list, name="list"),
    path("scores/<int:pk>/", views.score_detail, name="detail"),
    path("scores/<int:pk>/edit/", views.score_edit, name="edit"),
    path("scores/<int:pk>/delete/", views.score_delete, name="delete"),
    path("scores/<int:pk>/musicxml/", views.score_musicxml, name="musicxml"),
]
