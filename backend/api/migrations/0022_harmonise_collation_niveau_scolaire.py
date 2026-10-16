"""
Aligne la collation de niveau_scolaire.code_niveau (et de classe.niveau_scolaire, qui la
référence) sur celle de la base. Dans les bases importées depuis MySQL 9 via phpMyAdmin,
cette table est restée en utf8mb4_0900_ai_ci alors que le reste est en
utf8mb4_unicode_ci : MySQL refuse alors toute nouvelle clé étrangère vers elle (erreur
3780), comme celle de la grille des coefficients (migration 0023).
Sans effet hors MySQL ou si les collations sont déjà identiques.
"""
from django.db import migrations


def harmoniser(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor != 'mysql':
        return
    with connection.cursor() as cur:
        cur.execute("SELECT DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()")
        cible = cur.fetchone()[0]
        cur.execute("""SELECT COLLATION_NAME FROM information_schema.COLUMNS
                       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'niveau_scolaire'
                         AND COLUMN_NAME = 'code_niveau'""")
        actuelle = cur.fetchone()[0]
        if actuelle == cible:
            return
        charset = cible.split('_')[0]
        cur.execute("SET FOREIGN_KEY_CHECKS = 0")
        try:
            cur.execute(f"ALTER TABLE niveau_scolaire CONVERT TO CHARACTER SET {charset} COLLATE {cible}")
            cur.execute(f"ALTER TABLE classe MODIFY niveau_scolaire varchar(20) CHARACTER SET {charset} COLLATE {cible} NULL")
        finally:
            cur.execute("SET FOREIGN_KEY_CHECKS = 1")


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0021_cours_trimestres'),
    ]

    operations = [
        migrations.RunPython(harmoniser, migrations.RunPython.noop),
    ]
