"""
Tests des permissions par rôle : vérifie que les actions d'écriture sensibles restent
réservées à ADMIN/SUPER_ADMIN, y compris pour EtablissementViewSet.current dont
l'absence de contrôle de rôle avait été repérée lors de l'audit sécurité.

RoleBasedPermissionTest ci-dessous verrouille le correctif plus large : avant
RoleBasedPermission (api/permissions.py), SMSBaseViewSet n'exigeait qu'IsAuthenticated —
n'importe quel rôle (ETUDIANT, DIRECTION, APEE...) pouvait créer/modifier/supprimer
n'importe quelle ressource par un appel API direct, même si le frontend cachait les
boutons correspondants. Voir ROLE_WRITE_PERMISSIONS pour le mapping complet.
"""
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from api.models import Etablissement, TypeEtab, Utilisateur


def _authenticated_client(login, role, etablissement=None):
    Utilisateur.objects.create(
        login=login, passwd=make_password('x'), role=role, etablissement=etablissement,
    )
    client = APIClient()
    client.force_authenticate(user=User.objects.create_user(username=login, password='x'))
    return client


class UtilisateurWritePermissionTest(TestCase):
    def setUp(self):
        self.etab = Etablissement.objects.create(code_etab='ETABA', lib_etab='École A', actif=True)
        self.type_etab = TypeEtab.objects.create(lib_type='Secondaire')
        self.enseignant_client = _authenticated_client('ens1', 'ENSEIGNANT', self.etab)
        self.admin_client = _authenticated_client('admin1', 'ADMIN', self.etab)

    def test_non_admin_cannot_create_utilisateur(self):
        response = self.enseignant_client.post('/api/utilisateurs/', {
            'login': 'newuser', 'passwd': 'x', 'role': 'ETUDIANT',
            'etablissement': self.etab.code_etab, 'type_etab': self.type_etab.code_type,
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_utilisateur(self):
        response = self.admin_client.post('/api/utilisateurs/', {
            'login': 'newuser2', 'passwd': 'x', 'role': 'ETUDIANT',
            'etablissement': self.etab.code_etab, 'type_etab': self.type_etab.code_type,
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_admin_can_create_utilisateur_avec_roles_etablissement_reels(self):
        # Censeur, Surveillant Général, APEE — rôles ajoutés pour coller à l'organigramme
        # réel d'un établissement camerounais (voir doc de référence système éducatif).
        for i, role in enumerate(['CENSEUR', 'SURVEILLANT_GENERAL', 'APEE']):
            response = self.admin_client.post('/api/utilisateurs/', {
                'login': f'roleuser{i}', 'passwd': 'x', 'role': role,
                'etablissement': self.etab.code_etab, 'type_etab': self.type_etab.code_type,
            })
            self.assertEqual(response.status_code, status.HTTP_201_CREATED, msg=f"role={role}")
            self.assertEqual(response.data['role'], role)


class EtablissementWritePermissionTest(TestCase):
    """Verrouille le correctif : lecture ouverte à tout authentifié, écriture ADMIN/SUPER_ADMIN
    uniquement (EtablissementViewSet n'avait auparavant aucune restriction de rôle)."""

    def setUp(self):
        self.etab = Etablissement.objects.create(code_etab='ETABA', lib_etab='École A', actif=True)
        self.etudiant_client = _authenticated_client('etu1', 'ETUDIANT', self.etab)
        self.admin_client = _authenticated_client('admin2', 'ADMIN', self.etab)

    def test_any_authenticated_user_can_read_current(self):
        response = self.etudiant_client.get('/api/etablissements/current/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_non_admin_cannot_patch_current(self):
        response = self.etudiant_client.patch(
            '/api/etablissements/current/', {'lib_etab': 'Nom modifié'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_patch_current(self):
        response = self.admin_client.patch(
            '/api/etablissements/current/', {'lib_etab': 'Nom modifié'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.etab.refresh_from_db()
        self.assertEqual(self.etab.lib_etab, 'Nom modifié')


# Utilisateur.login est limité à 15 caractères et Departement.code_dep à 10 — d'où les
# codes courts ci-dessous plutôt que le nom du rôle en toutes lettres.
_SHORT_ROLE = {
    'ETUDIANT': 'etu', 'DIRECTION': 'dir', 'APEE': 'ape',
    'ENSEIGNANT': 'ens', 'COMPTABLE': 'cpt', 'CENSEUR': 'cen',
    'SURVEILLANT_GENERAL': 'svg', 'SCOLARITE': 'sco',
}


class RoleBasedPermissionTest(TestCase):
    """
    Vérifie RoleBasedPermission sur un ViewSet "ordinaire" (DepartementViewSet, sans
    get_permissions() propre) : la lecture reste ouverte à tout authentifié, l'écriture
    suit canCreate/canEdit/canDelete par rôle (voir api/permissions.py).
    """

    def setUp(self):
        self.etab = Etablissement.objects.create(code_etab='ETABA', lib_etab='École A', actif=True)

    def _body(self, code_dep):
        return {'code_dep': code_dep, 'lib_dep': 'Filière test', 'code_etab': self.etab.code_etab}

    def test_lecture_seule_toujours_ouverte_a_authentifie(self):
        for role in ['ETUDIANT', 'DIRECTION', 'APEE', 'ENSEIGNANT', 'COMPTABLE']:
            client = _authenticated_client(f'p_lec_{_SHORT_ROLE[role]}', role, self.etab)
            response = client.get('/api/departements/')
            self.assertEqual(response.status_code, status.HTTP_200_OK, msg=f"role={role}")

    def test_roles_sans_droit_ecriture_ne_peuvent_rien_creer(self):
        for role in ['ETUDIANT', 'DIRECTION', 'APEE']:
            short = _SHORT_ROLE[role]
            client = _authenticated_client(f'p_nc_{short}', role, self.etab)
            response = client.post('/api/departements/', self._body(f'D{short}'))
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, msg=f"role={role}")

    def test_roles_avec_droit_creation_peuvent_creer_mais_pas_supprimer(self):
        for role in ['ENSEIGNANT', 'COMPTABLE', 'CENSEUR', 'SURVEILLANT_GENERAL']:
            short = _SHORT_ROLE[role]
            client = _authenticated_client(f'p_cr_{short}', role, self.etab)
            code = f'D{short}'
            response = client.post('/api/departements/', self._body(code))
            self.assertEqual(response.status_code, status.HTTP_201_CREATED, msg=f"role={role}")

            response = client.delete(f'/api/departements/{code}/')
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, msg=f"role={role}")

    def test_scolarite_a_tous_les_droits_ecriture(self):
        client = _authenticated_client('p_scol_full', 'SCOLARITE', self.etab)
        response = client.post('/api/departements/', self._body('Dsco'))
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = client.delete('/api/departements/Dsco/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_envoi_email_refuse_aux_roles_sans_droit_creation(self):
        client = _authenticated_client('etu_mail', 'ETUDIANT', self.etab)
        response = client.post('/api/envoi-email/', {'to': 'x@example.com', 'subject': 'Test'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AuditLogPermissionTest(TestCase):
    """Le journal d'audit est un journal de sécurité — réservé ADMIN/SUPER_ADMIN, y
    compris en lecture (contrairement au reste de l'API, où lire reste ouvert)."""

    def setUp(self):
        self.etab = Etablissement.objects.create(code_etab='ETABA', lib_etab='École A', actif=True)

    def test_non_admin_ne_peut_pas_lire_le_journal(self):
        client = _authenticated_client('etu_audit', 'ETUDIANT', self.etab)
        response = client.get('/api/audit/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_peut_lire_le_journal(self):
        client = _authenticated_client('admin_audit', 'ADMIN', self.etab)
        response = client.get('/api/audit/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
