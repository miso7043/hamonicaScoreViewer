from django.contrib import admin
from .models import Score


@admin.register(Score)
class ScoreAdmin(admin.ModelAdmin):
    list_display = ("title", "composer", "original_filename", "updated_at")
    search_fields = ("title", "composer", "original_filename")
    readonly_fields = ("created_at", "updated_at")
