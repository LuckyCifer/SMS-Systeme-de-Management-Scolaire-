"""
Tests du module de paiement des salaires (PaiementSalaire) — volontairement séparé des
frais de scolarité/inscription (Paiement). Le bénéficiaire doit être soit un Enseignant,
soit un Personnel, jamais les deux ni aucun des deux.
"""
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import Enseignant, Etablissement, PaiementSalaire, Personnel, Utilisateur


class PaiementSalaireTest(TestCase):
    def setUp(self):
        self.etab = Etablissement.objects.create(code_etab='ETABA', lib_etab='École A', actif=True)
        self.ens = Enseignant.objects.create(mle_ens='ENS_A', nom_ens='Ateba', etablissement=self.etab)
        self.personnel = Personnel.objects.create(
            mle_personnel='PERS_A', nom='Biya', etablissement=self.etab,
            poste='ECONOME', categorie='ADMIN', type_contrat='TITULAIRE',
        )
        Utilisateur.objects.create(login='compt_a', passwd=make_password('x'), role='COMPTABLE', etablissement=self.etab)
        self.client = APIClient()
        self.client.force_authenticate(user=User.objects.create_user(username='compt_a', password='x'))

    def test_paiement_enseignant_ok(self):
        response = self.client.post('/api/paiements-salaires/', {
            'enseignant': self.ens.mle_ens, 'mois_paie': '2026-06-01', 'montant': 150000,
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['type_beneficiaire'], 'ENSEIGNANT')
        self.assertIn('Ateba', response.data['nom_beneficiaire'])

    def test_paiement_personnel_ok(self):
        response = self.client.post('/api/paiements-salaires/', {
            'personnel': self.personnel.mle_personnel, 'mois_paie': '2026-06-01', 'montant': 100000,
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['type_beneficiaire'], 'PERSONNEL')
        self.assertIn('Biya', response.data['nom_beneficiaire'])

    def test_paiement_sans_beneficiaire_refuse(self):
        response = self.client.post('/api/paiements-salaires/', {
            'mois_paie': '2026-06-01', 'montant': 100000,
        })
        self.assertEqual(response.status_code, 400)

    def test_paiement_deux_beneficiaires_refuse(self):
        response = self.client.post('/api/paiements-salaires/', {
            'enseignant': self.ens.mle_ens, 'personnel': self.personnel.mle_personnel,
            'mois_paie': '2026-06-01', 'montant': 100000,
        })
        self.assertEqual(response.status_code, 400)

    def test_stats_endpoint(self):
        PaiementSalaire.objects.create(
            enseignant=self.ens, mois_paie='2026-06-01', montant=150000, etablissement=self.etab,
        )
        PaiementSalaire.objects.create(
            personnel=self.personnel, mois_paie='2026-06-01', montant=100000, etablissement=self.etab,
        )
        response = self.client.get('/api/paiements-salaires/stats/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['nb_paiements'], 2)
        self.assertEqual(response.data['total_verse'], 250000)

    def test_isolation_par_etablissement(self):
        autre_etab = Etablissement.objects.create(code_etab='ETABB', lib_etab='École B', actif=True)
        autre_ens = Enseignant.objects.create(mle_ens='ENS_B', nom_ens='Autre', etablissement=autre_etab)
        PaiementSalaire.objects.create(
            enseignant=autre_ens, mois_paie='2026-06-01', montant=999999, etablissement=autre_etab,
        )
        response = self.client.get('/api/paiements-salaires/')
        self.assertEqual(response.data['results'], [])


class PaiementSalaireModelTest(TestCase):
    def setUp(self):
        self.etab = Etablissement.objects.create(code_etab='ETABA', lib_etab='École A', actif=True)
        self.ens = Enseignant.objects.create(mle_ens='ENS_A', nom_ens='Ateba', etablissement=self.etab)

    def test_clean_rejette_aucun_beneficiaire(self):
        from django.core.exceptions import ValidationError
        p = PaiementSalaire(mois_paie='2026-06-01', montant=100000, etablissement=self.etab)
        with self.assertRaises(ValidationError):
            p.clean()

    def test_clean_accepte_un_seul_beneficiaire(self):
        p = PaiementSalaire(enseignant=self.ens, mois_paie='2026-06-01', montant=100000, etablissement=self.etab)
        p.clean()  # ne doit pas lever d'exception
