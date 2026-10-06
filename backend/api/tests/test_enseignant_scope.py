"""
Tests du scoping ENSEIGNANT : un compte de rôle ENSEIGNANT ne doit voir/modifier que les
examens, évaluations, fiches de notes et cours de ses propres matières/classes (dérivées de
Cours via le lien Enseignant.utilisateur), pas ceux de toute l'école. Voir api/mixins.py
(scope_queryset_to_enseignant*, assert_enseignant_teaches) et get_enseignant_profile().
"""
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import (
    Annee, Classe, Cours, Departement, Enseignant, Etablissement, Evaluation,
    Examen, FicheNotes, Matiere, Module, Periode, TypeEvaluation, Utilisateur,
)


class EnseignantScopeTestBase(TestCase):
    def setUp(self):
        self.etab   = Etablissement.objects.create(code_etab='ETABA', lib_etab='École A', actif=True)
        self.annee  = Annee.objects.create(code_annee='2025-2026', lib_annee='2025-2026')
        self.periode = Periode.objects.create(lib_periode='Semestre 1')
        self.dep    = Departement.objects.create(code_dep='GI', lib_dep='Génie Informatique')
        self.classe_a = Classe.objects.create(code_classe='L1GI', lib_classe='L1 Génie Informatique')
        self.classe_b = Classe.objects.create(code_classe='L2GI', lib_classe='L2 Génie Informatique')
        self.module = Module.objects.create(code_module='MOD1', lib_module='Module 1')
        self.mat_a  = Matiere.objects.create(code_matiere='ALGO', lib_matiere='Algorithmique', code_module=self.module)
        self.mat_b  = Matiere.objects.create(code_matiere='RESO', lib_matiere='Réseaux', code_module=self.module)

        # Deux enseignants, chacun avec un compte utilisateur lié.
        self.ens_a = Enseignant.objects.create(mle_ens='ENS_A', nom_ens='Ateba', etablissement=self.etab)
        self.ens_b = Enseignant.objects.create(mle_ens='ENS_B', nom_ens='Biya', etablissement=self.etab)

        Utilisateur.objects.create(
            login='ens_a', passwd=make_password('x'), role='ENSEIGNANT',
            etablissement=self.etab,
        )
        self.ens_a.utilisateur = Utilisateur.objects.get(login='ens_a')
        self.ens_a.save()
        Utilisateur.objects.create(
            login='ens_b', passwd=make_password('x'), role='ENSEIGNANT',
            etablissement=self.etab,
        )
        self.ens_b.utilisateur = Utilisateur.objects.get(login='ens_b')
        self.ens_b.save()

        self.client_a = APIClient()
        self.client_a.force_authenticate(user=User.objects.create_user(username='ens_a', password='x'))
        self.client_b = APIClient()
        self.client_b.force_authenticate(user=User.objects.create_user(username='ens_b', password='x'))

        # ens_a enseigne ALGO en L1GI ; ens_b enseigne RESO en L2GI.
        self.cours_a = Cours.objects.create(
            code_matiere=self.mat_a, code_classe=self.classe_a, mle_ens=self.ens_a,
            semestre='S1', code_annee=self.annee, etablissement=self.etab,
        )
        self.cours_b = Cours.objects.create(
            code_matiere=self.mat_b, code_classe=self.classe_b, mle_ens=self.ens_b,
            semestre='S1', code_annee=self.annee, etablissement=self.etab,
        )


class CoursScopeTest(EnseignantScopeTestBase):
    def test_enseignant_voit_uniquement_ses_cours(self):
        response = self.client_a.get('/api/cours/')
        codes = {c['code_matiere'] for c in response.data['results']}
        self.assertIn('ALGO', codes)
        self.assertNotIn('RESO', codes)


class ExamenScopeTest(EnseignantScopeTestBase):
    def setUp(self):
        super().setUp()
        self.examen_a = Examen.objects.create(
            lib_examen='CC Algo', code_matiere=self.mat_a, code_classe=self.classe_a,
            code_annee=self.annee, code_periode=self.periode, date_examen='2026-03-10 08:00:00',
            etablissement=self.etab,
        )
        self.examen_b = Examen.objects.create(
            lib_examen='CC Réseaux', code_matiere=self.mat_b, code_classe=self.classe_b,
            code_annee=self.annee, code_periode=self.periode, date_examen='2026-03-11 08:00:00',
            etablissement=self.etab,
        )

    def test_enseignant_ne_voit_que_ses_examens(self):
        response = self.client_a.get('/api/examens/')
        libs = {e['lib_examen'] for e in response.data['results']}
        self.assertIn('CC Algo', libs)
        self.assertNotIn('CC Réseaux', libs)

    def test_enseignant_ne_peut_pas_planifier_pour_une_matiere_quil_nenseigne_pas(self):
        response = self.client_a.post('/api/examens/', {
            'lib_examen':   'CC Réseaux (usurpation)',
            'code_matiere': self.mat_b.code_matiere,
            'code_classe':  self.classe_b.code_classe,
            'code_annee':   self.annee.code_annee,
            'code_periode': self.periode.code_periode,
            'date_examen':  '2026-03-12 08:00:00',
        })
        self.assertEqual(response.status_code, 403)

    def test_enseignant_peut_planifier_pour_sa_propre_matiere(self):
        response = self.client_a.post('/api/examens/', {
            'lib_examen':   'Session normale Algo',
            'code_matiere': self.mat_a.code_matiere,
            'code_classe':  self.classe_a.code_classe,
            'code_annee':   self.annee.code_annee,
            'code_periode': self.periode.code_periode,
            'date_examen':  '2026-06-01 08:00:00',
        })
        self.assertEqual(response.status_code, 201)


class EvaluationScopeTest(EnseignantScopeTestBase):
    def setUp(self):
        super().setUp()
        self.type_eval = TypeEvaluation.objects.create(lib_type_eval='Contrôle continu')

    def test_enseignant_ne_peut_pas_noter_une_matiere_quil_nenseigne_pas(self):
        from api.models import Etudiant
        etud = Etudiant.objects.create(mle_etudiant='ETU030', nom='Test', code_dep=self.dep)
        response = self.client_a.post('/api/evaluations/', {
            'mle_etudiant':   etud.mle_etudiant,
            'code_matiere':   self.mat_b.code_matiere,
            'code_classe':    self.classe_b.code_classe,
            'code_periode':   self.periode.code_periode,
            'code_type_eval': self.type_eval.code_type_eval,
            'note': 15,
        })
        self.assertEqual(response.status_code, 403)


class FicheNotesScopeTest(EnseignantScopeTestBase):
    def setUp(self):
        super().setUp()
        self.type_eval = TypeEvaluation.objects.create(lib_type_eval='Contrôle continu')
        self.fiche_a = FicheNotes.objects.create(
            code_matiere=self.mat_a, code_classe=self.classe_a, mle_ens=self.ens_a,
            code_periode=self.periode, code_annee=self.annee, code_type_eval=self.type_eval,
            date_evaluation='2026-03-10', etablissement=self.etab,
        )
        self.fiche_b = FicheNotes.objects.create(
            code_matiere=self.mat_b, code_classe=self.classe_b, mle_ens=self.ens_b,
            code_periode=self.periode, code_annee=self.annee, code_type_eval=self.type_eval,
            date_evaluation='2026-03-11', etablissement=self.etab,
        )

    def test_enseignant_ne_voit_que_ses_fiches(self):
        response = self.client_a.get('/api/fiches-notes/')
        ids = {f['code_fiche'] for f in response.data['results']}
        self.assertIn(self.fiche_a.code_fiche, ids)
        self.assertNotIn(self.fiche_b.code_fiche, ids)

    def test_enseignant_ne_peut_pas_creer_une_fiche_pour_un_collegue(self):
        response = self.client_a.post('/api/fiches-notes/', {
            'code_matiere':   self.mat_b.code_matiere,
            'code_classe':    self.classe_b.code_classe,
            'mle_ens':        self.ens_b.mle_ens,
            'code_periode':   self.periode.code_periode,
            'code_annee':     self.annee.code_annee,
            'code_type_eval': self.type_eval.code_type_eval,
            'date_evaluation': '2026-03-15',
        })
        self.assertEqual(response.status_code, 403)


class EnseignantSansCompteLieTest(EnseignantScopeTestBase):
    """Un compte ENSEIGNANT sans fiche Enseignant associée doit être refusé par défaut,
    jamais avoir un accès complet par accident."""

    def setUp(self):
        super().setUp()
        Utilisateur.objects.create(
            login='ens_orphelin', passwd=make_password('x'), role='ENSEIGNANT',
            etablissement=self.etab,
        )
        self.client_orphelin = APIClient()
        self.client_orphelin.force_authenticate(
            user=User.objects.create_user(username='ens_orphelin', password='x')
        )

    def test_compte_sans_enseignant_lie_ne_voit_rien(self):
        Examen.objects.create(
            lib_examen='CC Algo', code_matiere=self.mat_a, code_classe=self.classe_a,
            code_annee=self.annee, code_periode=self.periode, date_examen='2026-03-10 08:00:00',
            etablissement=self.etab,
        )
        response = self.client_orphelin.get('/api/examens/')
        self.assertEqual(response.data['results'], [])
