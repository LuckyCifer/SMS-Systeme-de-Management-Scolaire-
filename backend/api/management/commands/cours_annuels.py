"""
Primaire et secondaire : un seul emploi du temps par classe et par année. Cette commande
passe les cours de ces écoles en « Année entière » (semestre = 'AN').

Une même matière d'une classe présente en plusieurs exemplaires (S1/S2 ou T1/T2/T3) est
fusionnée en un seul cours : on garde celui qui a le plus de créneaux, on y rattache les
créneaux des autres (un créneau identique en double est supprimé) et on additionne le
volume horaire. Les chevauchements que la fusion ferait apparaître sont signalés.

Aperçu par défaut ; --appliquer pour enregistrer.
"""
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Cours, Planning

TYPES_ANNUELS = ('PRIMAIRE', 'SECONDAIRE')


def _cle_creneau(p):
    return (p.type_planning, p.code_jour_id, p.h_debut, p.h_fin, p.date_debut, p.date_fin)


class Command(BaseCommand):
    help = "Passe les cours du primaire et du secondaire en « Année entière » (aperçu ; --appliquer)."

    def add_arguments(self, parser):
        parser.add_argument('--appliquer', action='store_true', help='Enregistre les changements.')
        parser.add_argument('--etab', help="Limite à une école (code_etab).")

    def handle(self, *args, **opts):
        cours = Cours.objects.filter(etablissement__type_etab__in=TYPES_ANNUELS)
        if opts['etab']:
            cours = cours.filter(etablissement_id=opts['etab'])

        groupes = defaultdict(list)
        for c in cours.select_related('etablissement'):
            groupes[(c.etablissement_id, c.code_annee_id, c.code_classe_id, c.code_matiere_id)].append(c)
        groupes = {k: v for k, v in groupes.items() if any(c.semestre != 'AN' for c in v)}

        with transaction.atomic():
            bilan = self._convertir(groupes)
            avertissements = self._chevauchements({k[0] for k in groupes})
            if not opts['appliquer']:
                transaction.set_rollback(True)

        self.stdout.write(f"Cours à passer en « Année entière » : {bilan['convertis']}")
        self.stdout.write(f"Matières fusionnées : {bilan['fusions']} ({bilan['supprimes']} cours en double retirés)")
        self.stdout.write(f"Créneaux rattachés : {bilan['deplaces']} ; créneaux identiques en double supprimés : {bilan['doublons']}")
        for ligne in bilan['enseignants'][:20]:
            self.stdout.write(self.style.WARNING(ligne))
        if len(bilan['enseignants']) > 20:
            self.stdout.write(self.style.WARNING(f"… et {len(bilan['enseignants']) - 20} autres fusions avec enseignants différents."))
        if avertissements:
            self.stdout.write(self.style.WARNING(f"{len(avertissements)} chevauchement(s) après fusion, à corriger dans le planning :"))
            for ligne in avertissements[:30]:
                self.stdout.write(self.style.WARNING('  ' + ligne))
        else:
            self.stdout.write("Aucun chevauchement après fusion.")
        if opts['appliquer']:
            self.stdout.write(self.style.SUCCESS('Changements enregistrés.'))
        else:
            self.stdout.write(self.style.NOTICE('Aperçu seulement : relancer avec --appliquer pour enregistrer.'))

    def _convertir(self, groupes):
        bilan = {'convertis': 0, 'fusions': 0, 'supprimes': 0, 'deplaces': 0, 'doublons': 0, 'enseignants': []}
        for (etab, annee, classe, matiere), liste in groupes.items():
            nb = {c.pk: Planning.objects.filter(code_cours=c).count() for c in liste}
            # Le cours gardé : déjà annuel, sinon le plus de créneaux, puis un enseignant, puis le plus ancien.
            liste.sort(key=lambda c: (c.semestre != 'AN', -nb[c.pk], c.mle_ens_id is None, c.pk))
            garde, autres = liste[0], liste[1:]
            if autres:
                bilan['fusions'] += 1
                ens = {c.mle_ens_id for c in liste if c.mle_ens_id}
                if len(ens) > 1:
                    bilan['enseignants'].append(
                        f"{etab} {annee} {classe} {matiere} : enseignants différents selon la période "
                        f"({', '.join(sorted(ens))}) ; gardé : {garde.mle_ens_id}")
                existants = {_cle_creneau(p) for p in Planning.objects.filter(code_cours=garde)}
                for c in autres:
                    for p in Planning.objects.filter(code_cours=c):
                        if _cle_creneau(p) in existants:
                            p.delete()
                            bilan['doublons'] += 1
                        else:
                            p.code_cours = garde
                            p.save(update_fields=['code_cours'])
                            existants.add(_cle_creneau(p))
                            bilan['deplaces'] += 1
                    garde.quota_horaire += c.quota_horaire
                    c.delete()
                    bilan['supprimes'] += 1
            if garde.semestre != 'AN' or autres:
                garde.semestre = 'AN'
                garde.save(update_fields=['semestre', 'quota_horaire'])
                bilan['convertis'] += 1
        return bilan

    def _chevauchements(self, etabs):
        """Créneaux hebdomadaires annuels qui se chevauchent (même classe, enseignant ou salle)."""
        lignes = []
        plannings = (Planning.objects
                     .filter(type_planning='HEBDO', code_cours__semestre='AN',
                             code_cours__etablissement_id__in=etabs)
                     .select_related('code_cours', 'code_cours__code_classe', 'code_cours__code_matiere')
                     .order_by('code_cours__code_annee', 'code_jour', 'h_debut'))
        par_jour = defaultdict(list)
        for p in plannings:
            par_jour[(p.code_cours.code_annee_id, p.code_jour_id)].append(p)
        for (annee, jour), liste in par_jour.items():
            for i, a in enumerate(liste):
                for b in liste[i + 1:]:
                    if b.h_debut >= a.h_fin:
                        break
                    motifs = []
                    if a.code_cours.code_classe_id == b.code_cours.code_classe_id:
                        motifs.append('classe')
                    if a.code_cours.mle_ens_id and a.code_cours.mle_ens_id == b.code_cours.mle_ens_id:
                        motifs.append('enseignant')
                    if a.code_salle_id and a.code_salle_id == b.code_salle_id:
                        motifs.append('salle')
                    if motifs:
                        lignes.append(
                            f"{annee} {jour} {a.h_debut:%H:%M} : {a.code_cours.code_matiere_id} "
                            f"({a.code_cours.code_classe.lib_classe}) / {b.code_cours.code_matiere_id} "
                            f"({b.code_cours.code_classe.lib_classe}) — même {', '.join(motifs)}")
        return lignes
