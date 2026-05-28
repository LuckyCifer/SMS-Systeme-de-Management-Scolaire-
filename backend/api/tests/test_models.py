from django.test import TestCase
from api.models import Etudiant, Departement, Specialite, Annee

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