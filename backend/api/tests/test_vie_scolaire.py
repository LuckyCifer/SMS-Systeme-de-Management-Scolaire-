"""
Vie scolaire : appel journalier (présent par défaut, tout ou rien), retards, vue du jour du
surveillant général, justification (non effacée par un nouvel appel), alertes de seuil.
"""
import datetime

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import (
    Absence, Annee, AppelLigne, Classe, Cours, Enseignant, Etablissement, Etudiant, Inscription,
    Matiere, Module, Seance, Utilisateur,
)

AUJOURDHUI = datetime.date.today().isoformat()


class VieScolaireTest(TestCase):
    def setUp(self):
        self.etab = Etablissement.objects.create(code_etab='EP', lib_etab='École', type_etab='PRIMAIRE', actif=True)
        self.annee = Annee.objects.create(code_annee='2025-2026', lib_annee='2025-2026', statut='EN COURS')
        self.classe = Classe.objects.create(code_classe='CM2', lib_classe='CM2 A', etablissement=self.etab)
        self.autre_classe = Classe.objects.create(code_classe='CE1', lib_classe='CE1 A', etablissement=self.etab)
        module = Module.objects.create(code_module='M', lib_module='M')
        self.maths = Matiere.objects.create(code_matiere='MATHS', lib_matiere='Maths', code_module=module)
        for mle, nom in [('E1', 'Abena'), ('E2', 'Bella'), ('E3', 'Ciza')]:
            e = Etudiant.objects.create(mle_etudiant=mle, nom=nom, prenom='x', etablissement=self.etab)
            Inscription.objects.create(code_classe=self.classe, mle_etudiant=e, code_annee=self.annee, etablissement=self.etab)
        Etudiant.objects.create(mle_etudiant='X9', nom='Autre', prenom='x', etablissement=self.etab)

        self.maitre_compte = Utilisateur.objects.create(login='maitre', passwd=make_password('x'), role='ENSEIGNANT', etablissement=self.etab)
        self.maitre = Enseignant.objects.create(mle_ens='M1', nom_ens='Maître', etablissement=self.etab, utilisateur=self.maitre_compte)
        Cours.objects.create(code_matiere=self.maths, code_classe=self.classe, semestre='T1',
                             code_annee=self.annee, mle_ens=self.maitre, etablissement=self.etab)
        self.seance = Seance.objects.create(code_matiere=self.maths, code_classe=self.classe, mle_ens=self.maitre,
                                            code_annee=self.annee, date_seance=AUJOURDHUI,
                                            h_debut='08:00', h_fin='10:00', etablissement=self.etab)
        self.sg = self.client_pour('sg', 'SURVEILLANT_GENERAL')
        self.maitre_client = APIClient()
        self.maitre_client.force_authenticate(user=User.objects.create_user(username='maitre', password='x'))

    def client_pour(self, login, role):
        Utilisateur.objects.create(login=login, passwd=make_password('x'), role=role, etablissement=self.etab)
        c = APIClient()
        c.force_authenticate(user=User.objects.create_user(username=login, password='x'))
        return c

    def appel(self, client, lignes, classe='CM2'):
        return client.post('/api/appels/enregistrer/', {
            'code_classe': classe, 'date': AUJOURDHUI, 'creneau': 'MATIN', 'lignes': lignes}, format='json')

    def test_feuille_presente_par_defaut_puis_enregistree(self):
        r = self.maitre_client.get('/api/appels/feuille/', {'code_classe': 'CM2', 'date': AUJOURDHUI})
        self.assertEqual([(e['mle_etudiant'], e['statut']) for e in r.data['eleves']],
                         [('E1', 'PRESENT'), ('E2', 'PRESENT'), ('E3', 'PRESENT')])
        r = self.appel(self.maitre_client, [{'mle_etudiant': 'E1', 'statut': 'PRESENT'},
                                            {'mle_etudiant': 'E2', 'statut': 'ABSENT'},
                                            {'mle_etudiant': 'E3', 'statut': 'RETARD', 'minutes_retard': 15}])
        self.assertEqual(r.data['absents'], 1)
        r = self.maitre_client.get('/api/appels/feuille/', {'code_classe': 'CM2', 'date': AUJOURDHUI})
        self.assertEqual([(e['statut'], e['minutes_retard']) for e in r.data['eleves']],
                         [('PRESENT', 0), ('ABSENT', 0), ('RETARD', 15)])

    def test_appel_tout_ou_rien_et_classes_du_maitre(self):
        r = self.appel(self.maitre_client, [{'mle_etudiant': 'E1', 'statut': 'ABSENT'}, {'mle_etudiant': 'X9', 'statut': 'ABSENT'}])
        self.assertEqual(r.status_code, 400)
        self.assertFalse(AppelLigne.objects.exists())
        self.assertEqual(self.appel(self.maitre_client, [], classe='CE1').status_code, 403)

    def test_vue_du_jour_et_justification(self):
        self.appel(self.maitre_client, [{'mle_etudiant': 'E2', 'statut': 'ABSENT'}])
        self.maitre_client.post(f'/api/seances/{self.seance.pk}/saisir-presences/', {'presences': [
            {'mle_etudiant': 'E1', 'present': True, 'retard_minutes': 10},
            {'mle_etudiant': 'E3', 'present': False}]}, format='json')
        r = self.sg.get('/api/vie-scolaire/jour/', {'date': AUJOURDHUI})
        vus = sorted((l['source'], l['mle_etudiant'], l['type']) for l in r.data['lignes'])
        self.assertEqual(vus, [('APPEL', 'E2', 'ABSENCE'), ('SEANCE', 'E1', 'RETARD'), ('SEANCE', 'E3', 'ABSENCE')])
        absence = next(l for l in r.data['lignes'] if l['mle_etudiant'] == 'E3')
        r = self.sg.post('/api/vie-scolaire/justifier/', {'source': 'SEANCE', 'id': absence['id'],
                                                         'justifiee': True, 'motif': 'Certificat médical'}, format='json')
        self.assertEqual(r.status_code, 200)
        # Un nouvel enregistrement de l'appel par l'enseignant n'efface pas la justification.
        self.maitre_client.post(f'/api/seances/{self.seance.pk}/saisir-presences/', {'presences': [
            {'mle_etudiant': 'E3', 'present': False}]}, format='json')
        a = Absence.objects.get(code_seance=self.seance, mle_etudiant='E3')
        self.assertEqual((a.justifiee, a.motif), (True, 'Certificat médical'))
        self.assertEqual(self.maitre_client.get('/api/vie-scolaire/jour/').status_code, 403)

    def test_alertes_de_seuil(self):
        for i in range(6):  # 6 séances de 2 h manquées sans justification = 12 h
            s = Seance.objects.create(code_matiere=self.maths, code_classe=self.classe, mle_ens=self.maitre,
                                      code_annee=self.annee, date_seance=AUJOURDHUI,
                                      h_debut=f'{8 + i}:00', h_fin=f'{10 + i}:00', etablissement=self.etab)
            Absence.objects.create(code_seance=s, mle_etudiant_id='E1', present=False)
        self.appel(self.maitre_client, [{'mle_etudiant': 'E2', 'statut': 'ABSENT'}])  # 1 demi-journée = 4 h
        r = self.sg.get('/api/vie-scolaire/alertes/', {'seuil_avertissement': 10, 'seuil_conseil': 20})
        self.assertEqual([(e['mle_etudiant'], e['heures_non_justifiees'], e['niveau']) for e in r.data['eleves']],
                         [('E1', 12.0, 'AVERTISSEMENT')])
        r = self.sg.get('/api/vie-scolaire/alertes/', {'seuil_avertissement': 4, 'seuil_conseil': 12})
        self.assertEqual({e['mle_etudiant']: e['niveau'] for e in r.data['eleves']},
                         {'E1': 'CONSEIL_DISCIPLINE', 'E2': 'AVERTISSEMENT'})
