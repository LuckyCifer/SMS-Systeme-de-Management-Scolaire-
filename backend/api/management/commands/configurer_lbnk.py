"""
configurer_lbnk.py — Configuration type d'un lycée bilingue camerounais (LBNK)

Calendrier 2026-2027 (année en cours), trimestres + période d'examens officiels,
niveaux et classes du lycée (6ème → Terminale), types d'évaluation du secondaire.
Idempotent — relançable sans risque de doublons.

Ne touche pas : les pensions/tranches (déjà en place), les élèves, les années passées.

Usage : python manage.py configurer_lbnk
"""
from datetime import datetime

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.models import Annee, Classe, Etablissement, Niveau, Periode, TypeEvaluation

CODE_ETAB  = 'LBNK'
CODE_ANNEE = '2026-2027'

# Calendrier : rentrée début septembre, trimestres, examens officiels en fin d'année
# (mi-mai → fin juillet, cf. Periode.type_periode EXAMENS_OFFICIELS)
PERIODES = [
    ('Trimestre 1 SEC', 'ORDINAIRE',        datetime(2026, 9, 14), datetime(2026, 12, 18)),
    ('Trimestre 2 SEC', 'ORDINAIRE',        datetime(2027, 1, 4),  datetime(2027, 3, 26)),
    ('Trimestre 3 SEC', 'ORDINAIRE',        datetime(2027, 4, 5),  datetime(2027, 5, 14)),
    ('Examens officiels', 'EXAMENS_OFFICIELS', datetime(2027, 5, 15), datetime(2027, 7, 31)),
]

# Niveaux manquants du lycée (6ème et 3ème existent déjà en base)
NIVEAUX_MANQUANTS = [
    ('Cinquième (5ème)', 'CYC_SEC'),
    ('Quatrième (4ème)', 'CYC_SEC'),
    ('Seconde (2nde)',   'CYC_SEC'),
    ('Première (1ère)',  'CYC_SEC'),
    ('Terminale (Tle)',  'CYC_SEC'),
]

# Une classe francophone par niveau manquant (code_classe, lib_classe, niveau)
CLASSES_MANQUANTES = [
    ('LBNK_5EA',  'Cinquième A', 'Cinquième (5ème)'),
    ('LBNK_4EA',  'Quatrième A', 'Quatrième (4ème)'),
    ('LBNK_2NDA', 'Seconde A',   'Seconde (2nde)'),
    ('LBNK_1REA', 'Première A',  'Première (1ère)'),
    ('LBNK_TLEA', 'Terminale A', 'Terminale (Tle)'),
]

TYPES_EVAL_SECONDAIRE = ['Devoir', 'Composition', 'Interrogation orale']


class Command(BaseCommand):
    help = "Configure le lycée LBNK selon le calendrier camerounais (2026-2027)"

    def handle(self, *args, **options):
        try:
            etab = Etablissement.objects.get(code_etab=CODE_ETAB)
        except Etablissement.DoesNotExist:
            raise CommandError(f"Établissement {CODE_ETAB} introuvable. Lancer seed_demo d'abord.")

        # Référence pour le département et la spécialité : la classe 6ème existante
        ref = Classe.objects.filter(etablissement=etab).order_by('code_classe').first()
        if ref is None:
            raise CommandError(f"Aucune classe existante pour {CODE_ETAB} : impossible de déduire le département.")

        with transaction.atomic():
            annee = self._annee()
            self._periodes(annee)
            niveaux = self._niveaux()
            self._classes(etab, ref, niveaux)
            self._types_evaluation()

        self.stdout.write(self.style.SUCCESS(f'\n=== {CODE_ETAB} configuré pour {CODE_ANNEE} ==='))

    # ── Calendrier ────────────────────────────────────────────────────────────

    def _annee(self):
        # Une seule année EN COURS à la fois (la vue passage-annee s'appuie sur ce statut)
        Annee.objects.filter(statut='EN COURS').exclude(code_annee=CODE_ANNEE).update(statut='CLOTUREE')
        annee, created = Annee.objects.get_or_create(
            code_annee=CODE_ANNEE,
            defaults={'lib_annee': f'Année scolaire {CODE_ANNEE}'},
        )
        # On conserve les dates déjà saisies ; on complète seulement celles qui manquent
        if annee.date_deb is None:
            annee.date_deb = datetime(2026, 9, 1)
        annee.date_fin = datetime(2027, 7, 31)
        annee.lib_annee = f'Année scolaire {CODE_ANNEE}'
        annee.statut = 'EN COURS'
        annee.save()
        self.stdout.write(f'  [OK] Année {CODE_ANNEE} : EN COURS ({"créée" if created else "mise à jour"})')
        return annee

    def _periodes(self, annee):
        for lib, type_per, debut, fin in PERIODES:
            Periode.objects.update_or_create(
                lib_periode=lib,
                code_annee=annee,
                type_etab='SECONDAIRE',
                defaults={
                    'date_debut':   debut,
                    'date_fin':     fin,
                    'type_periode': type_per,
                },
            )
        self.stdout.write(f'  [OK] {len(PERIODES)} périodes (3 trimestres + examens officiels)')

    # ── Structure ─────────────────────────────────────────────────────────────

    def _niveaux(self):
        niveaux = {}
        for lib, code_cycle in NIVEAUX_MANQUANTS:
            niv, _ = Niveau.objects.get_or_create(
                lib_niveau=lib,
                code_cycle_id=code_cycle,
                defaults={
                    'code_annee_id': CODE_ANNEE,
                    'type_etab':     'SECONDAIRE',
                },
            )
            niveaux[lib] = niv
        self.stdout.write(f'  [OK] {len(NIVEAUX_MANQUANTS)} niveaux du lycée (5ème → Terminale)')
        return niveaux

    def _classes(self, etab, ref, niveaux):
        for code, lib, niveau_lib in CLASSES_MANQUANTES:
            Classe.objects.update_or_create(
                code_classe=code,
                defaults={
                    'lib_classe':    lib,
                    'systeme':       'FRANCOPHONE',
                    'code_dep':      ref.code_dep,
                    'code_sp':       ref.code_sp,
                    'code_niveau':   niveaux[niveau_lib],
                    'eff_max':       50,
                    'etablissement': etab,
                },
            )
        self.stdout.write(f'  [OK] {len(CLASSES_MANQUANTES)} classes francophones ajoutées')

    # ── Évaluations ───────────────────────────────────────────────────────────

    def _types_evaluation(self):
        for lib in TYPES_EVAL_SECONDAIRE:
            TypeEvaluation.objects.get_or_create(lib_type_eval=lib, type_etab='SECONDAIRE')
        self.stdout.write(f'  [OK] {len(TYPES_EVAL_SECONDAIRE)} types d\'évaluation du secondaire')
