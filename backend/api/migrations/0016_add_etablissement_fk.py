"""
Migration 0016 — Ajout du champ etablissement_id (FK vers etablissement)
sur les 17 tables métier pour l'isolation multi-établissement.

RunSQL utilisé pour garantir le bon charset/collation sur MySQL 8.
Tous les champs sont NULL DEFAULT NULL pour ne pas casser les données existantes.
"""
from django.db import migrations, models
import django.db.models.deletion

# Tables et contraintes à créer
TABLES = [
    'departement',
    'specialite',
    'classe',
    'etudiant',
    'enseignant',
    'inscription',
    'evaluation',
    'paiement',
    'cours',
    'seance',
    'fiche_notes',
    'examen',
    'stage',
    'carte_etudiant',
    'decision',
    'facture',
    'rapport_statistique',
]

# Génération des SQL d'ajout de colonne + FK
def _add_sql(table):
    return (
        f"ALTER TABLE `{table}` "
        f"ADD COLUMN `etablissement_id` VARCHAR(10) "
        f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci "
        f"NULL DEFAULT NULL; "
        f"ALTER TABLE `{table}` "
        f"ADD CONSTRAINT `{table}_etab_fk` "
        f"FOREIGN KEY (`etablissement_id`) "
        f"REFERENCES `etablissement`(`code_etab`) "
        f"ON DELETE CASCADE;"
    )

def _drop_sql(table):
    return (
        f"ALTER TABLE `{table}` DROP FOREIGN KEY `{table}_etab_fk`; "
        f"ALTER TABLE `{table}` DROP COLUMN `etablissement_id`;"
    )

FORWARD_SQL  = '\n'.join(_add_sql(t)  for t in TABLES)
BACKWARD_SQL = '\n'.join(_drop_sql(t) for t in TABLES)

# State operations (pour que Django ORM reflète les nouveaux champs)
STATE_OPS = [
    migrations.AddField(
        model_name=model_name,
        name='etablissement',
        field=models.ForeignKey(
            blank=True, db_column='etablissement_id',
            null=True, on_delete=django.db.models.deletion.CASCADE,
            related_name='+', to='api.etablissement',
        ),
    )
    for model_name in [
        'departement', 'specialite', 'classe', 'etudiant', 'enseignant',
        'inscription', 'evaluation', 'paiement', 'cours', 'seance',
        'fichenotes', 'examen', 'stage', 'carteetudiant', 'decision',
        'facture', 'rapportstatistique',
    ]
]


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0015_classe_niveau_scolaire_fk'),
    ]

    operations = [
        migrations.RunSQL(
            sql=FORWARD_SQL,
            reverse_sql=BACKWARD_SQL,
            state_operations=STATE_OPS,
        ),
    ]
