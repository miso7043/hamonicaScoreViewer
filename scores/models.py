from django.db import models


class Score(models.Model):
    title = models.CharField("제목", max_length=200)
    composer = models.CharField("작곡가", max_length=200, blank=True)
    original_filename = models.CharField("원본 파일명", max_length=255, blank=True)
    xml_content = models.TextField("MusicXML 원문")
    created_at = models.DateTimeField("등록일", auto_now_add=True)
    updated_at = models.DateTimeField("수정일", auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "악보"
        verbose_name_plural = "악보"

    def __str__(self):
        return self.title
