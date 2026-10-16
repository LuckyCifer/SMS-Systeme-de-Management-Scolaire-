"""
api/horaires.py — Pauses de l'emploi du temps (récréations, pause déjeuner).

Règle : aucun cours ne chevauche une pause. Elle est vérifiée dans les deux sens :
- un créneau de planning qui empiète sur une pause est refusé (PlanningSerializer) ;
- une pause qui empiète sur un cours déjà programmé est refusée (PauseHoraireSerializer).

Une pause sans jour vaut pour toute la semaine. Si un jour a ses propres pauses, elles
remplacent celles de la semaine pour ce jour. Seuls les cours des années non clôturées
comptent : les emplois du temps des années passées ne sont plus modifiés.
"""
from django.db.models import Q

from .models import Jour, PauseHoraire, Planning


def _hm(t):
    return t.strftime('%H:%M') if t else ''


def pauses_du_jour(etab_id, code_jour, exclure_pk=None):
    """Pauses qui s'appliquent à ce jour, dans l'école donnée."""
    qs = PauseHoraire.objects.filter(etablissement_id=etab_id)
    if exclure_pk:
        qs = qs.exclude(pk=exclure_pk)
    propres = qs.filter(code_jour_id=code_jour)
    return propres if propres.exists() else qs.filter(code_jour__isnull=True)


def pause_chevauchee(etab_id, code_jour, h_debut, h_fin):
    """
    Première pause qui chevauche [h_debut, h_fin[, ou None. Sans jour (planning intensif,
    qui couvre toute une semaine), toutes les pauses de l'école comptent.
    """
    if not etab_id or not h_debut or not h_fin:
        return None
    if code_jour:
        pauses = pauses_du_jour(etab_id, code_jour)
    else:
        pauses = PauseHoraire.objects.filter(etablissement_id=etab_id)
    return pauses.filter(h_debut__lt=h_fin, h_fin__gt=h_debut).order_by('h_debut').first()


def message_pause(pause):
    jour = f" le {pause.code_jour.lib_jour}" if pause.code_jour_id else ""
    return (f"Ce créneau empiète sur la pause « {pause.libelle} » "
            f"({_hm(pause.h_debut)} – {_hm(pause.h_fin)}{jour}).")


def jours_ou_la_pause_s_applique(etab_id, code_jour, exclure_pk=None):
    """Codes des jours où une pause (de ce jour, ou de toute la semaine) s'appliquera."""
    if code_jour:
        return [code_jour]
    avec_pauses_propres = set(
        PauseHoraire.objects.filter(etablissement_id=etab_id, code_jour__isnull=False)
        .exclude(pk=exclure_pk).values_list('code_jour_id', flat=True)
    )
    return [j for j in Jour.objects.values_list('code_jour', flat=True) if j not in avec_pauses_propres]


def cours_chevauches(etab_id, jours, h_debut, h_fin):
    """Créneaux des années non clôturées, dans ces jours, qui chevauchent [h_debut, h_fin[."""
    qs = (Planning.objects
          .filter(code_cours__etablissement_id=etab_id, h_debut__lt=h_fin, h_fin__gt=h_debut)
          .exclude(code_cours__code_annee__statut='CLOTUREE')
          .select_related('code_cours__code_matiere', 'code_cours__code_classe', 'code_jour'))
    # Un planning intensif occupe tous les jours de sa semaine.
    return qs.filter(Q(type_planning='INTENSIF') | Q(code_jour_id__in=jours))


def message_cours(planning):
    c = planning.code_cours
    jour = planning.code_jour.lib_jour if planning.code_jour_id else "semaine intensive"
    return (f"Cette pause empiète sur le cours de {c.code_matiere.lib_matiere} en "
            f"{c.code_classe.lib_classe} ({jour}, {_hm(planning.h_debut)} – {_hm(planning.h_fin)}). "
            "Déplacez d'abord ce cours.")
