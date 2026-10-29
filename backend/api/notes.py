"""
api/notes.py — Calcul des moyennes, rangs, appréciations et délibérations.

Source de vérité unique pour tout ce qui dérive des notes : l'API (moyennes, bulletins,
génération des décisions) passe par ici, et le frontend affiche ces résultats sans
refaire de calcul de son côté.

Règles par niveau :
  - Poids d'une matière dans la moyenne générale : coefficient de la grille
    (CoefficientMatiere : établissement, année, niveau, série) au primaire et au
    secondaire, crédits LMD (Cours.credits) au supérieur. Une matière notée dans la
    classe mais non composée par un élève compte pour 0 (pas ignorée).
  - Primaire : chaque note /20 est accompagnée d'une appréciation A/ECA/NA
    (00-09 NA, 10-14 ECA, 15-20 A), appliquée aussi aux moyennes.
  - Secondaire : un trimestre peut contenir des séquences (Periode.periode_parent) ; la
    moyenne du trimestre est alors la moyenne de ses séquences.
  - Supérieur : délibération LMD (validation des matières, compensation, note éliminatoire).
"""
from collections import Counter, defaultdict

from django.db.models import Max, Q
from django.utils import timezone

from .utils import moyenne_ponderee

PRE_BAC = {'PRIMAIRE', 'SECONDAIRE'}

# Bornes des appréciations du primaire : < 10 → NA, < 15 → ECA, sinon A.
SEUIL_ECA = 10
SEUIL_A   = 15


# ── Appréciations, mentions ───────────────────────────────────────────────────
def appreciation_depuis_note(note):
    """00-09/20 → NA, 10-14/20 → ECA, 15-20/20 → A (ex : 9,75 → NA ; 14,5 → ECA)."""
    if note is None:
        return None
    note = float(note)
    if note < SEUIL_ECA:
        return 'NA'
    if note < SEUIL_A:
        return 'ECA'
    return 'A'


def mention_depuis_moyenne(moyenne):
    if moyenne is None or moyenne < 10:
        return None
    if moyenne >= 16:
        return 'Très Bien'
    if moyenne >= 14:
        return 'Bien'
    if moyenne >= 12:
        return 'Assez Bien'
    return 'Passable'


# Appréciation d'une moyenne sur le bulletin du secondaire (matière ou moyenne générale).
ECHELLE_APPRECIATION = [(18, 'Excellent'), (16, 'Très bien'), (14, 'Bien'), (12, 'Assez bien'),
                        (10, 'Passable'), (8, 'Insuffisant'), (5, 'Faible'), (0, 'Très faible')]


def appreciation_bulletin(moyenne):
    if moyenne is None:
        return None
    return next(lib for seuil, lib in ECHELLE_APPRECIATION if moyenne >= seuil)


def type_etab_classe(code_classe_id, etablissement_id=None):
    """Type d'établissement (PRIMAIRE/SECONDAIRE/SUPERIEUR) d'une évaluation ou d'une classe."""
    from .models import Classe, Etablissement
    if etablissement_id:
        type_etab = (Etablissement.objects.filter(pk=etablissement_id)
                     .values_list('type_etab', flat=True).first())
        if type_etab:
            return type_etab
    if code_classe_id:
        return (Classe.objects.filter(pk=code_classe_id)
                .values_list('etablissement__type_etab', flat=True).first())
    return None


# ── Fiches de notes ───────────────────────────────────────────────────────────
def periode_close(code_classe, code_periode):
    """Vrai si la période — ou le trimestre qui contient cette séquence — est close pour la classe."""
    from .models import ClotureNotes, Periode
    if not code_classe or not code_periode:
        return False
    ids = [code_periode]
    parent = Periode.objects.filter(pk=code_periode).values_list('periode_parent', flat=True).first()
    if parent:
        ids.append(parent)
    return ClotureNotes.objects.filter(code_classe=code_classe, code_periode__in=ids).exists()


def verifier_periode_ouverte(code_classe, code_periode):
    """Lève PermissionDenied si les notes de cette classe sur cette période sont verrouillées."""
    from rest_framework.exceptions import PermissionDenied
    if periode_close(code_classe, code_periode):
        raise PermissionDenied("Cette période est clôturée pour cette classe (conseil de classe tenu) : "
                               "les notes ne peuvent plus être modifiées. Demandez sa réouverture "
                               "au censeur ou à l'administration.")


def note_sur_20(note, bareme):
    """Convertit une note saisie sur `bareme` en note sur 20 (ex : 8/10 → 16/20)."""
    if note is None:
        return None
    bareme = float(bareme or 20)
    return round(float(note) * 20 / bareme, 2)


def importer_fiche(fiche):
    """
    Reporte les notes d'une fiche dans Evaluation :
      - note saisie sur le barème de la fiche → convertie sur 20 ;
      - absent non justifié → 0 ;
      - absent justifié → évaluation « dispensée », neutralisée dans la moyenne.
    Une ligne sans rien de saisi est ignorée. Retourne le nombre d'évaluations écrites.
    """
    from .models import Evaluation, FicheNotesDetail
    n = 0
    for d in FicheNotesDetail.objects.filter(code_fiche=fiche):
        if d.absent:
            valeurs = {'note': None, 'dispense': True, 'obs_eval': 'Absence justifiée'} if d.justifie \
                else {'note': 0, 'dispense': False, 'obs_eval': 'Absent'}
        elif d.note is not None:
            valeurs = {'note': note_sur_20(d.note, fiche.bareme), 'dispense': False,
                       'obs_eval': (d.observation or '')[:45] or None}
        elif d.appreciation:
            valeurs = {'note': None, 'appreciation': d.appreciation, 'dispense': False,
                       'obs_eval': (d.observation or '')[:45] or None}
        else:
            continue
        Evaluation.objects.update_or_create(
            mle_etudiant=d.mle_etudiant, code_matiere=fiche.code_matiere,
            code_classe=fiche.code_classe, code_periode=fiche.code_periode,
            code_type_eval=fiche.code_type_eval,
            defaults={**valeurs, 'date_eval': fiche.date_evaluation,
                      'etablissement': fiche.etablissement, 'code_annee': fiche.code_annee},
        )
        n += 1
    return n


# ── Séries et grille des coefficients ─────────────────────────────────────────
SERIES_LANGUES      = ['ALLEMAND', 'ESPAGNOL', 'LATIN', 'CHINOIS']   # 4ème / 3ème
SERIES_FRANCOPHONES = ['A', 'C', 'D', 'E', 'TI']
SERIES_ANGLOPHONES  = ['ARTS', 'SCIENCE']
# Enseignement technique industriel : spécialité du CAP au premier cycle, série du
# baccalauréat technique au second cycle.
SERIES_TECH_CAP     = ['ELEC', 'ELN', 'MACO', 'IS', 'FC', 'MEB']
SERIES_TECH_BAC     = ['F2', 'F3', 'F4', 'F5', 'IS', 'IB', 'MEB']
NIVEAUX_AVEC_SERIE  = {
    '4EME_FR': SERIES_LANGUES, '3EME_FR': SERIES_LANGUES,
    '2NDE_FR': SERIES_FRANCOPHONES, '1ERE_FR': SERIES_FRANCOPHONES, 'TLE_FR': SERIES_FRANCOPHONES,
    'LS_EN': SERIES_ANGLOPHONES, 'US_EN': SERIES_ANGLOPHONES,
    '1AN_TECH': SERIES_TECH_CAP, '2AN_TECH': SERIES_TECH_CAP, '3AN_TECH': SERIES_TECH_CAP, '4AN_TECH': SERIES_TECH_CAP,
    '2NDE_TECH': SERIES_TECH_BAC, '1ERE_TECH': SERIES_TECH_BAC, 'TLE_TECH': SERIES_TECH_BAC,
}


def series_du_niveau(code_niveau):
    """Séries proposées pour un niveau ; [''] = niveau sans série (une seule colonne)."""
    return NIVEAUX_AVEC_SERIE.get(code_niveau, [''])


def coefficients_classe(code_classe, code_annee, matieres):
    """
    Coefficients de la grille pour une classe : {matière: coef} pour les matières
    trouvées (niveau et série de la classe, année donnée). Les matières absentes de la
    grille ne figurent pas dans le résultat.
    """
    from .models import Classe, CoefficientMatiere
    classe = Classe.objects.filter(pk=code_classe).values('etablissement_id', 'niveau_scolaire_id', 'serie').first()
    if not classe or not classe['niveau_scolaire_id'] or not matieres:
        return {}
    rows = CoefficientMatiere.objects.filter(
        etablissement_id=classe['etablissement_id'], code_annee=code_annee,
        niveau_scolaire_id=classe['niveau_scolaire_id'], serie=classe['serie'] or '',
        code_matiere__in=matieres,
    ).values_list('code_matiere', 'coef')
    return dict(rows)


def poids_matieres(code_classe, code_annee, matieres, type_etab):
    """
    Retourne ({matière: poids}, {matière: note éliminatoire}, {matières sans poids défini}).
    Poids = coefficient de la grille (pré-bac) ou crédits du cours (supérieur) ; 1 quand
    il n'est pas renseigné — ces matières sont signalées pour que l'oubli se voie.
    """
    from .models import Cours
    poids  = {m: 1 for m in matieres}
    elims  = {}
    if not matieres:
        return poids, elims, set()
    if type_etab in PRE_BAC:
        coefs = coefficients_classe(code_classe, code_annee, matieres)
        poids.update(coefs)
        return poids, elims, set(matieres) - set(coefs)

    rows = (Cours.objects
            .filter(code_classe=code_classe, code_annee=code_annee, code_matiere__in=matieres)
            .values('code_matiere')
            .annotate(poids=Max('credits'), note_elim=Max('note_elim')))
    definis = set()
    for r in rows:
        if r['poids']:
            poids[r['code_matiere']] = r['poids']
            definis.add(r['code_matiere'])
        if r['note_elim'] is not None:
            elims[r['code_matiere']] = float(r['note_elim'])
    return poids, elims, set(matieres) - definis


# ── Périodes ──────────────────────────────────────────────────────────────────
def periodes_racines(code_periode=None, code_annee=None, code_classe=None, evaluations=None):
    """
    Retourne (racines, enfants) :
      - racines : périodes de premier niveau à prendre en compte ;
      - enfants : {racine: [sous-périodes]} (séquences d'un trimestre).
    Avec code_periode : cette seule période (et ses séquences ; une séquence seule est
    traitée comme une racine sans enfants). Avec code_annee : les périodes de premier
    niveau ordinaires sur lesquelles la classe a des notes (bilan annuel).
    """
    from .models import Periode
    if code_periode:
        periode = Periode.objects.get(pk=code_periode)
        enfants = {periode.pk: list(periode.sous_periodes.values_list('pk', flat=True))}
        return [periode.pk], enfants

    ids_notes = set(evaluations.values_list('code_periode', flat=True).distinct())
    periodes  = Periode.objects.filter(pk__in=ids_notes).exclude(type_periode='EXAMENS_OFFICIELS')
    racines   = sorted({p.periode_parent_id or p.pk for p in periodes})
    enfants   = defaultdict(list)
    for pid, parent in Periode.objects.filter(periode_parent__in=racines).values_list('pk', 'periode_parent'):
        enfants[parent].append(pid)
    return racines, dict(enfants)


def _moyenne_periode(evals_par_periode, racine, enfants):
    """
    Moyenne d'une matière sur une période. Si la période a des séquences, moyenne des
    séquences notées ; des notes saisies directement sur le trimestre comptent comme une
    séquence de plus.
    """
    sous = enfants.get(racine, [])
    if not sous:
        return moyenne_ponderee(evals_par_periode.get(racine, []))
    valeurs = [moyenne_ponderee(evals_par_periode.get(p, [])) for p in [*sous, racine]]
    valeurs = [v for v in valeurs if v is not None]
    return round(sum(valeurs) / len(valeurs), 2) if valeurs else None


# ── Calcul principal ──────────────────────────────────────────────────────────
def calculer_resultats(evaluations, code_classe, code_periode=None, code_annee=None):
    """
    Moyennes par matière et générale, rang (ex-aequo), effectif et moyenne de classe pour
    chaque élève d'une classe, sur une période (code_periode) ou sur l'année (code_annee).

    `evaluations` : queryset d'Evaluation déjà restreint aux droits de l'utilisateur.
    Retourne une liste triée par rang (élèves sans moyenne en dernier).
    """
    from .models import Periode
    type_etab = type_etab_classe(code_classe)
    evaluations = evaluations.filter(code_classe=code_classe)

    if code_periode:
        racines, enfants = periodes_racines(code_periode=code_periode)
        code_annee = code_annee or Periode.objects.filter(pk=code_periode).values_list('code_annee', flat=True).first()
    else:
        # L'année d'une note est souvent vide (saisies historiques) : celle de sa période
        # (ou du trimestre de sa séquence) fait foi.
        evaluations = evaluations.filter(
            Q(code_annee=code_annee)
            | Q(code_annee__isnull=True, code_periode__code_annee=code_annee)
            | Q(code_annee__isnull=True, code_periode__periode_parent__code_annee=code_annee)
        )
        racines, enfants = periodes_racines(code_annee=code_annee, evaluations=evaluations)

    ids_periodes = set(racines) | {p for sous in enfants.values() for p in sous}
    evaluations = evaluations.filter(code_periode__in=ids_periodes).select_related(
        'mle_etudiant', 'code_matiere', 'code_type_eval', 'code_type_eval__remplace',
    ).order_by('pk')

    # élève → matière → période → [évaluations]
    par_etudiant    = {}
    matieres_notees = set()
    for e in evaluations:
        etud = par_etudiant.setdefault(e.mle_etudiant_id, {
            'mle_etudiant': e.mle_etudiant_id,
            'nom_etudiant': str(e.mle_etudiant),
            'matieres':     {},
        })
        mat = etud['matieres'].setdefault(e.code_matiere_id, {
            'lib_matiere': e.code_matiere.lib_matiere,
            'periodes':    defaultdict(list),
            'evaluations': [],
            'dispense':    False,
        })
        if e.dispense:
            mat['dispense'] = True
        mat['periodes'][e.code_periode_id].append(e)
        mat['evaluations'].append(e)
        if e.note is not None:
            matieres_notees.add(e.code_matiere_id)

    poids, _, sans_poids = poids_matieres(code_classe, code_annee, matieres_notees, type_etab)
    primaire = type_etab == 'PRIMAIRE'

    resultats = []
    for data in par_etudiant.values():
        matieres, moy_par_matiere, neutralisees = [], {}, set()
        for code_mat, mat in data['matieres'].items():
            valeurs = [_moyenne_periode(mat['periodes'], r, enfants) for r in racines]
            valeurs = [v for v in valeurs if v is not None]
            moy = round(sum(valeurs) / len(valeurs), 2) if valeurs else None
            moy_par_matiere[code_mat] = moy
            # Absence justifiée sans aucune note dans la matière : la matière est retirée
            # de la moyenne de CET élève (ni 0, ni poids), au lieu de compter 0.
            if moy is None and mat['dispense']:
                neutralisees.add(code_mat)
            if primaire and moy is not None:
                appreciation = appreciation_depuis_note(moy)
            else:
                # Appréciation saisie seule, sans note (saisies historiques du primaire).
                saisies = [e.appreciation for e in mat['evaluations'] if e.appreciation]
                appreciation = saisies[-1] if saisies else None
            matieres.append({
                'code_matiere': code_mat,
                'lib_matiere':  mat['lib_matiere'],
                'moyenne':      moy,
                'poids':        poids.get(code_mat, 1) if code_mat in matieres_notees else None,
                # Coefficient (ou crédits) absent : la matière compte pour 1 par défaut.
                'poids_defaut': code_mat in sans_poids,
                'nb_evals':     len(mat['evaluations']),
                'appreciation': appreciation,
                'dispense':     code_mat in neutralisees,
            })

        comptees     = matieres_notees - neutralisees
        total_poids  = sum(poids[m] for m in comptees)
        total_points = sum((moy_par_matiere.get(m) or 0) * poids[m] for m in comptees)
        moyenne_gen  = round(total_points / total_poids, 2) if total_poids else None
        matieres.sort(key=lambda m: m['lib_matiere'])
        resultats.append({
            'mle_etudiant':          data['mle_etudiant'],
            'nom_etudiant':          data['nom_etudiant'],
            'matieres':              matieres,
            'moyenne_generale':      moyenne_gen,
            'total_points':          round(total_points, 2),
            'total_poids':           total_poids,
            'mention':               mention_depuis_moyenne(moyenne_gen),
            'appreciation_generale': appreciation_depuis_note(moyenne_gen) if primaire else None,
        })

    classer(resultats)
    return resultats


def classer(resultats):
    """
    Rang « olympique » : deux élèves à égalité ont le même rang et le suivant saute
    (1, 2, 2, 4). Ajoute aussi l'effectif et la moyenne de classe à chaque ligne.
    """
    notes   = [r for r in resultats if r['moyenne_generale'] is not None]
    egalites = Counter(r['moyenne_generale'] for r in notes)
    notes.sort(key=lambda r: (-r['moyenne_generale'], r['nom_etudiant']))
    rang_prec, moy_prec = None, None
    for i, r in enumerate(notes):
        rang = rang_prec if r['moyenne_generale'] == moy_prec else i + 1
        r['rang'], r['ex_aequo'] = rang, egalites[r['moyenne_generale']] > 1
        rang_prec, moy_prec = rang, r['moyenne_generale']

    sans_moyenne = sorted((r for r in resultats if r['moyenne_generale'] is None),
                          key=lambda r: r['nom_etudiant'])
    for r in sans_moyenne:
        r['rang'], r['ex_aequo'] = None, False

    moy_classe = (round(sum(r['moyenne_generale'] for r in notes) / len(notes), 2)
                  if notes else None)
    # Profil de la classe (bulletin) : plus forte et plus faible moyenne, part des élèves
    # ayant au moins 10.
    moyennes = [r['moyenne_generale'] for r in notes]
    profil = {
        'moyenne_max':   max(moyennes) if moyennes else None,
        'moyenne_min':   min(moyennes) if moyennes else None,
        'taux_reussite': round(100 * sum(m >= 10 for m in moyennes) / len(moyennes), 1) if moyennes else None,
    }
    resultats[:] = notes + sans_moyenne
    for r in resultats:
        r['effectif']       = len(notes)
        r['moyenne_classe'] = moy_classe
        r['appreciation_travail'] = appreciation_bulletin(r['moyenne_generale'])
        r.update(profil)
    classer_matieres(resultats)
    return resultats


def classer_matieres(resultats):
    """
    Pour chaque matière : rang de l'élève dans la classe (même règle « olympique » que le
    rang général), effectif noté et moyenne de la classe dans la matière.
    """
    par_matiere = {}
    for r in resultats:
        for m in r.get('matieres', []):
            par_matiere.setdefault(m['code_matiere'], []).append(m)
    for lignes in par_matiere.values():
        notees = sorted((m for m in lignes if m.get('moyenne') is not None), key=lambda m: -m['moyenne'])
        moy = round(sum(m['moyenne'] for m in notees) / len(notees), 2) if notees else None
        rang_prec, moy_prec = None, None
        for i, m in enumerate(notees):
            rang = rang_prec if m['moyenne'] == moy_prec else i + 1
            m['rang'], rang_prec, moy_prec = rang, rang, m['moyenne']
        for m in lignes:
            m.setdefault('rang', None)
            m['effectif_matiere'] = len(notees)
            m['moyenne_classe_matiere'] = moy
            m['appreciation_bulletin'] = appreciation_bulletin(m.get('moyenne'))


# ── Délibération ──────────────────────────────────────────────────────────────
def deliberer(evaluations, code_classe, code_annee, session='NORMALE', seuil=10):
    """
    Crée ou met à jour la décision de fin d'année de chaque élève noté de la classe.

    - Primaire / secondaire : ADMIS si moyenne annuelle ≥ seuil, sinon REDOUBLE.
    - Supérieur (LMD) : une matière est validée si sa moyenne ≥ 10 ; si la moyenne
      générale ≥ seuil et qu'aucune matière n'est sous sa note éliminatoire, toutes les
      matières sont validées par compensation. ADMIS si tous les crédits sont validés,
      sinon AJOURNE (session normale) ou REDOUBLE (rattrapage).

    Les champs saisis par le jury (président, observations existantes) sont conservés.
    Retourne {'crees', 'mis_a_jour', 'sans_notes', 'type_etab'}.
    """
    from .models import Classe, Decision
    classe    = Classe.objects.get(pk=code_classe)
    type_etab = type_etab_classe(code_classe)
    resultats = calculer_resultats(evaluations, code_classe, code_annee=code_annee)
    matieres  = {m['code_matiere'] for r in resultats for m in r['matieres']}
    _, elims, _ = poids_matieres(code_classe, code_annee, matieres, type_etab)

    crees = mis_a_jour = sans_notes = 0
    for r in resultats:
        moy = r['moyenne_generale']
        if moy is None:
            sans_notes += 1
            continue
        total_credits = credits_valides = 0
        observations  = None
        if type_etab == 'SUPERIEUR':
            notees = [m for m in r['matieres'] if m['poids'] is not None]
            total_credits = sum(m['poids'] for m in notees)
            compensation = moy >= seuil and all(
                m['moyenne'] is not None and m['moyenne'] >= elims.get(m['code_matiere'], 0)
                for m in notees
            )
            credits_valides = total_credits if compensation else sum(
                m['poids'] for m in notees if (m['moyenne'] or 0) >= 10)
            if credits_valides == total_credits:
                resultat = 'ADMIS'
                if any((m['moyenne'] or 0) < 10 for m in notees):
                    observations = 'Admis par compensation.'
            else:
                resultat = 'AJOURNE' if session == 'NORMALE' else 'REDOUBLE'
        else:
            resultat = 'ADMIS' if moy >= seuil else 'REDOUBLE'
            if r['appreciation_generale']:
                observations = f"Appréciation générale : {r['appreciation_generale']}."

        champs = {
            'code_classe':       classe,
            'moyenne_annuelle':  moy,
            'total_credits':     total_credits,
            'credits_valides':   credits_valides,
            'resultat':          resultat,
            'mention':           r['mention'],
            'rang':              r['rang'],
            'effectif':          r['effectif'],
            'date_deliberation': timezone.now(),
            'etablissement_id':  classe.etablissement_id,
        }
        _, cree = Decision.objects.update_or_create(
            mle_etudiant_id=r['mle_etudiant'], code_annee_id=code_annee, session=session,
            defaults=champs, create_defaults={**champs, 'observations': observations},
        )
        if cree:
            crees += 1
        else:
            mis_a_jour += 1

    return {'crees': crees, 'mis_a_jour': mis_a_jour, 'sans_notes': sans_notes, 'type_etab': type_etab}


# ── Séquences ─────────────────────────────────────────────────────────────────
def generer_sequences(code_annee):
    """
    Crée les 6 séquences du secondaire (2 par trimestre) pour une année, en partageant
    les dates de chaque trimestre en deux moitiés. Les trimestres qui ont déjà des
    séquences sont laissés tels quels. Retourne le nombre de séquences créées.
    """
    from .models import Periode
    trimestres = (Periode.objects
                  .filter(code_annee=code_annee, type_etab='SECONDAIRE',
                          periode_parent__isnull=True, type_periode='ORDINAIRE')
                  .order_by('date_debut', 'lib_periode'))
    creees = 0
    for i, trimestre in enumerate(trimestres):
        if trimestre.sous_periodes.exists():
            continue
        milieu = None
        if trimestre.date_debut and trimestre.date_fin:
            milieu = trimestre.date_debut + (trimestre.date_fin - trimestre.date_debut) / 2
        bornes = [(trimestre.date_debut, milieu), (milieu, trimestre.date_fin)]
        for j, (debut, fin) in enumerate(bornes):
            Periode.objects.create(
                lib_periode=f'Séquence {2 * i + j + 1}',
                date_debut=debut, date_fin=fin,
                type_etab='SECONDAIRE', type_periode='ORDINAIRE',
                code_annee_id=code_annee, periode_parent=trimestre,
            )
            creees += 1
    return creees
