"""
Tests de non-régression pour l'isolation multi-établissement (voir api/mixins.py).

Contexte : un utilisateur non SUPER_ADMIN pouvait auparavant accéder aux données d'un
autre établissement en falsifiant les headers HTTP X-Etablissement-Id / X-Type-Etab,
puisque ces headers étaient honorés tels quels sans vérifier l'établissement réellement
assigné à l'utilisateur en base (IDOR). Ces tests verrouillent le comportement corrigé.
"""
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import Departement, Etablissement, Utilisateur


class EtablissementIsolationTest(TestCase):
    def setUp(self):
        self.etab_a = Etablissement.objects.create(
            code_etab='ETABA', lib_etab='École A', actif=True,
        )
        self.etab_b = Etablissement.objects.create(
            code_etab='ETABB', lib_etab='École B', actif=True,
        )
        self.dep_a = Departement.objects.create(
            code_dep='DEPA', lib_dep='Département A', etablissement=self.etab_a,
        )
        self.dep_b = Departement.objects.create(
            code_dep='DEPB', lib_dep='Département B', etablissement=self.etab_b,
        )

        Utilisateur.objects.create(
            login='admin_a', passwd=make_password('x'),
            role='ADMIN', etablissement=self.etab_a,
        )
        self.client_a = APIClient()
        self.client_a.force_authenticate(
            user=User.objects.create_user(username='admin_a', password='x')
        )

        Utilisateur.objects.create(login='super', passwd=make_password('x'), role='SUPER_ADMIN')
        self.client_super = APIClient()
        self.client_super.force_authenticate(
            user=User.objects.create_user(username='super', password='x')
        )

    def _codes(self, response):
        return {d['code_dep'] for d in response.data['results']}

    def test_regular_user_sees_only_own_etablissement(self):
        response = self.client_a.get('/api/departements/')
        codes = self._codes(response)
        self.assertIn('DEPA', codes)
        self.assertNotIn('DEPB', codes)

    def test_regular_user_cannot_spoof_etablissement_header(self):
        """Falsifier X-Etablissement-Id ne doit rien changer pour un rôle non SUPER_ADMIN."""
        response = self.client_a.get('/api/departements/', HTTP_X_ETABLISSEMENT_ID='ETABB')
        codes = self._codes(response)
        self.assertNotIn('DEPB', codes)
        self.assertIn('DEPA', codes)

    def test_super_admin_can_switch_etablissement(self):
        """Le SUPER_ADMIN garde la capacité légitime de changer d'établissement via le header."""
        response = self.client_super.get('/api/departements/', HTTP_X_ETABLISSEMENT_ID='ETABB')
        codes = self._codes(response)
        self.assertIn('DEPB', codes)
        self.assertNotIn('DEPA', codes)


class UtilisateurIsolationTest(TestCase):
    """UtilisateurViewSet a sa propre logique de filtrage (pas le mixin générique) —
    couverte séparément pour éviter une régression silencieuse si les deux divergent."""

    def setUp(self):
        self.etab_a = Etablissement.objects.create(code_etab='ETABA', lib_etab='École A', actif=True)
        self.etab_b = Etablissement.objects.create(code_etab='ETABB', lib_etab='École B', actif=True)

        Utilisateur.objects.create(
            login='admin_a', passwd=make_password('x'), role='ADMIN', etablissement=self.etab_a,
        )
        Utilisateur.objects.create(
            login='ens_b', passwd=make_password('x'), role='ENSEIGNANT', etablissement=self.etab_b,
        )
        self.client_a = APIClient()
        self.client_a.force_authenticate(
            user=User.objects.create_user(username='admin_a', password='x')
        )

    def _logins(self, response):
        return {u['login'] for u in response.data['results']}

    def test_regular_user_sees_only_own_etablissement_accounts(self):
        response = self.client_a.get('/api/utilisateurs/')
        logins = self._logins(response)
        self.assertIn('admin_a', logins)
        self.assertNotIn('ens_b', logins)

    def test_regular_user_cannot_spoof_type_etab_header(self):
        response = self.client_a.get('/api/utilisateurs/', HTTP_X_TYPE_ETAB='1')
        logins = self._logins(response)
        self.assertNotIn('ens_b', logins)
