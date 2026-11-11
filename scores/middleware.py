from django.utils import translation
from django.utils.cache import patch_vary_headers
from django.utils.translation.trans_real import parse_accept_lang_header


class BrowserLanguageMiddleware:
    """Use Korean only when the browser's preferred language is Korean."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        preferences = parse_accept_lang_header(request.headers.get("Accept-Language", ""))
        preferred = next((code for code, quality in preferences if quality > 0), "en")
        language = "ko" if preferred.split("-")[0] == "ko" else "en"
        request.LANGUAGE_CODE = language
        with translation.override(language):
            response = self.get_response(request)
        response.headers.setdefault("Content-Language", language)
        patch_vary_headers(response, ("Accept-Language",))
        return response
