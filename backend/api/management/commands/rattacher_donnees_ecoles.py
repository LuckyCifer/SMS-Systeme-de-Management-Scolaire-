"""
Rattache à leur école les données créées avant l'isolation par établissement
(migration 0025) : sans école, elles seraient invisibles pour tout le monde.

    python manage.py rattacher_donnees_ecoles                         # aperçu, rien n'est enregistré
    python manage.py rattacher_donnees_ecoles --salles-pour ETAB001 --appliquer

Règles (seules les lignes sans école sont traitées) :
  - Journal d'audit : l'école du compte qui a agi.
  - Pensions : l'école des classes qui les utilisent (via leurs niveaux), sinon l'école dont
    le code ou le nom figure dans le libellé (« APEE Lycée Mbouda », « … LBN »).
  - Cycles : l'école de leur pension. Niveaux : l'école de leurs classes, sinon de leur
    pension, sinon de leur cycle.
  - Bâtiments et salles : l'école donnée par --salles-pour. Une salle utilisée dans le
    planning d'une autre école est dupliquée pour celle-ci, et son planning pointe vers la copie.
Ce qui ne peut pas être déduit est listé, pour être rattaché à la main.
"""
import unicodedata

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.models import (
    AuditLog, Batiment, Classe, Cycle, Etablissement, Frais, Niveau, Pension, Planning,
    RapportFinancier, Salle, Tuteur, Utilisateur,
)


def _norm(texte):
    return unicodedata.normalize('NFKD', texte or '').encode('ascii', 'ignore').decode().lower()


class Command(BaseCommand):
    help = "Rattache à leur école les données sans établissement (aperçu par défaut)."

    def add_arguments(self, parser):
        parser.add_argument('--appliquer', action='store_true', help='Enregistre les rattachements.')
        parser.add_argument('--salles-pour', help="Code de l'école qui reçoit les bâtiments et salles.")

    def handle(self, *args, **opts):
        self.appliquer = opts['appliquer']
        ecoles = list(Etablissement.objects.all())
        self.reste = []
        with transaction.atomic():
            self._audit()
            pensions = self._pensions(ecoles)
            self._cycles(pensions)
            self._niveaux(pensions)
            self._salles(opts['salles_pour'], ecoles)
            for modele in (Frais, Tuteur, RapportFinancier):
                for obj in modele.objects.filter(etablissement__isnull=True):
                    self.reste.append(f'{modele.__name__} {obj.pk} — {obj}')
            if not self.appliquer:
                transaction.set_rollback(True)

        if self.reste:
            self.stdout.write(self.style.WARNING('\nÀ rattacher à la main :'))
            for ligne in self.reste:
                self.stdout.write(f'  - {ligne}')
        self.stdout.write(self.style.SUCCESS(
            '\nRattachements enregistrés.' if self.appliquer else '\nAperçu uniquement : rien n\'a été enregistré.'))

    def _maj(self, obj, etab_id):
        obj.etablissement_id = etab_id
        obj.save(update_fields=['etablissement'])

    def _audit(self):
        ecole_du_compte = dict(Utilisateur.objects.exclude(etablissement__isnull=True)
                               .values_list('login', 'etablissement_id'))
        n = 0
        for login, etab in ecole_du_compte.items():
            n += AuditLog.objects.filter(etablissement__isnull=True, utilisateur=login).update(etablissement_id=etab)
        sans = AuditLog.objects.filter(etablissement__isnull=True).count()
        self.stdout.write(f"Journal d'audit : {n} traces rattachées ; {sans} restent sans école "
                          f"(SUPER_ADMIN, connexions échouées) — visibles d'aucune école.")

    def _pensions(self, ecoles):
        self.stdout.write('\nPensions :')
        resultat = {}
        for p in Pension.objects.all().order_by('code_pension'):
            if p.etablissement_id:
                resultat[p.pk] = p.etablissement_id
                continue
            via = set(Classe.objects.filter(code_niveau__code_pension=p).exclude(etablissement__isnull=True)
                      .values_list('etablissement_id', flat=True))
            etab, source = (via.pop(), 'classes') if len(via) == 1 else (None, None)
            if not etab:
                lib = _norm(p.lib_pension)
                candidats = [e.code_etab for e in ecoles
                             if _norm(e.code_etab) in lib.split() or _norm(e.lib_etab.split()[-1]) in lib]
                if len(candidats) == 1:
                    etab, source = candidats[0], 'nom'
            if etab:
                resultat[p.pk] = etab
                self._maj(p, etab)
                self.stdout.write(f'  {p.lib_pension:32} → {etab} (par {source})')
            else:
                self.reste.append(f'Pension {p.pk} — {p.lib_pension}')
        return resultat

    def _cycles(self, pensions):
        self.stdout.write('\nCycles :')
        for c in Cycle.objects.filter(etablissement__isnull=True):
            etab = pensions.get(c.code_pension_id)
            if etab:
                self._maj(c, etab)
                self.stdout.write(f'  {c.lib_cycle:40} → {etab}')
            else:
                self.reste.append(f'Cycle {c.pk} — {c.lib_cycle}')

    def _niveaux(self, pensions):
        n = 0
        for niv in Niveau.objects.filter(etablissement__isnull=True).select_related('code_cycle'):
            via = set(Classe.objects.filter(code_niveau=niv).exclude(etablissement__isnull=True)
                      .values_list('etablissement_id', flat=True))
            etab = (via.pop() if len(via) == 1 else None) or pensions.get(niv.code_pension_id) \
                or (niv.code_cycle.etablissement_id if niv.code_cycle_id else None)
            if etab:
                self._maj(niv, etab)
                n += 1
            else:
                self.reste.append(f'Niveau {niv.pk} — {niv}')
        self.stdout.write(f'\nNiveaux : {n} rattachés.')

    def _salles(self, code_ecole, ecoles):
        sans_ecole = Salle.objects.filter(etablissement__isnull=True).count() \
            + Batiment.objects.filter(etablissement__isnull=True).count()
        if not sans_ecole:
            return
        if not code_ecole:
            self.reste.append(f'{sans_ecole} bâtiments/salles sans école (option --salles-pour non fournie)')
            return
        if not Etablissement.objects.filter(pk=code_ecole).exists():
            raise CommandError(f'École inconnue : {code_ecole}')
        nb_bat = Batiment.objects.filter(etablissement__isnull=True).update(etablissement_id=code_ecole)
        nb_sal = Salle.objects.filter(etablissement__isnull=True).update(etablissement_id=code_ecole)
        self.stdout.write(f'\nBâtiments : {nb_bat} et salles : {nb_sal} → {code_ecole}')

        # Salles utilisées dans le planning d'une autre école : une copie par école.
        libs = {e.code_etab: e.lib_etab for e in ecoles}
        autres = (Planning.objects.filter(code_salle__etablissement_id=code_ecole)
                  .exclude(code_cours__etablissement_id=code_ecole)
                  .values_list('code_salle_id', 'code_cours__etablissement_id').distinct())
        for code_salle, etab in sorted(set(autres)):
            salle = Salle.objects.get(pk=code_salle)
            prefixe = _norm(libs.get(etab, etab).split()[-1])[:1].upper() or 'X'
            nouveau = (prefixe + code_salle)[:5]
            i = 1
            while Salle.objects.filter(pk=nouveau).exists():
                nouveau = f'{prefixe}{i}{code_salle}'[:5]
                i += 1
            Salle.objects.create(code_salle=nouveau, lib_salle=salle.lib_salle,
                                 obs_salle=f'Copie de {code_salle}'[:45], etablissement_id=etab)
            n = Planning.objects.filter(code_salle_id=code_salle, code_cours__etablissement_id=etab) \
                .update(code_salle_id=nouveau)
            self.stdout.write(f'  Salle {code_salle} copiée en {nouveau} pour {etab} ({n} créneaux repointés)')
