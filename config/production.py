from .settings import *

DEBUG = False
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
ALLOWED_HOSTS = [host.strip() for host in os.environ.get(
    "DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1"
).split(",") if host.strip()]
FORCE_SCRIPT_NAME = "/harmonica"
STATIC_URL = "/harmonica/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DATABASES["default"]["NAME"] = os.environ.get("DJANGO_DATABASE_PATH", "/var/lib/hamonica-player/db.sqlite3")
GOOGLE_AUTH_ENABLED = True
GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
GOOGLE_CLIENT_SECRET = os.environ["GOOGLE_CLIENT_SECRET"]
ALLOWED_GOOGLE_ID = os.environ["ALLOWED_GOOGLE_ID"]
GOOGLE_REDIRECT_URI = os.environ["GOOGLE_REDIRECT_URI"]
SESSION_COOKIE_NAME = "hamonica_session"
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_NAME = "hamonica_csrf"
CSRF_COOKIE_PATH = "/harmonica/"
CSRF_COOKIE_SECURE = True
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in os.environ.get(
    "DJANGO_CSRF_TRUSTED_ORIGINS", ""
).split(",") if origin.strip()]
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_AGE = 8 * 60 * 60
