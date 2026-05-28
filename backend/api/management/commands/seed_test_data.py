"""
Management command : python manage.py seed_test_data
Injecte des données de test réalistes dans les tables vides.
Idempotent : skip les objets qui existent déjà.
"""
import random
from datetime import date, time, timedelta, datetime
from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import (
    Annee, Classe, Departement, Enseignant, Etudiant, Inscription,
    Matiere, Cours, Periode, TypeEvaluation, Tranche, Pension,
    Evaluation, FicheNotes, FicheNotesDetail,
    Seance, Absence,
    Facture, FactureDetail,
    Decision, Stage,
    Paiement,
)


ANNEE = '2025-2026'

# ─── Données métier camerounaises réalistes ───────────────────────────────────
ENTREPRISES = [
    ("CAMTEL", "Télécommunications", "Yaoundé"),
    ("ORANGE Cameroun", "Téléphonie Mobile", "Douala"),
    ("MTN Cameroun", "Téléphonie Mobile", "Douala"),
    ("SCDP", "Industrie pétrolière", "Douala"),
    ("SONEL / ENEO", "Énergie", "Douala"),
    ("CICAM", "Textile industriel", "Garoua"),
    ("CDC", "Agriculture industrielle", "Buéa"),
    ("CHANIMETAL", "Métallurgie", "Douala"),
    ("HYSACAM", "Environnement / Déchets", "Yaoundé"),
    ("BICEC", "Banque & Finance", "Yaoundé"),
    ("Afriland First Bank", "Banque & Finance", "Yaoundé"),
    ("GIZ Cameroun", "Coopération internationale", "Yaoundé"),
    ("MINPOSTEL", "Ministère des TIC", "Yaoundé"),
    ("LABOGENIE", "BTP / Génie Civil", "Yaoundé"),
    ("COTCO", "Pipeline pétrolier", "Douala"),
]

TUTEURS_STAGE = [
    ("Mbarga", "Paul-Henri"),
    ("Ngo Balla", "Marie-Thérèse"),
    ("Tchamda", "Christophe"),
    ("Essama", "Serge"),
    ("Djomla", "Hortense"),
    ("Woumfo", "Patrice"),
    ("Nkengne", "Isabelle"),
    ("Yossa", "Fabrice"),
]


class Command(BaseCommand):
    help = 'Injecte des données de test réalistes dans les tables vides'

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('=== Seed données de test SMS ==='))
        with transaction.atomic():
            self._seed_reference()
            self._seed_cours_autres_classes()
            self._seed_evaluations_et_fiches()
            self._seed_seances()
            self._seed_factures()
            self._seed_decisions()
            self._seed_stages()
            self._seed_paiements_manquants()
        self.stdout.write(self.style.SUCCESS('✓ Seed terminé avec succès.'))

    # ──────────────────────────────────────────────────────────────────────────
    def _log(self, msg):
        self.stdout.write(f'  {msg}')

    def _seed_reference(self):
        """Tranches, périodes, types d'évaluation supplémentaires."""
        self.stdout.write(self.style.HTTP_INFO('\n[1] Données de référence'))

        # Tranches manquantes (pension 1 a 3 tranches : 200 000 + 150 000 + 50 000)
        pension = Pension.objects.get(code_pension=1)
        tranches_data = [
            (2, 'Tranche 2', 150000),
            (3, 'Tranche 3', 50000),
        ]
        for pk, lib, mt in tranches_data:
            obj, created = Tranche.objects.get_or_create(
                code_tranche=pk,
                defaults={'lib_tranche': lib, 'code_pension': pension, 'mt_tranche': mt},
            )
            if created:
                self._log(f'Tranche créée : {lib} ({mt:,} FCFA)')

        # Période 2 (Semestre 2)
        annee = Annee.objects.get(code_annee=ANNEE)
        p2, c = Periode.objects.get_or_create(
            code_periode=2,
            defaults={
                'lib_periode': 'Semestre 2',
                'date_debut': datetime(2026, 2, 1),
                'date_fin': datetime(2026, 6, 30),
                'code_annee': annee,
            },
        )
        if c:
            self._log('Période 2 (Semestre 2) créée')

        # Types d'évaluation supplémentaires
        for pk, lib in [(3, 'Examen final'), (4, 'Travaux Pratiques'), (5, 'Projet')]:
            obj, c = TypeEvaluation.objects.get_or_create(
                code_type_eval=pk, defaults={'lib_type_eval': lib},
            )
            if c:
                self._log(f'TypeEvaluation créé : {lib}')

    # ──────────────────────────────────────────────────────────────────────────
    def _seed_cours_autres_classes(self):
        """Ajoute des cours pour les 5 classes qui n'en ont pas encore."""
        self.stdout.write(self.style.HTTP_INFO('\n[2] Cours pour les autres classes'))
        annee = Annee.objects.get(code_annee=ANNEE)

        # Mapping : code_classe → [ (code_matiere, semestre, mle_ens) ]
        cours_map = {
            'LCS1': [
                ('ALGOBASE',   'S1', 'ENS005'), ('ARCHORDI',   'S1', 'ENS007'),
                ('ANALMATH',   'S1', 'ENS004'), ('TECHEXP',    'S1', 'ENS003'),
                ('OUTBUR',     'S1', 'ENS007'), ('ENVMICRO',   'S1', 'ENS007'),
                ('INTROBD',    'S2', 'ENS006'), ('PRGRWEB',    'S2', 'ENS005'),
                ('SE1',        'S2', 'ENS007'), ('STATDESCR',  'S2', 'ENS004'),
                ('DROITCIV',   'S2', 'ENS010'), ('FORMBIL',    'S2', 'ENS003'),
            ],
            'LEC1': [
                ('COMPTAGEN',  'S1', 'ENS002'), ('ECONGEN',    'S1', 'ENS009'),
                ('DROITCIV',   'S1', 'ENS010'), ('TECHEXP',    'S1', 'ENS003'),
                ('OUTBUR',     'S1', 'ENS007'), ('ANALMATH',   'S1', 'ENS004'),
                ('COMPTAANAL', 'S2', 'ENS002'), ('INTSYSINFO', 'S2', 'ENS001'),
                ('STATDESCR',  'S2', 'ENS004'), ('FORMBIL',    'S2', 'ENS003'),
                ('EOECREENT',  'S2', 'ENS009'), ('METHORRS',   'S2', 'ENS003'),
            ],
            'LA1': [
                ('ANALMATH',   'S1', 'ENS004'), ('TECHEXP',    'S1', 'ENS003'),
                ('OUTBUR',     'S1', 'ENS007'), ('ECONGEN',    'S1', 'ENS009'),
                ('EDUCIVETH',  'S1', 'ENS003'), ('STATDESCR',  'S1', 'ENS004'),
                ('DROITCIV',   'S2', 'ENS010'), ('FORMBIL',    'S2', 'ENS003'),
                ('EOECREENT',  'S2', 'ENS009'), ('METHORRS',   'S2', 'ENS003'),
                ('MATH01',     'S2', 'ENS004'), ('COMPTAGEN',  'S2', 'ENS002'),
            ],
            'LAB1': [
                ('ANALMATH',   'S1', 'ENS004'), ('TECHEXP',    'S1', 'ENS003'),
                ('OUTBUR',     'S1', 'ENS007'), ('ALGOBASE',   'S1', 'ENS005'),
                ('EDUCIVETH',  'S1', 'ENS003'), ('STATDESCR',  'S1', 'ENS004'),
                ('DROITCIV',   'S2', 'ENS010'), ('FORMBIL',    'S2', 'ENS003'),
                ('COMPTAGEN',  'S2', 'ENS002'), ('MATH01',     'S2', 'ENS004'),
                ('METHORRS',   'S2', 'ENS003'), ('EOECREENT',  'S2', 'ENS009'),
            ],
            'LMC1': [
                ('COMPTAGEN',  'S1', 'ENS002'), ('ECONGEN',    'S1', 'ENS009'),
                ('DROITCIV',   'S1', 'ENS010'), ('TECHEXP',    'S1', 'ENS003'),
                ('OUTBUR',     'S1', 'ENS007'), ('ANALMATH',   'S1', 'ENS004'),
                ('COMPTAANAL', 'S2', 'ENS002'), ('STATDESCR',  'S2', 'ENS004'),
                ('FORMBIL',    'S2', 'ENS003'), ('EOECREENT',  'S2', 'ENS009'),
                ('METHORRS',   'S2', 'ENS003'), ('EDUCIVETH',  'S2', 'ENS003'),
            ],
            'LMIT1': [
                ('ANALMATH',   'S1', 'ENS004'), ('ARCHORDI',   'S1', 'ENS007'),
                ('OUTBUR',     'S1', 'ENS007'), ('TECHEXP',    'S1', 'ENS003'),
                ('EDUCIVETH',  'S1', 'ENS003'), ('STATDESCR',  'S1', 'ENS004'),
                ('DROITCIV',   'S2', 'ENS010'), ('FORMBIL',    'S2', 'ENS003'),
                ('COMPTAGEN',  'S2', 'ENS002'), ('MATH01',     'S2', 'ENS004'),
                ('METHORRS',   'S2', 'ENS003'), ('EOECREENT',  'S2', 'ENS009'),
            ],
        }

        for code_classe, cours_list in cours_map.items():
            try:
                classe = Classe.objects.get(code_classe=code_classe)
            except Classe.DoesNotExist:
                continue
            for code_matiere, semestre, mle_ens in cours_list:
                try:
                    matiere = Matiere.objects.get(code_matiere=code_matiere)
                    ens = Enseignant.objects.get(mle_ens=mle_ens)
                except (Matiere.DoesNotExist, Enseignant.DoesNotExist):
                    continue
                _, c = Cours.objects.get_or_create(
                    code_matiere=matiere, code_classe=classe,
                    semestre=semestre, code_annee=annee,
                    defaults={'mle_ens': ens, 'quota_horaire': 30, 'credits': 2},
                )
                if c:
                    self._log(f'Cours : {code_matiere} -> {code_classe} S{semestre[-1]}')

    # ──────────────────────────────────────────────────────────────────────────
    def _seed_evaluations_et_fiches(self):
        """Crée des évaluations et fiches de notes pour chaque étudiant inscrit."""
        self.stdout.write(self.style.HTTP_INFO('\n[3] Évaluations & Fiches de notes'))

        annee = Annee.objects.get(code_annee=ANNEE)
        p1 = Periode.objects.get(code_periode=1)
        p2 = Periode.objects.get(code_periode=2)
        t_cc  = TypeEvaluation.objects.get(code_type_eval=1)   # Contrôle continu
        t_ex  = TypeEvaluation.objects.get(code_type_eval=3)   # Examen final

        # Correspondance étudiant → classe inscrite
        inscriptions = Inscription.objects.filter(
            code_annee=annee
        ).select_related('mle_etudiant', 'code_classe')

        for insc in inscriptions:
            etud = insc.mle_etudiant
            classe = insc.code_classe

            # Cours du S1 et S2 pour cette classe
            cours_s1 = list(Cours.objects.filter(
                code_classe=classe, semestre='S1', code_annee=annee
            ).select_related('code_matiere', 'mle_ens'))
            cours_s2 = list(Cours.objects.filter(
                code_classe=classe, semestre='S2', code_annee=annee
            ).select_related('code_matiere', 'mle_ens'))

            for cours_list, periode, base_date in [
                (cours_s1, p1, date(2025, 11, 10)),
                (cours_s2, p2, date(2026, 4, 5)),
            ]:
                for i, c in enumerate(cours_list):
                    mat = c.code_matiere
                    ens = c.mle_ens

                    # — Contrôle continu —
                    note_cc = round(random.uniform(8, 18), 2)
                    eval_date = base_date + timedelta(days=i * 3)
                    Evaluation.objects.get_or_create(
                        mle_etudiant=etud, code_matiere=mat,
                        code_classe=classe, code_periode=periode,
                        code_type_eval=t_cc,
                        defaults={
                            'date_eval': eval_date,
                            'note': note_cc,
                        },
                    )

                    # — Examen final —
                    note_ex = round(random.uniform(7, 19), 2)
                    exam_date = base_date + timedelta(days=45 + i * 2)
                    Evaluation.objects.get_or_create(
                        mle_etudiant=etud, code_matiere=mat,
                        code_classe=classe, code_periode=periode,
                        code_type_eval=t_ex,
                        defaults={
                            'date_eval': exam_date,
                            'note': note_ex,
                        },
                    )

                    # — Fiche de notes (si enseignant connu) —
                    if ens:
                        fiche, cf = FicheNotes.objects.get_or_create(
                            code_matiere=mat, code_classe=classe, mle_ens=ens,
                            code_periode=periode, code_type_eval=t_ex,
                            code_annee=annee,
                            defaults={
                                'date_evaluation': exam_date,
                                'bareme': 20,
                                'statut': 'VALIDE',
                            },
                        )
                        FicheNotesDetail.objects.get_or_create(
                            code_fiche=fiche, mle_etudiant=etud,
                            defaults={'note': note_ex, 'absent': False},
                        )

        nb_eval = Evaluation.objects.count()
        nb_fiche = FicheNotes.objects.count()
        self._log(f'{nb_eval} évaluations créées | {nb_fiche} fiches de notes')

    # ──────────────────────────────────────────────────────────────────────────
    def _seed_seances(self):
        """Crée des séances de cours avec présences pour chaque cours."""
        self.stdout.write(self.style.HTTP_INFO('\n[4] Séances & présences'))

        annee = Annee.objects.get(code_annee=ANNEE)

        horaires = [
            (time(7, 30),  time(9, 30)),
            (time(9, 30),  time(11, 30)),
            (time(11, 30), time(13, 30)),
            (time(14, 0),  time(16, 0)),
        ]
        salles = ['A101', 'A102', 'B201', 'B202', 'C301', 'Amphi']
        statuts_seance = ['TENU', 'TENU', 'TENU', 'TENU', 'ANNULE']

        for cours in Cours.objects.filter(code_annee=annee).select_related(
            'code_matiere', 'code_classe', 'mle_ens'
        ):
            if not cours.mle_ens:
                continue
            # 3 séances par cours
            base = date(2025, 10, 6) if cours.semestre == 'S1' else date(2026, 2, 2)
            for k in range(3):
                h_deb, h_fin = random.choice(horaires)
                s_date = base + timedelta(weeks=k * 2)
                statut = random.choice(statuts_seance)
                seance, c = Seance.objects.get_or_create(
                    code_matiere=cours.code_matiere,
                    code_classe=cours.code_classe,
                    mle_ens=cours.mle_ens,
                    code_annee=annee,
                    date_seance=s_date,
                    h_debut=h_deb,
                    defaults={
                        'h_fin': h_fin,
                        'salle': random.choice(salles),
                        'nb_heures_effectuees': 2,
                        'statut': statut,
                    },
                )
                if c and statut == 'TENU':
                    # Absences pour les étudiants inscrits dans la classe
                    etuds = Etudiant.objects.filter(
                        inscription__code_classe=cours.code_classe,
                        inscription__code_annee=annee,
                    )
                    for etud in etuds:
                        present = random.random() > 0.15   # 85 % de présence
                        Absence.objects.get_or_create(
                            code_seance=seance,
                            mle_etudiant=etud,
                            defaults={
                                'present': present,
                                'signe': present,
                                'justifiee': False if present else random.random() > 0.5,
                            },
                        )

        nb_seance = Seance.objects.count()
        nb_abs = Absence.objects.count()
        self._log(f'{nb_seance} séances | {nb_abs} présences/absences')

    # ──────────────────────────────────────────────────────────────────────────
    def _seed_factures(self):
        """Crée une ou deux factures par étudiant."""
        self.stdout.write(self.style.HTTP_INFO('\n[5] Factures'))

        annee = Annee.objects.get(code_annee=ANNEE)
        pension = Pension.objects.get(code_pension=1)
        tranches = list(Tranche.objects.filter(code_pension=pension).order_by('code_tranche'))

        etudiants = list(Etudiant.objects.all())
        statuts = ['SOLDEE', 'PARTIELLEMENT_PAYEE', 'EN_ATTENTE']
        poids = [0.5, 0.3, 0.2]

        num = Facture.objects.count()
        for idx, etud in enumerate(etudiants):
            if Facture.objects.filter(mle_etudiant=etud, code_annee=annee).exists():
                continue
            num += 1
            statut = random.choices(statuts, weights=poids)[0]
            mt_total = pension.mt_pension + pension.mt_inscription
            if statut == 'SOLDEE':
                mt_paye = mt_total
            elif statut == 'PARTIELLEMENT_PAYEE':
                mt_paye = random.choice([tranches[0].mt_tranche if tranches else 200000,
                                         pension.mt_inscription])
            else:
                mt_paye = 0

            num_fact = f'FAC-2026-{num:04d}'
            facture = Facture.objects.create(
                numero_facture=num_fact,
                mle_etudiant=etud,
                code_annee=annee,
                date_emission=date(2025, 9, 15) + timedelta(days=idx * 5),
                montant_total=mt_total,
                montant_paye=mt_paye,
                statut=statut,
            )
            # Lignes de facture
            FactureDetail.objects.create(
                code_facture=facture,
                libelle='Frais de scolarité 2025-2026',
                type_frais='SCOLARITE',
                montant=pension.mt_pension,
                date_echeance=date(2026, 6, 30),
            )
            FactureDetail.objects.create(
                code_facture=facture,
                libelle="Frais d'inscription 2025-2026",
                type_frais='INSCRIPTION',
                montant=pension.mt_inscription,
                date_echeance=date(2025, 10, 31),
            )
            self._log(f'Facture {num_fact} → {etud.nom} ({statut})')

    # ──────────────────────────────────────────────────────────────────────────
    def _seed_decisions(self):
        """Crée une décision de jury par étudiant pour 2025-2026."""
        self.stdout.write(self.style.HTTP_INFO('\n[6] Décisions de jury'))

        annee = Annee.objects.get(code_annee=ANNEE)
        resultats = ['ADMIS', 'ADMIS', 'ADMIS', 'AJOURNE', 'ADMIS']
        mentions = ['Passable', 'Assez Bien', 'Bien', 'Très Bien', 'Passable']

        inscriptions = Inscription.objects.filter(code_annee=annee).select_related(
            'mle_etudiant', 'code_classe'
        )
        eff = inscriptions.count()

        for rank, insc in enumerate(inscriptions, 1):
            etud = insc.mle_etudiant
            classe = insc.code_classe
            if Decision.objects.filter(
                mle_etudiant=etud, code_annee=annee, session='NORMALE'
            ).exists():
                continue
            # Calcule une moyenne basée sur les évaluations existantes
            evals = Evaluation.objects.filter(
                mle_etudiant=etud, code_classe=classe
            )
            if evals.exists():
                moy = round(sum(float(e.note) for e in evals) / evals.count(), 2)
            else:
                moy = round(random.uniform(9, 16), 2)

            res_idx = random.randint(0, len(resultats) - 1)
            Decision.objects.create(
                mle_etudiant=etud,
                code_annee=annee,
                code_classe=classe,
                session='NORMALE',
                moyenne_annuelle=moy,
                total_credits=60,
                credits_valides=60 if resultats[res_idx] == 'ADMIS' else random.randint(30, 55),
                resultat=resultats[res_idx],
                mention=mentions[res_idx] if resultats[res_idx] == 'ADMIS' else None,
                rang=rank,
                effectif=eff,
                date_deliberation=datetime(2026, 6, 28, 10, 0),
                president_jury='Prof. Nkoa Jean-Claude',
            )
            self._log(f'Décision : {etud.nom} → {resultats[res_idx]} ({moy}/20)')

    # ──────────────────────────────────────────────────────────────────────────
    def _seed_stages(self):
        """Crée 2-3 stages pour des étudiants."""
        self.stdout.write(self.style.HTTP_INFO('\n[7] Stages'))

        annee = Annee.objects.get(code_annee=ANNEE)
        etudiants = list(Etudiant.objects.all())
        types = ['OBSERVATION', 'IMMERSION', 'PFE', 'ACADEMIQUE', 'PROFESSIONNEL']
        statuts = ['EN_COURS', 'TERMINE', 'VALIDE']

        stages_data = [
            # (etud_idx, type, durée_jours, début, statut, entreprise_idx)
            (0, 'ACADEMIQUE',    60, date(2026, 1, 6),  'VALIDE',   2),
            (1, 'PROFESSIONNEL', 45, date(2026, 1, 13), 'TERMINE',  5),
            (2, 'PFE',           90, date(2026, 2, 2),  'EN_COURS', 0),
            (3, 'IMMERSION',     30, date(2026, 3, 2),  'TERMINE',  9),
            (4, 'ACADEMIQUE',    60, date(2026, 1, 6),  'VALIDE',   3),
            (5, 'PROFESSIONNEL', 45, date(2026, 1, 20), 'EN_COURS', 7),
        ]

        for etud_idx, type_stage, duree, debut, statut, ent_idx in stages_data:
            if etud_idx >= len(etudiants):
                continue
            etud = etudiants[etud_idx]
            ent_nom, secteur, ville = ENTREPRISES[ent_idx]
            tuteur_nom, tuteur_prenom = TUTEURS_STAGE[etud_idx % len(TUTEURS_STAGE)]
            fin = debut + timedelta(days=duree)

            if Stage.objects.filter(mle_etudiant=etud, date_debut=debut).exists():
                continue

            Stage.objects.create(
                mle_etudiant=etud,
                code_annee=annee,
                type_stage=type_stage,
                entreprise=ent_nom,
                adresse_entreprise=f'{ville}, Cameroun',
                tuteur_entreprise=f'{tuteur_nom} {tuteur_prenom}',
                sujet=f'Stage {type_stage.lower()} — {secteur}',
                date_debut=debut,
                date_fin=fin,
                statut=statut,
                certificat_emis=statut in ('TERMINE', 'VALIDE'),
                date_emission_cert=fin if statut in ('TERMINE', 'VALIDE') else None,
                note_stage=round(random.uniform(12, 18), 1) if statut == 'VALIDE' else None,
            )
            self._log(f'Stage : {etud.nom} → {ent_nom} ({type_stage}, {statut})')

    # ──────────────────────────────────────────────────────────────────────────
    def _seed_paiements_manquants(self):
        """Ajoute les tranches 2 & 3 pour les étudiants qui n'ont payé que la tranche 1."""
        self.stdout.write(self.style.HTTP_INFO('\n[8] Paiements complémentaires'))

        annee = Annee.objects.get(code_annee=ANNEE)
        t2 = Tranche.objects.get(code_tranche=2)
        t3 = Tranche.objects.get(code_tranche=3)

        # Étudiants ayant déjà payé la tranche 1
        etuds_t1 = Paiement.objects.filter(
            code_annee=annee, type_paiement='SCOLARITE', code_tranche__isnull=False
        ).values_list('mle_etudiant_id', flat=True).distinct()

        statut_choices = ['PAYE', 'PARTIEL', 'IMPAYE']
        poids = [0.5, 0.3, 0.2]

        # Ajouter paiements pour MC et MI (inscription uniquement avant)
        etuds_sans_scolarite = Etudiant.objects.filter(
            mle_etudiant__in=['2026-MC-00001', '2026-MI-00001']
        )
        for etud in etuds_sans_scolarite:
            statut = random.choices(statut_choices, weights=poids)[0]
            Paiement.objects.get_or_create(
                mle_etudiant=etud,
                type_paiement='SCOLARITE',
                code_tranche=t2,
                code_annee=annee,
                defaults={'mt_paiement': t2.mt_tranche, 'statut': statut,
                          'date_paiement': datetime(2025, 11, 15)},
            )

        # Tranche 3 pour quelques étudiants
        for mle in ['2026-CS-00001', '2026-EC-00001', '2026-AGRO-00001']:
            try:
                etud = Etudiant.objects.get(mle_etudiant=mle)
            except Etudiant.DoesNotExist:
                continue
            Paiement.objects.get_or_create(
                mle_etudiant=etud,
                type_paiement='SCOLARITE',
                code_tranche=t3,
                code_annee=annee,
                defaults={'mt_paiement': t3.mt_tranche, 'statut': 'PAYE',
                          'date_paiement': datetime(2026, 1, 10)},
            )
            self._log(f'Tranche 3 payée : {etud.nom}')

        nb = Paiement.objects.count()
        self._log(f'Total paiements en base : {nb}')
