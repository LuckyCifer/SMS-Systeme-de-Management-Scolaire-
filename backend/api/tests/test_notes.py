"""
Tests de api/notes.py — calcul unique des moyennes, rangs, appréciations et délibérations :
coefficients (primaire/secondaire) vs crédits (supérieur), rangs ex-aequo, séquences du
secondaire, bilan annuel, appréciations A/ECA/NA du primaire, délibération par niveau.
"""
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.deduction_classes import deduire_niveau_serie
from api.models import (
    Annee, Classe, CoefficientMatiere, Cours, Decision, Departement, Etablissement, Etudiant,
    Evaluation, Matiere, Module, NiveauScolaire, Periode, TypeEvaluation, Utilisateur,
)
from api.notes import appreciation_depuis_note, generer_sequences


class NotesTestBase(TestCase):
    """Établissement d'un type donné, une classe, des matières et un compte ADMIN."""
    TYPE_ETAB = 'SECONDAIRE'

    def setUp(self):
        self.etab = Etablissement.objects.create(
            code_etab='ET1', lib_etab='Établissement test', type_etab=self.TYPE_ETAB, actif=True,
        )
        self.annee = Annee.objects.create(code_annee='2025-2026', lib_annee='2025-2026')
        self.t1 = Periode.objects.create(lib_periode='Trimestre 1', code_annee=self.annee, type_etab=self.TYPE_ETAB)
        self.t2 = Periode.objects.create(lib_periode='Trimestre 2', code_annee=self.annee, type_etab=self.TYPE_ETAB)
        self.dep = Departement.objects.create(code_dep='D1', lib_dep='Département 1')
        self.classe = Classe.objects.create(code_classe='C1', lib_classe='Classe 1', etablissement=self.etab)
        self.module = Module.objects.create(code_module='M1', lib_module='Module 1')
        self.maths = Matiere.objects.create(code_matiere='MATHS', lib_matiere='Mathématiques', code_module=self.module)
        self.fr = Matiere.objects.create(code_matiere='FR', lib_matiere='Français', code_module=self.module)
        self.devoir = TypeEvaluation.objects.create(lib_type_eval='Devoir', ponderation=100)
        self.eleves = {}

        Utilisateur.objects.create(login='admin_t', passwd=make_password('x'), role='ADMIN', etablissement=self.etab)
        self.client = APIClient()
        self.client.force_authenticate(user=User.objects.create_user(username='admin_t', password='x'))

    def eleve(self, mle, nom=None):
        if mle not in self.eleves:
            self.eleves[mle] = Etudiant.objects.create(
                mle_etudiant=mle, nom=nom or mle, prenom='X', code_dep=self.dep, etablissement=self.etab,
            )
        return self.eleves[mle]

    def note(self, mle, matiere, note, periode=None, type_eval=None):
        return Evaluation.objects.create(
            mle_etudiant=self.eleve(mle), code_matiere=matiere, code_classe=self.classe,
            code_periode=periode or self.t1, code_type_eval=type_eval or self.devoir,
            note=note, etablissement=self.etab, code_annee=self.annee,
        )

    def cours(self, matiere, **kwargs):
        return Cours.objects.create(code_matiere=matiere, code_classe=self.classe, semestre='S1',
                                    code_annee=self.annee, etablissement=self.etab, **kwargs)

    def moyennes(self, **params):
        response = self.client.get('/api/evaluations/moyennes/', {'code_classe': 'C1', **params})
        self.assertEqual(response.status_code, 200, response.data)
        return {r['mle_etudiant']: r for r in response.data}


class AppreciationDepuisNoteTest(TestCase):
    def test_bornes(self):
        cas = {0: 'NA', 9: 'NA', 9.99: 'NA', 10: 'ECA', 14: 'ECA', 14.99: 'ECA', 15: 'A', 20: 'A'}
        for note, attendu in cas.items():
            self.assertEqual(appreciation_depuis_note(note), attendu, note)
        self.assertIsNone(appreciation_depuis_note(None))


class PrimaireAppreciationAutomatiqueTest(NotesTestBase):
    TYPE_ETAB = 'PRIMAIRE'

    def test_note_primaire_recoit_son_appreciation(self):
        e = self.note('P1', self.maths, 12)
        self.assertEqual(e.appreciation, 'ECA')
        e.note = 16
        e.save()
        self.assertEqual(e.appreciation, 'A')

    def test_appreciation_saisie_est_recalculee_depuis_la_note(self):
        e = Evaluation.objects.create(
            mle_etudiant=self.eleve('P1'), code_matiere=self.maths, code_classe=self.classe,
            code_periode=self.t1, code_type_eval=self.devoir, note=8, appreciation='A',
            etablissement=self.etab,
        )
        self.assertEqual(e.appreciation, 'NA')

    def test_moyennes_primaire_avec_appreciations(self):
        self.note('P1', self.maths, 16)
        self.note('P1', self.fr, 10)
        r = self.moyennes(code_periode=self.t1.pk)['P1']
        par_matiere = {m['code_matiere']: m for m in r['matieres']}
        self.assertEqual(par_matiere['MATHS']['appreciation'], 'A')
        self.assertEqual(par_matiere['FR']['appreciation'], 'ECA')
        self.assertEqual(r['moyenne_generale'], 13.0)
        self.assertEqual(r['appreciation_generale'], 'ECA')
        self.assertEqual(r['rang'], 1)


class SecondaireSansAppreciationTest(NotesTestBase):
    def test_note_secondaire_sans_appreciation(self):
        self.assertIsNone(self.note('S1', self.maths, 12).appreciation)


class CoefficientsSecondaireTest(NotesTestBase):
    """Le coefficient vient de la grille : établissement, année, niveau, série, matière."""
    def setUp(self):
        super().setUp()
        self.premiere = NiveauScolaire.objects.create(code_niveau='1ERE_FR', lib_niveau='1ère', type_etab='SECONDAIRE')
        self.classe.niveau_scolaire, self.classe.serie = self.premiere, 'A'
        self.classe.save()

    def grille(self, matiere, coef, serie='A', annee=None):
        CoefficientMatiere.objects.create(
            etablissement=self.etab, code_annee=annee or self.annee, niveau_scolaire=self.premiere,
            serie=serie, code_matiere=matiere, coef=coef,
        )

    def test_moyenne_generale_ponderee_par_la_grille(self):
        self.grille(self.maths, 3)
        self.grille(self.fr, 1)
        self.note('S1', self.maths, 18)
        self.note('S1', self.fr, 10)
        r = self.moyennes(code_periode=self.t1.pk)['S1']
        # (18*3 + 10*1) / 4 = 16, et non 14 (moyenne simple)
        self.assertEqual(r['moyenne_generale'], 16.0)
        self.assertEqual(r['total_poids'], 4)
        self.assertEqual(r['mention'], 'Très Bien')
        self.assertFalse(any(m['poids_defaut'] for m in r['matieres']))

    def test_meme_matiere_coefficient_different_selon_la_serie(self):
        # Anglais : coef 3 en série A, coef 1 en série C.
        self.grille(self.fr, 3, serie='A')
        self.grille(self.fr, 1, serie='C')
        self.grille(self.maths, 1, serie='A')
        self.grille(self.maths, 3, serie='C')
        classe_c = Classe.objects.create(code_classe='C1C', lib_classe='1ère C', etablissement=self.etab,
                                         niveau_scolaire=self.premiere, serie='C')
        for classe in (self.classe, classe_c):
            for matiere, note in ((self.fr, 16), (self.maths, 8)):
                Evaluation.objects.create(
                    mle_etudiant=self.eleve(f'E_{classe.pk}'), code_matiere=matiere, code_classe=classe,
                    code_periode=self.t1, code_type_eval=self.devoir, note=note, etablissement=self.etab,
                )
        serie_a = self.moyennes(code_periode=self.t1.pk)[f'E_{self.classe.pk}']
        r = self.client.get('/api/evaluations/moyennes/', {'code_classe': 'C1C', 'code_periode': self.t1.pk})
        serie_c = r.data[0]
        self.assertEqual(serie_a['moyenne_generale'], 14.0)  # (16*3 + 8*1) / 4
        self.assertEqual(serie_c['moyenne_generale'], 10.0)  # (16*1 + 8*3) / 4

    def test_coefficient_absent_vaut_un_et_est_signale(self):
        self.grille(self.maths, 3)
        self.note('S1', self.maths, 18)
        self.note('S1', self.fr, 10)
        r = self.moyennes(code_periode=self.t1.pk)['S1']
        self.assertEqual(r['moyenne_generale'], 16.0)  # (18*3 + 10*1) / 4
        defauts = {m['code_matiere']: m['poids_defaut'] for m in r['matieres']}
        self.assertEqual(defauts, {'MATHS': False, 'FR': True})

    def test_la_grille_d_une_autre_annee_ne_compte_pas(self):
        autre = Annee.objects.create(code_annee='2026-2027', lib_annee='2026-2027')
        self.grille(self.maths, 5, annee=autre)
        self.note('S1', self.maths, 18)
        self.note('S1', self.fr, 10)
        self.assertEqual(self.moyennes(code_periode=self.t1.pk)['S1']['moyenne_generale'], 14.0)


class GrilleCoefficientsApiTest(NotesTestBase):
    def setUp(self):
        super().setUp()
        self.premiere = NiveauScolaire.objects.create(code_niveau='1ERE_FR', lib_niveau='1ère', type_etab='SECONDAIRE')
        self.classe.niveau_scolaire, self.classe.serie = self.premiere, 'A'
        self.classe.save()
        self.cours(self.maths)

    def enregistrer(self, lignes, **extra):
        return self.client.post('/api/coefficients/enregistrer-grille/', {
            'code_annee': self.annee.pk, 'niveau_scolaire': '1ERE_FR', 'lignes': lignes, **extra,
        }, format='json')

    def test_grille_propose_les_series_et_les_matieres_enseignees(self):
        r = self.client.get('/api/coefficients/grille/', {'code_annee': self.annee.pk, 'niveau_scolaire': '1ERE_FR'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['series'], ['A', 'C', 'D', 'E', 'TI'])
        self.assertEqual([m['code_matiere'] for m in r.data['matieres']], ['MATHS'])
        self.assertEqual(r.data['classes'][0]['serie'], 'A')

    def test_enregistrer_modifier_supprimer(self):
        r = self.enregistrer([{'code_matiere': 'MATHS', 'serie': 'A', 'coef': 4},
                              {'code_matiere': 'FR', 'serie': 'C', 'coef': 2}])
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['crees'], 2)
        r = self.enregistrer([{'code_matiere': 'MATHS', 'serie': 'A', 'coef': 5},
                              {'code_matiere': 'FR', 'serie': 'C', 'coef': ''}])
        self.assertEqual((r.data['modifies'], r.data['supprimes']), (1, 1))
        self.assertEqual(list(CoefficientMatiere.objects.values_list('code_matiere', 'serie', 'coef')), [('MATHS', 'A', 5)])
        self.assertEqual(CoefficientMatiere.objects.get().etablissement_id, 'ET1')

    def test_valeurs_invalides_refusees(self):
        self.assertEqual(self.enregistrer([{'code_matiere': 'MATHS', 'serie': 'A', 'coef': 0}]).status_code, 400)
        self.assertEqual(self.enregistrer([{'code_matiere': 'MATHS', 'serie': 'ARTS', 'coef': 2}]).status_code, 400)
        self.assertFalse(CoefficientMatiere.objects.exists())

    def test_copier_une_annee_sans_ecraser(self):
        cible = Annee.objects.create(code_annee='2026-2027', lib_annee='2026-2027')
        self.enregistrer([{'code_matiere': 'MATHS', 'serie': 'A', 'coef': 4},
                          {'code_matiere': 'FR', 'serie': 'A', 'coef': 2}])
        CoefficientMatiere.objects.create(etablissement=self.etab, code_annee=cible, niveau_scolaire=self.premiere,
                                          serie='A', code_matiere=self.maths, coef=6)
        r = self.client.post('/api/coefficients/copier/', {'source_annee': self.annee.pk, 'cible_annee': cible.pk}, format='json')
        self.assertEqual(r.data['copies'], 1)
        self.assertEqual(CoefficientMatiere.objects.get(code_annee=cible, code_matiere='MATHS').coef, 6)

    def test_enseignant_ne_peut_pas_modifier_la_grille(self):
        Utilisateur.objects.create(login='ens_g', passwd=make_password('x'), role='ENSEIGNANT', etablissement=self.etab)
        self.client.force_authenticate(user=User.objects.create_user(username='ens_g', password='x'))
        self.assertEqual(self.enregistrer([{'code_matiere': 'MATHS', 'serie': 'A', 'coef': 4}]).status_code, 403)

    def test_grille_isolee_par_etablissement(self):
        autre = Etablissement.objects.create(code_etab='ET2', lib_etab='Autre', type_etab='SECONDAIRE', actif=True)
        CoefficientMatiere.objects.create(etablissement=autre, code_annee=self.annee, niveau_scolaire=self.premiere,
                                          serie='A', code_matiere=self.maths, coef=9)
        r = self.client.get('/api/coefficients/', {'code_annee': self.annee.pk})
        self.assertEqual(r.data.get('count', len(r.data)), 0)


class GrilleSuperAdminTest(NotesTestBase):
    """La grille est celle de l'école courante : celle choisie par le SUPER_ADMIN (en-tête
    X-Etablissement-Id), toujours la sienne pour un autre rôle."""
    def setUp(self):
        super().setUp()
        self.premiere = NiveauScolaire.objects.create(code_niveau='1ERE_FR', lib_niveau='1ère', type_etab='SECONDAIRE')
        self.autre = Etablissement.objects.create(code_etab='ET2', lib_etab='Autre', type_etab='SECONDAIRE', actif=True)
        self.sup = Etablissement.objects.create(code_etab='UNIV', lib_etab='Université', type_etab='SUPERIEUR', actif=True)
        Utilisateur.objects.create(login='root_t', passwd=make_password('x'), role='SUPER_ADMIN')
        self.root = APIClient()
        self.root.force_authenticate(user=User.objects.create_user(username='root_t', password='x'))

    corps = property(lambda self: {'code_annee': self.annee.pk, 'niveau_scolaire': '1ERE_FR',
                                   'lignes': [{'code_matiere': 'MATHS', 'serie': 'A', 'coef': 4}]})

    def test_super_admin_ecrit_dans_l_ecole_courante(self):
        r = self.root.post('/api/coefficients/enregistrer-grille/', self.corps, format='json',
                           HTTP_X_ETABLISSEMENT_ID='ET2')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(CoefficientMatiere.objects.get().etablissement_id, 'ET2')

    def test_super_admin_connecte_au_superieur_refuse(self):
        r = self.root.post('/api/coefficients/enregistrer-grille/', self.corps, format='json',
                           HTTP_X_ETABLISSEMENT_ID='UNIV')
        self.assertEqual(r.status_code, 400)

    def test_admin_ne_peut_pas_viser_une_autre_ecole(self):
        r = self.client.post('/api/coefficients/enregistrer-grille/', self.corps, format='json',
                             HTTP_X_ETABLISSEMENT_ID='ET2')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(CoefficientMatiere.objects.get().etablissement_id, 'ET1')


class DeductionNiveauSerieTest(TestCase):
    def test_libelles(self):
        cas = {
            '1ère A4':        ('1ERE_FR', 'A'),
            'Terminale C':    ('TLE_FR', 'C'),
            'Tle TI':         ('TLE_FR', 'TI'),
            '2nde D':         ('2NDE_FR', 'D'),
            '6ème A':         ('6EME_FR', ''),   # 6ème / 5ème : lettre = groupe
            '5ème B':         ('5EME_FR', ''),
            '4ème Espagnol':  ('4EME_FR', 'ESPAGNOL'),
            '3ème All':       ('3EME_FR', 'ALLEMAND'),
            '4ème Latin':     ('4EME_FR', 'LATIN'),
            'Form 3':         ('F3_EN', ''),
            'Lower Sixth Science': ('LS_EN', 'SCIENCE'),
            'Upper Sixth Arts':    ('US_EN', 'ARTS'),
            'CM2 B':          ('CM2_FR', ''),
        }
        for libelle, attendu in cas.items():
            d = deduire_niveau_serie(libelle)
            self.assertEqual((d['niveau'], d['serie']), attendu, libelle)

    def test_cas_a_verifier(self):
        self.assertEqual(deduire_niveau_serie('Lower Sixth A')['remarque'], 'Série (Arts / Science) à compléter')
        self.assertEqual(deduire_niveau_serie('1ère Espagnol')['remarque'], 'Série à compléter')
        self.assertEqual(deduire_niveau_serie('3ème B')['remarque'], 'Troisième langue (série) à compléter')
        self.assertIsNone(deduire_niveau_serie('Petite Section A')['niveau'])


class CreditsSuperieurTest(NotesTestBase):
    TYPE_ETAB = 'SUPERIEUR'

    def test_superieur_utilise_les_credits(self):
        self.cours(self.maths, credits=6)
        self.cours(self.fr, credits=2)
        self.note('E1', self.maths, 12)
        self.note('E1', self.fr, 16)
        # (12*6 + 16*2) / 8 = 13
        self.assertEqual(self.moyennes(code_periode=self.t1.pk)['E1']['moyenne_generale'], 13.0)


class RangExAequoTest(NotesTestBase):
    def test_rang_olympique(self):
        for mle, n in [('A', 15), ('B', 15), ('C', 12), ('D', 11)]:
            self.note(mle, self.maths, n)
        res = self.moyennes(code_periode=self.t1.pk)
        self.assertEqual([res[m]['rang'] for m in 'ABCD'], [1, 1, 3, 4])
        self.assertTrue(res['A']['ex_aequo'])
        self.assertFalse(res['C']['ex_aequo'])
        self.assertEqual(res['A']['effectif'], 4)
        self.assertEqual(res['A']['moyenne_classe'], 13.25)

    def test_filtre_eleve_garde_le_rang_de_la_classe(self):
        for mle, n in [('A', 15), ('B', 12)]:
            self.note(mle, self.maths, n)
        res = self.moyennes(code_periode=self.t1.pk, mle_etudiant='B')
        self.assertEqual(list(res), ['B'])
        self.assertEqual(res['B']['rang'], 2)
        self.assertEqual(res['B']['effectif'], 2)


class SequencesEtBilanAnnuelTest(NotesTestBase):
    def test_moyenne_trimestre_egale_moyenne_des_sequences(self):
        seq1 = Periode.objects.create(lib_periode='Séquence 1', code_annee=self.annee, periode_parent=self.t1)
        seq2 = Periode.objects.create(lib_periode='Séquence 2', code_annee=self.annee, periode_parent=self.t1)
        self.note('S1', self.maths, 10, periode=seq1)
        self.note('S1', self.maths, 14, periode=seq2)
        self.assertEqual(self.moyennes(code_periode=self.t1.pk)['S1']['moyenne_generale'], 12.0)
        # Une séquence seule reste consultable.
        self.assertEqual(self.moyennes(code_periode=seq2.pk)['S1']['moyenne_generale'], 14.0)

    def test_bilan_annuel_moyenne_des_trimestres(self):
        self.note('S1', self.maths, 10, periode=self.t1)
        self.note('S1', self.maths, 16, periode=self.t2)
        self.assertEqual(self.moyennes(code_annee=self.annee.pk)['S1']['moyenne_generale'], 13.0)

    def test_bilan_annuel_note_sans_annee_prend_celle_de_sa_periode(self):
        self.note('S1', self.maths, 10, periode=self.t1)
        Evaluation.objects.update(code_annee=None)  # saisies historiques sans année
        self.assertEqual(self.moyennes(code_annee=self.annee.pk)['S1']['moyenne_generale'], 10.0)

    def test_generer_sequences(self):
        response = self.client.post('/api/periodes/generer-sequences/', {'code_annee': self.annee.pk}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['creees'], 4)  # 2 trimestres × 2 séquences
        self.assertEqual(
            list(self.t2.sous_periodes.order_by('lib_periode').values_list('lib_periode', flat=True)),
            ['Séquence 3', 'Séquence 4'],
        )
        self.assertEqual(generer_sequences(self.annee.pk), 0)  # idempotent

    def test_une_sequence_ne_peut_pas_contenir_de_sequence(self):
        seq1 = Periode.objects.create(lib_periode='Séquence 1', code_annee=self.annee, periode_parent=self.t1)
        response = self.client.post('/api/periodes/', {
            'lib_periode': 'Sous-séquence', 'code_annee': self.annee.pk, 'periode_parent': seq1.pk,
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('periode_parent', response.data)


class DeliberationSecondaireTest(NotesTestBase):
    def generer(self, **body):
        return self.client.post('/api/decisions/generer/', {
            'code_classe': 'C1', 'code_annee': self.annee.pk, **body,
        }, format='json')

    def test_admis_et_redoublants(self):
        self.note('A', self.maths, 14)
        self.note('B', self.maths, 8)
        response = self.generer()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['crees'], 2)
        a = Decision.objects.get(mle_etudiant='A')
        self.assertEqual((a.resultat, a.rang, a.effectif, a.mention), ('ADMIS', 1, 2, 'Bien'))
        self.assertEqual(Decision.objects.get(mle_etudiant='B').resultat, 'REDOUBLE')

    def test_seuil_personnalise_et_mise_a_jour(self):
        self.note('A', self.maths, 11)
        self.generer()
        Decision.objects.filter(mle_etudiant='A').update(president_jury='M. Ndzana')
        response = self.generer(seuil=12)
        self.assertEqual(response.data['mis_a_jour'], 1)
        a = Decision.objects.get(mle_etudiant='A')
        self.assertEqual(a.resultat, 'REDOUBLE')
        self.assertEqual(a.president_jury, 'M. Ndzana')  # saisie du jury conservée

    def test_enseignant_ne_peut_pas_deliberer(self):
        Utilisateur.objects.create(login='ens_t', passwd=make_password('x'), role='ENSEIGNANT', etablissement=self.etab)
        self.client.force_authenticate(user=User.objects.create_user(username='ens_t', password='x'))
        self.assertEqual(self.generer().status_code, 403)

    def test_classe_d_un_autre_etablissement_introuvable(self):
        autre = Etablissement.objects.create(code_etab='ET2', lib_etab='Autre', type_etab='SECONDAIRE', actif=True)
        Classe.objects.create(code_classe='C2', lib_classe='Classe 2', etablissement=autre)
        response = self.client.post('/api/decisions/generer/', {
            'code_classe': 'C2', 'code_annee': self.annee.pk,
        }, format='json')
        self.assertEqual(response.status_code, 404)


class DeliberationSuperieurTest(NotesTestBase):
    TYPE_ETAB = 'SUPERIEUR'

    def setUp(self):
        super().setUp()
        self.c_maths = self.cours(self.maths, credits=6)
        self.c_fr = self.cours(self.fr, credits=4)

    def generer(self, **body):
        return self.client.post('/api/decisions/generer/', {
            'code_classe': 'C1', 'code_annee': self.annee.pk, **body,
        }, format='json')

    def test_admis_par_compensation(self):
        self.note('E1', self.maths, 14)
        self.note('E1', self.fr, 8)  # (14*6 + 8*4) / 10 = 11.6
        self.generer()
        d = Decision.objects.get(mle_etudiant='E1')
        self.assertEqual((d.resultat, d.total_credits, d.credits_valides), ('ADMIS', 10, 10))
        self.assertEqual(d.observations, 'Admis par compensation.')

    def test_note_eliminatoire_bloque_la_compensation(self):
        self.c_fr.note_elim = 9
        self.c_fr.save()
        self.note('E1', self.maths, 14)
        self.note('E1', self.fr, 8)
        self.generer()
        d = Decision.objects.get(mle_etudiant='E1')
        self.assertEqual((d.resultat, d.credits_valides), ('AJOURNE', 6))

    def test_rattrapage_echoue_redouble(self):
        self.note('E1', self.maths, 6)
        self.note('E1', self.fr, 6)
        self.generer(session='RATTRAPAGE')
        self.assertEqual(Decision.objects.get(mle_etudiant='E1', session='RATTRAPAGE').resultat, 'REDOUBLE')


class FicheNotesJustesTest(NotesTestBase):
    """Barème converti sur 20, absent non justifié = 0, absent justifié = neutralisé."""
    def setUp(self):
        super().setUp()
        from api.models import Enseignant, FicheNotes
        ens = Enseignant.objects.create(mle_ens='ENS1', nom_ens='Ens', etablissement=self.etab)
        self.fiche = FicheNotes.objects.create(
            code_matiere=self.maths, code_classe=self.classe, mle_ens=ens, code_periode=self.t1,
            code_annee=self.annee, code_type_eval=self.devoir, date_evaluation='2025-10-06',
            bareme=10, etablissement=self.etab,
        )
        for mle in ('A', 'B', 'C'):
            self.eleve(mle)
            self.note(mle, self.fr, 12)

    def detail(self, mle, **kwargs):
        return self.client.post('/api/fiches-notes-detail/', {
            'code_fiche': self.fiche.pk, 'mle_etudiant': mle, **kwargs}, format='json')

    def test_import_convertit_et_distingue_les_absences(self):
        self.assertEqual(self.detail('A', note=8).status_code, 201)
        self.assertEqual(self.detail('B', absent=True).status_code, 201)
        self.assertEqual(self.detail('C', absent=True, justifie=True).status_code, 201)
        r = self.client.post(f'/api/fiches-notes/{self.fiche.pk}/importer/')
        self.assertEqual(r.data['imported'], 3)
        notes = {e.mle_etudiant_id: (e.note, e.dispense) for e in Evaluation.objects.filter(code_matiere=self.maths)}
        self.assertEqual(float(notes['A'][0]), 16.0)            # 8/10 → 16/20
        self.assertEqual((float(notes['B'][0]), notes['B'][1]), (0.0, False))
        self.assertEqual(notes['C'], (None, True))

        res = self.moyennes(code_periode=self.t1.pk)
        self.assertEqual(res['A']['moyenne_generale'], 14.0)    # (16 + 12) / 2
        self.assertEqual(res['B']['moyenne_generale'], 6.0)     # (0 + 12) / 2
        self.assertEqual(res['C']['moyenne_generale'], 12.0)    # maths neutralisées
        maths_c = next(m for m in res['C']['matieres'] if m['code_matiere'] == 'MATHS')
        self.assertTrue(maths_c['dispense'])

    def test_note_au_dela_du_bareme_refusee(self):
        r = self.detail('A', note=12)
        self.assertEqual(r.status_code, 400)
        self.assertIn('note', r.data)

    def test_bareme_nul_refuse(self):
        r = self.client.patch(f'/api/fiches-notes/{self.fiche.pk}/', {'bareme': 0}, format='json')
        self.assertEqual(r.status_code, 400)


class ClotureNotesTest(NotesTestBase):
    """Après clôture d'une période pour une classe, plus aucune note ne bouge."""
    def setUp(self):
        super().setUp()
        self.eval_a = self.note('A', self.maths, 12)

    def cloturer(self, periode=None):
        return self.client.post('/api/clotures-notes/', {
            'code_classe': 'C1', 'code_periode': (periode or self.t1).pk}, format='json')

    def corps(self, **kw):
        return {'mle_etudiant': self.eleve('B').pk, 'code_matiere': 'MATHS', 'code_classe': 'C1',
                'code_periode': self.t1.pk, 'code_type_eval': self.devoir.pk, 'note': 10, **kw}

    def test_toute_ecriture_refusee_apres_cloture(self):
        self.assertEqual(self.cloturer().status_code, 201)
        self.assertEqual(self.client.post('/api/evaluations/', self.corps(), format='json').status_code, 403)
        self.assertEqual(self.client.patch(f'/api/evaluations/{self.eval_a.pk}/', {'note': 18}, format='json').status_code, 403)
        self.assertEqual(self.client.delete(f'/api/evaluations/{self.eval_a.pk}/').status_code, 403)
        self.assertEqual(self.client.post('/api/evaluations/bulk-delete/', {'ids': [self.eval_a.pk]}, format='json').status_code, 403)
        self.eval_a.refresh_from_db()
        self.assertEqual(float(self.eval_a.note), 12.0)

    def test_sequence_d_un_trimestre_clos_verrouillee(self):
        seq = Periode.objects.create(lib_periode='Séquence 1', code_annee=self.annee, periode_parent=self.t1)
        self.cloturer()
        r = self.client.post('/api/evaluations/', self.corps(code_periode=seq.pk), format='json')
        self.assertEqual(r.status_code, 403)

    def test_reouverture_et_trace_des_modifications(self):
        self.cloturer()
        cloture = self.client.get('/api/clotures-notes/').data
        cloture = (cloture['results'] if isinstance(cloture, dict) else cloture)[0]
        self.assertEqual(cloture['cloturee_par'], 'admin_t')
        self.assertEqual(self.client.delete(f"/api/clotures-notes/{cloture['id']}/").status_code, 204)
        self.assertEqual(self.client.patch(f'/api/evaluations/{self.eval_a.pk}/', {'note': 15}, format='json').status_code, 200)
        from api.models import AuditLog
        self.assertTrue(AuditLog.objects.filter(modele='Evaluation', detail__contains='12.00 → 15').exists())

    def test_enseignant_ne_peut_pas_cloturer(self):
        Utilisateur.objects.create(login='ens_c', passwd=make_password('x'), role='ENSEIGNANT', etablissement=self.etab)
        self.client.force_authenticate(user=User.objects.create_user(username='ens_c', password='x'))
        self.assertEqual(self.cloturer().status_code, 403)


class CircuitFicheTest(NotesTestBase):
    """Brouillon → soumise (enseignant) → validée et reportée (censeur), saisie tout-ou-rien."""
    def setUp(self):
        super().setUp()
        from api.models import Enseignant, FicheNotes, Inscription
        self.prof = Utilisateur.objects.create(login='prof', passwd=make_password('x'), role='ENSEIGNANT', etablissement=self.etab)
        ens = Enseignant.objects.create(mle_ens='ENS1', nom_ens='Ens', etablissement=self.etab, utilisateur=self.prof)
        Cours.objects.create(code_matiere=self.maths, code_classe=self.classe, semestre='T1',
                             code_annee=self.annee, mle_ens=ens, etablissement=self.etab)
        for mle in ('A', 'B'):
            Inscription.objects.create(code_classe=self.classe, mle_etudiant=self.eleve(mle),
                                       code_annee=self.annee, etablissement=self.etab)
        self.ens_client = APIClient()
        self.ens_client.force_authenticate(user=User.objects.create_user(username='prof', password='x'))
        # Création par l'enseignant, sans année : déduite de la période.
        r = self.ens_client.post('/api/fiches-notes/', {
            'code_matiere': 'MATHS', 'code_classe': 'C1', 'mle_ens': 'ENS1', 'code_periode': self.t1.pk,
            'code_type_eval': self.devoir.pk, 'date_evaluation': '2025-10-06', 'bareme': 20,
        }, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['code_annee'], '2025-2026')
        self.fiche = FicheNotes.objects.get(pk=r.data['code_fiche'])

    def saisir(self, client, notes):
        return client.post(f'/api/fiches-notes/{self.fiche.pk}/saisir/', {'notes': notes}, format='json')

    def test_saisie_tout_ou_rien(self):
        r = self.saisir(self.ens_client, [{'mle_etudiant': 'A', 'note': 14}, {'mle_etudiant': 'B', 'note': 25}])
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.fiche.fichenotesdetail_set.count(), 0)
        r = self.saisir(self.ens_client, [{'mle_etudiant': 'A', 'note': 14}, {'mle_etudiant': 'B', 'absent': True}])
        self.assertEqual(r.data['enregistrees'], 2)

    def test_circuit_complet(self):
        self.saisir(self.ens_client, [{'mle_etudiant': 'A', 'note': 14}])
        self.assertEqual(self.ens_client.post(f'/api/fiches-notes/{self.fiche.pk}/soumettre/').data['statut'], 'SOUMIS')
        # Soumise : l'enseignant ne peut plus modifier ni valider lui-même.
        self.assertEqual(self.saisir(self.ens_client, [{'mle_etudiant': 'A', 'note': 20}]).status_code, 403)
        self.assertEqual(self.ens_client.post(f'/api/fiches-notes/{self.fiche.pk}/valider/').status_code, 403)
        # Le censeur / l'administration valide : notes reportées aussitôt.
        r = self.client.post(f'/api/fiches-notes/{self.fiche.pk}/valider/')
        self.assertEqual((r.data['statut'], r.data['imported']), ('VALIDE', 1))
        self.assertEqual(float(Evaluation.objects.get(mle_etudiant='A', code_matiere='MATHS').note), 14.0)
        self.assertEqual(self.saisir(self.client, [{'mle_etudiant': 'A', 'note': 16}]).status_code, 403)
        # Réouverture pour correction, puis revalidation.
        self.assertEqual(self.client.post(f'/api/fiches-notes/{self.fiche.pk}/rouvrir/').data['statut'], 'BROUILLON')
        self.saisir(self.ens_client, [{'mle_etudiant': 'A', 'note': 16}])
        self.client.post(f'/api/fiches-notes/{self.fiche.pk}/valider/')
        self.assertEqual(float(Evaluation.objects.get(mle_etudiant='A', code_matiere='MATHS').note), 16.0)
