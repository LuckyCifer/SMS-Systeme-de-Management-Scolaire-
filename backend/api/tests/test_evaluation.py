"""
Tests de la moyenne pondérée par type d'évaluation (voir api/utils.moyenne_ponderee et
l'action EvaluationViewSet.moyennes) — ex. Contrôle continu 30% + Session normale 70%.
"""
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from django.core.exceptions import ValidationError

from api.models import (
    Annee, Classe, Cours, Departement, Enseignant, Etablissement, Etudiant, Evaluation,
    FicheNotes, FicheNotesDetail, Matiere, Module, Periode, TypeEvaluation, Utilisateur,
)
from api.utils import moyenne_ponderee


class MoyennePondereeUtilTest(TestCase):
    def setUp(self):
        self.periode = Periode.objects.create(lib_periode='Semestre 1')
        self.dep = Departement.objects.create(code_dep='GI', lib_dep='Génie Informatique')
        self.classe = Classe.objects.create(code_classe='L1GI', lib_classe='L1 Génie Informatique')
        self.module = Module.objects.create(code_module='MOD1', lib_module='Module 1')
        self.matiere = Matiere.objects.create(
            code_matiere='ALGO', lib_matiere='Algorithmique', code_module=self.module,
        )
        self.etudiant = Etudiant.objects.create(
            mle_etudiant='ETU020', nom='Biya', prenom='Junior', code_dep=self.dep,
        )
        self.cc = TypeEvaluation.objects.create(lib_type_eval='Contrôle continu', ponderation=30)
        self.sn = TypeEvaluation.objects.create(lib_type_eval='Session normale', ponderation=70)

    def _eval(self, type_eval, note):
        return Evaluation.objects.create(
            mle_etudiant=self.etudiant, code_matiere=self.matiere, code_classe=self.classe,
            code_periode=self.periode, code_type_eval=type_eval, note=note,
        )

    def test_moyenne_ponderee_avec_deux_types(self):
        evals = [self._eval(self.cc, 12), self._eval(self.sn, 16)]
        # 12*0.30 + 16*0.70 = 3.6 + 11.2 = 14.8
        self.assertEqual(moyenne_ponderee(evals), 14.8)

    def test_moyenne_ponderee_plusieurs_notes_meme_type(self):
        # Deux devoirs de contrôle continu : moyennés d'abord entre eux (10+14)/2=12, puis pondérés.
        evals = [self._eval(self.cc, 10), self._eval(self.cc, 14), self._eval(self.sn, 16)]
        self.assertEqual(moyenne_ponderee(evals), 14.8)

    def test_moyenne_ponderee_prorata_si_type_manquant(self):
        # Seule la session normale a été saisie : la moyenne doit rester 16, pas 16*0.70.
        evals = [self._eval(self.sn, 16)]
        self.assertEqual(moyenne_ponderee(evals), 16.0)

    def test_moyenne_ponderee_repli_sans_ponderation_configuree(self):
        type_sans_poids = TypeEvaluation.objects.create(lib_type_eval='Devoir libre')
        evals = [
            self._eval(type_sans_poids, 10),
            self._eval(type_sans_poids, 14),
        ]
        self.assertEqual(moyenne_ponderee(evals), 12.0)

    def test_moyenne_ponderee_liste_vide(self):
        self.assertIsNone(moyenne_ponderee([]))

    def test_rattrapage_remplace_session_normale(self):
        rattrapage = TypeEvaluation.objects.create(
            lib_type_eval='Rattrapage', remplace=self.sn,
        )
        # CC=12 (30%), SN=8 (70%) initialement, puis rattrapage=15 remplace la note de SN.
        evals = [self._eval(self.cc, 12), self._eval(self.sn, 8), self._eval(rattrapage, 15)]
        # 12*0.30 + 15*0.70 = 3.6 + 10.5 = 14.1 (la pondération de SN s'applique à la note du rattrapage)
        self.assertEqual(moyenne_ponderee(evals), 14.1)

    def test_rattrapage_sans_session_normale_ne_remplace_rien(self):
        rattrapage = TypeEvaluation.objects.create(
            lib_type_eval='Rattrapage', remplace=self.sn, ponderation=70,
        )
        # Pas de note de session normale dans ce groupe : le rattrapage compte pour lui-même.
        evals = [self._eval(self.cc, 12), self._eval(rattrapage, 15)]
        # 12*0.30 + 15*0.70 = 14.1 (même résultat ici, mais via le type rattrapage lui-même)
        self.assertEqual(moyenne_ponderee(evals), 14.1)


class EvaluationMoyennesEndpointTest(TestCase):
    def setUp(self):
        self.etab = Etablissement.objects.create(code_etab='ETABA', lib_etab='École A', actif=True)
        self.periode = Periode.objects.create(lib_periode='Semestre 1')
        self.dep = Departement.objects.create(code_dep='GI', lib_dep='Génie Informatique')
        self.classe = Classe.objects.create(code_classe='L1GI', lib_classe='L1 Génie Informatique')
        self.module = Module.objects.create(code_module='MOD1', lib_module='Module 1')
        self.matiere = Matiere.objects.create(
            code_matiere='ALGO', lib_matiere='Algorithmique', code_module=self.module,
        )
        self.etudiant = Etudiant.objects.create(
            mle_etudiant='ETU021', nom='Fotso', prenom='Aline', code_dep=self.dep,
            etablissement=self.etab,
        )
        self.cc = TypeEvaluation.objects.create(lib_type_eval='Contrôle continu', ponderation=30)
        self.sn = TypeEvaluation.objects.create(lib_type_eval='Session normale', ponderation=70)
        for type_eval, note in [(self.cc, 12), (self.sn, 16)]:
            Evaluation.objects.create(
                mle_etudiant=self.etudiant, code_matiere=self.matiere, code_classe=self.classe,
                code_periode=self.periode, code_type_eval=type_eval, note=note,
                etablissement=self.etab,
            )

        # ADMIN plutôt qu'ENSEIGNANT : ce test vérifie le calcul de moyenne pondérée, pas le
        # scoping enseignant (voir test_enseignant_scope.py) — un compte ENSEIGNANT sans fiche
        # Enseignant/Cours associée serait désormais restreint à un résultat vide, hors sujet ici.
        Utilisateur.objects.create(
            login='admin_a', passwd=make_password('x'), role='ADMIN', etablissement=self.etab,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=User.objects.create_user(username='admin_a', password='x'))

    def test_moyennes_endpoint_requires_query_params(self):
        response = self.client.get('/api/evaluations/moyennes/')
        self.assertEqual(response.status_code, 400)

    def test_moyennes_endpoint_returns_weighted_average(self):
        response = self.client.get('/api/evaluations/moyennes/', {
            'code_classe': self.classe.code_classe, 'code_periode': self.periode.code_periode,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        etud = response.data[0]
        self.assertEqual(etud['mle_etudiant'], 'ETU021')
        self.assertEqual(etud['moyenne_generale'], 14.8)
        self.assertEqual(etud['matieres'][0]['moyenne'], 14.8)


class MoyenneGeneralePondereeParCreditsTest(TestCase):
    """
    Régression : une matière non composée par un étudiant doit compter pour 0 dans ses
    crédits (Cours.credits), pas disparaître du calcul — sinon ne pas composer une
    matière avantage artificiellement la moyenne générale au lieu de la pénaliser
    (repéré sur le relevé de notes d'une classe réelle : des étudiants ayant "—" sur une
    matière se retrouvaient avec une moyenne générale supérieure à celle qu'ils auraient
    eue en la composant et en la ratant).
    """
    def setUp(self):
        self.etab   = Etablissement.objects.create(code_etab='ETABC', lib_etab='École C', actif=True)
        self.annee  = Annee.objects.create(code_annee='2025-2026', lib_annee='2025-2026')
        self.periode = Periode.objects.create(lib_periode='Semestre 1', code_annee=self.annee)
        self.dep    = Departement.objects.create(code_dep='GI', lib_dep='Génie Informatique')
        self.classe = Classe.objects.create(code_classe='L1GI2', lib_classe='L1 GI', etablissement=self.etab)
        self.module = Module.objects.create(code_module='MOD2', lib_module='Module 2')
        self.mat1 = Matiere.objects.create(code_matiere='MAT1', lib_matiere='Matière 1', code_module=self.module)
        self.mat2 = Matiere.objects.create(code_matiere='MAT2', lib_matiere='Matière 2', code_module=self.module)
        # Matière 2 pèse deux fois plus lourd que Matière 1 dans la moyenne générale.
        Cours.objects.create(
            code_matiere=self.mat1, code_classe=self.classe, semestre='S1',
            code_annee=self.annee, credits=2,
        )
        Cours.objects.create(
            code_matiere=self.mat2, code_classe=self.classe, semestre='S1',
            code_annee=self.annee, credits=4,
        )
        self.type_eval = TypeEvaluation.objects.create(lib_type_eval='Devoir', ponderation=100)

        self.complet = Etudiant.objects.create(
            mle_etudiant='ETU_COMPLET', nom='Complet', prenom='Eve', code_dep=self.dep, etablissement=self.etab,
        )
        self.absent = Etudiant.objects.create(
            mle_etudiant='ETU_ABSENT', nom='Absent', prenom='Adam', code_dep=self.dep, etablissement=self.etab,
        )
        for etu in (self.complet, self.absent):
            Evaluation.objects.create(
                mle_etudiant=etu, code_matiere=self.mat1, code_classe=self.classe,
                code_periode=self.periode, code_type_eval=self.type_eval, note=16, etablissement=self.etab,
            )
        # Seul `complet` a composé la matière 2 (la plus lourde) — `absent` ne l'a pas composée.
        Evaluation.objects.create(
            mle_etudiant=self.complet, code_matiere=self.mat2, code_classe=self.classe,
            code_periode=self.periode, code_type_eval=self.type_eval, note=16, etablissement=self.etab,
        )

        Utilisateur.objects.create(login='admin_c', passwd=make_password('x'), role='ADMIN', etablissement=self.etab)
        self.client = APIClient()
        self.client.force_authenticate(user=User.objects.create_user(username='admin_c', password='x'))

    def test_matiere_non_composee_compte_pour_zero_dans_les_credits(self):
        response = self.client.get('/api/evaluations/moyennes/', {
            'code_classe': self.classe.code_classe, 'code_periode': self.periode.code_periode,
        })
        self.assertEqual(response.status_code, 200)
        par_etudiant = {r['mle_etudiant']: r for r in response.data}

        # A composé les deux matières à 16/20 chacune -> moyenne générale = 16, quels que
        # soient les crédits (16*2 + 16*4) / (2+4) = 16.
        self.assertEqual(par_etudiant['ETU_COMPLET']['moyenne_generale'], 16.0)

        # N'a composé que la matière 1 (2 crédits) à 16/20 ; la matière 2 (4 crédits) compte
        # pour 0 au lieu d'être ignorée : (16*2 + 0*4) / (2+4) = 5.33, PAS 16.0.
        self.assertEqual(par_etudiant['ETU_ABSENT']['moyenne_generale'], 5.33)

    def test_etudiant_sans_aucune_note_composee_reste_inavantage(self):
        # Un 3e étudiant qui n'a composé qu'une matière à une note bien inférieure ne doit
        # jamais dépasser un étudiant complet grâce à l'absence sur l'autre matière.
        troisieme = Etudiant.objects.create(
            mle_etudiant='ETU_FAIBLE', nom='Faible', prenom='Zoe', code_dep=self.dep, etablissement=self.etab,
        )
        Evaluation.objects.create(
            mle_etudiant=troisieme, code_matiere=self.mat1, code_classe=self.classe,
            code_periode=self.periode, code_type_eval=self.type_eval, note=10, etablissement=self.etab,
        )
        response = self.client.get('/api/evaluations/moyennes/', {
            'code_classe': self.classe.code_classe, 'code_periode': self.periode.code_periode,
        })
        par_etudiant = {r['mle_etudiant']: r for r in response.data}
        # (10*2 + 0*4) / 6 = 3.33 : nettement pénalisé par la matière non composée, jamais
        # avantagé par rapport à ETU_COMPLET (16.0).
        self.assertEqual(par_etudiant['ETU_FAIBLE']['moyenne_generale'], 3.33)
        self.assertLess(par_etudiant['ETU_FAIBLE']['moyenne_generale'], par_etudiant['ETU_COMPLET']['moyenne_generale'])


class AppreciationCompetencesTest(TestCase):
    """
    Évaluation par compétences (primaire réformé) : une Evaluation porte soit une note /20,
    soit une appréciation A/ECA/NA — jamais les deux, jamais aucune des deux (clean()).
    """
    def setUp(self):
        self.periode = Periode.objects.create(lib_periode='Trimestre 1')
        self.dep = Departement.objects.create(code_dep='PRI', lib_dep='Primaire')
        self.classe = Classe.objects.create(code_classe='CE1A', lib_classe='CE1 A')
        self.module = Module.objects.create(code_module='MODP', lib_module='Module Primaire')
        self.matiere = Matiere.objects.create(
            code_matiere='LECT', lib_matiere='Lecture', code_module=self.module,
        )
        self.etudiant = Etudiant.objects.create(
            mle_etudiant='ETU030', nom='Mballa', prenom='Ines', code_dep=self.dep,
        )
        self.type_eval = TypeEvaluation.objects.create(lib_type_eval='Séquence 1', ponderation=100)

    def test_note_seule_valide(self):
        e = Evaluation(
            mle_etudiant=self.etudiant, code_matiere=self.matiere, code_classe=self.classe,
            code_periode=self.periode, code_type_eval=self.type_eval, note=14,
        )
        e.full_clean()  # ne doit pas lever

    def test_appreciation_seule_valide(self):
        e = Evaluation(
            mle_etudiant=self.etudiant, code_matiere=self.matiere, code_classe=self.classe,
            code_periode=self.periode, code_type_eval=self.type_eval, appreciation='ECA',
        )
        e.full_clean()  # ne doit pas lever

    def test_ni_note_ni_appreciation_refuse(self):
        e = Evaluation(
            mle_etudiant=self.etudiant, code_matiere=self.matiere, code_classe=self.classe,
            code_periode=self.periode, code_type_eval=self.type_eval,
        )
        with self.assertRaises(ValidationError):
            e.full_clean()

    def test_note_et_appreciation_a_la_fois_refuse(self):
        e = Evaluation(
            mle_etudiant=self.etudiant, code_matiere=self.matiere, code_classe=self.classe,
            code_periode=self.periode, code_type_eval=self.type_eval, note=14, appreciation='A',
        )
        with self.assertRaises(ValidationError):
            e.full_clean()

    def test_moyenne_ponderee_ignore_les_appreciations(self):
        # Une évaluation par appréciation ne doit pas polluer le calcul de moyenne numérique.
        avec_note = Evaluation.objects.create(
            mle_etudiant=self.etudiant, code_matiere=self.matiere, code_classe=self.classe,
            code_periode=self.periode, code_type_eval=self.type_eval, note=16,
        )
        # Même groupe (mêmes clés), autre matière pour éviter la contrainte unique_together
        autre_matiere = Matiere.objects.create(
            code_matiere='CALC', lib_matiere='Calcul', code_module=self.module,
        )
        avec_appreciation = Evaluation.objects.create(
            mle_etudiant=self.etudiant, code_matiere=autre_matiere, code_classe=self.classe,
            code_periode=self.periode, code_type_eval=self.type_eval, appreciation='A',
        )
        self.assertEqual(moyenne_ponderee([avec_note, avec_appreciation]), 16.0)


class FicheNotesImportAppreciationTest(TestCase):
    """L'import d'une fiche de notes primaire (appréciations) vers Evaluation."""
    def setUp(self):
        self.etab = Etablissement.objects.create(
            code_etab='EPRIA', lib_etab='École Primaire A', type_etab='PRIMAIRE', actif=True,
        )
        self.annee = Annee.objects.create(code_annee='2025-2026', lib_annee='2025-2026')
        self.periode = Periode.objects.create(lib_periode='Trimestre 1')
        self.dep = Departement.objects.create(code_dep='PRI', lib_dep='Primaire')
        self.classe = Classe.objects.create(code_classe='CE1B', lib_classe='CE1 B', etablissement=self.etab)
        self.module = Module.objects.create(code_module='MODP2', lib_module='Module Primaire 2')
        self.matiere = Matiere.objects.create(
            code_matiere='ECRIT', lib_matiere='Écriture', code_module=self.module,
        )
        self.ens = Enseignant.objects.create(mle_ens='ENS_P1', nom_ens='Ngo', etablissement=self.etab)
        self.type_eval = TypeEvaluation.objects.create(lib_type_eval='Séquence 1', ponderation=100)
        self.etudiant = Etudiant.objects.create(
            mle_etudiant='ETU031', nom='Owona', prenom='Paul', code_dep=self.dep, etablissement=self.etab,
        )
        self.fiche = FicheNotes.objects.create(
            code_matiere=self.matiere, code_classe=self.classe, mle_ens=self.ens,
            code_periode=self.periode, code_annee=self.annee, code_type_eval=self.type_eval,
            date_evaluation='2025-10-01', etablissement=self.etab,
        )
        FicheNotesDetail.objects.create(
            code_fiche=self.fiche, mle_etudiant=self.etudiant, appreciation='ECA',
        )

        Utilisateur.objects.create(login='dir_pria', passwd=make_password('x'), role='ADMIN', etablissement=self.etab)
        self.client = APIClient()
        self.client.force_authenticate(user=User.objects.create_user(username='dir_pria', password='x'))

    def test_import_copie_appreciation(self):
        response = self.client.post(f'/api/fiches-notes/{self.fiche.code_fiche}/importer/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['imported'], 1)
        evaluation = Evaluation.objects.get(
            mle_etudiant=self.etudiant, code_matiere=self.matiere, code_classe=self.classe,
            code_periode=self.periode, code_type_eval=self.type_eval,
        )
        self.assertEqual(evaluation.appreciation, 'ECA')
        self.assertIsNone(evaluation.note)

    def test_export_csv_affiche_appreciation(self):
        Evaluation.objects.create(
            mle_etudiant=self.etudiant, code_matiere=self.matiere, code_classe=self.classe,
            code_periode=self.periode, code_type_eval=self.type_eval, appreciation='ECA',
            etablissement=self.etab,
        )
        response = self.client.get('/api/evaluations/export-csv/')
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8-sig')
        self.assertIn('Appréciation', content)
        self.assertIn("En cours d'acquisition", content)

    def test_moyennes_endpoint_expose_appreciation(self):
        # Import de la fiche : crée l'Evaluation appreciation='ECA' correspondante.
        self.client.post(f'/api/fiches-notes/{self.fiche.code_fiche}/importer/')
        response = self.client.get('/api/evaluations/moyennes/', {
            'code_classe': self.classe.code_classe, 'code_periode': self.periode.code_periode,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        matiere = response.data[0]['matieres'][0]
        self.assertIsNone(matiere['moyenne'])
        self.assertEqual(matiere['appreciation'], 'ECA')
