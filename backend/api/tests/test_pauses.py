"""
Pauses de l'emploi du temps (api/horaires.py) : aucun cours ne chevauche une pause, dans
un sens (créneau posé sur une pause) comme dans l'autre (pause posée sur un cours).
"""
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import (
    Annee, Classe, Cours, Etablissement, Jour, Matiere, Module, PauseHoraire, Planning, Utilisateur,
)


class PauseHoraireTest(TestCase):
    def setUp(self):
        self.etab  = Etablissement.objects.create(code_etab='ETABA', lib_etab='École A', actif=True)
        self.autre = Etablissement.objects.create(code_etab='ETABB', lib_etab='École B', actif=True)
        self.annee = Annee.objects.create(code_annee='2026-2027', lib_annee='2026-2027', statut='EN COURS')
        Jour.objects.create(code_jour='LUN', lib_jour='Lundi')
        Jour.objects.create(code_jour='MAR', lib_jour='Mardi')
        module = Module.objects.create(code_module='MOD1', lib_module='Module 1')
        mat = Matiere.objects.create(code_matiere='MATH', lib_matiere='Mathématiques', code_module=module)
        classe = Classe.objects.create(code_classe='6EA', lib_classe='6ème A', etablissement=self.etab)
        self.cours = Cours.objects.create(code_matiere=mat, code_classe=classe, semestre='T1',
                                          code_annee=self.annee, etablissement=self.etab)

        Utilisateur.objects.create(login='admin_a', passwd=make_password('x'), role='ADMIN', etablissement=self.etab)
        Utilisateur.objects.create(login='ens_a', passwd=make_password('x'), role='ENSEIGNANT', etablissement=self.etab)
        self.client = APIClient()
        self.client.force_authenticate(user=User.objects.create_user(username='admin_a', password='x'))

        # Récréation de toute la semaine : 09:20 – 09:35.
        r = self.client.post('/api/pauses/', {'libelle': 'Récréation', 'h_debut': '09:20', 'h_fin': '09:35'})
        self.assertEqual(r.status_code, 201, r.data)
        self.recre = PauseHoraire.objects.get(pk=r.data['id'])

    def creneau(self, jour, debut, fin, type_planning='HEBDO', **extra):
        data = {'code_cours': self.cours.id, 'type_planning': type_planning,
                'h_debut': debut, 'h_fin': fin, **extra}
        if jour:
            data['code_jour'] = jour
        return self.client.post('/api/planning/', data)

    def test_pause_rattachee_a_l_ecole_connectee(self):
        self.assertEqual(self.recre.etablissement_id, 'ETABA')

    def test_cours_avant_et_apres_la_pause_acceptes(self):
        self.assertEqual(self.creneau('LUN', '07:30', '09:20').status_code, 201)
        self.assertEqual(self.creneau('LUN', '09:35', '11:25').status_code, 201)

    def test_cours_sur_la_pause_refuse(self):
        r = self.creneau('LUN', '08:30', '10:00')
        self.assertEqual(r.status_code, 400)
        self.assertIn('Récréation', str(r.data))

    def test_modification_vers_la_pause_refusee(self):
        r = self.creneau('LUN', '07:30', '09:20')
        r = self.client.patch(f"/api/planning/{r.data['id']}/", {'h_fin': '09:30'})
        self.assertEqual(r.status_code, 400)

    def test_planning_intensif_sur_la_pause_refuse(self):
        r = self.creneau(None, '08:00', '12:00', type_planning='INTENSIF',
                         date_debut='2026-11-02', date_fin='2026-11-06')
        self.assertEqual(r.status_code, 400)

    def test_pause_propre_au_jour_remplace_celle_de_la_semaine(self):
        r = self.client.post('/api/pauses/', {'libelle': 'Récré mardi', 'code_jour': 'MAR',
                                              'h_debut': '10:00', 'h_fin': '10:15'})
        self.assertEqual(r.status_code, 201, r.data)
        # Mardi, 09:20 – 09:35 n'est plus une pause, mais 10:00 – 10:15 l'est.
        self.assertEqual(self.creneau('MAR', '08:30', '10:00').status_code, 201)
        self.assertEqual(self.creneau('MAR', '10:00', '11:00').status_code, 400)
        self.assertEqual(self.creneau('LUN', '08:30', '10:00').status_code, 400)

    def test_pause_sur_un_cours_refusee(self):
        self.creneau('LUN', '11:40', '13:30')
        r = self.client.post('/api/pauses/', {'libelle': 'Déjeuner', 'h_debut': '13:00', 'h_fin': '14:00'})
        self.assertEqual(r.status_code, 400)
        self.assertIn('Mathématiques', str(r.data))
        r = self.client.post('/api/pauses/', {'libelle': 'Déjeuner', 'h_debut': '13:30', 'h_fin': '14:00'})
        self.assertEqual(r.status_code, 201)

    def test_deplacer_une_pause_sur_un_cours_refuse(self):
        self.creneau('LUN', '09:35', '11:25')
        r = self.client.patch(f'/api/pauses/{self.recre.id}/', {'h_fin': '09:45'})
        self.assertEqual(r.status_code, 400)

    def test_cours_d_une_annee_cloturee_ignores(self):
        ancienne = Annee.objects.create(code_annee='2025-2026', lib_annee='2025-2026', statut='CLOTUREE')
        cours = Cours.objects.create(code_matiere=self.cours.code_matiere, code_classe=self.cours.code_classe,
                                     semestre='T1', code_annee=ancienne, etablissement=self.etab)
        Planning.objects.create(code_cours=cours, type_planning='HEBDO', code_jour_id='LUN',
                                h_debut='12:00', h_fin='14:00')
        r = self.client.post('/api/pauses/', {'libelle': 'Déjeuner', 'h_debut': '13:00', 'h_fin': '14:00'})
        self.assertEqual(r.status_code, 201, r.data)

    def test_deux_pauses_ne_se_chevauchent_pas(self):
        r = self.client.post('/api/pauses/', {'libelle': 'Autre', 'h_debut': '09:30', 'h_fin': '09:50'})
        self.assertEqual(r.status_code, 400)

    def test_supprimer_la_derniere_pause_du_jour_qui_retablirait_un_chevauchement(self):
        r = self.client.post('/api/pauses/', {'libelle': 'Récré mardi', 'code_jour': 'MAR',
                                              'h_debut': '10:00', 'h_fin': '10:15'})
        self.creneau('MAR', '08:30', '10:00')  # passe sur 09:20 – 09:35, autorisé mardi
        r = self.client.delete(f"/api/pauses/{r.data['id']}/")
        self.assertEqual(r.status_code, 400)

    def test_ecole_isolee_et_ecriture_reservee(self):
        PauseHoraire.objects.create(etablissement=self.autre, libelle='Ailleurs', h_debut='08:00', h_fin='08:15')
        r = self.client.get('/api/pauses/')
        self.assertEqual([p['libelle'] for p in r.data], ['Récréation'])
        # La pause d'une autre école ne bloque pas les cours de celle-ci.
        self.assertEqual(self.creneau('LUN', '07:30', '09:00').status_code, 201)

        ens = APIClient()
        ens.force_authenticate(user=User.objects.create_user(username='ens_a', password='x'))
        self.assertEqual(ens.get('/api/pauses/').status_code, 200)
        r = ens.post('/api/pauses/', {'libelle': 'X', 'h_debut': '16:00', 'h_fin': '16:15'})
        self.assertEqual(r.status_code, 403)
