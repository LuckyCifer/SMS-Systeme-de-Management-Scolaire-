"""
Supprime un ou plusieurs établissements et toutes leurs données : classes, élèves, notes,
paiements, comptes utilisateurs (et leur compte Django), etc.

Aperçu par défaut : la suppression est simulée dans une transaction annulée, et la commande
affiche ce qui serait supprimé. --appliquer pour supprimer réellement. Irréversible :
faire une sauvegarde de la base avant (voir docs/Guide-installation-Docker-SMS.pdf, annexe).

    python manage.py supprimer_etablissement LBN LBNK
    python manage.py supprimer_etablissement LBN LBNK --appliquer
"""
from collections import Counter

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import ProtectedError, RestrictedError
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

from api.models import Etablissement, Paiement, Tranche, Utilisateur


class Command(BaseCommand):
    help = "Supprime des établissements et toutes leurs données (aperçu ; --appliquer)."

    def add_arguments(self, parser):
        parser.add_argument('codes', nargs='+', help='code_etab des établissements à supprimer')
        parser.add_argument('--appliquer', action='store_true', help='Supprime réellement.')

    def handle(self, *args, codes, appliquer, **opts):
        etabs = list(Etablissement.objects.filter(code_etab__in=codes))
        inconnus = set(codes) - {e.code_etab for e in etabs}
        if inconnus:
            raise CommandError(f"Établissement(s) introuvable(s) : {', '.join(sorted(inconnus))}")

        total = Counter()
        with transaction.atomic():
            for etab in etabs:
                self.stdout.write(f"{etab.code_etab} — {etab.lib_etab}")
                logins = list(Utilisateur.objects.filter(etablissement=etab).values_list('login', flat=True))
                try:
                    # Les tranches (sans champ établissement) protègent leur pension : on les
                    # retire d'abord, après les paiements qui les référencent.
                    avant = Counter()
                    # Les comptes ne sont pas supprimés avec l'école (lien mis à vide) : on les
                    # supprime ici, sinon ils resteraient actifs sans établissement.
                    for qs in (Paiement.objects.filter(etablissement=etab),
                               Tranche.objects.filter(code_pension__etablissement=etab),
                               Utilisateur.objects.filter(etablissement=etab)):
                        avant.update(qs.delete()[1])
                    _, par_modele = etab.delete()
                    par_modele = dict(Counter(par_modele) + avant)
                except (ProtectedError, RestrictedError) as err:
                    raise CommandError(f"{etab.code_etab} : suppression bloquée par des données liées ({err})")
                # Compte Django associé à chaque compte de l'application (même identifiant).
                # Suppression directe : la base importée n'a pas les tables de groupes et de
                # permissions de Django, que User.delete() voudrait aussi nettoyer.
                comptes = User.objects.filter(username__in=logins)
                OutstandingToken.objects.filter(user__in=comptes).update(user=None)
                n_users = comptes._raw_delete(comptes.db)
                if n_users:
                    par_modele = {**par_modele, 'auth.User': n_users}
                for modele, n in sorted(par_modele.items(), key=lambda x: -x[1]):
                    if n:
                        self.stdout.write(f"  {modele.split('.')[-1]:<24} {n}")
                total.update(par_modele)
            if not appliquer:
                transaction.set_rollback(True)

        self.stdout.write(f"Total : {sum(total.values())} enregistrement(s).")
        if appliquer:
            self.stdout.write(self.style.SUCCESS('Établissement(s) supprimé(s).'))
        else:
            self.stdout.write(self.style.NOTICE('Aperçu seulement : relancer avec --appliquer pour supprimer.'))
