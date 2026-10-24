from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [migrations.CreateModel(
        name="Score",
        fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("title", models.CharField(max_length=200, verbose_name="제목")),
            ("composer", models.CharField(blank=True, max_length=200, verbose_name="작곡가")),
            ("original_filename", models.CharField(blank=True, max_length=255, verbose_name="원본 파일명")),
            ("xml_content", models.TextField(verbose_name="MusicXML 원문")),
            ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="등록일")),
            ("updated_at", models.DateTimeField(auto_now=True, verbose_name="수정일")),
        ],
        options={"verbose_name": "악보", "verbose_name_plural": "악보", "ordering": ["-updated_at"]},
    )]
