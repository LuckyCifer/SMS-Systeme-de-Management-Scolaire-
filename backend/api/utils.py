"""
api/utils.py — Fonctions utilitaires partagées entre views.py et mixins.py
"""
import logging
logger = logging.getLogger(__name__)


def get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    return xff.split(',')[0] if xff else request.META.get('REMOTE_ADDR', '0.0.0.0')


def log_action(request, action, model_name, object_id='', detail=''):
    from .models import AuditLog
    try:
        user_login = request.user.username if request.user and request.user.is_authenticated else ''
        AuditLog.objects.create(
            utilisateur=user_login, action=action, modele=model_name,
            objet_id=str(object_id)[:100], detail=str(detail)[:500],
            ip_address=get_client_ip(request),
        )
    except Exception as exc:
        logger.error('log_action failed: %s', exc)
