"""
Tests de détection de conflits d'emploi du temps (voir PlanningSerializer.validate) :
une même classe, un même enseignant ou une même salle ne peuvent pas avoir deux cours sur
un créneau qui se chevauche.
"""
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import (
    Annee, Classe, Cours, Departement, Enseignant, Etablissement,
    Jour, Matiere, Module, Salle, Utilisateur,
)


class PlanningConflictTest(TestCase):
    def setUp(self):
        self.etab  = Etablissement.objects.create(code_etab='ETABA', lib_etab='École A', actif=True)
        self.annee = Annee.objects.create(code_annee='2025-2026', lib_annee='2025-2026')
        self.jour  = Jour.objects.create(code_jour='LUN', lib_jour='Lundi')
        self.jour2 = Jour.objects.create(code_jour='MAR', lib_jour='Mardi')
        self.salle = Salle.objects.create(code_salle='S1', lib_salle='Salle 1')
        self.salle2 = Salle.objects.create(code_salle='S2', lib_salle='Salle 2')
        self.dep = Departement.objects.create(code_dep='GI', lib_dep='Génie Informatique')
        self.classe_a = Classe.objects.create(code_classe='L1GI', lib_classe='L1 GI')
        self.classe_b = Classe.objects.create(code_classe='L2GI', lib_classe='L2 GI')
        self.module = Module.objects.create(code_module='MOD1', lib_module='Module 1')
        self.mat_a = Matiere.objects.create(code_matiere='ALGO', lib_matiere='Algo', code_module=self.module)
        self.mat_b = Matiere.objects.create(code_matiere='RESO', lib_matiere='Réseaux', code_module=self.module)
        self.ens   = Enseignant.objects.create(mle_ens='ENS_A', nom_ens='Ateba', etablissement=self.etab)
        self.ens2  = Enseignant.objects.create(mle_ens='ENS_B', nom_ens='Biya', etablissement=self.etab)

        self.cours_a = Cours.objects.create(
            code_matiere=self.mat_a, code_classe=self.classe_a, mle_ens=self.ens,
            semestre='S1', code_annee=self.annee, etablissement=self.etab,
        )
        self.cours_b = Cours.objects.create(
            code_matiere=self.mat_b, code_classe=self.classe_a, mle_ens=self.ens2,
            semestre='S1', code_annee=self.annee, etablissement=self.etab,
        )
        self.cours_c = Cours.objects.create(
            code_matiere=self.mat_b, code_classe=self.classe_b, mle_ens=self.ens,
            semestre='S1', code_annee=self.annee, etablissement=self.etab,
        )
        # Classe et enseignant tous deux différents de cours_a — isole les conflits de salle.
        # Même semestre que cours_a (S1) : un conflit de salle doit être détecté indépendamment
        # de la classe/l'enseignant (voir test_semestre_different_pas_de_conflit pour l'inverse).
        self.cours_d = Cours.objects.create(
            code_matiere=self.mat_a, code_classe=self.classe_b, mle_ens=self.ens2,
            semestre='S1', code_annee=self.annee, etablissement=self.etab,
        )
        # Même classe/enseignant/salle que cours_a, mais Semestre 2 : ne se déroule jamais en
        # même temps que S1 dans l'année, donc pas un vrai conflit malgré le même jour/heure.
        self.cours_e = Cours.objects.create(
            code_matiere=self.mat_b, code_classe=self.classe_a, mle_ens=self.ens,
            semestre='S2', code_annee=self.annee, etablissement=self.etab,
        )

        Utilisateur.objects.create(login='admin_a', passwd=make_password('x'), role='ADMIN', etablissement=self.etab)
        self.client = APIClient()
        self.client.force_authenticate(user=User.objects.create_user(username='admin_a', password='x'))

        # Premier créneau posé : L1GI, ALGO, lundi 08h-10h, salle S1, enseignant ENS_A
        self.client.post('/api/planning/', {
            'code_cours': self.cours_a.id, 'type_planning': 'HEBDO', 'code_jour': 'LUN',
            'h_debut': '08:00', 'h_fin': '10:00', 'code_salle': 'S1',
        })

    def test_creneau_libre_accepte(self):
        response = self.client.post('/api/planning/', {
            'code_cours': self.cours_b.id, 'type_planning': 'HEBDO', 'code_jour': 'LUN',
            'h_debut': '10:00', 'h_fin': '12:00', 'code_salle': 'S1',
        })
        self.assertEqual(response.status_code, 201)

    def test_meme_classe_meme_creneau_refuse(self):
        # L1GI a déjà ALGO à 08h-10h lundi ; on tente RESO pour L1GI au même moment.
        response = self.client.post('/api/planning/', {
            'code_cours': self.cours_b.id, 'type_planning': 'HEBDO', 'code_jour': 'LUN',
            'h_debut': '09:00', 'h_fin': '11:00', 'code_salle': 'S2',
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('code_cours', response.data)

    def test_meme_enseignant_deux_classes_meme_creneau_refuse(self):
        # ENS_A enseigne déjà ALGO à L1GI 08h-10h lundi ; on tente ENS_A pour L2GI au même moment.
        response = self.client.post('/api/planning/', {
            'code_cours': self.cours_c.id, 'type_planning': 'HEBDO', 'code_jour': 'LUN',
            'h_debut': '09:00', 'h_fin': '11:00', 'code_salle': 'S2',
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('code_cours', response.data)

    def test_meme_salle_creneau_chevauchant_refuse(self):
        # cours_d : classe et enseignant différents de cours_a, seule la salle est partagée.
        response = self.client.post('/api/planning/', {
            'code_cours': self.cours_d.id, 'type_planning': 'HEBDO', 'code_jour': 'LUN',
            'h_debut': '09:00', 'h_fin': '11:00', 'code_salle': 'S1',
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('code_salle', response.data)

    def test_meme_jour_creneaux_non_chevauchants_acceptes(self):
        response = self.client.post('/api/planning/', {
            'code_cours': self.cours_c.id, 'type_planning': 'HEBDO', 'code_jour': 'LUN',
            'h_debut': '10:00', 'h_fin': '12:00', 'code_salle': 'S1',
        })
        self.assertEqual(response.status_code, 201)

    def test_jour_different_pas_de_conflit(self):
        # Même enseignant (ENS_A), même horaire, même salle, mais un jour différent (mardi) :
        # aucun conflit avec le créneau du lundi.
        response = self.client.post('/api/planning/', {
            'code_cours': self.cours_c.id, 'type_planning': 'HEBDO', 'code_jour': 'MAR',
            'h_debut': '08:00', 'h_fin': '10:00', 'code_salle': 'S1',
        })
        self.assertEqual(response.status_code, 201)

    def test_semestre_different_pas_de_conflit(self):
        # Même classe, même enseignant, même salle, même jour/heure que cours_a — mais cours_e
        # est au Semestre 2 (cours_a est au Semestre 1) : pas un vrai conflit, les deux semestres
        # ne se déroulent jamais simultanément dans l'année.
        response = self.client.post('/api/planning/', {
            'code_cours': self.cours_e.id, 'type_planning': 'HEBDO', 'code_jour': 'LUN',
            'h_debut': '08:00', 'h_fin': '10:00', 'code_salle': 'S1',
        })
        self.assertEqual(response.status_code, 201)

    def test_heure_fin_avant_heure_debut_refuse(self):
        response = self.client.post('/api/planning/', {
            'code_cours': self.cours_b.id, 'type_planning': 'HEBDO', 'code_jour': 'LUN',
            'h_debut': '14:00', 'h_fin': '13:00', 'code_salle': 'S2',
        })
        self.assertEqual(response.status_code, 400)
