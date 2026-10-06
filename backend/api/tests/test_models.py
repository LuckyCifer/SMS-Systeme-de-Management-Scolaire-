from django.test import TestCase
from api.models import Classe, Diplome, Etablissement, Etudiant, Departement, Specialite, Annee, Periode

class EtudiantModelTest(TestCase):
    def setUp(self):
        self.dep = Departement.objects.create(
            code_dep='GI',
            lib_dep='Génie Informatique'
        )
        self.sp = Specialite.objects.create(
            code_sp='GL',
            lib_sp='Génie Logiciel',
            code_dep=self.dep
        )
        self.etudiant = Etudiant.objects.create(
            mle_etudiant='ETU005',
            nom='Test',
            prenom='Étudiant',
            code_dep=self.dep,
            code_sp=self.sp
        )
    
    def test_etudiant_creation(self):
        self.assertEqual(self.etudiant.mle_etudiant, 'ETU005')
        self.assertEqual(str(self.etudiant), 'Test Étudiant')
    
    def test_etudiant_departement(self):
        self.assertEqual(self.etudiant.code_dep, self.dep)
    
    def test_etudiant_specialite(self):
        self.assertEqual(self.etudiant.code_sp, self.sp)


class DepartementModelTest(TestCase):
    def test_departement_creation(self):
        dep = Departement.objects.create(
            code_dep='GIT',
            lib_dep='Génie Industriel et Technique'
        )
        self.assertEqual(dep.code_dep, 'GIT')
        self.assertEqual(str(dep), 'Génie Industriel et Technique')


class SpecialiteModelTest(TestCase):
    def setUp(self):
        self.dep = Departement.objects.create(
            code_dep='GIT',
            lib_dep='Génie Industriel et Technique'
        )
    
    def test_specialite_creation(self):
        sp = Specialite.objects.create(
            code_sp='GC',
            lib_sp='Génie Civil',
            code_dep=self.dep
        )
        self.assertEqual(sp.code_sp, 'GC')
        self.assertEqual(sp.code_dep, self.dep)


class ClasseSystemeTest(TestCase):
    """Sous-système linguistique d'une classe — pertinent pour un établissement BILINGUE
    où francophone et anglophone coexistent, chacun avec ses propres classes."""

    def test_classe_sans_systeme_par_defaut(self):
        # Établissement non bilingue : la classe n'a pas besoin de préciser de sous-système.
        classe = Classe.objects.create(code_classe='6EME_A', lib_classe='6ème A')
        self.assertIsNone(classe.systeme)

    def test_classe_francophone_et_anglophone_coexistent(self):
        fr = Classe.objects.create(code_classe='6EME_FR', lib_classe='6ème (Francophone)', systeme='FRANCOPHONE')
        en = Classe.objects.create(code_classe='FORM1_EN', lib_classe='Form 1 (Anglophone)', systeme='ANGLOPHONE')
        self.assertEqual(fr.systeme, 'FRANCOPHONE')
        self.assertEqual(en.systeme, 'ANGLOPHONE')


class PeriodeTypeTest(TestCase):
    """Distingue une séquence/trimestre ordinaire de la période d'examens officiels
    (mi-mai à fin juillet — voir doc de référence système éducatif)."""

    def test_periode_ordinaire_par_defaut(self):
        periode = Periode.objects.create(lib_periode='Trimestre 1')
        self.assertEqual(periode.type_periode, 'ORDINAIRE')

    def test_periode_examens_officiels(self):
        periode = Periode.objects.create(
            lib_periode='Session BEPC/Bac', type_periode='EXAMENS_OFFICIELS',
        )
        self.assertEqual(periode.type_periode, 'EXAMENS_OFFICIELS')


class TutelleAcademiqueIpesTest(TestCase):
    """IPES non homologué placé sous tutelle académique d'un établissement homologué,
    avec co-signature des diplômes délivrés (voir doc de référence système éducatif)."""

    def setUp(self):
        self.universite = Etablissement.objects.create(
            code_etab='UNIV_HOM', lib_etab='Université Homologuée', type_etab='SUPERIEUR',
            statut='PUBLIC', statut_agrement='HOMOLOGUE', actif=True,
        )
        self.ipes = Etablissement.objects.create(
            code_etab='IPES_A', lib_etab='Institut Privé A', type_etab='SUPERIEUR',
            statut='PRIVE_LAIQUE', statut_agrement='OUVERT',
            etablissement_tutelle=self.universite, actif=True,
        )
        self.dep = Departement.objects.create(code_dep='GI', lib_dep='Génie Informatique')

    def test_ipes_rattache_a_sa_tutelle(self):
        self.assertEqual(self.ipes.etablissement_tutelle, self.universite)
        self.assertEqual(self.ipes.statut_agrement, 'OUVERT')

    def test_diplome_cosigne_par_la_tutelle(self):
        etudiant = Etudiant.objects.create(
            mle_etudiant='ETU100', nom='Nono', prenom='Estelle', code_dep=self.dep,
            etablissement=self.ipes,
        )
        diplome = Diplome.objects.create(
            mle_etudiant=etudiant, type_diplome='LICENCE', lib_diplome='Licence en Informatique',
            annee_obtention='2025-2026', signe_par='Le Promoteur',
            etablissement_tutelle=self.universite, signe_par_tutelle='Le Recteur',
        )
        self.assertEqual(diplome.etablissement_tutelle, self.universite)
        self.assertEqual(diplome.signe_par_tutelle, 'Le Recteur')