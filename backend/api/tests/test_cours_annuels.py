"""
Primaire / secondaire : un seul emploi du temps par classe et par année (cours « Année
entière », semestre = 'AN'). Supérieur : semestre 1 ou 2. Commande cours_annuels.
"""
from io import StringIO

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import Annee, Classe, Cours, Etablissement, Jour, Matiere, Module, Planning, Utilisateur


class CoursAnnuelsTest(TestCase):
    def setUp(self):
        self.lycee = Etablissement.objects.create(code_etab='LYC', lib_etab='Lycée', type_etab='SECONDAIRE', actif=True)
        self.univ  = Etablissement.objects.create(code_etab='UNI', lib_etab='Université', type_etab='SUPERIEUR', actif=True)
        self.annee = Annee.objects.create(code_annee='2026-2027', lib_annee='2026-2027', statut='EN COURS')
        Jour.objects.create(code_jour='LUN', lib_jour='Lundi')
        module = Module.objects.create(code_module='MOD1', lib_module='Module 1')
        self.math = Matiere.objects.create(code_matiere='MATH', lib_matiere='Mathématiques', code_module=module)
        self.classe = Classe.objects.create(code_classe='6EA', lib_classe='6ème A', etablissement=self.lycee)
        self.l1 = Classe.objects.create(code_classe='L1', lib_classe='L1', etablissement=self.univ)

    def client_de(self, login, etab):
        Utilisateur.objects.create(login=login, passwd=make_password('x'), role='ADMIN', etablissement=etab)
        c = APIClient()
        c.force_authenticate(user=User.objects.create_user(username=login, password='x'))
        return c

    def test_secondaire_cours_annuel_meme_si_trimestre_envoye(self):
        c = self.client_de('adm_lyc', self.lycee)
        r = c.post('/api/cours/', {'code_matiere': 'MATH', 'code_classe': '6EA', 'semestre': 'T2', 'code_annee': '2026-2027'})
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['semestre'], 'AN')
        r = c.post('/api/cours/', {'code_matiere': 'MATH', 'code_classe': '6EA', 'code_annee': '2026-2027'})
        self.assertEqual(r.status_code, 400)  # même matière, même classe, même année : déjà créé

    def test_superieur_exige_un_semestre(self):
        c = self.client_de('adm_uni', self.univ)
        r = c.post('/api/cours/', {'code_matiere': 'MATH', 'code_classe': 'L1', 'code_annee': '2026-2027'})
        self.assertEqual(r.status_code, 400)
        r = c.post('/api/cours/', {'code_matiere': 'MATH', 'code_classe': 'L1', 'semestre': 'AN', 'code_annee': '2026-2027'})
        self.assertEqual(r.status_code, 400)
        r = c.post('/api/cours/', {'code_matiere': 'MATH', 'code_classe': 'L1', 'semestre': 'S2', 'code_annee': '2026-2027'})
        self.assertEqual(r.status_code, 201, r.data)

    def test_commande_fusionne_les_trimestres(self):
        t1 = Cours.objects.create(code_matiere=self.math, code_classe=self.classe, semestre='T1',
                                  code_annee=self.annee, etablissement=self.lycee, quota_horaire=20)
        t2 = Cours.objects.create(code_matiere=self.math, code_classe=self.classe, semestre='T2',
                                  code_annee=self.annee, etablissement=self.lycee, quota_horaire=15)
        Planning.objects.create(code_cours=t1, code_jour_id='LUN', h_debut='08:00', h_fin='10:00')
        Planning.objects.create(code_cours=t2, code_jour_id='LUN', h_debut='08:00', h_fin='10:00')  # doublon
        Planning.objects.create(code_cours=t2, code_jour_id='LUN', h_debut='10:00', h_fin='11:00')
        sup = Cours.objects.create(code_matiere=self.math, code_classe=self.l1, semestre='S1',
                                   code_annee=self.annee, etablissement=self.univ)

        call_command('cours_annuels', stdout=StringIO())  # aperçu : rien ne change
        self.assertEqual(Cours.objects.filter(semestre='AN').count(), 0)

        call_command('cours_annuels', '--appliquer', stdout=StringIO())
        restants = Cours.objects.filter(etablissement=self.lycee)
        self.assertEqual(list(restants.values_list('semestre', flat=True)), ['AN'])
        garde = restants.get()
        self.assertEqual(garde.quota_horaire, 35)
        self.assertEqual(Planning.objects.filter(code_cours=garde).count(), 2)
        sup.refresh_from_db()
        self.assertEqual(sup.semestre, 'S1')  # le supérieur garde ses semestres
