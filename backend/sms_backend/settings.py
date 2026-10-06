"""
settings.py — SMS Backend (Django)
Corrigé : INSTALLED_APPS/MIDDLEWARE unifiés, CORS, JWT, DRF
"""
from pathlib import Path
from datetime import timedelta
import os
from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

# DEBUG par défaut à False : un déploiement où la variable d'environnement DEBUG
# n'a pas été positionnée doit démarrer en mode sécurisé, pas en mode debug.
DEBUG = os.environ.get('DEBUG', 'False') == 'True'

_INSECURE_DEV_SECRET_KEY = 'django-insecure-lh8=j&o3=r0s(8lp)g+y*s%i0e*3jkt_m2e!p=#94s0lxf#g8p'
SECRET_KEY = os.environ.get('SECRET_KEY', '')
if not SECRET_KEY:
    if DEBUG:
        # Valeur de secours uniquement en développement local, jamais en production.
        SECRET_KEY = _INSECURE_DEV_SECRET_KEY
    else:
        raise ImproperlyConfigured(
            "SECRET_KEY doit être défini dans l'environnement (.env) quand DEBUG=False. "
            "Générez-en un avec : python -c \"from django.core.management.utils import "
            "get_random_secret_key; print(get_random_secret_key())\""
        )

_raw_hosts = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1')
ALLOWED_HOSTS = [h.strip() for h in _raw_hosts.split(',') if h.strip()]
if DEBUG:
    ALLOWED_HOSTS = ['*']

# ── Applications ──────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Tiers
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'django_filters',
    'corsheaders',
    'drf_spectacular',
    # Application SMS
    'api',
]

# ── Middleware ────────────────────────────────────────────────────────────────
# CorsMiddleware DOIT être en premier
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'sms_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'sms_backend.wsgi.application'

# ── Base de données MySQL ─────────────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE':   'django.db.backends.mysql',
        'NAME':     os.environ.get('DB_NAME',     'sms'),
        'USER':     os.environ.get('DB_USER',     'root'),
        'PASSWORD': os.environ.get('DB_PASSWORD', ''),
        'HOST':     os.environ.get('DB_HOST',     '127.0.0.1'),
        'PORT':     os.environ.get('DB_PORT',     '3306'),
        'OPTIONS':  {
            'charset': 'utf8mb4',
            # Force la même collation que les tables existantes (évite les erreurs FK MySQL 8)
            'init_command': "SET collation_connection = 'utf8mb4_unicode_ci'",
        },
        'TEST': {
            'CHARSET':    'utf8mb4',
            'COLLATION':  'utf8mb4_unicode_ci',
        },
    }
}

# ── Validation des mots de passe ──────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ── Internationalisation ──────────────────────────────────────────────────────
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE     = 'Africa/Douala'
USE_I18N      = True
USE_TZ        = False   # MySQL sur Windows n'a pas les tables de timezone — USE_TZ=False évite les erreurs

STATIC_URL  = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'  # cible de `manage.py collectstatic` en production

MEDIA_URL  = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        # Compression + hash dans le nom de fichier (cache long terme) en production.
        # En DEBUG, whitenoise sert directement les fichiers sans exiger collectstatic.
        'BACKEND': (
            'whitenoise.storage.CompressedManifestStaticFilesStorage'
            if not DEBUG else
            'django.contrib.staticfiles.storage.StaticFilesStorage'
        ),
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── Django REST Framework ─────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'api.pagination.SmsPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# ── Documentation API (drf-spectacular) ───────────────────────────────────────
# Schéma OpenAPI généré automatiquement à partir des ViewSets/serializers.
# UI interactive : /api/docs/ (Swagger) et /api/redoc/ (Redoc) — voir sms_backend/urls.py.
SPECTACULAR_SETTINGS = {
    'TITLE':       'SMS — API',
    'DESCRIPTION': "API REST du Système de Management Scolaire (établissements, élèves/étudiants, "
                    "scolarité, évaluations, finances, examens, rapports statistiques…).",
    'VERSION':     '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SCHEMA_PATH_PREFIX': r'/api/',
}

# ── JWT ───────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(hours=24),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': False,
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES':      ('Bearer',),
    'USER_ID_FIELD':          'id',
    'USER_ID_CLAIM':          'user_id',
}

# ── CORS ─────────────────────────────────────────────────────────────────────
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    # Domaine(s) du frontend en production — à définir dans .env, ex :
    # CORS_ALLOWED_ORIGINS=https://sms.example.cm,https://www.sms.example.cm
    _raw_cors_origins = os.environ.get(
        'CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173'
    )
    CORS_ALLOWED_ORIGINS = [o.strip() for o in _raw_cors_origins.split(',') if o.strip()]
CORS_ALLOW_CREDENTIALS = True

# ── Sécurité production ───────────────────────────────────────────────────────
# N'a de sens que derrière HTTPS ; désactivé en dev (DEBUG=True) pour ne pas
# casser le serveur de développement en HTTP simple.
if not DEBUG:
    SECURE_SSL_REDIRECT           = os.environ.get('SECURE_SSL_REDIRECT', 'True') == 'True'
    SESSION_COOKIE_SECURE         = True
    CSRF_COOKIE_SECURE            = True
    SECURE_CONTENT_TYPE_NOSNIFF   = True
    SECURE_HSTS_SECONDS           = int(os.environ.get('SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD           = True
    # À activer uniquement si l'app tourne derrière un reverse-proxy (nginx, etc.)
    # qui positionne fidèlement cet en-tête — sinon un client pourrait le forger.
    if os.environ.get('BEHIND_HTTPS_PROXY', 'False') == 'True':
        SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
# ── Email ─────────────────────────────────────────────────────────────────────
# En développement : EMAIL_BACKEND = console (affiche dans le terminal)
# En production : EMAIL_BACKEND = smtp + configurer HOST/USER/PASSWORD dans .env
EMAIL_BACKEND       = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST          = os.environ.get('EMAIL_HOST',     'smtp.gmail.com')
EMAIL_PORT          = int(os.environ.get('EMAIL_PORT',  '587'))
EMAIL_USE_TLS       = os.environ.get('EMAIL_USE_TLS',  'True') == 'True'
EMAIL_HOST_USER     = os.environ.get('EMAIL_HOST_USER',     '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL  = os.environ.get('DEFAULT_FROM_EMAIL',  'noreply@sms-ecole.cm')

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-etablissement-id',
    'x-type-etab',
]
