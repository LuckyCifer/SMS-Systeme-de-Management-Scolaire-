"""
Tests du rattachement d'un Examen à un diplôme national officiel (voir doc de référence
système éducatif camerounais) — Examen.type_officiel / organisme, et l'extension
correspondante de Diplome.TYPE_CHOICES.
"""
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import (
    Annee, Classe, Departement, Diplome, Etablissement, Etudiant,
    Examen, Matiere, Module, Utilisateur,
)


class ExamenOfficielTest(TestCase):
    def setUp(self):
        self.etab   = Etablissement.objects.create(code_etab='ETABA', lib_etab='École A', actif=True)
        self.annee  = Annee.objects.create(code_annee='2025-2026', lib_annee='2025-2026')
        self.dep    = Departement.objects.create(code_dep='SEC', lib_dep='Secondaire')
        self.classe = Classe.objects.create(code_classe='3EME', lib_classe='Troisième', etablissement=self.etab)
        self.module = Module.objects.create(code_module='MOD1', lib_module='Module 1')
        self.matiere = Matiere.objects.create(
            code_matiere='FR', lib_matiere='Français', code_module=self.module,
        )
        Utilisateur.objects.create(login='scol_a', passwd=make_password('x'), role='SCOLARITE', etablissement=self.etab)
        self.client = APIClient()
        self.client.force_authenticate(user=User.objects.create_user(username='scol_a', password='x'))

    def test_examen_rattache_a_un_diplome_officiel(self):
        response = self.client.post('/api/examens/', {
            'lib_examen': 'BEPC — Français', 'code_matiere': self.matiere.code_matiere,
            'code_classe': self.classe.code_classe, 'code_annee': self.annee.code_annee,
            'date_examen': '2026-06-15T08:00:00Z', 'type_officiel': 'BEPC', 'organisme': 'MINESEC',
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['type_officiel'], 'BEPC')
        self.assertEqual(response.data['organisme'], 'MINESEC')

    def test_examen_interne_sans_diplome_officiel(self):
        # Comportement par défaut inchangé : un devoir/CC classique n'est rattaché à rien.
        response = self.client.post('/api/examens/', {
            'lib_examen': 'Devoir surveillé n°1', 'code_matiere': self.matiere.code_matiere,
            'code_classe': self.classe.code_classe, 'code_annee': self.annee.code_annee,
            'date_examen': '2026-03-10T08:00:00Z',
        })
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.data['type_officiel'])
        self.assertEqual(response.data['organisme'], 'INTERNE')

    def test_diplome_secondaire_bepc(self):
        etudiant = Etudiant.objects.create(
            mle_etudiant='ETU001', nom='Ateba', prenom='Junior', code_dep=self.dep, etablissement=self.etab,
        )
        diplome = Diplome.objects.create(
            mle_etudiant=etudiant, type_diplome='BEPC', lib_diplome="Brevet d'Études du Premier Cycle",
            annee_obtention=self.annee.code_annee,
        )
        diplome.full_clean()
        self.assertEqual(diplome.type_diplome, 'BEPC')
