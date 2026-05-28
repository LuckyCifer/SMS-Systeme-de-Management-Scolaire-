"""
Migration 0010 — Élargissement du matricule étudiant VARCHAR(10) → VARCHAR(20)
pour supporter le format AAAA-SP-NNNNN (ex: 2025-LCS-00001).

Utilise SeparateDatabaseAndState pour que AlterField ne touche QUE l'état
Django (pas le SQL), et RunPython pour faire tous les ALTER TABLE avec
FOREIGN_KEY_CHECKS=0 (évite l'erreur MySQL 3780 sur les contraintes FK).
"""
from django.db import migrations, models


FK_TABLES = [
    # (table,              nullable)
    ('etudiant',           False),   # PK
    ('etudiant_tuteur',    False),
    ('inscription',        False),
    ('paiement',           False),
    ('moratoire',          False),
    ('facture',            False),
    ('evaluation',         False),
    ('fiche_notes_detail', False),
    ('absence',            False),
    ('decision',           False),
    ('diplome',            False),
    ('carte_etudiant',     False),
    ('stage',              False),
    ('lettre_admission',   False),
    ('convocation',        True),
    ('badge_acces',        True),
    ('document_genere',    True),
]


def widen_matricule(apps, schema_editor):
    if schema_editor.connection.vendor != 'mysql':
        return
    db = schema_editor.connection.settings_dict['NAME']
    with schema_editor.connection.cursor() as cursor:
        # Récupérer les tables existantes dans cette base
        cursor.execute(
            'SELECT TABLE_NAME FROM information_schema.TABLES '
            'WHERE TABLE_SCHEMA = %s', [db]
        )
        existing = {r[0] for r in cursor.fetchall()}

        cursor.execute('SET FOREIGN_KEY_CHECKS=0')
        try:
            for table, nullable in FK_TABLES:
                if table not in existing:
                    continue
                null_clause = 'NULL' if nullable else 'NOT NULL'
                cursor.execute(
                    f'ALTER TABLE `{table}` '
                    f'MODIFY COLUMN `mle_etudiant` VARCHAR(20) {null_clause}'
                )
        finally:
            cursor.execute('SET FOREIGN_KEY_CHECKS=1')


def reverse_widen(apps, schema_editor):
    # Réduire la longueur tronquerait les données — non réversible
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_paiement_type_tranche_optional'),
    ]

    operations = [
        # AlterField met à jour l'état interne Django SANS toucher la DB
        # (database_operations vide → seul l'état est mis à jour)
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterField(
                    model_name='etudiant',
                    name='mle_etudiant',
                    field=models.CharField(max_length=20, primary_key=True, serialize=False),
                ),
            ],
            database_operations=[],
        ),
        # RunPython alters TOUTES les colonnes avec FK_CHECKS désactivés
        migrations.RunPython(widen_matricule, reverse_widen),
    ]
