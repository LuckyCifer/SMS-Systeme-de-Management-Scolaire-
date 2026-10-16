"""
Accès aux données personnelles :
- les actions de détail (fiche élève, fiche enseignant, présences d'une séance) respectent
  l'école courante ;
- un enseignant ne voit / ne remplit que ses propres séances ;
- un compte ÉLÈVE ne voit que ses propres données, rien des données du personnel.
"""
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import (
    Absence, Annee, Classe, Enseignant, Etablissement, Etudiant, Evaluation, Inscription,
    Matiere, Module, Paiement, PaiementSalaire, Periode, Seance, TypeEvaluation, Utilisateur,
)
from api.urls import router


class SecuriteDonneesTest(TestCase):
    def setUp(self):
        self.a = Etablissement.objects.create(code_etab='AAA', lib_etab='A', type_etab='SECONDAIRE', actif=True)
        self.b = Etablissement.objects.create(code_etab='BBB', lib_etab='B', type_etab='SECONDAIRE', actif=True)
        self.annee = Annee.objects.create(code_annee='2025-2026', lib_annee='2025-2026')
        module = Module.objects.create(code_module='M', lib_module='M')
        self.maths = Matiere.objects.create(code_matiere='MATHS', lib_matiere='Maths', code_module=module)
        self.periode = Periode.objects.create(lib_periode='T1', code_annee=self.annee)
        self.devoir = TypeEvaluation.objects.create(lib_type_eval='Devoir', ponderation=100)

        self.classe_a = Classe.objects.create(code_classe='CA', lib_classe='6e A', etablissement=self.a)
        self.classe_b = Classe.objects.create(code_classe='CB', lib_classe='6e B', etablissement=self.b)
        self.ens1 = Enseignant.objects.create(mle_ens='E1', nom_ens='Un', etablissement=self.a)
        self.ens2 = Enseignant.objects.create(mle_ens='E2', nom_ens='Deux', etablissement=self.a)
        self.ens_b = Enseignant.objects.create(mle_ens='EB', nom_ens='B', etablissement=self.b)

        self.eleves = {}
        for mle, classe, etab in [('A1', self.classe_a, self.a), ('A2', self.classe_a, self.a), ('B1', self.classe_b, self.b)]:
            e = Etudiant.objects.create(mle_etudiant=mle, nom=mle, prenom='x', etablissement=etab)
            Inscription.objects.create(code_classe=classe, mle_etudiant=e, code_annee=self.annee, etablissement=etab)
            Evaluation.objects.create(mle_etudiant=e, code_matiere=self.maths, code_classe=classe,
                                      code_periode=self.periode, code_type_eval=self.devoir,
                                      note={'A1': 15, 'A2': 9, 'B1': 12}[mle], etablissement=etab)
            Paiement.objects.create(mle_etudiant=e, code_annee=self.annee, etablissement=etab)
            self.eleves[mle] = e
        PaiementSalaire.objects.create(mois_paie='2025-10-01', enseignant=self.ens1, etablissement=self.a)

        def seance(ens, classe, etab):
            return Seance.objects.create(code_matiere=self.maths, code_classe=classe, mle_ens=ens,
                                         code_annee=self.annee, date_seance='2025-10-06',
                                         h_debut='08:00', h_fin='10:00', etablissement=etab)
        self.seance_e1 = seance(self.ens1, self.classe_a, self.a)
        self.seance_e2 = seance(self.ens2, self.classe_a, self.a)
        self.seance_b = seance(self.ens_b, self.classe_b, self.b)
        Absence.objects.create(code_seance=self.seance_b, mle_etudiant=self.eleves['B1'], present=False)

        self.admin_a = self.client_pour('admin_a', 'ADMIN', self.a)

    def client_pour(self, login, role, etab):
        u = Utilisateur.objects.create(login=login, passwd=make_password('x'), role=role, etablissement=etab)
        c = APIClient()
        c.force_authenticate(user=User.objects.create_user(username=login, password='x'))
        c.utilisateur = u
        return c

    @staticmethod
    def lignes(r):
        return r.data['results'] if isinstance(r.data, dict) and 'results' in r.data else r.data

    # ── Actions de détail ─────────────────────────────────────────────────────
    def test_fiche_eleve_d_une_autre_ecole_introuvable(self):
        for action in ['absences', 'absences-stats', 'paiements', 'evaluations', 'inscriptions', 'decisions', 'tuteurs']:
            r = self.admin_a.get(f'/api/etudiants/B1/{action}/')
            self.assertEqual(r.status_code, 404, action)
        self.assertEqual(self.admin_a.get('/api/etudiants/A1/evaluations/').status_code, 200)

    def test_presences_d_une_seance_d_une_autre_ecole_introuvables(self):
        self.assertEqual(self.admin_a.get(f'/api/seances/{self.seance_b.pk}/presences/').status_code, 404)
        self.assertEqual(self.admin_a.get('/api/enseignants/EB/seances/').status_code, 404)
        self.assertEqual(self.admin_a.get('/api/enseignants/E1/planning/').status_code, 200)

    def test_pointage_limite_aux_eleves_de_la_classe(self):
        r = self.admin_a.post(f'/api/seances/{self.seance_e1.pk}/saisir-presences/', {'presences': [
            {'mle_etudiant': 'A1', 'present': True}, {'mle_etudiant': 'B1', 'present': False},
        ]}, format='json')
        self.assertEqual(r.data['updated'], 1)
        self.assertEqual([e['mle_etudiant'] for e in r.data['errors']], ['B1'])
        self.assertFalse(Absence.objects.filter(code_seance=self.seance_e1, mle_etudiant='B1').exists())

    # ── Enseignant ────────────────────────────────────────────────────────────
    def test_enseignant_ne_voit_que_ses_seances(self):
        ens = self.client_pour('ens1', 'ENSEIGNANT', self.a)
        self.ens1.utilisateur = ens.utilisateur
        self.ens1.save()
        r = ens.get('/api/seances/')
        self.assertEqual([s['code_seance'] for s in self.lignes(r)], [self.seance_e1.pk])
        r = ens.post(f'/api/seances/{self.seance_e2.pk}/saisir-presences/', {'presences': []}, format='json')
        self.assertEqual(r.status_code, 404)

    # ── Compte élève ──────────────────────────────────────────────────────────
    def test_eleve_ne_voit_que_ses_donnees(self):
        eleve = self.client_pour('compte_a1', 'ETUDIANT', self.a)
        self.eleves['A1'].utilisateur = eleve.utilisateur
        self.eleves['A1'].save()
        self.assertEqual([e['mle_etudiant'] for e in self.lignes(eleve.get('/api/evaluations/'))], ['A1'])
        self.assertEqual([e['mle_etudiant'] for e in self.lignes(eleve.get('/api/etudiants/'))], ['A1'])
        self.assertEqual([p['mle_etudiant'] for p in self.lignes(eleve.get('/api/paiements/'))], ['A1'])
        self.assertEqual(self.lignes(eleve.get('/api/paiements-salaires/')), [])
        self.assertEqual([u['login'] for u in self.lignes(eleve.get('/api/utilisateurs/'))], ['compte_a1'])
        self.assertEqual(eleve.get('/api/etudiants/A2/evaluations/').status_code, 404)
        # Moyennes : sa seule ligne, avec son rang dans la classe.
        r = eleve.get('/api/evaluations/moyennes/', {'code_classe': 'CA', 'code_periode': self.periode.pk})
        self.assertEqual([(l['mle_etudiant'], l['rang'], l['effectif']) for l in r.data], [('A1', 1, 2)])

    def test_eleve_sans_fiche_liee_ne_voit_rien(self):
        eleve = self.client_pour('orphelin', 'ETUDIANT', self.a)
        self.assertEqual(self.lignes(eleve.get('/api/evaluations/')), [])
        self.assertEqual(eleve.get('/api/evaluations/moyennes/', {'code_classe': 'CA', 'code_periode': self.periode.pk}).data, [])

    def test_chemins_vers_l_eleve_valides(self):
        for prefix, viewset, _ in router.registry:
            lookup = getattr(viewset, 'etudiant_lookup', None)
            if lookup:
                str(viewset.queryset.model.objects.filter(**{lookup: 'X'}).query)  # lève si le chemin est faux
