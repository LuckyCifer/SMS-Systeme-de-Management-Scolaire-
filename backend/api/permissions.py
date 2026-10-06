"""
api/permissions.py — Permissions basées sur le rôle utilisateur.

Miroir côté serveur de `ROLE_PERMISSIONS` dans frontend/src/utils/roles.js : avant ce
fichier, le tableau de bord frontend masquait bien les boutons créer/modifier/supprimer
selon le rôle, mais l'API elle-même n'exigeait qu'IsAuthenticated (voir SMSBaseViewSet)
— n'importe quel compte authentifié, y compris ETUDIANT, pouvait appeler l'API
directement (hors navigateur) pour créer/modifier/supprimer n'importe quelle ressource.
Le frontend ne sert plus qu'à l'ergonomie ; la sécurité vit ici. Garder les deux
synchronisés si le périmètre d'un rôle change.

La lecture (GET/HEAD/OPTIONS) reste ouverte à tout utilisateur authentifié — l'isolation
multi-établissement est gérée séparément par EtablissementFilterMixin, et les ressources
particulièrement sensibles (comptes utilisateurs, salaires...) ont leurs propres
restrictions de lecture au cas par cas sur leur ViewSet.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS
from .mixins import get_utilisateur_profile

# canCreate / canEdit / canDelete par rôle — voir frontend/src/utils/roles.js.
ROLE_WRITE_PERMISSIONS = {
    'SUPER_ADMIN':         {'create': True,  'edit': True,  'delete': True},
    'ADMIN':               {'create': True,  'edit': True,  'delete': True},
    'SCOLARITE':           {'create': True,  'edit': True,  'delete': True},
    'ENSEIGNANT':          {'create': True,  'edit': True,  'delete': False},
    'COMPTABLE':           {'create': True,  'edit': True,  'delete': False},
    'ETUDIANT':            {'create': False, 'edit': False, 'delete': False},
    'DIRECTION':           {'create': False, 'edit': False, 'delete': False},
    'CENSEUR':             {'create': True,  'edit': True,  'delete': False},
    'SURVEILLANT_GENERAL': {'create': True,  'edit': True,  'delete': False},
    'APEE':                {'create': False, 'edit': False, 'delete': False},
}

# Actions DRF standard → clé de permission ci-dessus. Toute action d'écriture
# personnalisée (ex: @action POST 'generate', 'valider', 'generer-convocations'…) et non
# listée ici retombe sur 'create' — canCreate == canEdit pour tous les rôles de ce
# système, donc ce choix par défaut ne change rien à la matrice réelle.
ACTION_PERMISSION_KEY = {
    'create':         'create',
    'update':         'edit',
    'partial_update': 'edit',
    'destroy':        'delete',
    'bulk_delete':    'delete',
}
DEFAULT_WRITE_ACTION_KEY = 'create'


class RoleBasedPermission(BasePermission):
    """
    Permission par défaut de SMSBaseViewSet. Un ViewSet qui a besoin d'une règle plus
    stricte (ex: EtablissementViewSet, UtilisateurViewSet — réservés à ADMIN/SUPER_ADMIN
    en écriture) garde son propre get_permissions() ; celui-ci ne s'applique que là où
    rien de plus spécifique n'est défini.
    """
    message = "Votre rôle ne vous autorise pas à effectuer cette action."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        profile = get_utilisateur_profile(request)
        if not profile:
            return False
        perms = ROLE_WRITE_PERMISSIONS.get(profile.role)
        if not perms:
            return False
        key = ACTION_PERMISSION_KEY.get(getattr(view, 'action', None), DEFAULT_WRITE_ACTION_KEY)
        return perms[key]
