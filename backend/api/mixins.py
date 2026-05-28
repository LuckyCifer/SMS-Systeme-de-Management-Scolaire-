"""
api/mixins.py — Isolation des données par établissement.

Utilisation :
    class MyViewSet(EtablissementFilterMixin, SMSBaseViewSet):
        ...

Le mixin :
  - lit l'en-tête HTTP X-Etablissement-Id (envoyé par le frontend)
  - si absent, utilise le premier établissement actif comme fallback
  - filtre get_queryset() si le modèle possède un champ 'etablissement'
  - injecte etablissement_id à la création
  - est silencieux si aucun établissement n'est trouvé (pas d'erreur 500)
"""
import logging
from .utils import log_action

logger = logging.getLogger(__name__)


def _has_etab_field(model):
    return any(f.name == 'etablissement' for f in model._meta.get_fields())


class EtablissementFilterMixin:

    def get_etablissement_id(self):
        etab_id = self.request.META.get('HTTP_X_ETABLISSEMENT_ID', '').strip()
        if etab_id:
            return etab_id
        try:
            from .models import Etablissement
            etab = Etablissement.objects.filter(actif=True).first()
            return etab.code_etab if etab else None
        except Exception:
            return None

    def get_queryset(self):
        qs = super().get_queryset()
        etab_id = self.get_etablissement_id()
        if not etab_id:
            return qs
        if _has_etab_field(qs.model):
            return qs.filter(etablissement_id=etab_id)
        return qs

    def perform_create(self, serializer):
        etab_id = self.get_etablissement_id()
        extra = {}
        if etab_id and _has_etab_field(serializer.Meta.model):
            extra['etablissement_id'] = etab_id
        instance = serializer.save(**extra)
        log_action(
            self.request, 'CREATE',
            self.__class__.__name__.replace('ViewSet', ''),
            getattr(instance, instance._meta.pk.name, ''),
        )
