from pathlib import Path
from tempfile import TemporaryDirectory
from django.test import TestCase
from django.urls import reverse
from .models import Score


class ScorePDFTests(TestCase):
    def setUp(self):
        self.folder = TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.override = self.settings(SCORE_PDF_DIR=self.folder.name)
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.score = Score.objects.create(title='PDF song', original_filename='someoneLikeYou.musicxml', xml_content='<score-partwise/>')
        self.pdf = Path(self.folder.name) / 'someoneLikeYou.pdf'
        self.url = reverse('scores:pdf', args=[self.score.pk])

    def test_only_existing_pdf_is_linked_on_both_home_pages(self):
        for home in ['/', '/m']:
            self.assertNotContains(self.client.get(home), self.url)
        self.pdf.write_bytes(b'%PDF-1.4\nexample')
        for home in ['/', '/m']:
            self.assertContains(self.client.get(home), self.url)
        response = self.client.get(self.url)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('attachment; filename="someoneLikeYou.pdf"', response['Content-Disposition'])
        self.assertEqual(b''.join(response.streaming_content), self.pdf.read_bytes())
        self.pdf.unlink()
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(self.client.get(reverse('scores:pdf', args=[999])).status_code, 404)

    def test_filename_with_multiple_dots_and_unicode(self):
        self.score.original_filename = '봄날.v2.xml'
        pdf = Path(self.folder.name) / '봄날.v2.pdf'
        pdf.write_bytes(b'%PDF')
        self.assertEqual(self.score.pdf_path, pdf)

    def test_no_empty_name_or_symlink_escape(self):
        self.score.original_filename = ''
        self.assertIsNone(self.score.pdf_path)
        with TemporaryDirectory() as outside:
            external = Path(outside) / 'private.pdf'
            external.write_bytes(b'%PDF')
            self.pdf.symlink_to(external)
            self.score.original_filename = '../someoneLikeYou.musicxml'
            self.assertIsNone(self.score.pdf_path)
