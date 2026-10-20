"""
seed_mbouda_2026.py — Données fictives complètes de l'année 2026-2027 pour le Lycée
Bilingue de Mbouda (ETAB002), afin de tester tous les modules du secondaire.

    python manage.py seed_mbouda_2026              # aperçu : tout est généré puis annulé
    python manage.py seed_mbouda_2026 --appliquer  # enregistre

Ce qui est créé (les données 2025-2026 ne sont pas modifiées) :
  - calendrier 2026-2027 du secondaire : 3 trimestres et 6 séquences ;
  - nouvelles classes pour couvrir les séries (4ème/3ème Allemand, 2nde C, 1ère C et D,
    Terminale C et D, Lower/Upper Sixth Science) ; 4ème A et 3ème A passent en Espagnol ;
  - passage en classe supérieure des élèves 2025-2026 (environ 10 % de redoublants, départ des
    Terminale et Upper Sixth), nouveaux élèves en 6ème, Form 1 et dans les nouvelles classes ;
  - cours, grille des coefficients, planning hebdomadaire (enseignants ajoutés au besoin) ;
  - séances depuis la rentrée (14/09/2026) jusqu'à aujourd'hui, absences et retards
    (dont 3 élèves très absents, pour les alertes), appel journalier de la semaine ;
  - fiches de notes de la séquence 1 (validées, soumises ou en brouillon), notes reportées,
    séquence 1 clôturée pour la Tle AE ;
  - parents, paiements APEE et frais d'examen officiel, factures, échéanciers ;
  - examens (compositions, BEPC/Probatoire/Bac blancs, GCE mock) et convocations ;
  - cartes scolaires, comptes enseignants et 3 comptes élèves reliés à leur fiche.
Tous les comptes créés ont le mot de passe Demo2026!.
"""
import math
import random
from datetime import date, datetime, time, timedelta

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.models import (
    Absence, Annee, Appel, AppelLigne, CarteEtudiant, Classe, ClotureNotes, CoefficientMatiere,
    Convocation, Cours, Departement, Enseignant, Etablissement, Etudiant, EtudiantTuteur, Examen,
    Facture, FicheNotes, FicheNotesDetail, Inscription, Matiere, Moratoire, Paiement, Pension,
    PauseHoraire, Periode, Planning, Salle, Seance, Tranche, Tuteur, TypeEvaluation, Utilisateur,
)
from api.notes import generer_sequences, importer_fiche
from api.management.commands.seed_mbouda import (
    NOMS_FAMILLE, PRENOMS_F_EN, PRENOMS_F_FR, PRENOMS_M_EN, PRENOMS_M_FR,
)

ETAB, ANNEE, ANNEE_PREC = 'ETAB002', '2026-2027', '2025-2026'
MOT_DE_PASSE = make_password('Demo2026!')
RENTREE = date(2026, 9, 14)

# ── Classes 2026-2027 : code → (libellé, niveau, série, système) ──────────────
CLASSES = {
    'MBD_6EA':   ('6ème A', '6EME_FR', None, 'FRANCOPHONE'),
    'MBD_5EA':   ('5ème A', '5EME_FR', None, 'FRANCOPHONE'),
    'MBD_4EA':   ('4ème A', '4EME_FR', 'ESPAGNOL', 'FRANCOPHONE'),
    'MBD_4EB':   ('4ème B', '4EME_FR', 'ALLEMAND', 'FRANCOPHONE'),
    'MBD_3EA':   ('3ème A', '3EME_FR', 'ESPAGNOL', 'FRANCOPHONE'),
    'MBD_3EB':   ('3ème B', '3EME_FR', 'ALLEMAND', 'FRANCOPHONE'),
    'MBD_2NDA':  ('2nde AE', '2NDE_FR', 'A', 'FRANCOPHONE'),
    'MBD_2NDC':  ('2nde C', '2NDE_FR', 'C', 'FRANCOPHONE'),
    'MBD_1EREA': ('1ère AE', '1ERE_FR', 'A', 'FRANCOPHONE'),
    'MBD_1EREC': ('1ère C', '1ERE_FR', 'C', 'FRANCOPHONE'),
    'MBD_1ERED': ('1ère D', '1ERE_FR', 'D', 'FRANCOPHONE'),
    'MBD_TLEA':  ('Tle AE', 'TLE_FR', 'A', 'FRANCOPHONE'),
    'MBD_TLEC':  ('Tle C', 'TLE_FR', 'C', 'FRANCOPHONE'),
    'MBD_TLED':  ('Tle D', 'TLE_FR', 'D', 'FRANCOPHONE'),
    'MBD_F1A':   ('Form 1 A', 'F1_EN', None, 'ANGLOPHONE'),
    'MBD_F2A':   ('Form 2 A', 'F2_EN', None, 'ANGLOPHONE'),
    'MBD_F3A':   ('Form 3 A', 'F3_EN', None, 'ANGLOPHONE'),
    'MBD_F4A':   ('Form 4 A', 'F4_EN', None, 'ANGLOPHONE'),
    'MBD_LSA':   ('Lower Sixth A', 'LS_EN', 'ARTS', 'ANGLOPHONE'),
    'MBD_LSS':   ('Lower Sixth S', 'LS_EN', 'SCIENCE', 'ANGLOPHONE'),
    'MBD_USA':   ('Upper Sixth A', 'US_EN', 'ARTS', 'ANGLOPHONE'),
    'MBD_USS':   ('Upper Sixth S', 'US_EN', 'SCIENCE', 'ANGLOPHONE'),
}
# Passage en classe supérieure (classe 2025-2026 → classes possibles en 2026-2027).
PASSAGES = {
    'MBD_6EA': ['MBD_5EA'], 'MBD_5EA': ['MBD_4EA', 'MBD_4EB'], 'MBD_4EA': ['MBD_3EA'],
    'MBD_3EA': ['MBD_2NDA', 'MBD_2NDC'], 'MBD_2NDA': ['MBD_1EREA'], 'MBD_1EREA': ['MBD_TLEA'],
    'MBD_TLEA': [], 'MBD_F1A': ['MBD_F2A'], 'MBD_F2A': ['MBD_F3A'], 'MBD_F3A': ['MBD_F4A'],
    'MBD_F4A': ['MBD_LSA', 'MBD_LSS'], 'MBD_LSA': ['MBD_USA'], 'MBD_USA': [],
}
EFFECTIF_MIN = {'MBD_6EA': 30, 'MBD_F1A': 25}   # classes d'entrée ; 18 ailleurs

# ── Grille des coefficients (fictive mais plausible) : (niveau, série) → matière: coef ──
PC_FR  = {'SEC_FRA': 4, 'SEC_ANG': 3, 'SEC_MAT': 4, 'SEC_SVT': 2, 'SEC_HGO': 2, 'SEC_ECM': 1, 'SEC_EPS': 1, 'SEC_INF': 1}
PC2_FR = {**PC_FR, 'SEC_PCH': 2}
PC_EN  = {'SEC_ANG': 4, 'SEC_FRA': 3, 'SEC_MAT': 4, 'SEC_SVT': 2, 'SEC_HGO': 2, 'SEC_ECM': 1, 'SEC_EPS': 1, 'SEC_INF': 1}
COEFS = {
    ('6EME_FR', ''): PC_FR, ('5EME_FR', ''): PC_FR,
    ('4EME_FR', 'ESPAGNOL'): {**PC2_FR, 'SEC_ESP': 2}, ('4EME_FR', 'ALLEMAND'): {**PC2_FR, 'SEC_ALL': 2},
    ('3EME_FR', 'ESPAGNOL'): {**PC2_FR, 'SEC_ESP': 2}, ('3EME_FR', 'ALLEMAND'): {**PC2_FR, 'SEC_ALL': 2},
    ('2NDE_FR', 'A'): {'SEC_FRA': 4, 'SEC_ANG': 3, 'SEC_ESP': 3, 'SEC_HGO': 3, 'SEC_MAT': 2, 'SEC_SVT': 1, 'SEC_PCH': 1, 'SEC_ECM': 1, 'SEC_EPS': 1, 'SEC_INF': 1},
    ('2NDE_FR', 'C'): {'SEC_MAT': 5, 'SEC_PCH': 4, 'SEC_SVT': 2, 'SEC_FRA': 3, 'SEC_ANG': 2, 'SEC_HGO': 2, 'SEC_ECM': 1, 'SEC_EPS': 1, 'SEC_INF': 2},
    ('1ERE_FR', 'A'): {'SEC_FRA': 4, 'SEC_PHI': 2, 'SEC_ANG': 3, 'SEC_ESP': 3, 'SEC_HGO': 3, 'SEC_MAT': 2, 'SEC_SVT': 1, 'SEC_ECM': 1, 'SEC_EPS': 1, 'SEC_INF': 1},
    ('1ERE_FR', 'C'): {'SEC_MAT': 6, 'SEC_PCH': 5, 'SEC_SVT': 2, 'SEC_FRA': 3, 'SEC_PHI': 2, 'SEC_ANG': 2, 'SEC_HGO': 2, 'SEC_ECM': 1, 'SEC_EPS': 1, 'SEC_INF': 2},
    ('1ERE_FR', 'D'): {'SEC_MAT': 4, 'SEC_PCH': 4, 'SEC_SVT': 5, 'SEC_FRA': 3, 'SEC_PHI': 2, 'SEC_ANG': 2, 'SEC_HGO': 2, 'SEC_ECM': 1, 'SEC_EPS': 1, 'SEC_INF': 1},
    ('TLE_FR', 'A'): {'SEC_PHI': 5, 'SEC_FRA': 4, 'SEC_ANG': 3, 'SEC_ESP': 3, 'SEC_HGO': 3, 'SEC_MAT': 2, 'SEC_ECM': 1, 'SEC_EPS': 1, 'SEC_INF': 1},
    ('TLE_FR', 'C'): {'SEC_MAT': 7, 'SEC_PCH': 6, 'SEC_SVT': 2, 'SEC_PHI': 2, 'SEC_FRA': 2, 'SEC_ANG': 2, 'SEC_HGO': 2, 'SEC_ECM': 1, 'SEC_EPS': 1, 'SEC_INF': 2},
    ('TLE_FR', 'D'): {'SEC_MAT': 4, 'SEC_PCH': 4, 'SEC_SVT': 6, 'SEC_PHI': 2, 'SEC_FRA': 2, 'SEC_ANG': 2, 'SEC_HGO': 2, 'SEC_ECM': 1, 'SEC_EPS': 1, 'SEC_INF': 1},
    ('F1_EN', ''): PC_EN, ('F2_EN', ''): PC_EN,
    ('F3_EN', ''): {**PC_EN, 'SEC_PCH': 2}, ('F4_EN', ''): {**PC_EN, 'SEC_PCH': 2},
    ('LS_EN', 'ARTS'):    {'SEC_ANG': 5, 'SEC_FRA': 3, 'SEC_HGO': 4, 'SEC_PHI': 3, 'SEC_MAT': 1, 'SEC_ECM': 1, 'SEC_EPS': 1, 'SEC_INF': 1},
    ('US_EN', 'ARTS'):    {'SEC_ANG': 5, 'SEC_FRA': 3, 'SEC_HGO': 4, 'SEC_PHI': 3, 'SEC_MAT': 1, 'SEC_ECM': 1, 'SEC_EPS': 1, 'SEC_INF': 1},
    ('LS_EN', 'SCIENCE'): {'SEC_MAT': 5, 'SEC_PCH': 5, 'SEC_SVT': 4, 'SEC_ANG': 2, 'SEC_FRA': 2, 'SEC_INF': 2, 'SEC_EPS': 1},
    ('US_EN', 'SCIENCE'): {'SEC_MAT': 5, 'SEC_PCH': 5, 'SEC_SVT': 4, 'SEC_ANG': 2, 'SEC_FRA': 2, 'SEC_INF': 2, 'SEC_EPS': 1},
}
LIB_MATIERE = {'SEC_ALL': 'Allemand', 'SEC_ESP': 'Espagnol'}
JOURS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN']
JOURS_PY = {'LUN': 0, 'MAR': 1, 'MER': 2, 'JEU': 3, 'VEN': 4}
CRENEAUX = [(time(7, 30), time(9, 20)), (time(9, 35), time(11, 25)), (time(11, 40), time(13, 30)), (time(14, 0), time(15, 50))]
# Pauses entre les créneaux : aucun cours ne les chevauche (voir api/horaires.py).
PAUSES = [('Récréation', time(9, 20), time(9, 35)), ('Récréation', time(11, 25), time(11, 40)),
          ('Pause déjeuner', time(13, 30), time(14, 0))]
CHARGE_MAX = 18   # créneaux hebdomadaires maximum par enseignant
FRAIS_EXAMEN = {'3EME_FR': ('BEPC', 5000), '1ERE_FR': ('PROBATOIRE', 10000), 'TLE_FR': ('BAC', 12000),
                'F4_EN': ('GCE_O_LEVEL', 9000), 'US_EN': ('GCE_A_LEVEL', 12000)}
MOTIFS = ['Maladie', 'Certificat médical', 'Rendez-vous médical', 'Deuil familial', 'Convocation administrative']


def tel():
    return f'+237 6{random.randint(70, 99)} {random.randint(10, 99)} {random.randint(10, 99)} {random.randint(10, 99)}'


class Command(BaseCommand):
    help = "Données fictives complètes 2026-2027 pour le Lycée Bilingue de Mbouda (aperçu par défaut)."

    def add_arguments(self, parser):
        parser.add_argument('--appliquer', action='store_true', help='Enregistre les données.')

    def handle(self, *args, **opts):
        random.seed(20261016)
        self.today = date.today()
        if Inscription.objects.filter(etablissement_id=ETAB, code_annee=ANNEE).exists():
            raise CommandError(f'Des inscriptions {ANNEE} existent déjà pour {ETAB} : génération déjà faite.')
        self.etab = Etablissement.objects.get(pk=ETAB)
        self.annee = Annee.objects.get(pk=ANNEE)
        self.dep = Departement.objects.filter(etablissement=self.etab).first()
        self.bilan = []
        with transaction.atomic():
            self._calendrier()
            self._matieres_et_classes()
            self._eleves()
            self._enseignants_cours_planning()
            self._coefficients()
            self._seances_absences()
            self._appels()
            self._fiches_de_notes()
            self._parents()
            self._finances()
            self._examens()
            self._cartes()
            self._comptes()
            if not opts['appliquer']:
                transaction.set_rollback(True)
        for ligne in self.bilan:
            self.stdout.write('  ' + ligne)
        self.stdout.write(self.style.SUCCESS(
            '\nDonnées enregistrées (mot de passe des comptes : Demo2026!).' if opts['appliquer']
            else '\nAperçu uniquement : rien n\'a été enregistré. Relancer avec --appliquer.'))

    # ── Calendrier ─────────────────────────────────────────────────────────────
    def _calendrier(self):
        bornes = [('Trimestre 1 SEC', date(2026, 9, 14), date(2026, 12, 18)),
                  ('Trimestre 2 SEC', date(2027, 1, 4), date(2027, 3, 26)),
                  ('Trimestre 3 SEC', date(2027, 4, 5), date(2027, 6, 11))]
        for lib, debut, fin in bornes:
            Periode.objects.get_or_create(
                lib_periode=lib, type_etab='SECONDAIRE', code_annee=self.annee, periode_parent=None,
                defaults={'date_debut': datetime.combine(debut, time()), 'date_fin': datetime.combine(fin, time()),
                          'type_periode': 'ORDINAIRE'})
        n = generer_sequences(ANNEE)
        self.seq1 = Periode.objects.get(code_annee=self.annee, type_etab='SECONDAIRE', lib_periode='Séquence 1')
        self.bilan.append(f'Calendrier {ANNEE} : 3 trimestres, {n} séquences créées')

    # ── Matières, classes, salles ───────────────────────────────────────────────
    def _matieres_et_classes(self):
        module = Matiere.objects.get(pk='SEC_ANG').code_module
        for code, lib in LIB_MATIERE.items():
            Matiere.objects.get_or_create(code_matiere=code, defaults={'lib_matiere': lib, 'code_module': module, 'type_etab': 'SECONDAIRE'})
        self.classes, nouvelles = {}, 0
        for i, (code, (lib, niveau, serie, systeme)) in enumerate(CLASSES.items(), start=1):
            salle, _ = Salle.objects.get_or_create(code_salle=f'MB{i:02d}', defaults={
                'lib_salle': f'Salle {lib}'[:15], 'obs_salle': 'Lycée de Mbouda', 'etablissement': self.etab})
            classe, cree = Classe.objects.get_or_create(code_classe=code, defaults={
                'lib_classe': lib, 'etablissement': self.etab, 'code_dep': self.dep, 'eff_max': 60})
            classe.niveau_scolaire_id, classe.serie, classe.systeme, classe.code_salle = niveau, serie, systeme, salle
            classe.save()
            self.classes[code] = classe
            nouvelles += cree
        self.bilan.append(f'Classes : {len(CLASSES)} pour {ANNEE} dont {nouvelles} nouvelles ; 4ème A et 3ème A en Espagnol ; {len(CLASSES)} salles')

    # ── Élèves et inscriptions ──────────────────────────────────────────────────
    def _nouvel_eleve(self, systeme):
        self.num += 1
        sexe = random.choice('MF')
        en = systeme == 'ANGLOPHONE'
        prenom = random.choice((PRENOMS_M_EN if sexe == 'M' else PRENOMS_F_EN) if en else (PRENOMS_M_FR if sexe == 'M' else PRENOMS_F_FR))
        nom = random.choice(NOMS_FAMILLE)
        return Etudiant.objects.create(
            mle_etudiant=f'MBD{self.num:04d}', nom=nom, prenom=prenom, sexe=sexe,
            date_naiss=date(random.randint(2008, 2015), random.randint(1, 12), random.randint(1, 28)),
            lieu='Mbouda', region_or='OUEST', nationalite='Camerounaise', code_dep=self.dep,
            nom_tuteur=f'{nom} {random.choice(PRENOMS_M_FR)}', tel=tel(), etablissement=self.etab)

    def _eleves(self):
        self.num = max(int(m[3:]) for m in Etudiant.objects.filter(mle_etudiant__startswith='MBD').values_list('mle_etudiant', flat=True))
        repartition = {code: [] for code in CLASSES}
        promus = redoublants = partis = 0
        for insc in Inscription.objects.filter(etablissement_id=ETAB, code_annee=ANNEE_PREC).select_related('code_classe'):
            ancienne = insc.code_classe_id
            if random.random() < 0.10:
                repartition[ancienne].append(insc.mle_etudiant)
                redoublants += 1
            elif PASSAGES.get(ancienne):
                cibles = PASSAGES[ancienne]
                repartition[cibles[len(repartition[cibles[0]]) % len(cibles)] if len(cibles) > 1 else cibles[0]].append(insc.mle_etudiant)
                promus += 1
            else:
                partis += 1
        nouveaux = 0
        for code, eleves in repartition.items():
            while len(eleves) < EFFECTIF_MIN.get(code, 18):
                eleves.append(self._nouvel_eleve(CLASSES[code][3]))
                nouveaux += 1
        pension = Pension.objects.filter(etablissement=self.etab).first()
        Inscription.objects.bulk_create([
            Inscription(code_classe=self.classes[code], mle_etudiant=e, code_annee=self.annee,
                        date_inscription=datetime(2026, 9, random.randint(1, 12)),
                        mt_inscription=int(pension.mt_inscription) if pension else 0, etablissement=self.etab)
            for code, eleves in repartition.items() for e in eleves])
        self.repartition = repartition
        self.eleves = [e for eleves in repartition.values() for e in eleves]
        # Aptitude moyenne de chaque élève (pour des notes cohérentes d'une matière à l'autre).
        self.niveau_eleve = {e.pk: random.gauss(11.5, 2.6) for e in self.eleves}
        self.bilan.append(f'Élèves {ANNEE} : {len(self.eleves)} inscrits — {promus} passés en classe supérieure, '
                          f'{redoublants} redoublants, {nouveaux} nouveaux ; {partis} sortis (Terminale, Upper Sixth)')

    # ── Enseignants, cours, planning ────────────────────────────────────────────
    def _enseignants_cours_planning(self):
        pool = {}
        for c in Cours.objects.filter(etablissement=self.etab).exclude(mle_ens__isnull=True).select_related('mle_ens'):
            pool.setdefault(c.code_matiere_id, [])
            if c.mle_ens not in pool[c.code_matiere_id]:
                pool[c.code_matiere_id].append(c.mle_ens)
        self.nb_ens_crees = 0
        charge = {}           # mle_ens → set((jour, créneau))
        occupe_classe = {}    # classe → set((jour, créneau))
        self.cours = []
        plannings = []
        for code, classe in self.classes.items():
            _, niveau, serie, _ = CLASSES[code]
            occupe_classe[code] = set()
            for matiere, coef in COEFS[(niveau, serie or '')].items():
                besoin = max(1, math.ceil(coef / 2))
                libres = [(j, k) for j in JOURS for k in range(len(CRENEAUX)) if (j, k) not in occupe_classe[code]]
                ens = None
                for candidat in sorted(pool.get(matiere, []), key=lambda e: len(charge.get(e.pk, ()))):
                    dispo = [s for s in libres if s not in charge.get(candidat.pk, set())]
                    if len(charge.get(candidat.pk, ())) + besoin <= CHARGE_MAX and len(dispo) >= besoin:
                        ens = candidat
                        break
                if ens is None:
                    ens = self._nouvel_enseignant(matiere)
                    pool.setdefault(matiere, []).append(ens)
                cours = Cours.objects.create(code_matiere_id=matiere, code_classe=classe, mle_ens=ens, semestre='AN',
                                             code_annee=self.annee, quota_horaire=besoin * 2 * 30, credits=0, etablissement=self.etab)
                self.cours.append(cours)
                # Créneaux répartis sur des jours différents autant que possible.
                dispo = [s for s in libres if s not in charge.get(ens.pk, set())]
                choisis = []
                for s in sorted(dispo, key=lambda s: (sum(1 for x in choisis if x[0] == s[0]), JOURS.index(s[0]) * 7 % 5, s[1])):
                    if len(choisis) == besoin:
                        break
                    if all(x[0] != s[0] for x in choisis) or len(dispo) <= besoin * 2:
                        choisis.append(s)
                for jour, k in choisis:
                    occupe_classe[code].add((jour, k))
                    charge.setdefault(ens.pk, set()).add((jour, k))
                    plannings.append(Planning(code_cours=cours, type_planning='HEBDO', type_seance='CM', code_jour_id=jour,
                                              h_debut=CRENEAUX[k][0], h_fin=CRENEAUX[k][1], code_salle=classe.code_salle))
        Planning.objects.bulk_create(plannings)
        if not PauseHoraire.objects.filter(etablissement_id=ETAB).exists():
            PauseHoraire.objects.bulk_create([PauseHoraire(etablissement_id=ETAB, libelle=lib, h_debut=d, h_fin=f)
                                              for lib, d, f in PAUSES])
        self.plannings = list(Planning.objects.filter(code_cours__in=self.cours).select_related('code_cours'))
        self.bilan.append(f'Cours : {len(self.cours)} ; planning : {len(self.plannings)} créneaux hebdomadaires ; '
                          f'{self.nb_ens_crees} enseignants ajoutés (charge ≤ {CHARGE_MAX} créneaux/semaine)')

    def _nouvel_enseignant(self, matiere):
        self.nb_ens_crees += 1
        numero = Enseignant.objects.filter(mle_ens__startswith='MBD_E').count() + 1
        sexe = random.choice('MF')
        nom, prenom = random.choice(NOMS_FAMILLE), random.choice(PRENOMS_M_FR if sexe == 'M' else PRENOMS_F_FR)
        return Enseignant.objects.create(
            mle_ens=f'MBD_E{numero:02d}', nom_ens=nom, prenom_ens=prenom, sexe=sexe, code_dep=self.dep,
            statut='FONCTIONNAIRE', etablissement=self.etab, tel_ens=tel(),
            email_ens=f'{prenom.lower()}.{nom.lower()}{numero}@lyceembouda.cm')

    # ── Coefficients ────────────────────────────────────────────────────────────
    def _coefficients(self):
        # Les cases déjà saisies (à la main) sont conservées : seules les cases vides sont remplies.
        existantes = set(CoefficientMatiere.objects.filter(etablissement=self.etab, code_annee=self.annee)
                         .values_list('niveau_scolaire', 'serie', 'code_matiere'))
        lignes = [CoefficientMatiere(etablissement=self.etab, code_annee=self.annee, niveau_scolaire_id=niveau,
                                     serie=serie, code_matiere_id=matiere, coef=coef)
                  for (niveau, serie), grille in COEFS.items() for matiere, coef in grille.items()
                  if (niveau, serie, matiere) not in existantes]
        CoefficientMatiere.objects.bulk_create(lignes)
        self.bilan.append(f'Grille des coefficients {ANNEE} : {len(lignes)} cases remplies, '
                          f'{len(existantes)} déjà saisies conservées ({len(COEFS)} niveaux/séries)')

    # ── Séances, absences, retards ──────────────────────────────────────────────
    def _seances_absences(self):
        inscrits = {code: [e.pk for e in eleves] for code, eleves in self.repartition.items()}
        tous = [mle for v in inscrits.values() for mle in v]
        self.absenteistes = set(random.sample(tous, 3))
        seances, jour = [], RENTREE
        while jour <= self.today:
            for p in self.plannings:
                if JOURS_PY.get(p.code_jour_id) == jour.weekday():
                    c = p.code_cours
                    seances.append(Seance(code_matiere_id=c.code_matiere_id, code_classe_id=c.code_classe_id, mle_ens_id=c.mle_ens_id,
                                          code_annee=self.annee, date_seance=jour, h_debut=p.h_debut, h_fin=p.h_fin,
                                          nb_heures_effectuees=1.83, statut='TENU', etablissement=self.etab))
            jour += timedelta(days=1)
        Seance.objects.bulk_create(seances, batch_size=500)
        absences, n_abs, n_ret = [], 0, 0
        for s in Seance.objects.filter(etablissement=self.etab, code_annee=self.annee):
            for mle in inscrits[s.code_classe_id]:
                r = random.random()
                seuil_abs = 0.30 if mle in self.absenteistes else 0.03
                if r < seuil_abs:
                    justifiee = mle not in self.absenteistes and random.random() < 0.4
                    absences.append(Absence(code_seance=s, mle_etudiant_id=mle, present=False, justifiee=justifiee,
                                            motif=random.choice(MOTIFS) if justifiee else None))
                    n_abs += 1
                elif r < seuil_abs + 0.02:
                    absences.append(Absence(code_seance=s, mle_etudiant_id=mle, present=True, retard_minutes=random.choice([5, 10, 15, 20, 30])))
                    n_ret += 1
        Absence.objects.bulk_create(absences, batch_size=1000)
        self.bilan.append(f'Séances du {RENTREE:%d/%m/%Y} au {self.today:%d/%m/%Y} : {len(seances)} ; '
                          f'{n_abs} absences, {n_ret} retards ; 3 élèves très absents ({", ".join(sorted(self.absenteistes))})')

    def _appels(self):
        jours = [self.today - timedelta(days=d) for d in range(7) if (self.today - timedelta(days=d)).weekday() < 5]
        classes_appel = ['MBD_6EA', 'MBD_5EA', 'MBD_F1A', 'MBD_F2A']
        n_lignes = 0
        for code in classes_appel:
            for jour in jours:
                appel = Appel.objects.create(etablissement=self.etab, code_classe=self.classes[code], date=jour,
                                             creneau='MATIN', fait_par='mbd_sg')
                lignes = []
                for e in self.repartition[code]:
                    r = random.random()
                    statut = 'ABSENT' if r < 0.04 else 'RETARD' if r < 0.07 else 'PRESENT'
                    lignes.append(AppelLigne(appel=appel, mle_etudiant=e, statut=statut,
                                             minutes_retard=random.choice([5, 10, 15]) if statut == 'RETARD' else 0))
                AppelLigne.objects.bulk_create(lignes)
                n_lignes += len(lignes)
        self.bilan.append(f'Appel journalier (matin) : {len(classes_appel)} classes × {len(jours)} jours, {n_lignes} lignes')

    # ── Fiches de notes de la séquence 1 ────────────────────────────────────────
    def _note(self, mle, bareme):
        n = max(1.0, min(19.75, self.niveau_eleve[mle] + random.gauss(0, 2.4)))
        return round(n * float(bareme) / 20 * 4) / 4

    def _fiches_de_notes(self):
        ds = TypeEvaluation.objects.get(pk=6)     # Devoir Surveillé (DS)
        interro = TypeEvaluation.objects.get(pk=8)  # Interrogation
        statuts = {'VALIDE': 0, 'SOUMIS': 0, 'BROUILLON': 0}
        reportees = 0
        for cours in self.cours:
            code = cours.code_classe_id
            evaluations = [(ds, 20)] + ([(interro, 10)] if cours.code_matiere_id in ('SEC_MAT', 'SEC_FRA', 'SEC_ANG') else [])
            for type_eval, bareme in evaluations:
                r = random.random()
                statut = 'VALIDE' if code == 'MBD_TLEA' or r < 0.70 else 'SOUMIS' if r < 0.85 else 'BROUILLON'
                fiche = FicheNotes.objects.create(
                    code_matiere_id=cours.code_matiere_id, code_classe_id=code, mle_ens_id=cours.mle_ens_id,
                    code_periode=self.seq1, code_annee=self.annee, code_type_eval=type_eval,
                    date_evaluation=date(2026, 9, 28) + timedelta(days=random.randint(0, 11)),
                    bareme=bareme, statut='BROUILLON', etablissement=self.etab)
                details = []
                for e in self.repartition[code]:
                    if random.random() < 0.025:
                        details.append(FicheNotesDetail(code_fiche=fiche, mle_etudiant=e, absent=True, justifie=random.random() < 0.5))
                    else:
                        details.append(FicheNotesDetail(code_fiche=fiche, mle_etudiant=e, note=self._note(e.pk, bareme)))
                FicheNotesDetail.objects.bulk_create(details)
                if statut == 'VALIDE':
                    reportees += importer_fiche(fiche)
                fiche.statut = statut
                fiche.save(update_fields=['statut'])
                statuts[statut] += 1
        ClotureNotes.objects.create(etablissement=self.etab, code_classe=self.classes['MBD_TLEA'],
                                    code_periode=self.seq1, cloturee_par='mbd_censeur')
        self.bilan.append(f'Fiches de notes (séquence 1) : {statuts["VALIDE"]} validées, {statuts["SOUMIS"]} soumises, '
                          f'{statuts["BROUILLON"]} en brouillon ; {reportees} notes reportées ; séquence 1 clôturée en Tle AE')

    # ── Parents ─────────────────────────────────────────────────────────────────
    def _parents(self):
        n = 0
        for e in self.eleves:
            if EtudiantTuteur.objects.filter(mle_etudiant=e).exists():
                continue
            lien = random.choice(['Père', 'Mère', 'Oncle', 'Tante'])
            prenom = random.choice(PRENOMS_F_FR if lien in ('Mère', 'Tante') else PRENOMS_M_FR)
            t = Tuteur.objects.create(nom=e.nom, prenom=prenom, lien_parente=lien, tel=tel(),
                                      adresse='Mbouda', etablissement=self.etab)
            EtudiantTuteur.objects.create(mle_etudiant=e, code_tuteur=t, est_contact_principal=True)
            n += 1
        self.bilan.append(f'Parents : {n} créés et reliés à leur enfant')

    # ── Finances ────────────────────────────────────────────────────────────────
    def _finances(self):
        tranches = list(Tranche.objects.filter(code_pension__etablissement=self.etab).order_by('code_tranche'))
        total_apee = sum(t.mt_tranche for t in tranches)
        paiements, factures, moratoires = [], [], []
        classe_de = {e.pk: code for code, eleves in self.repartition.items() for e in eleves}
        for i, e in enumerate(self.eleves, start=1):
            r = random.random()
            verse = []
            if r < 0.55:
                verse = [(tranches[0], tranches[0].mt_tranche, 'PAYE'), (tranches[1], tranches[1].mt_tranche, 'PAYE')]
            elif r < 0.80:
                verse = [(tranches[0], tranches[0].mt_tranche, 'PAYE')]
            elif r < 0.90:
                verse = [(tranches[0], tranches[0].mt_tranche // 2, 'PARTIEL')]
            for tranche, montant, statut in verse:
                paiements.append(Paiement(mle_etudiant=e, code_annee=self.annee, code_tranche=tranche, type_paiement='APEE',
                                          mt_paiement=montant, statut=statut, mode_paiement=random.choice(['ESPECES', 'MOBILE_MONEY']),
                                          ref_paiement=f'APEE-{i:04d}-{tranche.pk}', obs_paiement='Contribution APEE',
                                          date_paiement=datetime(2026, random.choice([9, 10]), random.randint(1, 15)),
                                          etablissement=self.etab))
            paye = sum(m for _, m, _ in verse)
            factures.append(Facture(numero_facture=f'MBD-2627-{i:04d}', mle_etudiant=e, code_annee=self.annee,
                                    date_emission=date(2026, 9, 14), montant_total=total_apee, montant_paye=paye,
                                    statut='SOLDEE' if paye >= total_apee else 'PARTIELLEMENT_PAYEE' if paye else 'EN_ATTENTE',
                                    etablissement=self.etab))
            if not paye:
                moratoires.append(Moratoire(lib_mor=f'Échéancier APEE {ANNEE}', date_effet=date(2026, 10, 1),
                                            date_exp=date(2026, 12, 15), mle_etudiant=e, etablissement=self.etab))
            examen = FRAIS_EXAMEN.get(CLASSES[classe_de[e.pk]][1])
            if examen and random.random() < 0.6:
                paiements.append(Paiement(mle_etudiant=e, code_annee=self.annee, type_paiement='EXAMEN_OFFICIEL',
                                          mt_paiement=examen[1], statut='PAYE', mode_paiement='ESPECES',
                                          ref_paiement=f'EXO-{i:04d}', obs_paiement=f'Frais {examen[0]}',
                                          date_paiement=datetime(2026, 10, random.randint(1, 15)), etablissement=self.etab))
        Paiement.objects.bulk_create(paiements)
        Facture.objects.bulk_create(factures)
        Moratoire.objects.bulk_create(moratoires)
        self.bilan.append(f'Finances : {len(paiements)} paiements (APEE + examens officiels), {len(factures)} factures, '
                          f'{len(moratoires)} échéanciers')

    # ── Examens et convocations ─────────────────────────────────────────────────
    def _examens(self):
        examens, convocations = [], []
        t1 = Periode.objects.get(code_annee=self.annee, type_etab='SECONDAIRE', lib_periode='Trimestre 1 SEC')
        for code, classe in self.classes.items():
            niveau = CLASSES[code][1]
            principales = [m for m in ('SEC_FRA', 'SEC_MAT', 'SEC_ANG') if m in COEFS[(niveau, CLASSES[code][2] or '')]][:2]
            for j, matiere in enumerate(principales):
                examens.append(Examen(lib_examen='Composition du 1er trimestre', code_matiere_id=matiere, code_classe=classe,
                                      code_annee=self.annee, code_periode=t1, code_salle=classe.code_salle_id,
                                      date_examen=datetime(2026, 12, 7 + j, 8, 0), duree_minutes=180, type_examen='ECRIT',
                                      organisme='INTERNE', etablissement=self.etab))
            if niveau in FRAIS_EXAMEN:
                officiel = FRAIS_EXAMEN[niveau][0]
                lib = {'BEPC': 'BEPC blanc', 'PROBATOIRE': 'Probatoire blanc', 'BAC': 'Baccalauréat blanc',
                       'GCE_O_LEVEL': 'GCE O Level mock', 'GCE_A_LEVEL': 'GCE A Level mock'}[officiel]
                examens.append(Examen(lib_examen=lib, code_matiere_id=principales[0], code_classe=classe, code_annee=self.annee,
                                      code_salle=classe.code_salle_id, date_examen=datetime(2027, 2, 15, 8, 0), duree_minutes=240,
                                      type_examen='ECRIT', type_officiel=officiel, organisme='INTERNE', etablissement=self.etab))
        Examen.objects.bulk_create(examens)
        for ex in Examen.objects.filter(etablissement=self.etab, code_annee=self.annee, type_officiel__isnull=False):
            for e in self.repartition[ex.code_classe_id]:
                convocations.append(Convocation(type_convocation='EXAMEN', destinataire_type='ETUDIANT', mle_etudiant=e,
                                                code_examen=ex, objet=f'Convocation — {ex.lib_examen}',
                                                date_evenement=ex.date_examen, lieu='Lycée Bilingue de Mbouda',
                                                message='Se présenter 30 minutes avant le début de l\'épreuve.', statut='ENVOYEE'))
        Convocation.objects.bulk_create(convocations)
        self.bilan.append(f'Examens : {len(examens)} (compositions, BEPC/Probatoire/Bac blancs, GCE mock) ; {len(convocations)} convocations')

    def _cartes(self):
        CarteEtudiant.objects.bulk_create([
            CarteEtudiant(mle_etudiant=e, code_annee=self.annee, numero_carte=f'MBD-2627-{e.pk[3:]}',
                          date_emission=date(2026, 9, 21), date_expiration=date(2027, 7, 31), statut='ACTIVE',
                          etablissement=self.etab) for e in self.eleves])
        self.bilan.append(f'Cartes scolaires : {len(self.eleves)}')

    # ── Comptes ─────────────────────────────────────────────────────────────────
    def _compte(self, login, role, nom_user):
        u, _ = Utilisateur.objects.update_or_create(login=login, defaults={
            'passwd': MOT_DE_PASSE, 'role': role, 'etablissement': self.etab, 'nom_user': nom_user})
        User.objects.get_or_create(username=login, defaults={'is_active': True})
        return u

    def _comptes(self):
        n_ens = 0
        numero = Utilisateur.objects.filter(login__startswith='mbd_ens').count()
        for ens in Enseignant.objects.filter(etablissement=self.etab, utilisateur__isnull=True).order_by('mle_ens'):
            numero += 1
            ens.utilisateur = self._compte(f'mbd_ens{numero}', 'ENSEIGNANT', f'{ens.prenom_ens} {ens.nom_ens}')
            ens.save(update_fields=['utilisateur'])
            n_ens += 1
        eleves = []
        for i, code in enumerate(['MBD_6EA', 'MBD_3EB', 'MBD_TLEC'], start=1):
            e = self.repartition[code][0]
            e.utilisateur = self._compte(f'mbd_eleve{i}', 'ETUDIANT', f'{e.prenom} {e.nom}')
            e.save(update_fields=['utilisateur'])
            eleves.append(f'mbd_eleve{i} ({CLASSES[code][0]})')
        self.bilan.append(f'Comptes : {n_ens} enseignants reliés à leur fiche ; élèves : {", ".join(eleves)}')
