"""LAN deployment: public playback, staff-only score management."""
from .settings import *

DEBUG = False
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
ALLOWED_HOSTS = [host.strip() for host in os.environ.get(
    "DJANGO_ALLOWED_HOSTS", "192.168.76.1,121.186.117.114,rp-yoon.duckdns.org,localhost,127.0.0.1"
).split(",") if host.strip()]
DATABASES["default"]["NAME"] = os.environ["DJANGO_DATABASE_PATH"]
FORCE_SCRIPT_NAME = "/hamonica"
STATIC_URL = "/hamonica/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
GOOGLE_AUTH_ENABLED = False
PUBLIC_SCORE_VIEW = True
SESSION_COOKIE_NAME = "hamonica_session"
SESSION_COOKIE_PATH = "/hamonica/"
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_NAME = "hamonica_csrf"
CSRF_COOKIE_PATH = "/hamonica/"
CSRF_COOKIE_SECURE = True
CSRF_TRUSTED_ORIGINS = ["https://192.168.76.1", "https://121.186.117.114", "https://yoon-pi5.local", "https://rp-yoon.duckdns.org"]
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 8 * 60 * 60
SECURE_CONTENT_TYPE_NOSNIFF = True
