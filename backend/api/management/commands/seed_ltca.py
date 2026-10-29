"""
seed_ltca.py — Données fictives du Lycée Technique Charles Atangana (LTCA), au même niveau de
détail que celles du Lycée Bilingue de Mbouda (seed_mbouda + seed_mbouda_2026), pour tester
tous les modules sur un lycée technique.

Prérequis : configurer_ltca --appliquer (établissement, classes, cours 2026-2027, coefficients).

    python manage.py seed_ltca              # aperçu : tout est généré puis annulé
    python manage.py seed_ltca --appliquer  # enregistre (refuse de tourner deux fois)

Ce qui est créé :
  - 2025-2026 (année clôturée) : élèves et inscriptions, cours avec enseignants, notes de la
    séquence 1 (devoir surveillé), paiements APEE ;
  - 2026-2027 : passage en classe supérieure (une spécialité monte d'année en année ; après
    le CAP, une partie entre en seconde dans la série correspondante ; les terminales partent),
    environ 10 % de redoublants, nouveaux élèves en 1ère année et en seconde ;
  - enseignants par matière et emploi du temps hebdomadaire (sans conflit ni chevauchement de
    pause), séances depuis la rentrée avec absences et retards, appel journalier ;
  - fiches de notes de la séquence 1 (validées, soumises, en brouillon), séquence 1 close en
    Tle F4 ;
  - parents, paiements APEE et frais d'examen (CAP, probatoire, bac), factures, échéanciers ;
  - compositions, CAP / probatoire / bac blancs et convocations ; cartes scolaires ;
  - personnel administratif, comptes enseignants et trois comptes élèves.
Tous les noms sont fictifs. Les comptes ont le mot de passe Demo2026!.
"""
import math
import random
from datetime import date, datetime, timedelta

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.models import (
    Absence, Annee, Appel, AppelLigne, CarteEtudiant, Classe, ClotureNotes, Convocation, Cours,
    Departement, Enseignant, Etablissement, Etudiant, EtudiantTuteur, Evaluation, Examen, Facture,
    FicheNotes, FicheNotesDetail, Inscription, Moratoire, Paiement, Pension, Periode, Personnel,
    Planning, Seance, Tranche, Tuteur, TypeEvaluation, Utilisateur,
)
from api.notes import importer_fiche
from api.management.commands.configurer_ltca import CODE, NIVEAUX, programme
from api.management.commands.seed_mbouda import NOMS_FAMILLE, PRENOMS_F_FR, PRENOMS_M_FR
from api.management.commands.seed_mbouda_2026 import CRENEAUX, JOURS, JOURS_PY, MOTIFS, tel

ANNEE, ANNEE_PREC = '2026-2027', '2025-2026'
MOT_DE_PASSE = make_password('Demo2026!')
RENTREE = date(2026, 9, 14)
CHARGE_MAX = 18                 # créneaux hebdomadaires maximum par enseignant
EFFECTIF_PREC = 9               # élèves par classe en 2025-2026
EFFECTIF_MIN = {'1A': 14, 'SE': 10}   # classes d'entrée en 2026-2027 ; 8 ailleurs
# Après le CAP (4ème année), série du second cycle ouverte à chaque spécialité.
APRES_CAP = {'ELEC': ['F3'], 'ELN': ['F2'], 'MACO': ['F4'], 'IS': ['IS'], 'FC': ['F5'], 'MEB': ['MEB', 'IB']}
SUIVANT = {'1A': '2A', '2A': '3A', '3A': '4A', 'SE': 'PR', 'PR': 'TL'}
FRAIS_EXAMEN = {'4AN_TECH': ('CAP', 5000), '1ERE_TECH': ('PROBATOIRE', 10000), 'TLE_TECH': ('BAC', 12000)}
LIB_BLANC = {'CAP': 'CAP blanc', 'PROBATOIRE': 'Probatoire blanc', 'BAC': 'Baccalauréat technique blanc'}
SECTION_MATIERE = {'TEC_ELECTEC': 'LTCA_EE', 'TEC_ELECTRON': 'LTCA_EE', 'TEC_MECA': 'LTCA_EE',
                   'TEC_CONSTR': 'LTCA_GC', 'TEC_RDM': 'LTCA_GC', 'TEC_HYDRO': 'LTCA_GC',
                   'TEC_FROID': 'LTCA_FC', 'TEC_BOIS': 'LTCA_BOIS'}
# Atelier des travaux pratiques de chaque spécialité / série.
ATELIER = {'ELEC': 'LTAEL', 'F3': 'LTAEL', 'ELN': 'LTAEN', 'F2': 'LTAEN', 'MACO': 'LTAGC', 'F4': 'LTAGC',
           'IS': 'LTAIS', 'FC': 'LTAFC', 'F5': 'LTAFC', 'MEB': 'LTABO', 'IB': 'LTABO'}
PERSONNEL = [
    # (mle, nom, prénom, sexe, poste, catégorie, contrat) — noms fictifs
    ('LTC_P01', 'Mbarga',  'Hélène',    'F', 'CENSEUR',     'DIRECTION',   'TITULAIRE'),
    ('LTC_P02', 'Onana',   'Paul',      'M', 'CENSEUR',     'DIRECTION',   'TITULAIRE'),
    ('LTC_P03', 'Ateba',   'Rosine',    'F', 'SURVEILLANT', 'PEDAGOGIQUE', 'TITULAIRE'),
    ('LTC_P04', 'Nkodo',   'Jean-Marie', 'M', 'ECONOME',    'ADMIN',       'TITULAIRE'),
    ('LTC_P05', 'Essomba', 'Carine',    'F', 'AGENT_SCOL',  'ADMIN',       'CONTRACTUEL'),
    ('LTC_P06', 'Abega',   'Thomas',    'M', 'GARDIEN',     'SOUTIEN',     'CONTRACTUEL'),
]


def code_classe(prefixe, serie):
    return f'LT{prefixe}{serie}'


class Command(BaseCommand):
    help = "Données fictives 2025-2026 et 2026-2027 du Lycée Technique Charles Atangana (aperçu par défaut)."

    def add_arguments(self, parser):
        parser.add_argument('--appliquer', action='store_true', help='Enregistre les données.')

    def handle(self, *args, **opts):
        random.seed(20261026)
        self.today = date.today()
        if not Etablissement.objects.filter(pk=CODE).exists():
            raise CommandError("LTCA n'existe pas : lancer d'abord configurer_ltca --appliquer.")
        if Inscription.objects.filter(etablissement_id=CODE).exists():
            raise CommandError('Des inscriptions existent déjà pour LTCA : génération déjà faite.')
        self.etab = Etablissement.objects.get(pk=CODE)
        self.annee = Annee.objects.get(pk=ANNEE)
        self.annee_prec = Annee.objects.get(pk=ANNEE_PREC)
        self.classes = {c.code_classe: c for c in Classe.objects.filter(etablissement=self.etab)}
        # (préfixe, série) de chaque classe, d'après la définition de configurer_ltca.
        self.cle = {code_classe(p, s): (p, s, niv) for niv, p, _, series in NIVEAUX for s in series}
        self.sections = {d.code_dep: d for d in Departement.objects.filter(etablissement=self.etab)}
        self.bilan, self.num = [], 0
        with transaction.atomic():
            self._annee_precedente()
            self._passages()
            self._enseignants_planning()
            self._cours_annee_precedente()
            self._seances_absences()
            self._appels()
            self._fiches_de_notes()
            self._parents()
            self._finances()
            self._examens()
            self._cartes()
            self._personnel_et_comptes()
            if not opts['appliquer']:
                transaction.set_rollback(True)
        for ligne in self.bilan:
            self.stdout.write('  ' + ligne)
        self.stdout.write(self.style.SUCCESS(
            '\nDonnées enregistrées (mot de passe des comptes : Demo2026!).' if opts['appliquer']
            else "\nAperçu uniquement : rien n'a été enregistré. Relancer avec --appliquer."))

    # ── Élèves ──────────────────────────────────────────────────────────────────
    def _nouvel_eleve(self, age_min, age_max):
        self.num += 1
        sexe = 'M' if random.random() < 0.72 else 'F'    # filières industrielles : majorité de garçons
        nom = random.choice(NOMS_FAMILLE)
        return Etudiant.objects.create(
            mle_etudiant=f'LTC{self.num:04d}', nom=nom, prenom=random.choice(PRENOMS_M_FR if sexe == 'M' else PRENOMS_F_FR),
            sexe=sexe, date_naiss=date(random.randint(age_min, age_max), random.randint(1, 12), random.randint(1, 28)),
            lieu='Yaoundé', region_or='CENTRE', nationalite='Camerounaise',
            nom_tuteur=f'{nom} {random.choice(PRENOMS_M_FR)}', tel=tel(), etablissement=self.etab)

    @staticmethod
    def _naissance(prefixe, decalage):
        rang = ['1A', '2A', '3A', '4A', 'SE', 'PR', 'TL'].index(prefixe)
        return 2013 - rang - decalage, 2014 - rang - decalage

    def _annee_precedente(self):
        self.repart_prec = {}
        for code, (prefixe, _, _) in self.cle.items():
            self.repart_prec[code] = [self._nouvel_eleve(*self._naissance(prefixe, 1)) for _ in range(EFFECTIF_PREC)]
        pension = Pension.objects.filter(etablissement=self.etab).first()
        Inscription.objects.bulk_create([
            Inscription(code_classe=self.classes[code], mle_etudiant=e, code_annee=self.annee_prec,
                        date_inscription=datetime(2025, 9, random.randint(1, 12)),
                        mt_inscription=int(pension.mt_inscription or 0), etablissement=self.etab)
            for code, eleves in self.repart_prec.items() for e in eleves])
        n = sum(len(v) for v in self.repart_prec.values())
        self.bilan.append(f'{ANNEE_PREC} : {n} élèves inscrits dans {len(self.repart_prec)} classes')

    def _passages(self):
        repartition = {code: [] for code in self.cle}
        promus = redoublants = partis = 0
        for code, eleves in self.repart_prec.items():
            prefixe, serie, _ = self.cle[code]
            for e in eleves:
                if random.random() < 0.10:
                    repartition[code].append(e)
                    redoublants += 1
                elif prefixe in SUIVANT:
                    repartition[code_classe(SUIVANT[prefixe], serie)].append(e)
                    promus += 1
                elif prefixe == '4A' and random.random() < 0.5:     # CAP obtenu, poursuite en seconde
                    repartition[code_classe('SE', random.choice(APRES_CAP[serie]))].append(e)
                    promus += 1
                else:
                    partis += 1
        nouveaux = 0
        for code, eleves in repartition.items():
            prefixe = self.cle[code][0]
            while len(eleves) < EFFECTIF_MIN.get(prefixe, 8):
                eleves.append(self._nouvel_eleve(*self._naissance(prefixe, 0)))
                nouveaux += 1
        pension = Pension.objects.filter(etablissement=self.etab).first()
        Inscription.objects.bulk_create([
            Inscription(code_classe=self.classes[code], mle_etudiant=e, code_annee=self.annee,
                        date_inscription=datetime(2026, 9, random.randint(1, 12)),
                        mt_inscription=int(pension.mt_inscription or 0), etablissement=self.etab)
            for code, eleves in repartition.items() for e in eleves])
        self.repartition = repartition
        self.eleves = [e for eleves in repartition.values() for e in eleves]
        self.niveau_eleve = {e.pk: random.gauss(11.3, 2.6) for e in set(self.eleves) | {e for v in self.repart_prec.values() for e in v}}
        self.bilan.append(f'{ANNEE} : {len(self.eleves)} élèves — {promus} passés en classe supérieure '
                          f'(dont entrées en seconde après le CAP), {redoublants} redoublants, {nouveaux} nouveaux ; '
                          f'{partis} sortis (CAP sans poursuite, terminales)')

    # ── Enseignants et emploi du temps 2026-2027 ────────────────────────────────
    def _nouvel_enseignant(self, matiere):
        self.nb_ens += 1
        sexe = random.choice('MMF')
        nom, prenom = random.choice(NOMS_FAMILLE), random.choice(PRENOMS_M_FR if sexe == 'M' else PRENOMS_F_FR)
        return Enseignant.objects.create(
            mle_ens=f'LTC_E{self.nb_ens:02d}', nom_ens=nom, prenom_ens=prenom, sexe=sexe,
            code_dep=self.sections.get(SECTION_MATIERE.get(matiere)), statut='FONCTIONNAIRE',
            etablissement=self.etab, tel_ens=tel(), email_ens=f'{prenom.lower()}.{nom.lower()}{self.nb_ens}@ltca.cm')

    def _enseignants_planning(self):
        self.nb_ens = 0
        pool, charge, plannings = {}, {}, []
        salle_occupee = set()   # (salle, jour, créneau) : deux classes partagent une salle
        self.cours = []
        self.ens_de = {}
        cours_existants = {(c.code_classe_id, c.code_matiere_id): c for c in
                           Cours.objects.filter(etablissement=self.etab, code_annee=self.annee)}
        for code, classe in self.classes.items():
            occupe = set()
            # Les matières les plus lourdes d'abord : elles trouvent plus facilement leurs créneaux.
            prog = sorted(programme(classe.niveau_scolaire_id, classe.serie).items(), key=lambda x: -x[1])
            for matiere, coef in prog:
                besoin = max(1, math.ceil(coef / 3))
                libres = [(j, k) for j in JOURS for k in range(len(CRENEAUX)) if (j, k) not in occupe]
                ens = None
                for candidat in sorted(pool.get(matiere, []), key=lambda e: len(charge.get(e.pk, ()))):
                    dispo = [s for s in libres if s not in charge.get(candidat.pk, set())]
                    if len(charge.get(candidat.pk, ())) + besoin <= CHARGE_MAX and len(dispo) >= besoin:
                        ens = candidat
                        break
                if ens is None:
                    ens = self._nouvel_enseignant(matiere)
                    pool.setdefault(matiere, []).append(ens)
                cours = cours_existants.get((code, matiere)) or Cours.objects.create(
                    code_matiere_id=matiere, code_classe=classe, semestre='AN', code_annee=self.annee,
                    quota_horaire=30 * coef, etablissement=self.etab)
                cours.mle_ens = ens
                cours.save(update_fields=['mle_ens'])
                self.cours.append(cours)
                self.ens_de[(code, matiere)] = ens
                dispo = [s for s in libres if s not in charge.get(ens.pk, set())]
                choisis = []
                for s in sorted(dispo, key=lambda s: (JOURS.index(s[0]) * 7 % 5, s[1])):
                    if len(choisis) == besoin:
                        break
                    if all(x[0] != s[0] for x in choisis) or len(dispo) <= besoin * 2:
                        choisis.append(s)
                for jour, k in choisis:
                    occupe.add((jour, k))
                    charge.setdefault(ens.pk, set()).add((jour, k))
                    # TP à l'atelier de la spécialité s'il est libre, sinon dans la salle de la
                    # classe (une salle par classe : toujours libre quand la classe l'est).
                    salle = ATELIER[classe.serie] if matiere == 'TEC_TP' else classe.code_salle_id
                    if (salle, jour, k) in salle_occupee:
                        salle = classe.code_salle_id if (classe.code_salle_id, jour, k) not in salle_occupee else None
                    if salle:
                        salle_occupee.add((salle, jour, k))
                    plannings.append(Planning(code_cours=cours, type_planning='HEBDO',
                                              type_seance='TP' if matiere == 'TEC_TP' else 'CM', code_jour_id=jour,
                                              h_debut=CRENEAUX[k][0], h_fin=CRENEAUX[k][1], code_salle_id=salle))
        Planning.objects.bulk_create(plannings)
        self.plannings = list(Planning.objects.filter(code_cours__in=self.cours).select_related('code_cours'))
        sans_salle = sum(1 for p in plannings if not p.code_salle_id)
        self.bilan.append(f'{self.nb_ens} enseignants ; {len(self.cours)} cours {ANNEE} attribués ; '
                          f'{len(self.plannings)} créneaux hebdomadaires (charge ≤ {CHARGE_MAX} par enseignant ; '
                          f'TP en atelier quand il est libre ; {sans_salle} sans salle)')

    # ── Année précédente : cours, notes, paiements ──────────────────────────────
    def _cours_annee_precedente(self):
        cours_prec, evaluations = [], []
        ds = TypeEvaluation.objects.get(pk=6)
        seq1_prec = Periode.objects.get(code_annee=self.annee_prec, type_etab='SECONDAIRE', lib_periode='Séquence 1')
        for code, classe in self.classes.items():
            for matiere, coef in programme(classe.niveau_scolaire_id, classe.serie).items():
                cours_prec.append(Cours(code_matiere_id=matiere, code_classe=classe, mle_ens=self.ens_de[(code, matiere)],
                                        semestre='AN', code_annee=self.annee_prec, quota_horaire=30 * coef,
                                        etablissement=self.etab))
                for e in self.repart_prec[code]:
                    note = max(1.0, min(19.75, round((self.niveau_eleve[e.pk] + random.gauss(0, 2.4)) * 4) / 4))
                    evaluations.append(Evaluation(
                        mle_etudiant=e, code_matiere_id=matiere, code_classe=classe, note=note,
                        date_eval=datetime(2025, 10, random.randint(6, 24)), code_periode=seq1_prec,
                        code_type_eval=ds, code_annee=self.annee_prec, etablissement=self.etab))
        Cours.objects.bulk_create(cours_prec)
        Evaluation.objects.bulk_create(evaluations, batch_size=1000)
        tranches = list(Tranche.objects.filter(code_pension__etablissement=self.etab).order_by('code_tranche'))
        paiements = []
        for i, e in enumerate([e for v in self.repart_prec.values() for e in v]):
            verse = tranches if i % 10 < 6 else tranches[:1] if i % 10 < 9 else []
            for t in verse:
                paiements.append(Paiement(mle_etudiant=e, code_annee=self.annee_prec, code_tranche=t, type_paiement='APEE',
                                          mt_paiement=t.mt_tranche, statut='PAYE', mode_paiement='ESPECES',
                                          date_paiement=datetime(2025, 10, random.randint(1, 28)),
                                          obs_paiement='Contribution APEE', etablissement=self.etab))
        Paiement.objects.bulk_create(paiements)
        self.bilan.append(f'{ANNEE_PREC} : {len(cours_prec)} cours, {len(evaluations)} notes (séquence 1), '
                          f'{len(paiements)} paiements APEE')

    # ── Séances, absences, appel journalier ─────────────────────────────────────
    def _seances_absences(self):
        inscrits = {code: [e.pk for e in eleves] for code, eleves in self.repartition.items()}
        self.absenteistes = set(random.sample([m for v in inscrits.values() for m in v], 3))
        seances, jour = [], RENTREE
        while jour <= self.today:
            for p in self.plannings:
                if JOURS_PY.get(p.code_jour_id) == jour.weekday():
                    c = p.code_cours
                    seances.append(Seance(code_matiere_id=c.code_matiere_id, code_classe_id=c.code_classe_id, mle_ens_id=c.mle_ens_id,
                                          code_annee=self.annee, date_seance=jour, h_debut=p.h_debut, h_fin=p.h_fin,
                                          nb_heures_effectuees=1.83, statut='TENU', etablissement=self.etab))
            jour += timedelta(days=1)
        Seance.objects.bulk_create(seances, batch_size=1000)
        absences, n_abs, n_ret = [], 0, 0
        for s in Seance.objects.filter(etablissement=self.etab, code_annee=self.annee).only('pk', 'code_classe_id'):
            for mle in inscrits[s.code_classe_id]:
                r = random.random()
                seuil = 0.30 if mle in self.absenteistes else 0.03
                if r < seuil:
                    justifiee = mle not in self.absenteistes and random.random() < 0.4
                    absences.append(Absence(code_seance=s, mle_etudiant_id=mle, present=False, justifiee=justifiee,
                                            motif=random.choice(MOTIFS) if justifiee else None))
                    n_abs += 1
                elif r < seuil + 0.02:
                    absences.append(Absence(code_seance=s, mle_etudiant_id=mle, present=True,
                                            retard_minutes=random.choice([5, 10, 15, 20, 30])))
                    n_ret += 1
        Absence.objects.bulk_create(absences, batch_size=2000)
        self.bilan.append(f'Séances du {RENTREE:%d/%m/%Y} au {self.today:%d/%m/%Y} : {len(seances)} ; {n_abs} absences, '
                          f'{n_ret} retards ; 3 élèves très absents ({", ".join(sorted(self.absenteistes))})')

    def _appels(self):
        jours = [self.today - timedelta(days=d) for d in range(7) if (self.today - timedelta(days=d)).weekday() < 5]
        classes_appel = ['LT1AELEC', 'LT1AMACO', 'LT2AELN', 'LTSEF3']
        n = 0
        for code in classes_appel:
            for jour in jours:
                appel = Appel.objects.create(etablissement=self.etab, code_classe=self.classes[code], date=jour,
                                             creneau='MATIN', fait_par='ltca_sg')
                lignes = []
                for e in self.repartition[code]:
                    r = random.random()
                    statut = 'ABSENT' if r < 0.04 else 'RETARD' if r < 0.07 else 'PRESENT'
                    lignes.append(AppelLigne(appel=appel, mle_etudiant=e, statut=statut,
                                             minutes_retard=random.choice([5, 10, 15]) if statut == 'RETARD' else 0))
                AppelLigne.objects.bulk_create(lignes)
                n += len(lignes)
        self.bilan.append(f'Appel journalier (matin) : {len(classes_appel)} classes × {len(jours)} jours, {n} lignes')

    # ── Fiches de notes de la séquence 1 ────────────────────────────────────────
    def _fiches_de_notes(self):
        seq1 = Periode.objects.get(code_annee=self.annee, type_etab='SECONDAIRE', lib_periode='Séquence 1')
        ds, interro, tp = (TypeEvaluation.objects.get(pk=pk) for pk in (6, 8, 9))
        statuts = {'VALIDE': 0, 'SOUMIS': 0, 'BROUILLON': 0}
        reportees = 0
        for cours in self.cours:
            code = cours.code_classe_id
            evals = [(tp, 20)] if cours.code_matiere_id == 'TEC_TP' else \
                [(ds, 20)] + ([(interro, 10)] if cours.code_matiere_id in ('SEC_MAT', 'SEC_FRA') else [])
            for type_eval, bareme in evals:
                r = random.random()
                statut = 'VALIDE' if code == 'LTTLF4' or r < 0.70 else 'SOUMIS' if r < 0.85 else 'BROUILLON'
                fiche = FicheNotes.objects.create(
                    code_matiere_id=cours.code_matiere_id, code_classe_id=code, mle_ens_id=cours.mle_ens_id,
                    code_periode=seq1, code_annee=self.annee, code_type_eval=type_eval,
                    date_evaluation=date(2026, 9, 28) + timedelta(days=random.randint(0, 11)),
                    bareme=bareme, statut='BROUILLON', etablissement=self.etab)
                details = []
                for e in self.repartition[code]:
                    if random.random() < 0.025:
                        details.append(FicheNotesDetail(code_fiche=fiche, mle_etudiant=e, absent=True, justifie=random.random() < 0.5))
                    else:
                        n = max(1.0, min(19.75, self.niveau_eleve[e.pk] + random.gauss(0, 2.4)))
                        details.append(FicheNotesDetail(code_fiche=fiche, mle_etudiant=e, note=round(n * bareme / 20 * 4) / 4))
                FicheNotesDetail.objects.bulk_create(details)
                if statut == 'VALIDE':
                    reportees += importer_fiche(fiche)
                fiche.statut = statut
                fiche.save(update_fields=['statut'])
                statuts[statut] += 1
        ClotureNotes.objects.create(etablissement=self.etab, code_classe=self.classes['LTTLF4'],
                                    code_periode=seq1, cloturee_par='ltca_censeur')
        self.bilan.append(f'Fiches de notes (séquence 1) : {statuts["VALIDE"]} validées, {statuts["SOUMIS"]} soumises, '
                          f'{statuts["BROUILLON"]} en brouillon ; {reportees} notes reportées ; séquence 1 close en Tle F4')

    # ── Parents ─────────────────────────────────────────────────────────────────
    def _parents(self):
        tous = {e.pk: e for v in self.repart_prec.values() for e in v}
        tous.update({e.pk: e for e in self.eleves})
        for e in tous.values():
            lien = random.choice(['Père', 'Mère', 'Oncle', 'Tante'])
            t = Tuteur.objects.create(nom=e.nom, prenom=random.choice(PRENOMS_F_FR if lien in ('Mère', 'Tante') else PRENOMS_M_FR),
                                      lien_parente=lien, tel=tel(), adresse='Yaoundé', etablissement=self.etab)
            EtudiantTuteur.objects.create(mle_etudiant=e, code_tuteur=t, est_contact_principal=True)
        self.bilan.append(f'Parents : {len(tous)} créés et reliés à leur enfant')

    # ── Finances 2026-2027 ──────────────────────────────────────────────────────
    def _finances(self):
        tranches = list(Tranche.objects.filter(code_pension__etablissement=self.etab).order_by('code_tranche'))
        total = sum(t.mt_tranche for t in tranches)
        paiements, factures, moratoires = [], [], []
        niveau_de = {e.pk: self.cle[code][2] for code, eleves in self.repartition.items() for e in eleves}
        for i, e in enumerate(self.eleves, start=1):
            r = random.random()
            verse = ([(t, t.mt_tranche, 'PAYE') for t in tranches] if r < 0.55 else
                     [(tranches[0], tranches[0].mt_tranche, 'PAYE')] if r < 0.80 else
                     [(tranches[0], tranches[0].mt_tranche // 2, 'PARTIEL')] if r < 0.90 else [])
            for t, montant, statut in verse:
                paiements.append(Paiement(mle_etudiant=e, code_annee=self.annee, code_tranche=t, type_paiement='APEE',
                                          mt_paiement=montant, statut=statut, mode_paiement=random.choice(['ESPECES', 'MOBILE_MONEY']),
                                          ref_paiement=f'APEE-LTC-{i:04d}-{t.pk}', obs_paiement='Contribution APEE',
                                          date_paiement=datetime(2026, random.choice([9, 10]), random.randint(1, 15)),
                                          etablissement=self.etab))
            paye = sum(m for _, m, _ in verse)
            factures.append(Facture(numero_facture=f'LTC-2627-{i:04d}', mle_etudiant=e, code_annee=self.annee,
                                    date_emission=RENTREE, montant_total=total, montant_paye=paye,
                                    statut='SOLDEE' if paye >= total else 'PARTIELLEMENT_PAYEE' if paye else 'EN_ATTENTE',
                                    etablissement=self.etab))
            if not paye:
                moratoires.append(Moratoire(lib_mor=f'Échéancier APEE {ANNEE}', date_effet=date(2026, 10, 1),
                                            date_exp=date(2026, 12, 15), mle_etudiant=e, etablissement=self.etab))
            examen = FRAIS_EXAMEN.get(niveau_de[e.pk])
            if examen and random.random() < 0.6:
                paiements.append(Paiement(mle_etudiant=e, code_annee=self.annee, type_paiement='EXAMEN_OFFICIEL',
                                          mt_paiement=examen[1], statut='PAYE', mode_paiement='ESPECES',
                                          ref_paiement=f'EXO-LTC-{i:04d}', obs_paiement=f'Frais {examen[0]}',
                                          date_paiement=datetime(2026, 10, random.randint(1, 15)), etablissement=self.etab))
        Paiement.objects.bulk_create(paiements)
        Facture.objects.bulk_create(factures)
        Moratoire.objects.bulk_create(moratoires)
        self.bilan.append(f'Finances {ANNEE} : {len(paiements)} paiements (APEE + CAP / probatoire / bac), '
                          f'{len(factures)} factures, {len(moratoires)} échéanciers')

    # ── Examens et convocations ─────────────────────────────────────────────────
    def _examens(self):
        t1 = Periode.objects.get(code_annee=self.annee, type_etab='SECONDAIRE', lib_periode='Trimestre 1 SEC')
        examens = []
        for code, classe in self.classes.items():
            prefixe, serie, niveau = self.cle[code]
            for j, matiere in enumerate(['SEC_FRA', 'SEC_MAT']):
                examens.append(Examen(lib_examen='Composition du 1er trimestre', code_matiere_id=matiere, code_classe=classe,
                                      code_annee=self.annee, code_periode=t1, code_salle=classe.code_salle_id,
                                      date_examen=datetime(2026, 12, 7 + j, 8, 0), duree_minutes=180, type_examen='ECRIT',
                                      organisme='INTERNE', etablissement=self.etab))
            if niveau in FRAIS_EXAMEN:
                officiel = FRAIS_EXAMEN[niveau][0]
                matiere = max(programme(niveau, serie).items(), key=lambda x: x[1])[0]   # matière dominante
                examens.append(Examen(lib_examen=LIB_BLANC[officiel], code_matiere_id=matiere, code_classe=classe,
                                      code_annee=self.annee, code_salle=classe.code_salle_id,
                                      date_examen=datetime(2027, 2, 15, 8, 0), duree_minutes=240, type_examen='PRATIQUE'
                                      if matiere == 'TEC_TP' else 'ECRIT', type_officiel=officiel, organisme='INTERNE',
                                      etablissement=self.etab))
        Examen.objects.bulk_create(examens)
        convocations = [
            Convocation(type_convocation='EXAMEN', destinataire_type='ETUDIANT', mle_etudiant=e, code_examen=ex,
                        objet=f'Convocation — {ex.lib_examen}', date_evenement=ex.date_examen,
                        lieu='Lycée Technique Charles Atangana', statut='ENVOYEE',
                        message="Se présenter 30 minutes avant le début de l'épreuve, en tenue d'atelier pour les épreuves pratiques.")
            for ex in Examen.objects.filter(etablissement=self.etab, code_annee=self.annee, type_officiel__isnull=False)
            for e in self.repartition[ex.code_classe_id]]
        Convocation.objects.bulk_create(convocations)
        self.bilan.append(f'Examens : {len(examens)} (compositions, CAP / probatoire / bac blancs) ; {len(convocations)} convocations')

    def _cartes(self):
        CarteEtudiant.objects.bulk_create([
            CarteEtudiant(mle_etudiant=e, code_annee=self.annee, numero_carte=f'LTC-2627-{e.pk[3:]}',
                          date_emission=date(2026, 9, 21), date_expiration=date(2027, 7, 31), statut='ACTIVE',
                          etablissement=self.etab) for e in self.eleves])
        self.bilan.append(f'Cartes scolaires : {len(self.eleves)}')

    # ── Personnel et comptes ────────────────────────────────────────────────────
    def _compte(self, login, role, nom_user):
        u, _ = Utilisateur.objects.update_or_create(login=login, defaults={
            'passwd': MOT_DE_PASSE, 'role': role, 'etablissement': self.etab, 'nom_user': nom_user})
        User.objects.get_or_create(username=login, defaults={'is_active': True})
        return u

    def _personnel_et_comptes(self):
        for mle, nom, prenom, sexe, poste, categorie, contrat in PERSONNEL:
            Personnel.objects.update_or_create(mle_personnel=mle, defaults={
                'nom': nom, 'prenom': prenom, 'sexe': sexe, 'etablissement': self.etab, 'poste': poste,
                'categorie': categorie, 'type_contrat': contrat, 'date_embauche': date(2015, 9, 1), 'actif': True, 'tel': tel()})
        n_ens = 0
        for ens in Enseignant.objects.filter(etablissement=self.etab, utilisateur__isnull=True).order_by('mle_ens'):
            n_ens += 1
            ens.utilisateur = self._compte(f'ltca_ens{n_ens}', 'ENSEIGNANT', f'{ens.prenom_ens} {ens.nom_ens}')
            ens.save(update_fields=['utilisateur'])
        comptes_eleves = []
        for i, code in enumerate(['LT1AELEC', 'LT4AMACO', 'LTTLF3'], start=1):
            e = self.repartition[code][0]
            e.utilisateur = self._compte(f'ltca_eleve{i}', 'ETUDIANT', f'{e.prenom} {e.nom}')
            e.save(update_fields=['utilisateur'])
            comptes_eleves.append(f'ltca_eleve{i} ({self.classes[code].lib_classe})')
        self.bilan.append(f'Personnel : {len(PERSONNEL)} agents ; comptes : {n_ens} enseignants (ltca_ens1…), '
                          f'élèves : {", ".join(comptes_eleves)}')
