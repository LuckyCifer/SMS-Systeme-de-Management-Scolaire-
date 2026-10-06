"""
seed_mbouda.py — Données réalistes pour le Lycée Bilingue de Mbouda (ETAB002)

Établissement secondaire public BILINGUE (Ouest, Mbouda — région à forte identité
Bamiléké), utilisé comme cas d'usage concret du double système linguistique
(Classe.systeme FRANCOPHONE/ANGLOPHONE) et des rôles réels d'établissement
(CENSEUR, SURVEILLANT_GENERAL, APEE).

Idempotent : relançable sans risque (get_or_create / update_or_create).

Usage :
    python manage.py seed_mbouda
"""
import random
from datetime import date, datetime, timedelta

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import (
    Annee, Classe, Cours, Departement, Enseignant, Etablissement, Etudiant,
    Evaluation, Inscription, Jour, Matiere, Paiement, Periode, Personnel,
    Planning, Pension, Salle, Tranche, TypeEvaluation, Utilisateur,
)

ETAB_CODE  = 'ETAB002'
ANNEE_CODE = '2025-2026'
DEMO_PWD   = make_password('Demo2026!')

random.seed(20260813)

# ── Réservoir de noms (Ouest / Bamiléké — cohérent avec Mbouda) ───────────────
NOMS_FAMILLE = [
    'Kamdem', 'Tchoumi', 'Fotso', 'Djoumessi', 'Wandji', 'Kenfack', 'Tchinda',
    'Nguemo', 'Tchatchouang', 'Kengne', 'Tankeu', 'Nana', 'Ngassa', 'Kuate',
    'Youmbi', 'Talla', 'Feudjio', 'Meli', 'Sonfack', 'Ngueguim', 'Djiotsa',
    'Wafo', 'Kammogne', 'Fondja', 'Chatue', 'Tueguem', 'Fotsing', 'Kamga',
    'Mekontso', 'Tchamba', 'Nzeukou', 'Tiotsop', 'Kengap', 'Djuidje', 'Wamba',
]
PRENOMS_M_FR = [
    'Cédric', 'Junior', 'Steve', 'Arsène', 'Franck', 'Gaël', 'Yannick',
    'Merlin', 'Boris', 'Ivan', 'Landry', 'Christian', 'Loïc', 'Rodrigue',
    'Achille', 'Emmanuel', 'Blaise', 'Guy', 'Hervé', 'Patrick',
]
PRENOMS_F_FR = [
    'Carine', 'Estelle', 'Nadège', 'Sandrine', 'Larissa', 'Vanessa', 'Gaëlle',
    'Prisca', 'Aurore', 'Judith', 'Divine', 'Rachel', 'Christelle',
    'Pulchérie', 'Bibiane', 'Alvine', 'Sonia', 'Doriane', 'Fabiola', 'Grace',
]
PRENOMS_M_EN = [
    'Prince', 'Divine', 'Confidence', 'Godlove', 'Precious', 'Marvellous',
    'Ebenezer', 'Nixon', 'Clinton', 'Derrick', 'Kelvin', 'Terence', 'Collins',
]
PRENOMS_F_EN = [
    'Precious', 'Delight', 'Blessing', 'Comfort', 'Providence', 'Loveline',
    'Gratitude', 'Confidence', 'Destiny', 'Serena', 'Faith', 'Charity',
]

_name_seq = 0
def next_nom_prenom(track, sexe):
    """Génère un couple (nom, prénom) déterministe et sans répétition immédiate."""
    global _name_seq
    _name_seq += 1
    nom = NOMS_FAMILLE[_name_seq % len(NOMS_FAMILLE)]
    if track == 'EN':
        pool = PRENOMS_M_EN if sexe == 'M' else PRENOMS_F_EN
    else:
        pool = PRENOMS_M_FR if sexe == 'M' else PRENOMS_F_FR
    prenom = pool[(_name_seq * 7) % len(pool)]
    return nom, prenom


# ── Structure des classes : (code, libellé, niveau_scolaire, systeme, eff_max, effectif) ──
NIVEAUX = [
    # Premier cycle francophone
    ('MBD_6EA',  '6ème A',         '6EME_FR', 'FRANCOPHONE', 60, 24, 1),
    ('MBD_5EA',  '5ème A',         '5EME_FR', 'FRANCOPHONE', 60, 22, 1),
    ('MBD_4EA',  '4ème A',         '4EME_FR', 'FRANCOPHONE', 60, 20, 1),
    ('MBD_3EA',  '3ème A',         '3EME_FR', 'FRANCOPHONE', 55, 18, 1),
    # Second cycle francophone
    ('MBD_2NDA', '2nde A',         '2NDE_FR', 'FRANCOPHONE', 45, 16, 2),
    ('MBD_1EREA','1ère A',         '1ERE_FR', 'FRANCOPHONE', 40, 14, 2),
    ('MBD_TLEA', 'Terminale A',    'TLE_FR',  'FRANCOPHONE', 40, 12, 2),
    # Premier cycle anglophone (Lower Secondary)
    ('MBD_F1A',  'Form 1 A',       'F1_EN',   'ANGLOPHONE',  60, 20, 1),
    ('MBD_F2A',  'Form 2 A',       'F2_EN',   'ANGLOPHONE',  60, 18, 1),
    ('MBD_F3A',  'Form 3 A',       'F3_EN',   'ANGLOPHONE',  55, 16, 1),
    ('MBD_F4A',  'Form 4 A',       'F4_EN',   'ANGLOPHONE',  55, 14, 1),
    # Second cycle anglophone (Upper Secondary)
    ('MBD_LSA',  'Lower Sixth A',  'LS_EN',   'ANGLOPHONE',  40, 10, 2),
    ('MBD_USA',  'Upper Sixth A',  'US_EN',   'ANGLOPHONE',  35,  8, 2),
]

MATIERES_PREMIER_CYCLE = ['SEC_FRA', 'SEC_ANG', 'SEC_MAT', 'SEC_HGO', 'SEC_PCH', 'SEC_SVT', 'SEC_EPS', 'SEC_ECM']
MATIERES_SECOND_CYCLE  = MATIERES_PREMIER_CYCLE + ['SEC_PHI', 'SEC_INF']

JOURS_SEMAINE = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']
CRENEAUX = [('07:30', '08:25'), ('08:25', '09:20'), ('09:35', '10:30'), ('10:30', '11:25'), ('11:40', '12:35'), ('12:35', '13:30')]

ENSEIGNANTS = [
    # (mle, nom, prenom, sexe, matieres)
    ('MBD_E01', 'Kamdem',   'Paul',        'M', ['SEC_MAT']),
    ('MBD_E02', 'Fotso',    'Bernadette',  'F', ['SEC_MAT', 'SEC_PCH']),
    ('MBD_E03', 'Wandji',   'Emmanuel',    'M', ['SEC_PCH']),
    ('MBD_E04', 'Nguemo',   'Solange',     'F', ['SEC_SVT']),
    ('MBD_E05', 'Tchinda',  'Robert',      'M', ['SEC_FRA']),
    ('MBD_E06', 'Kenfack',  'Marceline',   'F', ['SEC_FRA', 'SEC_PHI']),
    ('MBD_E07', 'Nkeng',    'Divine',      'F', ['SEC_ANG']),
    ('MBD_E08', 'Fongang',  'Terence',     'M', ['SEC_ANG']),
    ('MBD_E09', 'Kengne',   'Jules',       'M', ['SEC_HGO']),
    ('MBD_E10', 'Talla',    'Odette',      'F', ['SEC_HGO', 'SEC_ECM']),
    ('MBD_E11', 'Djoumessi','André',       'M', ['SEC_EPS']),
    ('MBD_E12', 'Youmbi',   'Isaac',       'M', ['SEC_INF']),
    ('MBD_E13', 'Tankeu',   'Chantal',     'F', ['SEC_ECM']),
    ('MBD_E14', 'Feudjio',  'Vincent',     'M', ['SEC_PHI']),
]

PERSONNEL_ADMIN = [
    # (mle, nom, prenom, sexe, poste, categorie, contrat)
    ('MBD_P01', 'Tchoumi',  'Grégoire',  'M', 'PROVISEUR',   'DIRECTION',   'TITULAIRE'),
    ('MBD_P02', 'Kamga',    'Ferdinand', 'M', 'CENSEUR',     'DIRECTION',   'TITULAIRE'),
    ('MBD_P03', 'Ngassa',   'Delphine',  'F', 'SURVEILLANT', 'PEDAGOGIQUE', 'TITULAIRE'),
    ('MBD_P04', 'Sonfack',  'Albert',    'M', 'ECONOME',     'ADMIN',       'TITULAIRE'),
    ('MBD_P05', 'Djiotsa',  'Clarisse',  'F', 'AGENT_SCOL',  'ADMIN',       'CONTRACTUEL'),
    ('MBD_P06', 'Wafo',     'Bertrand',  'M', 'GARDIEN',     'SOUTIEN',     'CONTRACTUEL'),
]


class Command(BaseCommand):
    help = 'Peuple le Lycée Bilingue de Mbouda (ETAB002) avec des données réalistes'

    def handle(self, *args, **options):
        try:
            etab = Etablissement.objects.get(code_etab=ETAB_CODE)
        except Etablissement.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"Établissement {ETAB_CODE} introuvable."))
            return
        annee = Annee.objects.get(code_annee=ANNEE_CODE)

        with transaction.atomic():
            dep       = self._departement(etab)
            classes   = self._classes(etab, dep)
            pension, tranches = self._pension_apee(etab)
            enseignants = self._enseignants(etab, dep)
            self._personnel(etab)
            etudiants = self._etudiants(etab, dep, classes)
            self._inscriptions(etab, annee, etudiants, pension)
            cours = self._cours(etab, annee, classes, enseignants)
            self._planning(cours)
            self._evaluations(etab, cours)
            self._paiements(etab, annee, etudiants, tranches)
            self._utilisateurs(etab, enseignants)

        total_etudiants = sum(len(v) for v in etudiants.values())
        self.stdout.write(self.style.SUCCESS(
            f"Lycée Bilingue de Mbouda ({ETAB_CODE}) peuplé : "
            f"{len(classes)} classes, {total_etudiants} élèves, {len(enseignants)} enseignants."
        ))

    # ── Structure académique ──────────────────────────────────────────────────
    def _departement(self, etab):
        dep, _ = Departement.objects.get_or_create(
            code_dep='DEP_MBOUDA',
            defaults={'lib_dep': 'Enseignement Secondaire Général', 'etablissement': etab},
        )
        return dep

    def _classes(self, etab, dep):
        classes = {}
        for code, lib, niveau_scol, systeme, eff_max, _effectif, _cycle in NIVEAUX:
            classe, _ = Classe.objects.update_or_create(
                code_classe=code,
                defaults={
                    'lib_classe': lib, 'code_dep': dep, 'niveau_scolaire_id': niveau_scol,
                    'eff_max': eff_max, 'etablissement': etab, 'systeme': systeme,
                },
            )
            classes[code] = classe
        self.stdout.write(f"  {len(classes)} classes (7 francophones + 6 anglophones)")
        return classes

    def _pension_apee(self, etab):
        # Établissement PUBLIC : la scolarité est nominalement gratuite, le coût réel pour
        # les familles est la contribution APEE (voir doc de référence système éducatif).
        pension, _ = Pension.objects.get_or_create(
            lib_pension='APEE Lycée Mbouda',
            defaults={'mt_pension': 12000, 'mt_inscription': 3000, 'nb_tranche': 2, 'type_etab': 'SECONDAIRE'},
        )
        tranches = []
        for i, montant in enumerate([7000, 5000], start=1):
            tranche, _ = Tranche.objects.get_or_create(
                code_pension=pension, lib_tranche=f'Tranche {i}',
                defaults={'mt_tranche': montant},
            )
            tranches.append(tranche)
        return pension, tranches

    # ── Personnes ──────────────────────────────────────────────────────────────
    def _enseignants(self, etab, dep):
        created = {}
        for mle, nom, prenom, sexe, _mats in ENSEIGNANTS:
            ens, _ = Enseignant.objects.update_or_create(
                mle_ens=mle,
                defaults={
                    'nom_ens': nom, 'prenom_ens': prenom, 'sexe': sexe, 'code_dep': dep,
                    'statut': 'FONCTIONNAIRE', 'etablissement': etab,
                    'tel_ens': f'+237 6{random.randint(70,99)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}',
                    'email_ens': f'{prenom.lower()}.{nom.lower()}@lyceembouda.cm',
                },
            )
            created[mle] = ens
        self.stdout.write(f"  {len(created)} enseignants")
        return created

    def _personnel(self, etab):
        for mle, nom, prenom, sexe, poste, categorie, contrat in PERSONNEL_ADMIN:
            Personnel.objects.update_or_create(
                mle_personnel=mle,
                defaults={
                    'nom': nom, 'prenom': prenom, 'sexe': sexe, 'etablissement': etab,
                    'poste': poste, 'categorie': categorie, 'type_contrat': contrat,
                    'date_embauche': date(2018, 9, 1), 'actif': True,
                    'tel': f'+237 6{random.randint(70,99)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}',
                },
            )
        self.stdout.write(f"  {len(PERSONNEL_ADMIN)} agents de personnel (Proviseur, Censeur, Surveillant Général, Économe…)")

    def _etudiants(self, etab, dep, classes):
        etudiants = {}
        idx = 0
        # Âge indicatif croissant avec le niveau (~11 ans en 6ème/Form1 jusqu'à ~19 en Tle/US).
        for niveau_pos, (code, _lib, _niv, systeme, _eff_max, effectif, _cycle) in enumerate(NIVEAUX):
            track = 'EN' if systeme == 'ANGLOPHONE' else 'FR'
            annee_naiss = 2014 - niveau_pos
            for i in range(effectif):
                idx += 1
                sexe = 'M' if i % 2 == 0 else 'F'
                nom, prenom = next_nom_prenom(track, sexe)
                mle = f"MBD{idx:04d}"
                etu, _ = Etudiant.objects.update_or_create(
                    mle_etudiant=mle,
                    defaults={
                        'nom': nom, 'prenom': prenom, 'sexe': sexe,
                        'date_naiss': date(annee_naiss, random.randint(1, 12), random.randint(1, 28)),
                        'lieu': 'Mbouda', 'region_or': 'OUEST', 'nationalite': 'Camerounaise',
                        'code_dep': dep, 'nom_tuteur': f"{random.choice(NOMS_FAMILLE)} {random.choice(PRENOMS_M_FR)}",
                        'tel': f'+237 6{random.randint(70,99)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}',
                        'etablissement': etab,
                    },
                )
                etudiants.setdefault(code, []).append(etu)
        total = sum(len(v) for v in etudiants.values())
        self.stdout.write(f"  {total} élèves")
        return etudiants

    # ── Inscriptions & finances ───────────────────────────────────────────────
    def _inscriptions(self, etab, annee, etudiants_par_classe, pension):
        count = 0
        for code, etus in etudiants_par_classe.items():
            classe = Classe.objects.get(code_classe=code)
            for etu in etus:
                Inscription.objects.update_or_create(
                    mle_etudiant=etu, code_annee=annee,
                    defaults={
                        'code_classe': classe, 'date_inscription': datetime(2025, 9, 8),
                        'mt_inscription': int(pension.mt_inscription), 'etablissement': etab,
                    },
                )
                count += 1
        self.stdout.write(f"  {count} inscriptions ({ANNEE_CODE})")

    def _paiements(self, etab, annee, etudiants_par_classe, tranches):
        count = 0
        all_etus = [e for etus in etudiants_par_classe.values() for e in etus]
        for i, etu in enumerate(all_etus):
            # Répartition réaliste : la majorité a soldé, certains sont partiels ou en retard.
            roll = i % 10
            if roll < 6:
                statuts_tranches = [('PAYE', tranches[0]), ('PAYE', tranches[1])]
            elif roll < 8:
                statuts_tranches = [('PAYE', tranches[0]), ('PARTIEL', tranches[1])]
            else:
                statuts_tranches = [('PAYE', tranches[0])]
            for statut, tranche in statuts_tranches:
                montant = tranche.mt_tranche if statut == 'PAYE' else tranche.mt_tranche // 2
                Paiement.objects.get_or_create(
                    mle_etudiant=etu, code_annee=annee, code_tranche=tranche, type_paiement='APEE',
                    defaults={
                        'mt_paiement': montant, 'statut': statut, 'mode_paiement': 'ESPECES',
                        'date_paiement': datetime(2025, 10, random.randint(1, 28)),
                        'obs_paiement': 'Contribution APEE' if statut == 'PAYE' else 'Versement partiel',
                        'etablissement': etab,
                    },
                )
                count += 1
        self.stdout.write(f"  {count} paiements APEE")

    # ── Pédagogie ──────────────────────────────────────────────────────────────
    def _cours(self, etab, annee, classes, enseignants):
        # Table matière -> enseignant (le premier de ENSEIGNANTS qui l'enseigne)
        prof_par_matiere = {}
        for mle, _n, _p, _s, mats in ENSEIGNANTS:
            for m in mats:
                prof_par_matiere.setdefault(m, enseignants[mle])

        cours = []
        for code, _lib, _niv, _systeme, _eff, _effectif, cycle in NIVEAUX:
            classe = classes[code]
            matieres = MATIERES_SECOND_CYCLE if cycle == 2 else MATIERES_PREMIER_CYCLE
            for mat_code in matieres:
                for semestre in ['S1', 'S2']:
                    c, _ = Cours.objects.update_or_create(
                        code_matiere_id=mat_code, code_classe=classe, semestre=semestre, code_annee=annee,
                        defaults={
                            'mle_ens': prof_par_matiere.get(mat_code), 'quota_horaire': 30,
                            'credits': 0, 'etablissement': etab,
                        },
                    )
                    cours.append(c)
        self.stdout.write(f"  {len(cours)} cours (attribution matière/classe/semestre)")
        return cours

    def _planning(self, cours_list):
        # Un seul créneau hebdomadaire par cours S1, en évitant les conflits salle/enseignant/
        # classe déjà couverts par PlanningSerializer.validate — ici on les évite directement
        # en avançant séquentiellement jour par jour, créneau par créneau, par classe.
        salles = list(Salle.objects.all()[:8]) or [None]
        cours_s1 = [c for c in cours_list if c.semestre == 'S1']
        # Idempotence : le choix de salle (voir plus bas) et donc le créneau finalement retenu
        # pour chaque cours peuvent varier d'une exécution à l'autre — on repart d'un état propre
        # plutôt que de dépendre du get_or_create pour dédoublonner.
        Planning.objects.filter(code_cours__in=cours_s1).delete()
        by_classe = {}
        for c in cours_s1:
            by_classe.setdefault(c.code_classe_id, []).append(c)

        slot_occupe_ens = set()   # (mle_ens, jour, h_debut)
        slot_occupe_salle = set() # (salle, jour, h_debut)
        created = 0
        for code_classe, cours_classe in by_classe.items():
            slot_idx = 0
            for c in cours_classe:
                placed = False
                attempts = 0
                while not placed and attempts < len(JOURS_SEMAINE) * len(CRENEAUX):
                    jour = JOURS_SEMAINE[slot_idx % len(JOURS_SEMAINE)]
                    h_debut, h_fin = CRENEAUX[(slot_idx // len(JOURS_SEMAINE)) % len(CRENEAUX)]
                    slot_idx += 1
                    attempts += 1
                    key_ens = (c.mle_ens_id, jour, h_debut)
                    if c.mle_ens_id and key_ens in slot_occupe_ens:
                        continue
                    stable_idx = sum(ord(ch) for ch in f'{code_classe}{jour}{h_debut}')
                    salle = salles[stable_idx % len(salles)] if salles[0] else None
                    key_salle = (getattr(salle, 'code_salle', None), jour, h_debut)
                    if salle and key_salle in slot_occupe_salle:
                        continue
                    Planning.objects.get_or_create(
                        code_cours=c, type_planning='HEBDO', code_jour_id=jour,
                        h_debut=h_debut, h_fin=h_fin,
                        defaults={'type_seance': 'CM', 'code_salle': salle},
                    )
                    if c.mle_ens_id:
                        slot_occupe_ens.add(key_ens)
                    if salle:
                        slot_occupe_salle.add(key_salle)
                    created += 1
                    placed = True
        self.stdout.write(f"  {created} créneaux de planning (semestre 1, hebdomadaire)")

    def _evaluations(self, etab, cours_list):
        periode_t1 = Periode.objects.filter(
            lib_periode__icontains='Trimestre 1', type_etab='SECONDAIRE', code_annee_id=ANNEE_CODE,
        ).first()
        if not periode_t1:
            self.stdout.write(self.style.WARNING("  Période Trimestre 1 (SECONDAIRE) introuvable — évaluations ignorées."))
            return
        type_ds   = TypeEvaluation.objects.filter(lib_type_eval__icontains='Devoir Surveillé', type_etab='SECONDAIRE').first()
        type_comp = TypeEvaluation.objects.filter(lib_type_eval__icontains='Composition Trimestrielle', type_etab='SECONDAIRE').first()
        if not (type_ds and type_comp):
            self.stdout.write(self.style.WARNING("  Types d'évaluation SECONDAIRE introuvables — évaluations ignorées."))
            return

        # Idempotence : bulk_create n'a pas de contrainte d'unicité sur laquelle s'appuyer
        # (ignore_conflicts ne dédoublonne rien ici) — on repart d'un état propre à chaque exécution.
        Evaluation.objects.filter(etablissement=etab, code_periode=periode_t1).delete()

        to_create = []
        cours_s1 = [c for c in cours_list if c.semestre == 'S1']
        for c in cours_s1:
            inscrits = Inscription.objects.filter(code_classe_id=c.code_classe_id, code_annee_id=ANNEE_CODE)
            for insc in inscrits:
                # Notes plausibles : centrées ~12/20, dispersion réaliste, bornées [4, 19].
                for type_eval in (type_ds, type_comp):
                    note = max(4, min(19, round(random.gauss(12, 3.2), 2)))
                    to_create.append(Evaluation(
                        mle_etudiant_id=insc.mle_etudiant_id, code_matiere_id=c.code_matiere_id,
                        code_classe_id=c.code_classe_id, date_eval=datetime(2025, 11, random.randint(3, 28)),
                        note=note, code_periode=periode_t1, code_type_eval=type_eval,
                        etablissement=etab,
                    ))
        Evaluation.objects.bulk_create(to_create, ignore_conflicts=True, batch_size=500)
        self.stdout.write(f"  {len(to_create)} évaluations (Trimestre 1 — Devoir Surveillé + Composition)")

    # ── Comptes système ────────────────────────────────────────────────────────
    def _utilisateurs(self, etab, enseignants):
        # Le Django User n'est qu'un point d'ancrage pour les permissions — l'authentification
        # réelle vérifie Utilisateur.passwd (voir SmsLoginView). Convention reprise de seed_demo.py.
        def make_login(login, role, nom_user):
            Utilisateur.objects.update_or_create(
                login=login, defaults={'passwd': DEMO_PWD, 'role': role, 'etablissement': etab, 'nom_user': nom_user},
            )
            User.objects.get_or_create(username=login, defaults={'is_active': True})

        # login <= 15 caractères (contrainte Utilisateur.login) — préfixe court "mbd_".
        make_login('mbd_proviseur', 'ADMIN',               'Grégoire Tchoumi (Proviseur)')
        make_login('mbd_censeur',   'CENSEUR',              'Ferdinand Kamga (Censeur)')
        make_login('mbd_sg',        'SURVEILLANT_GENERAL',  'Delphine Ngassa (Surveillant Général)')
        make_login('mbd_scol',      'SCOLARITE',            'Clarisse Djiotsa (Scolarité)')
        make_login('mbd_comptable', 'COMPTABLE',            'Albert Sonfack (Économe)')
        make_login('mbd_apee',      'APEE',                 'Bureau APEE')
        # Deux comptes enseignant liés à de vrais Enseignant (pour le scoping par matière/classe).
        for i, mle in enumerate(('MBD_E01', 'MBD_E05'), start=1):
            login = f"mbd_ens{i}"
            Utilisateur.objects.update_or_create(
                login=login,
                defaults={
                    'passwd': DEMO_PWD, 'role': 'ENSEIGNANT', 'etablissement': etab,
                    'nom_user': f"{enseignants[mle].prenom_ens} {enseignants[mle].nom_ens}",
                },
            )
            User.objects.get_or_create(username=login, defaults={'is_active': True})
            ens = enseignants[mle]
            ens.utilisateur = Utilisateur.objects.get(login=login)
            ens.save(update_fields=['utilisateur'])
        self.stdout.write("  8 comptes de démonstration (mot de passe : Demo2026!)")
