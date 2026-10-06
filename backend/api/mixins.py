"""
api/mixins.py — Isolation des données par établissement.

Utilisation :
    class MyViewSet(EtablissementFilterMixin, SMSBaseViewSet):
        ...

Le contexte établissement/type d'établissement est déterminé par `trusted_etablissement_header()`
et `trusted_type_etab_header()` :
  - SUPER_ADMIN : peut naviguer librement — les en-têtes HTTP X-Etablissement-Id / X-Type-Etab
    envoyés par le frontend (sélecteur d'interface) sont honorés tels quels.
  - Tout autre rôle : ces en-têtes sont IGNORÉS. Le contexte est toujours dérivé de
    l'établissement assigné à l'utilisateur en base (Utilisateur.etablissement). Un en-tête
    client n'est jamais une source d'autorisation — sinon n'importe quel utilisateur authentifié
    pourrait se faire passer pour un autre établissement en changeant un simple header (IDOR).

Le mixin :
  - filtre get_queryset() si le modèle possède un champ 'etablissement'
  - injecte etablissement_id à la création
  - refuse par défaut (queryset vide) si l'établissement ne peut pas être déterminé pour un
    utilisateur non SUPER_ADMIN, plutôt que de retomber silencieusement sur "tous les
    établissements" ou "le premier établissement actif"

En complément, `scope_queryset_to_enseignant()` / `scope_queryset_to_enseignant_cours()`
restreignent un compte ENSEIGNANT à ses propres matières/classes (via Cours), pour les
viewsets où voir/modifier les données de toute l'école n'a pas de sens (Examen, Evaluation,
FicheNotes, Cours). Voir get_enseignant_profile() pour le lien Enseignant ↔ Utilisateur.
"""
import logging
from .utils import log_action

logger = logging.getLogger(__name__)


def _has_etab_field(model):
    return any(f.name == 'etablissement' for f in model._meta.get_fields())


def get_utilisateur_profile(request):
    """
    Profil métier (Utilisateur : rôle, établissement assigné) lié au request.user Django
    actuellement authentifié. Mis en cache sur la requête pour éviter les requêtes SQL répétées.
    """
    if not getattr(request, 'user', None) or not request.user.is_authenticated:
        return None
    if not hasattr(request, '_sms_utilisateur_profile'):
        from .models import Utilisateur
        try:
            request._sms_utilisateur_profile = Utilisateur.objects.select_related(
                'etablissement', 'type_etab'
            ).get(login=request.user.username)
        except Utilisateur.DoesNotExist:
            request._sms_utilisateur_profile = None
    return request._sms_utilisateur_profile


def is_super_admin(request):
    profile = get_utilisateur_profile(request)
    return bool(profile and profile.role == 'SUPER_ADMIN')


def trusted_etablissement_header(request):
    """
    Valeur fiable pour le contexte "établissement courant" de la requête.
    SUPER_ADMIN → contenu réel de l'en-tête X-Etablissement-Id (switch d'interface).
    Autre rôle  → toujours son propre établissement assigné en base ; l'en-tête est ignoré.
    Retourne une chaîne vide si indéterminable (comportement identique à un header absent).
    """
    profile = get_utilisateur_profile(request)
    if profile and profile.role == 'SUPER_ADMIN':
        return request.META.get('HTTP_X_ETABLISSEMENT_ID', '').strip()
    if profile and profile.etablissement_id:
        return str(profile.etablissement_id)
    return ''


def trusted_type_etab_header(request):
    """
    Valeur fiable pour le contexte "type d'établissement" (sélecteur SUPER_ADMIN uniquement).
    Pour tout autre rôle, retourne toujours '' : le contexte doit être dérivé de son propre
    établissement (via trusted_etablissement_header), jamais d'un en-tête client.
    """
    if is_super_admin(request):
        return request.META.get('HTTP_X_TYPE_ETAB', '').strip()
    return ''


def is_enseignant(request):
    profile = get_utilisateur_profile(request)
    return bool(profile and profile.role == 'ENSEIGNANT')


def get_enseignant_profile(request):
    """
    Fiche Enseignant liée au compte connecté (Enseignant.utilisateur), pour un compte de
    rôle ENSEIGNANT uniquement. None si le rôle n'est pas ENSEIGNANT ou si aucune fiche
    Enseignant n'est associée à ce compte (ex : compte créé sans lien — accès refusé par
    défaut plutôt que de laisser passer, voir scope_queryset_to_enseignant*).
    """
    if not is_enseignant(request):
        return None
    if not hasattr(request, '_sms_enseignant_profile'):
        profile = get_utilisateur_profile(request)
        try:
            request._sms_enseignant_profile = profile.enseignant
        except Exception:
            request._sms_enseignant_profile = None
    return request._sms_enseignant_profile


def scope_queryset_to_enseignant(request, qs, field='mle_ens'):
    """
    Restreint qs aux lignes dont `field` correspond à l'enseignant connecté. No-op pour tout
    rôle autre qu'ENSEIGNANT (ADMIN/SCOLARITE/SUPER_ADMIN gardent une vue complète). À utiliser
    sur les modèles ayant une FK directe vers Enseignant (ex : Cours.mle_ens, FicheNotes.mle_ens).
    """
    if not is_enseignant(request):
        return qs
    enseignant = get_enseignant_profile(request)
    if not enseignant:
        # Compte ENSEIGNANT sans fiche associée : refus par défaut, jamais une fuite.
        return qs.none()
    return qs.filter(**{field: enseignant})


def scope_queryset_to_enseignant_cours(request, qs, matiere_field='code_matiere', classe_field='code_classe'):
    """
    Restreint qs aux lignes dont (matière, classe) correspond à un Cours effectivement
    enseigné par l'enseignant connecté. No-op pour tout rôle autre qu'ENSEIGNANT. À utiliser
    sur les modèles sans FK directe vers Enseignant (ex : Examen, Evaluation) — le lien passe
    par Cours (matière + classe + enseignant).
    """
    if not is_enseignant(request):
        return qs
    enseignant = get_enseignant_profile(request)
    if not enseignant:
        return qs.none()
    from django.db.models import Q
    from .models import Cours
    paires = Cours.objects.filter(mle_ens=enseignant).values_list('code_matiere_id', 'code_classe_id')
    if not paires:
        return qs.none()
    q = Q()
    for mat, cls in paires:
        q |= Q(**{matiere_field: mat, classe_field: cls})
    return qs.filter(q)


def assert_enseignant_teaches(request, code_matiere, code_classe):
    """
    Lève PermissionDenied si le compte ENSEIGNANT connecté n'enseigne pas cette matière dans
    cette classe (dérivé de Cours). No-op pour tout autre rôle. À appeler dans perform_create
    (et perform_update si la matière/classe peut être modifiée) des viewsets Examen/Evaluation,
    pour empêcher en écriture ce que scope_queryset_to_enseignant_cours empêche en lecture.
    """
    if not is_enseignant(request):
        return
    from rest_framework.exceptions import PermissionDenied
    from .models import Cours
    enseignant = get_enseignant_profile(request)
    if not enseignant or not Cours.objects.filter(
        mle_ens=enseignant, code_matiere_id=code_matiere, code_classe_id=code_classe,
    ).exists():
        raise PermissionDenied("Vous n'enseignez pas cette matière dans cette classe.")


class EtablissementFilterMixin:

    def get_type_etab_id(self):
        return trusted_type_etab_header(self.request) or None

    def get_etablissement_id(self):
        etab_id = trusted_etablissement_header(self.request)
        if etab_id:
            return etab_id
        if is_super_admin(self.request):
            try:
                from .models import Etablissement
                etab = Etablissement.objects.filter(actif=True).first()
                return etab.code_etab if etab else None
            except Exception:
                return None
        return None

    def get_queryset(self):
        qs = super().get_queryset()
        if not _has_etab_field(qs.model):
            return qs

        super_admin = is_super_admin(self.request)

        # SUPER_ADMIN avec un type sélectionné → filtre par tous les étabs de ce type
        type_etab_id = self.get_type_etab_id()
        if super_admin and type_etab_id:
            try:
                from .models import Etablissement
                etab_ids = list(
                    Etablissement.objects.filter(type_etab=type_etab_id)
                    .values_list('code_etab', flat=True)
                )
                return qs.filter(etablissement_id__in=etab_ids) if etab_ids else qs.none()
            except Exception:
                pass

        etab_id = self.get_etablissement_id()
        if not etab_id:
            # SUPER_ADMIN sans sélection → vue globale (comportement historique voulu).
            # Tout autre rôle sans établissement résolu → refus par défaut, jamais une fuite.
            return qs if super_admin else qs.none()
        return qs.filter(etablissement_id=etab_id)

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
