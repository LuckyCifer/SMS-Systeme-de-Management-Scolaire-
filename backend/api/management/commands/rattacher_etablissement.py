"""
management/commands/rattacher_etablissement.py

Rattache tous les enregistrements existants au premier établissement actif.
À exécuter UNE SEULE FOIS après la migration 0016.

Usage :
    python manage.py rattacher_etablissement
    python manage.py rattacher_etablissement --etab ETAB001
"""
from django.core.management.base import BaseCommand, CommandError
from api.models import (
    Etablissement,
    Departement, Specialite, Classe, Etudiant, Enseignant,
    Inscription, Evaluation, Paiement, Cours, Seance, FicheNotes,
    Examen, Stage, CarteEtudiant, Decision, Facture, RapportStatistique,
)

MODELS = [
    Departement, Specialite, Classe, Etudiant, Enseignant,
    Inscription, Evaluation, Paiement, Cours, Seance, FicheNotes,
    Examen, Stage, CarteEtudiant, Decision, Facture, RapportStatistique,
]


class Command(BaseCommand):
    help = 'Rattache tous les enregistrements existants au premier établissement actif'

    def add_arguments(self, parser):
        parser.add_argument(
            '--etab', dest='code_etab', default=None,
            help='Code de l\'établissement cible (défaut : premier actif)',
        )

    def handle(self, *args, **options):
        code = options['code_etab']
        if code:
            try:
                etab = Etablissement.objects.get(code_etab=code)
            except Etablissement.DoesNotExist:
                raise CommandError(f"Établissement '{code}' introuvable.")
        else:
            etab = Etablissement.objects.filter(actif=True).first()
            if not etab:
                raise CommandError("Aucun établissement actif trouvé. Créez-en un d'abord.")

        self.stdout.write(f"Rattachement vers : {etab.lib_etab} ({etab.code_etab})\n")

        total = 0
        for Model in MODELS:
            try:
                count = Model.objects.filter(etablissement__isnull=True).update(etablissement=etab)
                self.stdout.write(f"  {Model.__name__:<25} {count:>5} enregistrement(s) rattaché(s)")
                total += count
            except Exception as exc:
                self.stderr.write(f"  {Model.__name__}: ERREUR — {exc}")

        self.stdout.write(self.style.SUCCESS(f"\nTotal : {total} enregistrement(s) rattaché(s)."))
