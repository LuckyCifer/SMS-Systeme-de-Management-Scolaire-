# Migration 0006 — Restructuration de Cours (attribution semestrielle) et
# Planning (emploi du temps HEBDO + INTENSIF, cours du jour / du soir).
#
# Contexte : les deux tables ont été créées depuis un script SQL avec des
# clés primaires composites. Cette migration :
#   1. Remplace les composite PK par un id BigAutoField standard.
#   2. Transforme Cours en table d'attribution (matière + classe + semestre).
#   3. Transforme Planning pour gérer les deux systèmes camerounais :
#        HEBDO    — créneau fixe récurrent (ex : Lundi 08h-10h chaque semaine)
#        INTENSIF — semaine entière dédiée à une seule matière (20h en 5 jours)
#      Et le type de séance : CM / TD / TP / cours du SOIR.

import django.db.models.deletion
from django.db import migrations, models


# ─── Fonctions RunPython ────────────────────────────────────────────────────

def restructure_cours(apps, schema_editor):
    """Restructure la table cours : composite PK → id + nouveaux champs."""
    exe = schema_editor.execute
    # Vider les données de test
    exe("DELETE FROM cours")
    # Supprimer la contrainte FK sur mle_ens
    exe("ALTER TABLE cours DROP FOREIGN KEY cours_mle_ens_3242f6ea_fk_enseignant_mle_ens")
    # Supprimer la clé primaire composite (code_matiere, code_classe)
    exe("ALTER TABLE cours DROP PRIMARY KEY")
    # Ajouter id BIGINT AUTO_INCREMENT comme nouvelle PK
    exe("ALTER TABLE cours ADD COLUMN id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST")
    # Supprimer les colonnes obsolètes
    exe("ALTER TABLE cours DROP COLUMN h_debut")
    exe("ALTER TABLE cours DROP COLUMN date_cours")
    # Ajouter les nouvelles colonnes
    exe("ALTER TABLE cours ADD COLUMN semestre varchar(2) NOT NULL COLLATE utf8mb4_unicode_ci AFTER mle_ens")
    exe("ALTER TABLE cours ADD COLUMN code_annee varchar(10) NOT NULL COLLATE utf8mb4_unicode_ci AFTER semestre")
    exe("ALTER TABLE cours ADD COLUMN quota_horaire int unsigned NOT NULL DEFAULT 20 AFTER code_annee")
    exe("ALTER TABLE cours ADD COLUMN credits int unsigned NOT NULL DEFAULT 0 AFTER quota_horaire")
    # Recréer la FK sur mle_ens
    exe("ALTER TABLE cours ADD CONSTRAINT cours_mle_ens_fk FOREIGN KEY (mle_ens) REFERENCES enseignant(mle_ens)")
    # Ajouter FK sur code_annee
    exe("ALTER TABLE cours ADD CONSTRAINT cours_code_annee_fk FOREIGN KEY (code_annee) REFERENCES annee(code_annee)")
    # Contrainte unique semestrielle
    exe("ALTER TABLE cours ADD UNIQUE KEY cours_semestre_unique (code_matiere, code_classe, semestre, code_annee)")


def restructure_planning(apps, schema_editor):
    """Restructure la table planning : composite PK → id + HEBDO/INTENSIF."""
    exe = schema_editor.execute
    # Vider les données de test
    exe("DELETE FROM planning")
    # Supprimer toutes les FKs existantes
    exe("ALTER TABLE planning DROP FOREIGN KEY fk_planning_annee")
    exe("ALTER TABLE planning DROP FOREIGN KEY fk_planning_classe")
    exe("ALTER TABLE planning DROP FOREIGN KEY fk_planning_ens")
    exe("ALTER TABLE planning DROP FOREIGN KEY fk_planning_jour")
    exe("ALTER TABLE planning DROP FOREIGN KEY fk_planning_matiere")
    exe("ALTER TABLE planning DROP FOREIGN KEY planning_code_annee_616a7f23_fk_annee_code_annee")
    # Supprimer la clé primaire composite
    exe("ALTER TABLE planning DROP PRIMARY KEY")
    # Supprimer les colonnes de l'ancien modèle
    exe("ALTER TABLE planning DROP COLUMN code_matiere")
    exe("ALTER TABLE planning DROP COLUMN code_classe")
    exe("ALTER TABLE planning DROP COLUMN mle_ens")
    exe("ALTER TABLE planning DROP COLUMN nbH")
    exe("ALTER TABLE planning DROP COLUMN code_annee")
    # Rendre code_jour nullable (utilisé uniquement pour HEBDO)
    exe("ALTER TABLE planning MODIFY COLUMN code_jour varchar(10) NULL COLLATE utf8mb4_unicode_ci")
    # Ajouter id comme nouvelle PK
    exe("ALTER TABLE planning ADD COLUMN id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST")
    # Ajouter les nouvelles colonnes
    exe("ALTER TABLE planning ADD COLUMN code_cours_id bigint NOT NULL AFTER id")
    exe("ALTER TABLE planning ADD COLUMN type_planning varchar(10) NOT NULL DEFAULT 'HEBDO' COLLATE utf8mb4_unicode_ci AFTER code_cours_id")
    exe("ALTER TABLE planning ADD COLUMN type_seance varchar(5) NOT NULL DEFAULT 'CM' COLLATE utf8mb4_unicode_ci AFTER type_planning")
    exe("ALTER TABLE planning ADD COLUMN h_debut time NOT NULL DEFAULT '08:00:00' AFTER type_seance")
    exe("ALTER TABLE planning ADD COLUMN h_fin time NOT NULL DEFAULT '10:00:00' AFTER h_debut")
    exe("ALTER TABLE planning ADD COLUMN code_salle varchar(5) NULL COLLATE utf8mb4_unicode_ci AFTER h_fin")
    exe("ALTER TABLE planning ADD COLUMN date_debut date NULL AFTER code_jour")
    exe("ALTER TABLE planning ADD COLUMN date_fin date NULL AFTER date_debut")
    # Ajouter les contraintes FK
    exe("ALTER TABLE planning ADD CONSTRAINT planning_cours_fk FOREIGN KEY (code_cours_id) REFERENCES cours(id)")
    exe("ALTER TABLE planning ADD CONSTRAINT planning_jour_fk FOREIGN KEY (code_jour) REFERENCES jour(code_jour)")
    exe("ALTER TABLE planning ADD CONSTRAINT planning_salle_fk FOREIGN KEY (code_salle) REFERENCES salle(code_salle)")


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_alter_decision_unique_together_decision_session_and_more'),
    ]

    operations = [

        # ── COURS : Attribution semestrielle ──────────────────────────────────
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(restructure_cours, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.RemoveField(model_name='cours', name='h_debut'),
                migrations.RemoveField(model_name='cours', name='date_cours'),
                migrations.AddField(
                    model_name='cours',
                    name='semestre',
                    field=models.CharField(
                        choices=[('S1', 'Semestre 1'), ('S2', 'Semestre 2')],
                        max_length=2,
                    ),
                ),
                migrations.AddField(
                    model_name='cours',
                    name='code_annee',
                    field=models.ForeignKey(
                        db_column='code_annee',
                        on_delete=django.db.models.deletion.RESTRICT,
                        to='api.annee',
                    ),
                ),
                migrations.AddField(
                    model_name='cours',
                    name='quota_horaire',
                    field=models.PositiveIntegerField(default=20),
                ),
                migrations.AddField(
                    model_name='cours',
                    name='credits',
                    field=models.PositiveIntegerField(default=0),
                ),
                migrations.AlterUniqueTogether(
                    name='cours',
                    unique_together={('code_matiere', 'code_classe', 'semestre', 'code_annee')},
                ),
            ],
        ),

        # ── PLANNING : HEBDO + INTENSIF, jour + soir ─────────────────────────
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(restructure_planning, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AlterUniqueTogether(name='planning', unique_together=set()),
                migrations.RemoveField(model_name='planning', name='code_matiere'),
                migrations.RemoveField(model_name='planning', name='code_classe'),
                migrations.RemoveField(model_name='planning', name='mle_ens'),
                migrations.RemoveField(model_name='planning', name='nb_h'),
                migrations.RemoveField(model_name='planning', name='code_annee'),
                migrations.AddField(
                    model_name='planning',
                    name='code_cours',
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to='api.cours',
                    ),
                ),
                migrations.AddField(
                    model_name='planning',
                    name='type_planning',
                    field=models.CharField(
                        choices=[
                            ('HEBDO',    'Hebdomadaire (créneau fixe chaque semaine)'),
                            ('INTENSIF', 'Intensif (semaine entière dédiée à une matière)'),
                        ],
                        default='HEBDO',
                        max_length=10,
                    ),
                ),
                migrations.AddField(
                    model_name='planning',
                    name='type_seance',
                    field=models.CharField(
                        choices=[
                            ('CM',   'Cours Magistral'),
                            ('TD',   'Travaux Dirigés'),
                            ('TP',   'Travaux Pratiques'),
                            ('SOIR', 'Cours du soir'),
                        ],
                        default='CM',
                        max_length=5,
                    ),
                ),
                migrations.AddField(
                    model_name='planning',
                    name='h_debut',
                    field=models.TimeField(),
                ),
                migrations.AddField(
                    model_name='planning',
                    name='h_fin',
                    field=models.TimeField(),
                ),
                migrations.AddField(
                    model_name='planning',
                    name='code_salle',
                    field=models.ForeignKey(
                        blank=True, db_column='code_salle', null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to='api.salle',
                    ),
                ),
                migrations.AlterField(
                    model_name='planning',
                    name='code_jour',
                    field=models.ForeignKey(
                        blank=True, db_column='code_jour', null=True,
                        on_delete=django.db.models.deletion.RESTRICT,
                        to='api.jour',
                    ),
                ),
                migrations.AddField(
                    model_name='planning',
                    name='date_debut',
                    field=models.DateField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='planning',
                    name='date_fin',
                    field=models.DateField(blank=True, null=True),
                ),
            ],
        ),
    ]
