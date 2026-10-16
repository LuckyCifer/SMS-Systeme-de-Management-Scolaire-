"""
Déduit le niveau scolaire national et la série des classes du primaire et du secondaire
à partir de leur libellé (voir api/deduction_classes.py).

    python manage.py deduire_niveaux_series              # aperçu, rien n'est enregistré
    python manage.py deduire_niveaux_series --appliquer  # enregistre les propositions

Seuls les champs vides sont remplis : un niveau ou une série déjà saisi n'est jamais
écrasé (une divergence est seulement signalée).
"""
from django.core.management.base import BaseCommand

from api.deduction_classes import deduire_niveau_serie
from api.models import Classe, NiveauScolaire


class Command(BaseCommand):
    help = "Déduit niveau scolaire et série des classes primaire/secondaire depuis leur libellé."

    def add_arguments(self, parser):
        parser.add_argument('--appliquer', action='store_true', help='Enregistre les propositions.')
        parser.add_argument('--etab', help="Limiter à un établissement (code_etab).")

    def handle(self, *args, **opts):
        niveaux_connus = set(NiveauScolaire.objects.values_list('code_niveau', flat=True))
        classes = (Classe.objects
                   .filter(etablissement__type_etab__in=['PRIMAIRE', 'SECONDAIRE'])
                   .select_related('etablissement')
                   .order_by('etablissement_id', 'lib_classe'))
        if opts['etab']:
            classes = classes.filter(etablissement_id=opts['etab'])

        modifiees = a_verifier = 0
        lignes = []
        for c in classes:
            d = deduire_niveau_serie(c.lib_classe)
            remarques = [d['remarque']] if d['remarque'] else []
            niveau = d['niveau'] if d['niveau'] in niveaux_connus else None
            if d['niveau'] and not niveau:
                remarques.append(f"niveau {d['niveau']} absent du référentiel")

            nouveau_niveau, nouvelle_serie = c.niveau_scolaire_id, c.serie or ''
            if niveau and not c.niveau_scolaire_id:
                nouveau_niveau = niveau
            elif niveau and c.niveau_scolaire_id != niveau:
                remarques.append(f'niveau actuel {c.niveau_scolaire_id} conservé (déduit : {niveau})')
            if d['serie'] and not c.serie:
                nouvelle_serie = d['serie']
            elif d['serie'] and c.serie != d['serie']:
                remarques.append(f'série actuelle {c.serie} conservée (déduite : {d["serie"]})')

            change = (nouveau_niveau != c.niveau_scolaire_id) or (nouvelle_serie != (c.serie or ''))
            if change:
                modifiees += 1
            if remarques:
                a_verifier += 1
            lignes.append((c.etablissement_id, c.code_classe, c.lib_classe,
                           c.niveau_scolaire_id or '—', nouveau_niveau or '—',
                           c.serie or '—', nouvelle_serie or '—', '; '.join(remarques)))
            if change and opts['appliquer']:
                c.niveau_scolaire_id = nouveau_niveau
                c.serie = nouvelle_serie or None
                c.save(update_fields=['niveau_scolaire', 'serie'])

        entete = ('Étab', 'Classe', 'Libellé', 'Niveau actuel', 'Niveau proposé',
                  'Série actuelle', 'Série proposée', 'Remarque')
        self.stdout.write(' | '.join(entete))
        for l in lignes:
            self.stdout.write(' | '.join(str(x) for x in l))
        verbe = 'modifiées' if opts['appliquer'] else 'à modifier (aperçu, rien enregistré)'
        self.stdout.write(self.style.SUCCESS(
            f'\n{len(lignes)} classes analysées — {modifiees} {verbe} — {a_verifier} à vérifier.'))
