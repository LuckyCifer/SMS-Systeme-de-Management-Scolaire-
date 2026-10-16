"""
Une seule école à la fois : chaque requête porte sur l'école courante (celle du compte, ou
celle choisie par le SUPER_ADMIN), et aucune donnée d'une autre école n'est visible ni
modifiable — y compris les données rattachées à l'école par une relation (détails de fiche
de notes…) et les tables qui n'avaient pas d'école avant la migration 0025 (pensions…).
"""
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import (
    Annee, AuditLog, Classe, Departement, Enseignant, Etablissement, Etudiant, FicheNotes,
    FicheNotesDetail, Matiere, Module, Pension, Periode, TypeEvaluation, Utilisateur,
)


class EcoleCouranteTest(TestCase):
    def setUp(self):
        self.a = Etablissement.objects.create(code_etab='AAA', lib_etab='École A', type_etab='SECONDAIRE', actif=True)
        self.b = Etablissement.objects.create(code_etab='BBB', lib_etab='École B', type_etab='PRIMAIRE', actif=True)
        dep = Departement.objects.create(code_dep='D', lib_dep='Dép')
        self.eleve_a = Etudiant.objects.create(mle_etudiant='EA', nom='A', prenom='x', code_dep=dep, etablissement=self.a)
        self.eleve_b = Etudiant.objects.create(mle_etudiant='EB', nom='B', prenom='x', code_dep=dep, etablissement=self.b)
        Pension.objects.create(code_pension=1, lib_pension='Pension A', etablissement=self.a)
        Pension.objects.create(code_pension=2, lib_pension='Pension B', etablissement=self.b)
        AuditLog.objects.create(utilisateur='x', action='CREATE', modele='M', objet_id='1', detail='', etablissement=self.a)
        AuditLog.objects.create(utilisateur='y', action='CREATE', modele='M', objet_id='2', detail='', etablissement=self.b)
        AuditLog.objects.create(utilisateur='inconnu', action='LOGIN_FAILED', modele='U', objet_id='3', detail='')

        # Fiche de notes de l'école B, avec un détail (modèle sans champ etablissement).
        annee = Annee.objects.create(code_annee='2025-2026', lib_annee='2025-2026')
        module = Module.objects.create(code_module='M', lib_module='M')
        matiere = Matiere.objects.create(code_matiere='MAT', lib_matiere='Maths', code_module=module)
        classe_b = Classe.objects.create(code_classe='CB', lib_classe='CM1', etablissement=self.b)
        ens_b = Enseignant.objects.create(mle_ens='ENB', nom_ens='Ens B', etablissement=self.b)
        self.fiche_b = FicheNotes.objects.create(
            code_matiere=matiere, code_classe=classe_b, mle_ens=ens_b, code_annee=annee,
            code_periode=Periode.objects.create(lib_periode='T1'),
            code_type_eval=TypeEvaluation.objects.create(lib_type_eval='Devoir'),
            date_evaluation='2025-10-01', etablissement=self.b,
        )
        FicheNotesDetail.objects.create(code_fiche=self.fiche_b, mle_etudiant=self.eleve_b, note=12)

        self.admin_a = self.client_pour('admin_a', 'ADMIN', self.a)
        self.root = self.client_pour('root', 'SUPER_ADMIN', None)

    def client_pour(self, login, role, etab):
        Utilisateur.objects.create(login=login, passwd=make_password('x'), role=role, etablissement=etab)
        c = APIClient()
        c.force_authenticate(user=User.objects.create_user(username=login, password='x'))
        return c

    @staticmethod
    def resultats(r):
        return r.data['results'] if isinstance(r.data, dict) and 'results' in r.data else r.data

    def test_admin_ne_voit_que_son_ecole_meme_avec_un_entete_falsifie(self):
        r = self.admin_a.get('/api/etudiants/', HTTP_X_ETABLISSEMENT_ID='BBB', HTTP_X_TYPE_ETAB='PRIMAIRE')
        self.assertEqual([e['mle_etudiant'] for e in self.resultats(r)], ['EA'])
        r = self.admin_a.get('/api/pensions/')
        self.assertEqual([p['lib_pension'] for p in self.resultats(r)], ['Pension A'])

    def test_donnee_par_relation_isolee(self):
        r = self.admin_a.get('/api/fiches-notes-detail/')
        self.assertEqual(self.resultats(r), [])
        Etudiant.objects.create(mle_etudiant='EB2', nom='B2', prenom='x', etablissement=self.b)
        r = self.admin_a.post('/api/fiches-notes-detail/', {
            'code_fiche': self.fiche_b.pk, 'mle_etudiant': 'EB2', 'note': 18,
        }, format='json')
        self.assertEqual(r.status_code, 403, r.data)
        self.assertEqual(FicheNotesDetail.objects.filter(note=18).count(), 0)

    def test_une_modification_ne_deplace_pas_la_donnee_vers_une_autre_ecole(self):
        r = self.admin_a.patch('/api/etudiants/EA/', {'etablissement': 'BBB', 'nom': 'Renommé'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        eleve = Etudiant.objects.get(pk='EA')
        self.assertEqual((eleve.etablissement_id, eleve.nom), ('AAA', 'Renommé'))

    def test_admin_ne_voit_que_son_etablissement(self):
        r = self.admin_a.get('/api/etablissements/')
        self.assertEqual([e['code_etab'] for e in self.resultats(r)], ['AAA'])

    def test_super_admin_voit_une_seule_ecole_a_la_fois(self):
        r = self.root.get('/api/etudiants/', HTTP_X_ETABLISSEMENT_ID='BBB')
        self.assertEqual([e['mle_etudiant'] for e in self.resultats(r)], ['EB'])
        # Sans école choisie : la première école active, jamais toutes les écoles.
        r = self.root.get('/api/etudiants/')
        self.assertEqual([e['mle_etudiant'] for e in self.resultats(r)], ['EA'])
        # L'ancien en-tête « type » n'ouvre plus une vue multi-écoles.
        r = self.root.get('/api/etudiants/', HTTP_X_TYPE_ETAB='PRIMAIRE')
        self.assertEqual([e['mle_etudiant'] for e in self.resultats(r)], ['EA'])
        r = self.root.get('/api/etablissements/current/', HTTP_X_ETABLISSEMENT_ID='BBB')
        self.assertEqual((r.data['code_etab'], r.data['type_etab']), ('BBB', 'PRIMAIRE'))

    def test_journal_d_audit_par_ecole(self):
        r = self.admin_a.get('/api/audit/')
        self.assertEqual([l['objet_id'] for l in self.resultats(r)], ['1'])
        # Le SUPER_ADMIN voit aussi les traces sans école (connexions échouées…).
        r = self.root.get('/api/audit/', HTTP_X_ETABLISSEMENT_ID='BBB')
        self.assertEqual(sorted(l['objet_id'] for l in self.resultats(r)), ['2', '3'])

    def test_les_nouvelles_traces_portent_l_ecole_courante(self):
        r = self.root.post('/api/pensions/', {'code_pension': 99, 'lib_pension': 'Nouvelle'}, format='json', HTTP_X_ETABLISSEMENT_ID='BBB')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Pension.objects.get(lib_pension='Nouvelle').etablissement_id, 'BBB')
        self.assertEqual(AuditLog.objects.filter(modele='Pension').latest('id').etablissement_id, 'BBB')
