"""
Commande : python manage.py migrer_matricules

Migre les matricules existants (ex: ETU001) vers le format AAAA-SP-NNNNN
(ex: 2026-LCS-00001) en mettant à jour simultanément la clé primaire et
toutes les tables qui y font référence en clé étrangère.

Options :
  --annee AAAA   Année à utiliser dans le préfixe (défaut : année courante)
  --dry-run      Affiche les changements prévus sans les appliquer
"""
import re
from datetime import datetime

from django.core.management.base import BaseCommand
from django.db import connection

from api.models import Etudiant

# Toutes les tables FK qui référencent etudiant.mle_etudiant
FK_TABLES = [
    'etudiant_tuteur',
    'inscription',
    'paiement',
    'moratoire',
    'facture',
    'evaluation',
    'fiche_notes_detail',
    'absence',
    'convocation',
    'decision',
    'diplome',
    'carte_etudiant',
    'stage',
    'lettre_admission',
    'badge_acces',
    'document_genere',
]

NEW_FORMAT = re.compile(r'^\d{4}-.+-\d{5}$')


class Command(BaseCommand):
    help = 'Migre les matricules existants vers le format AAAA-SP-NNNNN'

    def add_arguments(self, parser):
        parser.add_argument(
            '--annee', type=int, default=datetime.now().year,
            help='Année à intégrer dans le matricule (défaut : année courante)',
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Prévisualise les changements sans les appliquer',
        )

    def handle(self, *args, **options):
        annee   = options['annee']
        dry_run = options['dry_run']

        # ── 1. Identifier les étudiants à migrer ─────────────────────────────
        tous = list(Etudiant.objects.select_related('code_sp').order_by('mle_etudiant'))
        a_migrer = [e for e in tous if not NEW_FORMAT.match(e.mle_etudiant)]

        if not a_migrer:
            self.stdout.write(self.style.SUCCESS(
                '[OK] Tous les matricules sont déjà au format AAAA-SP-NNNNN.'
            ))
            return

        self.stdout.write(
            f'\n{len(a_migrer)} matricule(s) a migrer (annee : {annee})\n'
        )

        # ── 2. Charger les séquences déjà utilisées (matricules déjà migrés) ─
        seq_tracker = {}
        for e in tous:
            m = re.match(r'^(\d{4}-.+-?)(\d{5})$', e.mle_etudiant)
            if m:
                prefix = m.group(1)
                seq_tracker[prefix] = max(seq_tracker.get(prefix, 0), int(m.group(2)))

        # ── 3. Générer les nouveaux matricules ────────────────────────────────
        plan = []   # [(ancien, nouveau, etudiant)]
        for etudiant in a_migrer:
            sp_str = (
                str(etudiant.code_sp.code_sp)[:6].upper()
                if etudiant.code_sp else 'GEN'
            )
            prefix = f'{annee}-{sp_str}-'
            seq_tracker[prefix] = seq_tracker.get(prefix, 0) + 1
            nouveau = f'{prefix}{str(seq_tracker[prefix]).zfill(5)}'
            plan.append((etudiant.mle_etudiant, nouveau, etudiant))

        # Afficher le plan
        col = max(len(p[0]) for p in plan)
        for ancien, nouveau, e in plan:
            nom = f'{e.nom} {e.prenom or ""}'.strip()
            self.stdout.write(
                f'  {ancien:<{col}}  ->  {nouveau}  '
                f'({nom})'
            )

        if dry_run:
            self.stdout.write(self.style.WARNING(
                '\n[DRY RUN] Aucune modification appliquée.\n'
                'Relancez sans --dry-run pour appliquer.'
            ))
            return

        # ── 4. Vérifier les tables existantes ─────────────────────────────────
        db_name = connection.settings_dict['NAME']
        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT TABLE_NAME FROM information_schema.TABLES '
                'WHERE TABLE_SCHEMA = %s', [db_name]
            )
            tables_existantes = {r[0] for r in cursor.fetchall()}

        fk_actives = [t for t in FK_TABLES if t in tables_existantes]

        # ── 5. Appliquer avec FOREIGN_KEY_CHECKS=0 ────────────────────────────
        self.stdout.write('\nApplication en cours…')
        with connection.cursor() as cursor:
            cursor.execute('SET FOREIGN_KEY_CHECKS=0')
            try:
                for ancien, nouveau, _ in plan:
                    # Mettre à jour toutes les FK d'abord
                    for table in fk_actives:
                        cursor.execute(
                            f'UPDATE `{table}` '
                            f'SET `mle_etudiant` = %s '
                            f'WHERE `mle_etudiant` = %s',
                            [nouveau, ancien]
                        )
                    # Mettre à jour la PK en dernier
                    cursor.execute(
                        'UPDATE `etudiant` '
                        'SET `mle_etudiant` = %s '
                        'WHERE `mle_etudiant` = %s',
                        [nouveau, ancien]
                    )
            except Exception as exc:
                cursor.execute('SET FOREIGN_KEY_CHECKS=1')
                self.stderr.write(self.style.ERROR(f'\nErreur : {exc}'))
                self.stderr.write('Aucune modification n\'a été persistée (FOREIGN_KEY_CHECKS remis à 1).')
                raise
            finally:
                cursor.execute('SET FOREIGN_KEY_CHECKS=1')

        self.stdout.write(self.style.SUCCESS(
            f'\n[OK] {len(plan)} matricule(s) migré(s) avec succès.'
        ))
