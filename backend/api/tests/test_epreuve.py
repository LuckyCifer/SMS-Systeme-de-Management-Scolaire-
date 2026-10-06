"""
Tests du workflow de soumission/validation des épreuves (voir api/views.py EpreuveViewSet) :
BROUILLON → SOUMISE → VALIDEE, ou SOUMISE → REJETEE → (re-soumission) → SOUMISE.
Seul le service SCOLARITE (et SUPER_ADMIN) peut valider/rejeter ; un enseignant ne gère que
ses propres épreuves.
"""
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import (
    Annee, Classe, Cours, Departement, Enseignant, Etablissement, Epreuve,
    Examen, Matiere, Module, Periode, Utilisateur,
)


def _fichier():
    return SimpleUploadedFile('sujet.pdf', b'%PDF-1.4 contenu factice', content_type='application/pdf')


class EpreuveWorkflowTest(TestCase):
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

        self.ens_a = Enseignant.objects.create(mle_ens='ENS_A', nom_ens='Ateba', etablissement=self.etab)
        self.ens_b = Enseignant.objects.create(mle_ens='ENS_B', nom_ens='Biya', etablissement=self.etab)

        Utilisateur.objects.create(login='ens_a', passwd=make_password('x'), role='ENSEIGNANT', etablissement=self.etab)
        self.ens_a.utilisateur = Utilisateur.objects.get(login='ens_a')
        self.ens_a.save()
        Utilisateur.objects.create(login='ens_b', passwd=make_password('x'), role='ENSEIGNANT', etablissement=self.etab)
        self.ens_b.utilisateur = Utilisateur.objects.get(login='ens_b')
        self.ens_b.save()
        Utilisateur.objects.create(login='scol_a', passwd=make_password('x'), role='SCOLARITE', etablissement=self.etab)

        self.client_a    = APIClient()
        self.client_a.force_authenticate(user=User.objects.create_user(username='ens_a', password='x'))
        self.client_b    = APIClient()
        self.client_b.force_authenticate(user=User.objects.create_user(username='ens_b', password='x'))
        self.client_scol = APIClient()
        self.client_scol.force_authenticate(user=User.objects.create_user(username='scol_a', password='x'))

        Cours.objects.create(
            code_matiere=self.mat_a, code_classe=self.classe_a, mle_ens=self.ens_a,
            semestre='S1', code_annee=self.annee, etablissement=self.etab,
        )
        Cours.objects.create(
            code_matiere=self.mat_b, code_classe=self.classe_b, mle_ens=self.ens_b,
            semestre='S1', code_annee=self.annee, etablissement=self.etab,
        )
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

    def test_cycle_complet_soumission_puis_validation(self):
        create_resp = self.client_a.post('/api/epreuves/', {
            'examen': self.examen_a.code_examen, 'fichier': _fichier(),
        }, format='multipart')
        self.assertEqual(create_resp.status_code, 201)
        self.assertEqual(create_resp.data['statut'], 'BROUILLON')
        epreuve_id = create_resp.data['code_epreuve']

        soumettre_resp = self.client_a.post(f'/api/epreuves/{epreuve_id}/soumettre/')
        self.assertEqual(soumettre_resp.status_code, 200)
        self.assertEqual(soumettre_resp.data['statut'], 'SOUMISE')

        valider_resp = self.client_scol.post(f'/api/epreuves/{epreuve_id}/valider/')
        self.assertEqual(valider_resp.status_code, 200)
        self.assertEqual(valider_resp.data['statut'], 'VALIDEE')
        self.assertEqual(valider_resp.data['valide_par_login'], 'scol_a')

    def test_cycle_rejet_puis_resoumission(self):
        epreuve = Epreuve.objects.create(examen=self.examen_a, fichier=_fichier(), soumis_par=self.ens_a, etablissement=self.etab)
        self.client_a.post(f'/api/epreuves/{epreuve.code_epreuve}/soumettre/')

        rejet_resp = self.client_scol.post(
            f'/api/epreuves/{epreuve.code_epreuve}/rejeter/', {'commentaire': 'Barème manquant'},
        )
        self.assertEqual(rejet_resp.status_code, 200)
        self.assertEqual(rejet_resp.data['statut'], 'REJETEE')
        self.assertEqual(rejet_resp.data['commentaire_validation'], 'Barème manquant')

        # Re-soumission après correction
        resoumettre_resp = self.client_a.post(f'/api/epreuves/{epreuve.code_epreuve}/soumettre/')
        self.assertEqual(resoumettre_resp.status_code, 200)
        self.assertEqual(resoumettre_resp.data['statut'], 'SOUMISE')

    def test_rejet_sans_commentaire_refuse(self):
        epreuve = Epreuve.objects.create(examen=self.examen_a, fichier=_fichier(), statut='SOUMISE', soumis_par=self.ens_a, etablissement=self.etab)
        response = self.client_scol.post(f'/api/epreuves/{epreuve.code_epreuve}/rejeter/', {'commentaire': ''})
        self.assertEqual(response.status_code, 400)

    def test_enseignant_ne_peut_pas_valider(self):
        epreuve = Epreuve.objects.create(examen=self.examen_a, fichier=_fichier(), statut='SOUMISE', soumis_par=self.ens_a, etablissement=self.etab)
        response = self.client_a.post(f'/api/epreuves/{epreuve.code_epreuve}/valider/')
        self.assertEqual(response.status_code, 403)

    def test_enseignant_ne_peut_pas_creer_epreuve_pour_matiere_dautrui(self):
        response = self.client_a.post('/api/epreuves/', {
            'examen': self.examen_b.code_examen, 'fichier': _fichier(),
        }, format='multipart')
        self.assertEqual(response.status_code, 403)

    def test_enseignant_ne_voit_pas_les_epreuves_dautrui(self):
        Epreuve.objects.create(examen=self.examen_b, fichier=_fichier(), soumis_par=self.ens_b, etablissement=self.etab)
        response = self.client_a.get('/api/epreuves/')
        self.assertEqual(response.data['results'], [])

    def test_epreuve_soumise_non_modifiable_par_enseignant(self):
        epreuve = Epreuve.objects.create(examen=self.examen_a, fichier=_fichier(), statut='SOUMISE', soumis_par=self.ens_a, etablissement=self.etab)
        response = self.client_a.patch(
            f'/api/epreuves/{epreuve.code_epreuve}/', {'fichier': _fichier()}, format='multipart',
        )
        self.assertEqual(response.status_code, 403)

    def test_soumettre_sans_fichier_refuse(self):
        epreuve = Epreuve.objects.create(examen=self.examen_a, soumis_par=self.ens_a, etablissement=self.etab)
        response = self.client_a.post(f'/api/epreuves/{epreuve.code_epreuve}/soumettre/')
        self.assertEqual(response.status_code, 400)
