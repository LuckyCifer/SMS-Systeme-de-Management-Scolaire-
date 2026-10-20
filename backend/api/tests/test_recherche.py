"""
Recherche des listes (api/recherche.py) : `?search=` trouve les codes, les champs liés et
aussi les libellés affichés des champs à choix (« Payé » → PAYE), sans tenir compte des
accents ni de la casse ; plusieurs mots doivent tous se retrouver.
"""
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import Annee, Etablissement, Etudiant, Paiement, Utilisateur


class RechercheAvecLibellesTest(TestCase):
    def setUp(self):
        self.etab = Etablissement.objects.create(code_etab='LYC', lib_etab='Lycée', type_etab='SECONDAIRE', actif=True)
        annee = Annee.objects.create(code_annee='2026-2027', lib_annee='Année scolaire 2026-2027', statut='EN COURS')
        kamga = Etudiant.objects.create(mle_etudiant='E1', nom='Kamga', prenom='Paul', etablissement=self.etab)
        meli  = Etudiant.objects.create(mle_etudiant='E2', nom='Meli', prenom='Éloïse', etablissement=self.etab)
        Paiement.objects.create(mle_etudiant=kamga, code_annee=annee, mt_paiement=1, statut='PAYE', type_paiement='APEE',
                                etablissement=self.etab)
        Paiement.objects.create(mle_etudiant=meli, code_annee=annee, mt_paiement=1, statut='PARTIEL',
                                type_paiement='EXAMEN_OFFICIEL', etablissement=self.etab)
        Paiement.objects.create(mle_etudiant=meli, code_annee=annee, mt_paiement=1, statut='IMPAYE',
                                type_paiement='SCOLARITE', etablissement=self.etab)
        Utilisateur.objects.create(login='adm', passwd=make_password('x'), role='ADMIN', etablissement=self.etab)
        self.client = APIClient()
        self.client.force_authenticate(user=User.objects.create_user(username='adm', password='x'))

    def chercher(self, terme):
        r = self.client.get('/api/paiements/', {'search': terme, 'page_size': 50})
        self.assertEqual(r.status_code, 200)
        return sorted((p['mle_etudiant'], p['statut']) for p in r.data['results'])

    def test_libelle_de_statut(self):
        # Recherche par sous-chaîne : « payé » est aussi dans « Partiellement payé » et « Impayé ».
        self.assertEqual(self.chercher('Payé'), [('E1', 'PAYE'), ('E2', 'IMPAYE'), ('E2', 'PARTIEL')])
        self.assertEqual(self.chercher('partiellement'), [('E2', 'PARTIEL')])
        self.assertEqual(self.chercher('impaye'), [('E2', 'IMPAYE')])

    def test_libelle_de_type_en_plusieurs_mots(self):
        self.assertEqual(self.chercher("examen officiel"), [('E2', 'PARTIEL')])
        self.assertEqual(self.chercher('Frais APEE'), [('E1', 'PAYE')])

    def test_champs_lies_et_accents(self):
        self.assertEqual(self.chercher('eloise'), [('E2', 'IMPAYE'), ('E2', 'PARTIEL')])
        self.assertEqual(self.chercher('Meli impayé'), [('E2', 'IMPAYE')])
        self.assertEqual(len(self.chercher('scolaire 2026')), 3)  # libellé de l'année
        self.assertEqual(self.chercher('introuvable'), [])
