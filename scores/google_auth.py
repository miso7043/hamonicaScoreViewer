import secrets

from authlib.integrations.django_client import OAuth
from authlib.integrations.base_client.errors import OAuthError
from django.conf import settings
from django.http import HttpResponseForbidden
from django.shortcuts import redirect
from django.urls import reverse
from django.views.decorators.cache import never_cache


def google_client():
    oauth = OAuth()
    oauth.register(
        name="google", client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile", "timeout": 15},
    )
    return oauth.create_client("google")


@never_cache
def login(request):
    if not settings.GOOGLE_AUTH_ENABLED:
        return redirect("scores:list")
    return google_client().authorize_redirect(
        request, settings.GOOGLE_REDIRECT_URI,
        state="hmp_" + secrets.token_urlsafe(32), prompt="select_account",
    )


@never_cache
def callback(request):
    try:
        token = google_client().authorize_access_token(request)
        user = token.get("userinfo") or {}
    except (OAuthError, ValueError):
        return HttpResponseForbidden("구글 인증에 실패했습니다. 다시 로그인해 주세요.")
    if not user.get("email_verified") or not secrets.compare_digest(
        str(user.get("sub", "")), settings.ALLOWED_GOOGLE_ID
    ) or not settings.ALLOWED_GOOGLE_ID:
        request.session.flush()
        return HttpResponseForbidden("허용된 구글 계정으로 로그인해 주세요.")
    target = request.session.pop("score_return_to", reverse("scores:mobile-list"))
    request.session.cycle_key()
    request.session["score_google_id"] = settings.ALLOWED_GOOGLE_ID
    request.session.set_expiry(8 * 60 * 60)
    return redirect(target)


class GoogleLoginRequiredMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        public = ("/auth/google/", "/auth/google/callback")
        if settings.GOOGLE_AUTH_ENABLED and request.path_info not in public:
            identity = request.session.get("score_google_id", "")
            if not identity or not secrets.compare_digest(identity, settings.ALLOWED_GOOGLE_ID):
                # Store only a same-site path, never a user-supplied return URL.
                request.session["score_return_to"] = request.path
                return redirect("google-login")
        response = self.get_response(request)
        if settings.GOOGLE_AUTH_ENABLED:
            response["Cache-Control"] = "no-store"
        return response
