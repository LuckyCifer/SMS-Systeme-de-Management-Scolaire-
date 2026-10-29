"""
Supérieur : cycle (BTS, Licence, Master…) choisi à l'inscription, cohérent avec la classe
(classe → niveau interne → cycle) et propre à l'école. Primaire / secondaire : pas de cycle.
"""
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import Annee, Classe, Cycle, Etablissement, Etudiant, Inscription, Niveau, Utilisateur


class InscriptionCycleTest(TestCase):
    def setUp(self):
        self.sup = Etablissement.objects.create(code_etab='SUP', lib_etab='École sup', type_etab='SUPERIEUR', actif=True)
        self.autre = Etablissement.objects.create(code_etab='AUT', lib_etab='Autre sup', type_etab='SUPERIEUR', actif=True)
        self.lycee = Etablissement.objects.create(code_etab='LYC', lib_etab='Lycée', type_etab='SECONDAIRE', actif=True)
        Annee.objects.create(code_annee='2026-2027', lib_annee='2026-2027', statut='EN COURS')
        self.bts = Cycle.objects.create(code_cycle='S_BTS', lib_cycle='BTS', etablissement=self.sup)
        self.lic = Cycle.objects.create(code_cycle='S_LIC', lib_cycle='Licence', etablissement=self.sup)
        self.etranger = Cycle.objects.create(code_cycle='A_MAS', lib_cycle='Master', etablissement=self.autre)
        n1 = Niveau.objects.create(lib_niveau='Niveau 1', code_cycle=self.bts, etablissement=self.sup)
        n3 = Niveau.objects.create(lib_niveau='Niveau 3', code_cycle=self.lic, etablissement=self.sup)
        Classe.objects.create(code_classe='GL1', lib_classe='Génie logiciel 1', code_niveau=n1, etablissement=self.sup)
        Classe.objects.create(code_classe='GL3', lib_classe='Génie logiciel 3', code_niveau=n3, etablissement=self.sup)
        Classe.objects.create(code_classe='6A', lib_classe='6ème A', etablissement=self.lycee)
        for mle, etab in (('E1', self.sup), ('E2', self.sup), ('E3', self.sup), ('L1', self.lycee)):
            Etudiant.objects.create(mle_etudiant=mle, nom=mle, etablissement=etab)
        self.client = self._client('adm_sup', self.sup)

    def _client(self, login, etab):
        Utilisateur.objects.create(login=login, passwd=make_password('x'), role='ADMIN', etablissement=etab)
        c = APIClient()
        c.force_authenticate(user=User.objects.create_user(username=login, password='x'))
        return c

    def inscrire(self, mle, classe, cycle=None, client=None):
        data = {'mle_etudiant': mle, 'code_classe': classe, 'code_annee': '2026-2027'}
        if cycle:
            data['code_cycle'] = cycle
        return (client or self.client).post('/api/inscriptions/', data)

    def test_cycle_choisi_coherent_avec_la_classe(self):
        r = self.inscrire('E1', 'GL1', 'S_BTS')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['lib_cycle'], 'BTS')

    def test_classe_d_un_autre_cycle_refusee(self):
        r = self.inscrire('E1', 'GL1', 'S_LIC')
        self.assertEqual(r.status_code, 400)
        self.assertIn('BTS', str(r.data))

    def test_cycle_deduit_de_la_classe(self):
        r = self.inscrire('E2', 'GL3')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Inscription.objects.get(mle_etudiant='E2').code_cycle_id, 'S_LIC')

    def test_cycle_d_une_autre_ecole_refuse(self):
        r = self.inscrire('E3', 'GL1', 'A_MAS')
        self.assertEqual(r.status_code, 400)

    def test_secondaire_sans_cycle(self):
        lycee = self._client('adm_lyc', self.lycee)
        r = self.inscrire('L1', '6A', client=lycee)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertIsNone(Inscription.objects.get(mle_etudiant='L1').code_cycle_id)

    def test_classes_filtrees_par_cycle(self):
        r = self.client.get('/api/classes/', {'code_cycle': 'S_LIC'})
        codes = [c['code_classe'] for c in (r.data['results'] if isinstance(r.data, dict) else r.data)]
        self.assertEqual(codes, ['GL3'])
