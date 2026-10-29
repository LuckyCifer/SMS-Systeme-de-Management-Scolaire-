"""
Enseignement technique industriel (niveaux 1AN_TECH… TLE_TECH, spécialités et séries F2…),
commande configurer_ltca et commande supprimer_etablissement.
"""
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase

from api.deduction_classes import deduire_niveau_serie
from api.models import (
    Annee, Classe, CoefficientMatiere, Cours, Etablissement, Etudiant, Matiere, Module,
    NiveauScolaire, Paiement, Pension, Tranche, Utilisateur,
)
from api.notes import series_du_niveau


class NiveauxTechniquesTest(TestCase):
    def test_niveaux_crees_par_la_migration(self):
        codes = set(NiveauScolaire.objects.filter(code_niveau__endswith='_TECH').values_list('code_niveau', flat=True))
        self.assertEqual(codes, {'1AN_TECH', '2AN_TECH', '3AN_TECH', '4AN_TECH', '2NDE_TECH', '1ERE_TECH', 'TLE_TECH'})

    def test_series(self):
        self.assertIn('ELEC', series_du_niveau('4AN_TECH'))
        self.assertIn('F4', series_du_niveau('TLE_TECH'))
        self.assertNotIn('F4', series_du_niveau('TLE_FR'))

    def test_deduction_depuis_le_libelle(self):
        cas = {
            '1ère année ELEC': ('1AN_TECH', 'ELEC'),
            '4ème année MACO': ('4AN_TECH', 'MACO'),
            '2nde F3':         ('2NDE_TECH', 'F3'),
            'Tle F4':          ('TLE_TECH', 'F4'),
            '1ère MEB':        ('1ERE_TECH', 'MEB'),
            'Tle C':           ('TLE_FR', 'C'),      # général inchangé
            '1ère AE':         ('1ERE_FR', 'A'),
        }
        for libelle, attendu in cas.items():
            d = deduire_niveau_serie(libelle)
            self.assertEqual((d['niveau'], d['serie']), attendu, libelle)
        self.assertEqual(deduire_niveau_serie('2ème année')['remarque'], 'Spécialité ou série technique à compléter')


class ConfigurerLtcaTest(TestCase):
    def setUp(self):
        Annee.objects.create(code_annee='2026-2027', lib_annee='2026-2027', statut='EN COURS')
        for code in ('TEC', 'ELECTRICT', 'INDUSTRI', 'GEN', 'LIT', 'SCI', 'SPO'):
            Module.objects.create(code_module=code, lib_module=code)
        for code in ('SEC_FRA', 'SEC_ANG', 'SEC_MAT', 'SEC_PCH', 'SEC_HGO', 'SEC_ECM', 'SEC_EPS', 'SEC_INF', 'SEC_PHI'):
            Matiere.objects.create(code_matiere=code, lib_matiere=code, code_module_id='GEN', type_etab='SECONDAIRE')

    def test_apercu_puis_application_sans_doublon(self):
        call_command('configurer_ltca', stdout=StringIO())
        self.assertFalse(Etablissement.objects.filter(pk='LTCA').exists())

        call_command('configurer_ltca', '--appliquer', stdout=StringIO())
        etab = Etablissement.objects.get(pk='LTCA')
        self.assertEqual((etab.type_etab, etab.statut, etab.systeme), ('SECONDAIRE', 'PUBLIC', 'FRANCOPHONE'))
        classes = Classe.objects.filter(etablissement=etab)
        self.assertEqual(classes.count(), 45)
        tle_f4 = classes.get(code_classe='LTTLF4')
        self.assertEqual((tle_f4.lib_classe, tle_f4.niveau_scolaire_id, tle_f4.serie), ('Tle F4', 'TLE_TECH', 'F4'))
        # Programme : cours annuels et coefficients de la grille pour chaque matière.
        self.assertTrue(Cours.objects.filter(code_classe=tle_f4, code_matiere='TEC_CONSTR', semestre='AN').exists())
        self.assertEqual(CoefficientMatiere.objects.get(etablissement=etab, niveau_scolaire='TLE_TECH',
                                                        serie='F4', code_matiere='TEC_CONSTR').coef, 5)
        self.assertEqual(Utilisateur.objects.get(login='ltca_proviseur').role, 'ADMIN')

        n = Cours.objects.count()
        call_command('configurer_ltca', '--appliquer', stdout=StringIO())
        self.assertEqual(Cours.objects.count(), n)


class SupprimerEtablissementTest(TestCase):
    def setUp(self):
        self.etab = Etablissement.objects.create(code_etab='VIEUX', lib_etab='Ancien lycée', type_etab='SECONDAIRE')
        self.autre = Etablissement.objects.create(code_etab='GARDE', lib_etab='Lycée gardé', type_etab='SECONDAIRE')
        annee = Annee.objects.create(code_annee='2026-2027', lib_annee='2026-2027')
        pension = Pension.objects.create(lib_pension='APEE', etablissement=self.etab)
        tranche = Tranche.objects.create(code_pension=pension, lib_tranche='T1', mt_tranche=1000)
        eleve = Etudiant.objects.create(mle_etudiant='V1', nom='Ancien', etablissement=self.etab)
        Paiement.objects.create(mle_etudiant=eleve, code_annee=annee, mt_paiement=1000, code_tranche=tranche,
                                etablissement=self.etab)
        Utilisateur.objects.create(login='vieux_admin', passwd='x', role='ADMIN', etablissement=self.etab)
        User.objects.create(username='vieux_admin')
        Utilisateur.objects.create(login='garde_admin', passwd='x', role='ADMIN', etablissement=self.autre)

    def test_apercu_puis_suppression_complete(self):
        call_command('supprimer_etablissement', 'VIEUX', stdout=StringIO())
        self.assertTrue(Etablissement.objects.filter(pk='VIEUX').exists())

        call_command('supprimer_etablissement', 'VIEUX', '--appliquer', stdout=StringIO())
        self.assertFalse(Etablissement.objects.filter(pk='VIEUX').exists())
        self.assertFalse(Etudiant.objects.filter(pk='V1').exists())
        self.assertFalse(Tranche.objects.exists())
        # Les comptes de l'école ne restent pas sans établissement ; les autres sont intacts.
        self.assertFalse(Utilisateur.objects.filter(login='vieux_admin').exists())
        self.assertFalse(User.objects.filter(username='vieux_admin').exists())
        self.assertTrue(Utilisateur.objects.filter(login='garde_admin').exists())
