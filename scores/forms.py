from .i18n import tr
from pathlib import Path
from django import forms

from .models import Score
from .musicxml import MusicXMLError, decode_xml, metadata, update_work_title

MAX_XML_SIZE = 10 * 1024 * 1024


class ScoreUploadForm(forms.Form):
    musicxml_file = forms.FileField(label="MusicXML")

    def clean_musicxml_file(self):
        uploaded = self.cleaned_data["musicxml_file"]
        if Path(uploaded.name).suffix.lower() not in {".xml", ".musicxml"}:
            raise forms.ValidationError(tr(".xml 또는 .musicxml 파일을 선택해 주세요."))
        if uploaded.size > MAX_XML_SIZE:
            raise forms.ValidationError(tr("파일 크기는 10MB 이하여야 합니다."))
        try:
            xml_content = decode_xml(uploaded.read())
            title, composer = metadata(xml_content)
        except MusicXMLError as exc:
            raise forms.ValidationError(str(exc)) from exc
        uploaded.xml_content = xml_content
        uploaded.score_title = title or Path(uploaded.name).stem
        uploaded.composer = composer
        return uploaded

    def save(self):
        uploaded = self.cleaned_data["musicxml_file"]
        return Score.objects.create(title=uploaded.score_title, composer=uploaded.composer,
                                    original_filename=uploaded.name, xml_content=uploaded.xml_content)


class ScoreEditForm(forms.ModelForm):
    class Meta:
        model = Score
        fields = ["title", "composer", "xml_content"]
        widgets = {"xml_content": forms.Textarea(attrs={"rows": 28, "spellcheck": "false"})}
        labels = {"xml_content": "MusicXML"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["title"].label = tr("제목")
        self.fields["composer"].label = tr("작곡가")
        self._original_title = self.instance.title if self.instance.pk else ""
        try:
            self._original_xml_title = metadata(self.instance.xml_content)[0] if self.instance.pk else ""
        except MusicXMLError:
            self._original_xml_title = ""

    def clean(self):
        cleaned = super().clean()
        xml_content, title = cleaned.get("xml_content"), cleaned.get("title")
        if xml_content and title:
            try:
                xml_title, _ = metadata(xml_content)
                title = title.strip()
                title_was_edited = title != self._original_title
                xml_title_was_edited = bool(xml_title) and xml_title != self._original_xml_title
                if xml_title_was_edited and not title_was_edited:
                    # A user editing <work-title> in the source expects that value to be retained.
                    cleaned["title"] = xml_title
                else:
                    # If both fields changed, the explicit title field is the source of truth.
                    cleaned["xml_content"] = update_work_title(xml_content, title)
            except MusicXMLError as exc:
                self.add_error("xml_content", str(exc))
        return cleaned
