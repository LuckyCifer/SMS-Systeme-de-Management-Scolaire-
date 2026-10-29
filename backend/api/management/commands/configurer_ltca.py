"""
configurer_ltca.py — Crée et paramètre le Lycée Technique Charles Atangana (Yaoundé).

Sources publiques (consultées le 26/10/2026) :
- mémoire de l'ENS de Yaoundé (2015, dépôt DICAMES) : créé en 1960, établissement public
  (CETIC Charles Atangana de 1973 à 2012), arrondissement de Yaoundé 1er ;
- Cameroon Tribune (résultats du baccalauréat technique 2022) : proviseure Mme Bernadette
  Félicité Ebela ; séries F2 (électronique), F3 (électricité), F4 (génie civil), F5 (froid et
  climatisation), installation sanitaire, industrie du bois, ameublement-ébénisterie.

Le reste est un paramétrage type d'un lycée technique industriel public camerounais, à
ajuster par l'établissement : spécialités du CAP au premier cycle, coefficients, montants
de l'APEE et des frais d'examen, salles, pauses. Aucun élève ni enseignant n'est créé ;
les cours sont créés sans enseignant (à attribuer dans la page Cours).

Aperçu par défaut ; --appliquer pour enregistrer. Relançable sans doublon.
"""
from datetime import date, time

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import (
    Annee, Batiment, Classe, CoefficientMatiere, Cours, Departement, Etablissement, Frais,
    Matiere, Module, NiveauScolaire, PauseHoraire, Pension, Salle, Tranche, Utilisateur,
)

CODE = 'LTCA'
ANNEE = '2026-2027'
MOT_DE_PASSE = 'Demo2026!'

ETABLISSEMENT = {
    'lib_etab': 'Lycée Technique Charles Atangana', 'sigle': 'LTCA',
    'type_etab': 'SECONDAIRE', 'statut': 'PUBLIC', 'systeme': 'FRANCOPHONE',
    'region': 'CENTRE', 'ville': 'Yaoundé', 'adresse': 'Arrondissement de Yaoundé 1er (Mfoundi)',
    'ministere_tutelle': 'Ministère des Enseignements Secondaires (MINESEC)',
    'directeur': 'Mme Bernadette Félicité Ebela',
    'date_creation': date(1960, 1, 1),   # seule l'année (1960) est connue
    'actif': True,
}

# Sections (départements) et spécialités / séries qui en relèvent.
SECTIONS = {
    'LTCA_EE':   ('Génie électrique (électricité, électronique)', ['ELEC', 'ELN', 'F2', 'F3']),
    'LTCA_GC':   ('Génie civil (maçonnerie, installation sanitaire)', ['MACO', 'IS', 'F4']),
    'LTCA_FC':   ('Froid et climatisation', ['FC', 'F5']),
    'LTCA_BOIS': ('Bois (menuiserie, ameublement, industrie du bois)', ['MEB', 'IB']),
}

# Matières de l'enseignement technique (référentiel commun au secondaire).
MATIERES_TECHNIQUES = [
    ('TEC_TECHNO',   'Technologie',                  'TEC'),
    ('TEC_DESSIN',   'Dessin technique',             'TEC'),
    ('TEC_TP',       "Travaux pratiques d'atelier",  'TEC'),
    ('TEC_ELECTEC',  'Électrotechnique',             'ELECTRICT'),
    ('TEC_ELECTRON', 'Électronique',                 'ELECTRICT'),
    ('TEC_MECA',     'Mécanique appliquée',          'INDUSTRI'),
    ('TEC_RDM',      'Résistance des matériaux',     'INDUSTRI'),
    ('TEC_CONSTR',   'Construction et métré',        'INDUSTRI'),
    ('TEC_FROID',    'Froid et climatisation',       'INDUSTRI'),
    ('TEC_HYDRO',    'Plomberie et hydraulique',     'INDUSTRI'),
    ('TEC_BOIS',     'Technologie du bois',          'INDUSTRI'),
    ('TEC_LEGIS',    'Législation et économie',      'GEN'),
    ('TEC_ENTREP',   'Entrepreneuriat',              'GEN'),
]

# Niveaux : (code NiveauScolaire, préfixe du code de classe, libellé de classe, séries).
PREMIER_CYCLE = ['ELEC', 'ELN', 'MACO', 'IS', 'FC', 'MEB']
SECOND_CYCLE = ['F2', 'F3', 'F4', 'F5', 'IS', 'IB', 'MEB']
NIVEAUX = [
    ('1AN_TECH',  '1A', '1ère année', PREMIER_CYCLE),
    ('2AN_TECH',  '2A', '2ème année', PREMIER_CYCLE),
    ('3AN_TECH',  '3A', '3ème année', PREMIER_CYCLE),
    ('4AN_TECH',  '4A', '4ème année', PREMIER_CYCLE),
    ('2NDE_TECH', 'SE', '2nde',       SECOND_CYCLE),
    ('1ERE_TECH', 'PR', '1ère',       SECOND_CYCLE),
    ('TLE_TECH',  'TL', 'Tle',        SECOND_CYCLE),
]

# Programmes et coefficients (paramétrage type, à ajuster par le censeur).
GENERAL_1C = {'SEC_FRA': 3, 'SEC_ANG': 2, 'SEC_MAT': 3, 'SEC_PCH': 2, 'SEC_HGO': 1,
              'SEC_ECM': 1, 'SEC_EPS': 1, 'SEC_INF': 1}
TECHNIQUE_1C = {'TEC_TECHNO': 3, 'TEC_DESSIN': 3, 'TEC_TP': 6}
SPECIALITE_1C = {'ELEC': 'TEC_ELECTEC', 'ELN': 'TEC_ELECTRON', 'MACO': 'TEC_CONSTR',
                 'IS': 'TEC_HYDRO', 'FC': 'TEC_FROID', 'MEB': 'TEC_BOIS'}
GENERAL_2C = {'SEC_FRA': 2, 'SEC_ANG': 2, 'SEC_MAT': 4, 'SEC_PCH': 4, 'SEC_HGO': 1,
              'SEC_ECM': 1, 'SEC_EPS': 1, 'SEC_INF': 1}
TECHNIQUE_2C = {'TEC_DESSIN': 3, 'TEC_TP': 5, 'TEC_ENTREP': 1}
SPECIALITE_2C = {
    'F2':  {'TEC_ELECTRON': 5, 'TEC_ELECTEC': 3},
    'F3':  {'TEC_ELECTEC': 5, 'TEC_MECA': 3},
    'F4':  {'TEC_CONSTR': 5, 'TEC_RDM': 4},
    'F5':  {'TEC_FROID': 5, 'TEC_ELECTEC': 3},
    'IS':  {'TEC_HYDRO': 5, 'TEC_CONSTR': 3},
    'IB':  {'TEC_BOIS': 5, 'TEC_MECA': 3},
    'MEB': {'TEC_BOIS': 5, 'TEC_TECHNO': 3},
}

BATIMENTS = [('LTADM', 'Bloc administratif'), ('LTCLA', 'Bloc des salles'), ('LTATE', 'Ateliers')]
NB_SALLES = 45   # une salle par classe
ATELIERS = [
    ('LTAEL', 'Atelier ELEC',   'Atelier électricité / électrotechnique'),
    ('LTAEN', 'Atelier ELN',    'Atelier électronique'),
    ('LTAGC', 'Atelier GC',     'Atelier génie civil / maçonnerie'),
    ('LTAIS', 'Atelier IS',     'Atelier installation sanitaire'),
    ('LTAFC', 'Atelier FROID',  'Atelier froid et climatisation'),
    ('LTABO', 'Atelier BOIS',   'Atelier menuiserie-ébénisterie / bois'),
]
PAUSES = [('Récréation', time(9, 20), time(9, 35)), ('Récréation', time(11, 25), time(11, 40)),
          ('Pause déjeuner', time(13, 30), time(14, 0))]
# Établissement public : scolarité nominalement gratuite, contribution APEE des familles.
APEE = {'lib_pension': 'APEE LTCA', 'mt_pension': 20000, 'mt_inscription': 0, 'nb_tranche': 2}
TRANCHES_APEE = [12000, 8000]
FRAIS_EXAMEN = [('Frais examen CAP', 5000), ('Frais examen Probatoire', 10000), ('Frais examen Bac technique', 12000)]
COMPTES = [
    ('ltca_proviseur', 'ADMIN',               'Proviseur LTCA'),
    ('ltca_censeur',   'CENSEUR',             'Censeur LTCA'),
    ('ltca_sg',        'SURVEILLANT_GENERAL', 'Surveillant général LTCA'),
    ('ltca_scol',      'SCOLARITE',           'Scolarité LTCA'),
    ('ltca_econome',   'COMPTABLE',           'Économe LTCA'),
]


def programme(code_niveau, serie):
    """Coefficients {matière: coef} d'un niveau et d'une spécialité / série."""
    if code_niveau.endswith('AN_TECH'):
        prog = {**GENERAL_1C, **TECHNIQUE_1C, SPECIALITE_1C[serie]: 3}
        if code_niveau in ('3AN_TECH', '4AN_TECH'):
            prog['TEC_LEGIS'] = 1
    else:
        prog = {**GENERAL_2C, **TECHNIQUE_2C, **SPECIALITE_2C[serie]}
        if code_niveau == 'TLE_TECH':
            prog['SEC_PHI'] = 2
    return prog


class Command(BaseCommand):
    help = "Crée et paramètre le Lycée Technique Charles Atangana (aperçu ; --appliquer)."

    def add_arguments(self, parser):
        parser.add_argument('--appliquer', action='store_true', help='Enregistre les changements.')

    def handle(self, *args, appliquer, **opts):
        self.bilan = []
        with transaction.atomic():
            etab = self._etablissement()
            sections = self._sections(etab)
            salles = self._infrastructure(etab)
            self._matieres()
            classes = self._classes(etab, sections, salles)
            self._programme(etab, classes)
            self._finances(etab)
            self._pauses(etab)
            self._comptes(etab)
            if not appliquer:
                transaction.set_rollback(True)
        for ligne in self.bilan:
            self.stdout.write('  ' + ligne)
        if appliquer:
            self.stdout.write(self.style.SUCCESS(f'{CODE} créé et paramétré.'))
        else:
            self.stdout.write(self.style.NOTICE('Aperçu seulement : relancer avec --appliquer pour enregistrer.'))

    def _etablissement(self):
        etab, cree = Etablissement.objects.update_or_create(code_etab=CODE, defaults=ETABLISSEMENT)
        self.bilan.append(f"Établissement {CODE} — {etab.lib_etab} ({'créé' if cree else 'mis à jour'})")
        return etab

    def _sections(self, etab):
        par_serie = {}
        for code, (lib, series) in SECTIONS.items():
            dep, _ = Departement.objects.update_or_create(
                code_dep=code, defaults={'lib_dep': lib, 'code_etab': etab, 'etablissement': etab})
            for s in series:
                par_serie[s] = dep
        self.bilan.append(f'{len(SECTIONS)} sections : ' + ', '.join(lib for lib, _ in SECTIONS.values()))
        return par_serie

    def _infrastructure(self, etab):
        for code, lib in BATIMENTS:
            Batiment.objects.update_or_create(code_bat=code, defaults={'lib_bat': lib, 'etablissement': etab})
        salles = []
        for i in range(1, NB_SALLES + 1):
            salle, _ = Salle.objects.update_or_create(
                code_salle=f'LT{i:02d}', defaults={'lib_salle': f'Salle {i}', 'obs_salle': 'Bloc des salles', 'etablissement': etab})
            salles.append(salle)
        for code, lib, obs in ATELIERS:
            Salle.objects.update_or_create(code_salle=code, defaults={'lib_salle': lib, 'obs_salle': obs, 'etablissement': etab})
        self.bilan.append(f'{len(BATIMENTS)} bâtiments, {NB_SALLES} salles de classe, {len(ATELIERS)} ateliers')
        return salles

    def _matieres(self):
        for code, lib, module in MATIERES_TECHNIQUES:
            Matiere.objects.update_or_create(code_matiere=code, defaults={
                'lib_matiere': lib, 'code_module': Module.objects.get(pk=module), 'type_etab': 'SECONDAIRE'})
        self.bilan.append(f'{len(MATIERES_TECHNIQUES)} matières techniques (référentiel commun du secondaire)')

    def _classes(self, etab, sections, salles):
        classes = []
        for code_niveau, prefixe, lib_niveau, series in NIVEAUX:
            niveau = NiveauScolaire.objects.get(pk=code_niveau)
            for serie in series:
                salle = salles[len(classes) % len(salles)]   # une salle par classe
                classe, _ = Classe.objects.update_or_create(code_classe=f'LT{prefixe}{serie}', defaults={
                    'lib_classe': f'{lib_niveau} {serie}', 'niveau_scolaire': niveau, 'serie': serie,
                    'systeme': 'FRANCOPHONE', 'code_dep': sections[serie], 'code_bat_id': 'LTCLA',
                    'code_salle': salle, 'eff_max': 50 if code_niveau.endswith('AN_TECH') else 45,
                    'etablissement': etab,
                })
                classes.append(classe)
        self.bilan.append(f'{len(classes)} classes : 1ère à 4ème année ({len(PREMIER_CYCLE)} spécialités du CAP), '
                          f'2nde à Tle ({len(SECOND_CYCLE)} séries du bac technique)')
        return classes

    def _programme(self, etab, classes):
        annee = Annee.objects.get(pk=ANNEE)
        n_cours = n_coefs = 0
        vus = set()
        for classe in classes:
            prog = programme(classe.niveau_scolaire_id, classe.serie)
            for matiere, coef in prog.items():
                _, cree = Cours.objects.get_or_create(
                    code_matiere_id=matiere, code_classe=classe, semestre='AN', code_annee=annee,
                    defaults={'etablissement': etab, 'quota_horaire': 30 * coef})
                n_cours += cree
                cle = (classe.niveau_scolaire_id, classe.serie, matiere)
                if cle not in vus:
                    vus.add(cle)
                    CoefficientMatiere.objects.update_or_create(
                        etablissement=etab, code_annee=annee, niveau_scolaire_id=classe.niveau_scolaire_id,
                        serie=classe.serie, code_matiere_id=matiere, defaults={'coef': coef})
                    n_coefs += 1
        self.bilan.append(f'{n_cours} cours {ANNEE} (sans enseignant), grille de {n_coefs} coefficients')

    def _finances(self, etab):
        pension, _ = Pension.objects.update_or_create(
            lib_pension=APEE['lib_pension'], etablissement=etab, defaults={**APEE, 'type_etab': 'SECONDAIRE'})
        for i, montant in enumerate(TRANCHES_APEE, start=1):
            Tranche.objects.update_or_create(code_pension=pension, lib_tranche=f'Tranche {i}', defaults={'mt_tranche': montant})
        annee = Annee.objects.get(pk=ANNEE)
        suivant = (Frais.objects.order_by('-code_frais').values_list('code_frais', flat=True).first() or 0) + 1
        for lib, montant in FRAIS_EXAMEN:
            frais = Frais.objects.filter(etablissement=etab, lib_frais=lib, code_annee=annee).first()
            if frais is None:
                Frais.objects.create(code_frais=suivant, lib_frais=lib, type_frais='EXAMEN', mt_frais=montant,
                                     code_annee=annee, type_etab='SECONDAIRE', etablissement=etab)
                suivant += 1
        self.bilan.append(f"APEE {APEE['mt_pension']} FCFA en {len(TRANCHES_APEE)} tranches ; frais d'examen "
                          + ', '.join(f'{lib.split()[-1] if "Bac" not in lib else "Bac"} {m}' for lib, m in FRAIS_EXAMEN))

    def _pauses(self, etab):
        if not PauseHoraire.objects.filter(etablissement=etab).exists():
            PauseHoraire.objects.bulk_create([PauseHoraire(etablissement=etab, libelle=lib, h_debut=d, h_fin=f)
                                              for lib, d, f in PAUSES])
        self.bilan.append('Pauses : ' + ', '.join(f'{lib} {d:%H:%M}–{f:%H:%M}' for lib, d, f in PAUSES))

    def _comptes(self, etab):
        mdp = make_password(MOT_DE_PASSE)
        for login, role, nom in COMPTES:
            Utilisateur.objects.update_or_create(login=login, defaults={
                'passwd': mdp, 'role': role, 'nom_user': nom, 'etablissement': etab})
            User.objects.get_or_create(username=login, defaults={'is_active': True})
        self.bilan.append(f'{len(COMPTES)} comptes (mot de passe {MOT_DE_PASSE}) : ' + ', '.join(c[0] for c in COMPTES))
