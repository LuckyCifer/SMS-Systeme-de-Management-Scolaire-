from django.db import IntegrityError, transaction
from django.test import TestCase
from api.models import Annee, Departement, Etudiant, Facture, Frais, Paiement


class AnneeModelTest(TestCase):
    def test_annee_creation(self):
        annee = Annee.objects.create(code_annee='2025-2026', lib_annee='2025-2026', statut='EN COURS')
        self.assertEqual(annee.code_annee, '2025-2026')
        self.assertEqual(annee.statut, 'EN COURS')


class FraisModelTest(TestCase):
    def test_frais_creation(self):
        frais = Frais.objects.create(
            code_frais=1, lib_frais='Scolarité', type_frais='SCOLARITE', mt_frais=150000,
        )
        self.assertEqual(frais.mt_frais, 150000)
        self.assertEqual(str(frais), 'Scolarité')


class PaiementModelTest(TestCase):
    def setUp(self):
        self.annee = Annee.objects.create(code_annee='2025-2026', lib_annee='2025-2026')
        self.dep = Departement.objects.create(code_dep='GI', lib_dep='Génie Informatique')
        self.etudiant = Etudiant.objects.create(
            mle_etudiant='ETU010', nom='Kamga', prenom='Paul', code_dep=self.dep,
        )

    def test_paiement_creation_defaults(self):
        paiement = Paiement.objects.create(
            mle_etudiant=self.etudiant, code_annee=self.annee, mt_paiement=50000,
        )
        self.assertEqual(paiement.statut, 'PAYE')
        self.assertEqual(paiement.type_paiement, 'SCOLARITE')
        self.assertEqual(paiement.mt_paiement, 50000)

    def test_paiement_statut_partiel(self):
        paiement = Paiement.objects.create(
            mle_etudiant=self.etudiant, code_annee=self.annee, mt_paiement=20000, statut='PARTIEL',
        )
        self.assertEqual(paiement.statut, 'PARTIEL')

    def test_paiement_type_apee(self):
        # Frais APEE — distinct de la scolarité privée, voir doc de référence système
        # éducatif (coût réel dans le public où la scolarité est nominalement gratuite).
        paiement = Paiement.objects.create(
            mle_etudiant=self.etudiant, code_annee=self.annee, mt_paiement=15000, type_paiement='APEE',
        )
        self.assertEqual(paiement.type_paiement, 'APEE')

    def test_paiement_type_examen_officiel(self):
        paiement = Paiement.objects.create(
            mle_etudiant=self.etudiant, code_annee=self.annee, mt_paiement=10000,
            type_paiement='EXAMEN_OFFICIEL',
        )
        self.assertEqual(paiement.type_paiement, 'EXAMEN_OFFICIEL')


class FactureModelTest(TestCase):
    def setUp(self):
        self.annee = Annee.objects.create(code_annee='2025-2026', lib_annee='2025-2026')
        self.dep = Departement.objects.create(code_dep='GI', lib_dep='Génie Informatique')
        self.etudiant = Etudiant.objects.create(
            mle_etudiant='ETU011', nom='Nga', prenom='Sarah', code_dep=self.dep,
        )

    def test_facture_creation_defaults(self):
        facture = Facture.objects.create(
            numero_facture='FAC-2026-001', mle_etudiant=self.etudiant, code_annee=self.annee,
        )
        self.assertEqual(facture.statut, 'EN_ATTENTE')
        self.assertEqual(facture.montant_total, 0)
        self.assertEqual(facture.montant_paye, 0)

    def test_facture_numero_unique(self):
        Facture.objects.create(
            numero_facture='FAC-2026-002', mle_etudiant=self.etudiant, code_annee=self.annee,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Facture.objects.create(
                    numero_facture='FAC-2026-002', mle_etudiant=self.etudiant, code_annee=self.annee,
                )
