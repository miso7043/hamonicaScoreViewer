from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from .forms import ScoreEditForm, ScoreUploadForm
from .models import Score

XML = '''<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>옛 제목</work-title></work><identification><creator type="composer">작곡가</creator></identification><part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list><part id="P1"><measure number="1"><note><rest/><duration>1</duration></note></measure></part></score-partwise>'''

class ScoreFlowTests(TestCase):
    def test_upload_extracts_metadata_and_saves_xml(self):
        response=self.client.post(reverse("scores:list"),{"musicxml_file":SimpleUploadedFile("song.musicxml",XML.encode())}); score=Score.objects.get()
        self.assertRedirects(response,reverse("scores:detail",args=[score.pk])); self.assertEqual((score.title,score.composer),("옛 제목","작곡가")); self.assertEqual(score.xml_content,XML)
    def test_rejects_non_music_xml(self):
        form=ScoreUploadForm(files={"musicxml_file":SimpleUploadedFile("data.xml",b"<catalog/>")}); self.assertFalse(form.is_valid()); self.assertIn("MusicXML",str(form.errors))
    def test_title_edit_updates_work_title(self):
        score=Score.objects.create(title="옛 제목",xml_content=XML); form=ScoreEditForm({"title":"새 & 제목","composer":"작곡가","xml_content":XML},instance=score)
        self.assertTrue(form.is_valid(),form.errors); self.assertIn("<work-title>새 &amp; 제목</work-title>",form.save().xml_content)
    def test_work_title_edited_in_xml_updates_database_title(self):
        score=Score.objects.create(title="옛 제목",xml_content=XML); changed=XML.replace("옛 제목","XML에서 바꾼 제목")
        form=ScoreEditForm({"title":"옛 제목","composer":"작곡가","xml_content":changed},instance=score)
        self.assertTrue(form.is_valid(),form.errors); updated=form.save()
        self.assertEqual(updated.title,"XML에서 바꾼 제목"); self.assertIn("<work-title>XML에서 바꾼 제목</work-title>",updated.xml_content)
    def test_invalid_xml_edit_is_rejected(self):
        score=Score.objects.create(title="제목",xml_content=XML); form=ScoreEditForm({"title":"제목","composer":"","xml_content":"<score-partwise>"},instance=score); self.assertFalse(form.is_valid())
    def test_musicxml_endpoint_and_missing_score(self):
        score=Score.objects.create(title="제목",xml_content=XML); self.assertContains(self.client.get(reverse("scores:musicxml",args=[score.pk])),"옛 제목"); self.assertEqual(self.client.get(reverse("scores:detail",args=[999])).status_code,404)
    def test_delete_requires_confirmation_post(self):
        score=Score.objects.create(title="삭제할 악보",xml_content=XML); url=reverse("scores:delete",args=[score.pk])
        self.assertContains(self.client.get(url),"삭제할 악보"); self.assertTrue(Score.objects.filter(pk=score.pk).exists())
        response=self.client.post(url); self.assertRedirects(response,reverse("scores:list")); self.assertFalse(Score.objects.filter(pk=score.pk).exists())

    def test_mobile_dashboard_links_to_mobile_score(self):
        score = Score.objects.create(title="모바일 악보", xml_content=XML)
        for url in ("/m", "/m/"):
            response = self.client.get(url)
            self.assertContains(response, reverse("scores:mobile-detail", args=[score.pk]))
            self.assertContains(response, 'class="mobile-layout"')

    def test_mobile_detail_uses_two_measures_and_mobile_back_link(self):
        score = Score.objects.create(title="모바일 악보", xml_content=XML)
        response = self.client.get(reverse("scores:mobile-detail", args=[score.pk]))
        self.assertContains(response, 'data-measures-per-system="2"')
        self.assertContains(response, 'href="/m"')
        self.assertContains(response, reverse("scores:musicxml", args=[score.pk]))
        desktop = self.client.get(reverse("scores:detail", args=[score.pk]))
        self.assertContains(desktop, 'data-measures-per-system="4"')
        self.assertEqual(self.client.get("/m/scores/999/").status_code, 404)

    def test_mobile_upload_redirects_to_mobile_detail(self):
        response = self.client.post("/m", {"musicxml_file": SimpleUploadedFile("song.musicxml", XML.encode())})
        score = Score.objects.get()
        self.assertRedirects(response, reverse("scores:mobile-detail", args=[score.pk]))


from unittest.mock import patch
from django.test import override_settings


@override_settings(GOOGLE_AUTH_ENABLED=True, ALLOWED_GOOGLE_ID="allowed-user")
class GoogleAuthenticationTests(TestCase):
    def test_private_routes_require_google_login(self):
        score = Score.objects.create(title="비공개 악보", xml_content=XML)
        for url in ("/", "/m", reverse("scores:musicxml", args=[score.pk]), "/admin/"):
            response = self.client.get(url)
            self.assertEqual(response.status_code, 302)
            self.assertEqual(response.url, reverse("google-login"))

    @patch("scores.google_auth.google_client")
    def test_allowed_google_account_can_open_mobile_dashboard(self, client):
        client.return_value.authorize_access_token.return_value = {
            "userinfo": {"sub": "allowed-user", "email_verified": True}}
        response = self.client.get(reverse("google-callback"))
        self.assertRedirects(response, reverse("scores:mobile-list"))
        self.assertEqual(self.client.session["score_google_id"], "allowed-user")

    @patch("scores.google_auth.google_client")
    def test_other_accounts_and_unverified_email_are_rejected(self, client):
        for identity in ({"sub": "other", "email_verified": True},
                         {"sub": "allowed-user", "email_verified": False}):
            client.return_value.authorize_access_token.return_value = {"userinfo": identity}
            self.assertEqual(self.client.get(reverse("google-callback")).status_code, 403)
            self.assertNotIn("score_google_id", self.client.session)

    @patch("scores.google_auth.google_client")
    def test_invalid_oauth_state_does_not_authenticate(self, client):
        from authlib.integrations.base_client.errors import MismatchingStateError
        client.return_value.authorize_access_token.side_effect = MismatchingStateError()
        self.assertEqual(self.client.get(reverse("google-callback")).status_code, 403)
        self.assertNotIn("score_google_id", self.client.session)
