"""
api/mixins.py — Isolation des données par établissement.

Utilisation :
    class MyViewSet(EtablissementFilterMixin, SMSBaseViewSet):
        ...

Règle : chaque requête porte sur UNE SEULE école, « l'établissement courant »
(`trusted_etablissement_header()`), et toutes les données affichées en dépendent — y compris
le type (primaire / secondaire / supérieur), qui se déduit toujours de cette école :
  - SUPER_ADMIN : l'école choisie dans le sélecteur d'interface (en-tête X-Etablissement-Id),
    ou à défaut la première école active. Il passe d'une école à l'autre, jamais plusieurs
    à la fois.
  - Tout autre rôle : l'école assignée au compte en base (Utilisateur.etablissement) ; l'en-tête
    est IGNORÉ. Un en-tête client n'est jamais une source d'autorisation (IDOR).

EtablissementFilterMixin (modèles avec un champ 'etablissement') :
  - filtre get_queryset() sur l'école courante, refus par défaut si elle est indéterminée ;
  - impose l'école courante à la création ET à la modification (une donnée ne peut pas être
    « déplacée » vers une autre école en changeant son champ etablissement).

EtablissementParRelationMixin (modèles sans champ 'etablissement', rattachés à l'école par
une relation : absence → élève, détail de facture → facture…) : même filtrage via
`etablissement_lookups`, et refus d'écrire une donnée qui ne serait pas de l'école courante.

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
    École courante de la requête (code_etab), ou '' si indéterminable.
    SUPER_ADMIN → l'école de l'en-tête X-Etablissement-Id si elle existe, sinon la première
                  école active (il est toujours « connecté » à une école).
    Autre rôle  → toujours son propre établissement assigné en base ; l'en-tête est ignoré.
    """
    if hasattr(request, '_sms_etablissement_courant'):
        return request._sms_etablissement_courant
    from .models import Etablissement
    profile = get_utilisateur_profile(request)
    etab_id = ''
    if profile and profile.role == 'SUPER_ADMIN':
        demande = request.META.get('HTTP_X_ETABLISSEMENT_ID', '').strip()
        if demande and Etablissement.objects.filter(pk=demande).exists():
            etab_id = demande
        else:
            etab_id = (Etablissement.objects.filter(actif=True).order_by('code_etab')
                       .values_list('code_etab', flat=True).first() or '')
    elif profile and profile.etablissement_id:
        etab_id = str(profile.etablissement_id)
    request._sms_etablissement_courant = etab_id
    return etab_id


def type_etab_courant(request):
    """Type (PRIMAIRE / SECONDAIRE / SUPERIEUR) de l'école courante, ou None."""
    from .models import Etablissement
    etab_id = trusted_etablissement_header(request)
    if not etab_id:
        return None
    return Etablissement.objects.filter(pk=etab_id).values_list('type_etab', flat=True).first()


def is_etudiant(request):
    profile = get_utilisateur_profile(request)
    return bool(profile and profile.role == 'ETUDIANT')


def get_etudiant_profile(request):
    """
    Fiche Etudiant du compte ÉLÈVE connecté : le lien Etudiant.utilisateur, ou à défaut un
    élève de la même école dont le matricule est le login. None sinon (accès refusé par défaut).
    """
    if not is_etudiant(request):
        return None
    if not hasattr(request, '_sms_etudiant_profile'):
        from .models import Etudiant
        profile = get_utilisateur_profile(request)
        etudiant = Etudiant.objects.filter(utilisateur=profile).first() or Etudiant.objects.filter(
            pk=profile.login, etablissement_id=profile.etablissement_id).first()
        request._sms_etudiant_profile = etudiant
    return request._sms_etudiant_profile


def scope_queryset_to_etudiant(request, qs, lookup='mle_etudiant'):
    """
    Compte ÉLÈVE : ne garde que ses propres lignes (`lookup` = chemin vers l'élève).
    No-op pour tout autre rôle.
    """
    if not is_etudiant(request):
        return qs
    etudiant = get_etudiant_profile(request)
    return qs.filter(**{lookup: etudiant.pk}) if etudiant else qs.none()


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

    def get_etablissement_id(self):
        return trusted_etablissement_header(self.request) or None

    def get_queryset(self):
        qs = super().get_queryset()
        if not _has_etab_field(qs.model):
            return qs
        etab_id = self.get_etablissement_id()
        # Une seule école à la fois, y compris pour le SUPER_ADMIN ; refus par défaut si
        # l'école ne peut pas être déterminée, jamais une vue « toutes écoles ».
        return qs.filter(etablissement_id=etab_id) if etab_id else qs.none()

    def _save_dans_etablissement(self, serializer, action, detail=None):
        etab_id = self.get_etablissement_id()
        extra = {}
        if etab_id and _has_etab_field(serializer.Meta.model):
            extra['etablissement_id'] = etab_id
        instance = serializer.save(**extra)
        if detail != '':  # detail='' : l'appelant écrit sa propre trace
            log_action(
                self.request, action,
                self.__class__.__name__.replace('ViewSet', ''),
                getattr(instance, instance._meta.pk.name, ''), detail or '',
            )
        return instance

    def perform_create(self, serializer):
        self._save_dans_etablissement(serializer, 'CREATE')

    def perform_update(self, serializer):
        # Une modification ne peut pas changer l'école d'une donnée.
        self._save_dans_etablissement(serializer, 'UPDATE')


class EtablissementParRelationMixin:
    """
    Isolation des modèles sans champ 'etablissement' : `etablissement_lookups` liste les
    chemins vers l'école (ex. ['mle_etudiant__etablissement'] ; plusieurs chemins = l'un
    OU l'autre, ex. badge d'un élève ou d'un enseignant).
    """
    etablissement_lookups = ()

    def _q_etablissement(self, etab_id):
        from django.db.models import Q
        q = Q()
        for lookup in self.etablissement_lookups:
            q |= Q(**{lookup: etab_id})
        return q

    def get_queryset(self):
        qs = super().get_queryset()
        etab_id = trusted_etablissement_header(self.request)
        return qs.filter(self._q_etablissement(etab_id)).distinct() if etab_id else qs.none()

    def _save_verifie(self, serializer, action):
        from django.db import transaction
        from rest_framework.exceptions import PermissionDenied
        etab_id = trusted_etablissement_header(self.request)
        with transaction.atomic():
            instance = serializer.save()
            modele = type(instance)
            if not etab_id or not modele.objects.filter(
                    self._q_etablissement(etab_id), pk=instance.pk).exists():
                raise PermissionDenied("Cette donnée doit appartenir à votre établissement.")
        log_action(self.request, action, self.__class__.__name__.replace('ViewSet', ''),
                   getattr(instance, instance._meta.pk.name, ''))
        return instance

    def perform_create(self, serializer):
        self._save_verifie(serializer, 'CREATE')

    def perform_update(self, serializer):
        self._save_verifie(serializer, 'UPDATE')
