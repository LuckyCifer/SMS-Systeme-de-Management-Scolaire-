"""
api/vie_scolaire.py — Présences, retards et absences au quotidien.

Deux sources d'absences :
  - l'appel par séance (Absence, rattachée à une Seance de l'emploi du temps) ;
  - l'appel journalier d'une classe (Appel / AppelLigne : matin ou après-midi), adapté au
    primaire où un même maître fait l'appel pour toute la demi-journée.
Ce module fournit la feuille d'appel journalier, la vue « absences et retards du jour » du
surveillant général et les alertes de seuil d'heures d'absence non justifiées.
"""
import datetime
from collections import defaultdict

from django.db import transaction
from django.db.models import Q

# Une demi-journée d'absence à l'appel journalier compte pour ce nombre d'heures dans les
# alertes (modifiable par paramètre de requête).
HEURES_PAR_DEMI_JOURNEE = 4


def annee_de_la_date(date):
    """Année scolaire contenant `date` (dates de l'année), à défaut celle « EN COURS »."""
    from .models import Annee
    annee = (Annee.objects.filter(date_deb__date__lte=date, date_fin__date__gte=date).first()
             or Annee.objects.filter(statut='EN COURS').first())
    return annee


def eleves_de_classe(code_classe, date):
    """Élèves inscrits dans la classe pour l'année de `date` (à défaut, tous ses inscrits)."""
    from .models import Etudiant, Inscription
    inscriptions = Inscription.objects.filter(code_classe=code_classe)
    annee = annee_de_la_date(date)
    if annee and inscriptions.filter(code_annee=annee).exists():
        inscriptions = inscriptions.filter(code_annee=annee)
    return Etudiant.objects.filter(pk__in=inscriptions.values('mle_etudiant')).order_by('nom', 'prenom')


def feuille_appel(code_classe, date, creneau):
    """Liste d'appel : chaque élève avec son statut enregistré, PRÉSENT par défaut."""
    from .models import Appel
    appel = Appel.objects.filter(code_classe=code_classe, date=date, creneau=creneau).first()
    existantes = {l.mle_etudiant_id: l for l in appel.lignes.all()} if appel else {}
    eleves = []
    for e in eleves_de_classe(code_classe, date):
        l = existantes.get(e.pk)
        eleves.append({
            'mle_etudiant':   e.pk,
            'nom':            e.nom,
            'prenom':         e.prenom,
            'statut':         l.statut if l else 'PRESENT',
            'minutes_retard': l.minutes_retard if l else 0,
            'justifiee':      l.justifiee if l else False,
            'motif':          l.motif if l else '',
        })
    return {'appel': appel.pk if appel else None, 'fait_par': appel.fait_par if appel else None,
            'eleves': eleves}


def enregistrer_appel(etablissement_id, code_classe, date, creneau, lignes, login):
    """Enregistre l'appel (tout ou rien). Retourne (appel, erreurs)."""
    from .models import Appel, AppelLigne
    inscrits = set(eleves_de_classe(code_classe, date).values_list('pk', flat=True))
    erreurs, propres = [], []
    for l in lignes:
        mle, statut = l.get('mle_etudiant'), l.get('statut') or 'PRESENT'
        if mle not in inscrits:
            erreurs.append(f'{mle} : élève non inscrit dans cette classe.')
        elif statut not in dict(AppelLigne.STATUT_CHOICES):
            erreurs.append(f'{mle} : statut invalide.')
        else:
            minutes = int(l.get('minutes_retard') or 0) if statut == 'RETARD' else 0
            propres.append((mle, statut, max(minutes, 0)))
    if erreurs:
        return None, erreurs
    with transaction.atomic():
        appel, _ = Appel.objects.update_or_create(
            code_classe_id=code_classe, date=date, creneau=creneau,
            defaults={'etablissement_id': etablissement_id, 'fait_par': login},
        )
        for mle, statut, minutes in propres:
            ligne, cree = AppelLigne.objects.get_or_create(
                appel=appel, mle_etudiant_id=mle,
                defaults={'statut': statut, 'minutes_retard': minutes})
            if not cree:
                if statut == 'PRESENT':
                    ligne.justifiee, ligne.motif = False, None
                ligne.statut, ligne.minutes_retard = statut, minutes
                ligne.save()
    return appel, []


def duree_seance(seance):
    """Heures d'une séance : celles effectuées si renseignées, sinon l'horaire prévu."""
    if seance.nb_heures_effectuees:
        return float(seance.nb_heures_effectuees)
    debut = datetime.datetime.combine(datetime.date.today(), seance.h_debut)
    fin = datetime.datetime.combine(datetime.date.today(), seance.h_fin)
    return max((fin - debut).total_seconds() / 3600, 0)


def evenements_du_jour(etablissement_id, date):
    """Absences et retards du jour, toutes classes de l'école, des deux sources."""
    from .models import Absence, AppelLigne
    lignes = []
    for a in (Absence.objects
              .filter(code_seance__etablissement_id=etablissement_id, code_seance__date_seance=date)
              .filter(Q(present=False) | Q(retard_minutes__gt=0))
              .select_related('mle_etudiant', 'code_seance__code_classe', 'code_seance__code_matiere')):
        s = a.code_seance
        lignes.append({
            'source': 'SEANCE', 'id': a.pk,
            'type': 'ABSENCE' if not a.present else 'RETARD',
            'minutes_retard': a.retard_minutes,
            'mle_etudiant': a.mle_etudiant_id,
            'eleve': f'{a.mle_etudiant.nom} {a.mle_etudiant.prenom or ""}'.strip(),
            'code_classe': s.code_classe_id, 'lib_classe': s.code_classe.lib_classe,
            'quand': f'{s.code_matiere.lib_matiere} {s.h_debut:%H:%M}-{s.h_fin:%H:%M}',
            'justifiee': a.justifiee, 'motif': a.motif or '',
        })
    for l in (AppelLigne.objects
              .filter(appel__etablissement_id=etablissement_id, appel__date=date)
              .exclude(statut='PRESENT')
              .select_related('mle_etudiant', 'appel__code_classe')):
        lignes.append({
            'source': 'APPEL', 'id': l.pk,
            'type': 'ABSENCE' if l.statut == 'ABSENT' else 'RETARD',
            'minutes_retard': l.minutes_retard,
            'mle_etudiant': l.mle_etudiant_id,
            'eleve': f'{l.mle_etudiant.nom} {l.mle_etudiant.prenom or ""}'.strip(),
            'code_classe': l.appel.code_classe_id, 'lib_classe': l.appel.code_classe.lib_classe,
            'quand': l.appel.get_creneau_display(),
            'creneau': l.appel.creneau,  # MATIN / APRES_MIDI, traduit par l'interface
            'justifiee': l.justifiee, 'motif': l.motif or '',
        })
    lignes.sort(key=lambda x: (x['lib_classe'], x['eleve']))
    return lignes


def justifier(etablissement_id, source, pk, justifiee, motif):
    """Justifie (ou non) une absence / un retard de l'école. Retourne False si introuvable."""
    from .models import Absence, AppelLigne
    if source == 'SEANCE':
        qs = Absence.objects.filter(pk=pk, code_seance__etablissement_id=etablissement_id)
    elif source == 'APPEL':
        qs = AppelLigne.objects.filter(pk=pk, appel__etablissement_id=etablissement_id)
    else:
        return False
    return bool(qs.update(justifiee=bool(justifiee), motif=(motif or '')[:100] or None))


def alertes(etablissement_id, code_annee=None, seuil_avertissement=10, seuil_conseil=20,
            heures_demi_journee=HEURES_PAR_DEMI_JOURNEE):
    """
    Élèves dont les heures d'absence NON justifiées atteignent un seuil sur l'année :
    séances manquées (durée de la séance) + demi-journées d'absence à l'appel journalier
    (`heures_demi_journee` heures chacune). Retards comptés à part, pour information.
    """
    from .models import Absence, Annee, AppelLigne, Etudiant
    annee = Annee.objects.filter(pk=code_annee).first() if code_annee else annee_de_la_date(datetime.date.today())
    heures, retards = defaultdict(float), defaultdict(int)

    absences = Absence.objects.filter(code_seance__etablissement_id=etablissement_id, justifiee=False)
    if annee:
        absences = absences.filter(code_seance__code_annee=annee)
    for a in absences.select_related('code_seance'):
        if not a.present:
            heures[a.mle_etudiant_id] += duree_seance(a.code_seance)
        elif a.retard_minutes:
            retards[a.mle_etudiant_id] += 1

    lignes = AppelLigne.objects.filter(appel__etablissement_id=etablissement_id, justifiee=False)
    if annee and annee.date_deb and annee.date_fin:
        lignes = lignes.filter(appel__date__gte=annee.date_deb.date(), appel__date__lte=annee.date_fin.date())
    for l in lignes:
        if l.statut == 'ABSENT':
            heures[l.mle_etudiant_id] += heures_demi_journee
        elif l.statut == 'RETARD':
            retards[l.mle_etudiant_id] += 1

    concernes = {mle: h for mle, h in heures.items() if h >= seuil_avertissement}
    eleves = {e.pk: e for e in Etudiant.objects.filter(pk__in=concernes)}
    resultat = [{
        'mle_etudiant': mle,
        'eleve': f'{eleves[mle].nom} {eleves[mle].prenom or ""}'.strip() if mle in eleves else mle,
        'heures_non_justifiees': round(h, 1),
        'retards': retards.get(mle, 0),
        'niveau': 'CONSEIL_DISCIPLINE' if h >= seuil_conseil else 'AVERTISSEMENT',
    } for mle, h in concernes.items()]
    resultat.sort(key=lambda x: -x['heures_non_justifiees'])
    return {'annee': annee.pk if annee else None, 'eleves': resultat}
