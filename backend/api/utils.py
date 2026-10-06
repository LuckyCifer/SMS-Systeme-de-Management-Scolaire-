"""
api/utils.py — Fonctions utilitaires partagées entre views.py et mixins.py
"""
import logging
logger = logging.getLogger(__name__)


def get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    return xff.split(',')[0] if xff else request.META.get('REMOTE_ADDR', '0.0.0.0')


def log_action(request, action, model_name, object_id='', detail=''):
    from .models import AuditLog
    try:
        user_login = request.user.username if request.user and request.user.is_authenticated else ''
        AuditLog.objects.create(
            utilisateur=user_login, action=action, modele=model_name,
            objet_id=str(object_id)[:100], detail=str(detail)[:500],
            ip_address=get_client_ip(request),
        )
    except Exception as exc:
        logger.error('log_action failed: %s', exc)


def check_event_date_bounds(date_value, annee=None, periode=None):
    """
    Vérifie qu'un événement daté (examen, séance, évaluation…) tombe bien dans les bornes
    de l'année scolaire (`annee.date_deb`/`date_fin`) et, si fournie, de la période
    (`periode.date_debut`/`date_fin`) auxquelles il est rattaché.

    Retourne un message d'erreur (str) si la date est hors bornes, sinon None. Les bornes
    non renseignées (calendrier pas encore paramétré pour cette année/période) sont
    ignorées plutôt que de bloquer la création — on ne peut pas exiger une cohérence que
    l'établissement n'a pas encore configurée.

    Tolère la comparaison DateField/DateTimeField : une date sans heure est comparée à la
    partie date des bornes (une évaluation le dernier jour de l'année ne doit pas être
    rejetée juste parce que `date_fin` porte une heure de fin de journée).
    """
    from datetime import datetime

    if date_value is None:
        return None

    is_date_only = not isinstance(date_value, datetime)

    def _bound(value):
        if value is None:
            return None
        return value.date() if (is_date_only and isinstance(value, datetime)) else value

    if annee is not None:
        deb, fin = _bound(annee.date_deb), _bound(annee.date_fin)
        if deb and date_value < deb:
            return f"antérieure au début de l'année scolaire {annee} ({deb})"
        if fin and date_value > fin:
            return f"postérieure à la fin de l'année scolaire {annee} ({fin})"

    if periode is not None:
        deb, fin = _bound(periode.date_debut), _bound(periode.date_fin)
        if deb and date_value < deb:
            return f"antérieure au début de la période {periode} ({deb})"
        if fin and date_value > fin:
            return f"postérieure à la fin de la période {periode} ({fin})"

    return None


def moyenne_ponderee(evaluations):
    """
    Calcule la moyenne pondérée d'un ensemble d'Evaluation portant sur un même étudiant +
    matière + période, à partir du pourcentage TypeEvaluation.ponderation (ex : Contrôle
    continu 30%, Session normale 70%).

    - Les notes sont d'abord regroupées et moyennées par type d'évaluation (utile si
      plusieurs notes existent pour un même type, ex. deux devoirs de contrôle continu).
    - Chaque moyenne de type est ensuite pondérée par son pourcentage, proratisé sur la
      somme des pondérations réellement présentes — ce qui permet d'afficher une moyenne
      cohérente même si tous les types n'ont pas encore été saisis (ex. la session normale
      n'a pas encore eu lieu).
    - Si aucun des types présents n'a de pondération configurée, repli sur une moyenne
      arithmétique simple de toutes les notes (comportement historique, rétrocompatible
      pour les établissements qui n'utilisent pas cette fonctionnalité).
    - Substitution : si un type porte un `remplace` (ex : Rattrapage → Session normale) et
      que le type ciblé a lui aussi une note dans ce groupe, la note du type remplaçant
      écrase celle du type ciblé — qui conserve sa pondération — au lieu de s'y ajouter.

    `evaluations` : itérable d'objets Evaluation avec `code_type_eval` (et idéalement
    `code_type_eval__remplace`) pré-chargés (select_related) pour éviter les requêtes N+1.
    Retourne un float arrondi à 2 décimales, ou None si `evaluations` est vide.
    """
    from collections import defaultdict

    notes_par_type = defaultdict(list)
    for e in evaluations:
        if e.note is None:
            continue
        notes_par_type[e.code_type_eval].append(float(e.note))

    if not notes_par_type:
        return None

    # Substitutions (ex : une note de Rattrapage remplace celle de Session normale).
    for type_eval in list(notes_par_type.keys()):
        cible = type_eval.remplace
        if cible is not None and cible in notes_par_type:
            notes_par_type[cible] = notes_par_type.pop(type_eval)

    somme_ponderee   = 0.0
    total_ponderation = 0.0
    toutes_notes      = []

    for type_eval, notes in notes_par_type.items():
        moyenne_type = sum(notes) / len(notes)
        toutes_notes.extend(notes)
        if type_eval.ponderation is not None:
            poids = float(type_eval.ponderation)
            somme_ponderee    += moyenne_type * poids
            total_ponderation += poids

    if total_ponderation > 0:
        return round(somme_ponderee / total_ponderation, 2)

    # Repli : aucune pondération configurée pour les types d'évaluation présents.
    return round(sum(toutes_notes) / len(toutes_notes), 2)
