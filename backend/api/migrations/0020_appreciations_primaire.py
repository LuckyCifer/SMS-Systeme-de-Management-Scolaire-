"""
Primaire : chaque note /20 existante reçoit son appréciation A/ECA/NA
(00-09 NA, 10-14 ECA, 15-20 A) — même règle que Evaluation.save() et notes.py.
"""
from django.db import migrations
from django.db.models import Q


def remplir_appreciations(apps, schema_editor):
    Evaluation = apps.get_model('api', 'Evaluation')
    primaire = Evaluation.objects.filter(
        Q(etablissement__type_etab='PRIMAIRE')
        | Q(etablissement__isnull=True, code_classe__etablissement__type_etab='PRIMAIRE'),
        note__isnull=False,
    )
    primaire.filter(note__lt=10).update(appreciation='NA')
    primaire.filter(note__gte=10, note__lt=15).update(appreciation='ECA')
    primaire.filter(note__gte=15).update(appreciation='A')


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0019_coef_sequences_suppression_ue'),
    ]

    operations = [
        migrations.RunPython(remplir_appreciations, migrations.RunPython.noop),
    ]
