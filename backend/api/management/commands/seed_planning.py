"""
management/commands/seed_planning.py
Génère un emploi du temps réaliste pour toutes les classes :
  - Niveaux 1 & 2 : HEBDO  (créneau fixe récurrent chaque semaine)
  - Niveaux 3, 4 & 5 : INTENSIF (une semaine dédiée par cours)
"""
from datetime import date, timedelta, time
from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import Planning, Cours, Classe, Jour, Salle

# ── Salles par catégorie ──────────────────────────────────────────────────────
SALLES_CM    = ['A101','A102','A103','A201','A202','A203','A301','A302','A303']
SALLES_TD    = ['A101','A102','A201','A202','A301','A302']
SALLES_TP    = ['B101','B102','B103','B201','B202','B301','LAB1','LAB2']
SALLES_AMPHI = ['AMPH1','AMPH2']
SALLES_SOIR  = ['A101','A201','A301']

# ── Grille de créneaux HEBDO ──────────────────────────────────────────────────
# Format : (code_jour, h_debut, h_fin, type_seance)
# Ordonnés de façon à distribuer d'abord un cours par jour avant de
# remplir un deuxième créneau quotidien.
SLOTS_HEBDO = [
    # Première vague : 1 créneau matin par jour (CM)
    ('LUN', time(8, 0),  time(10, 0), 'CM'),
    ('MAR', time(8, 0),  time(10, 0), 'CM'),
    ('MER', time(8, 0),  time(10, 0), 'CM'),
    ('JEU', time(8, 0),  time(10, 0), 'CM'),
    ('VEN', time(8, 0),  time(10, 0), 'CM'),
    ('SAM', time(8, 0),  time(10, 0), 'CM'),
    # Deuxième vague : créneau après-midi (TD)
    ('LUN', time(14, 0), time(16, 0), 'TD'),
    ('MAR', time(14, 0), time(16, 0), 'TD'),
    ('MER', time(14, 0), time(16, 0), 'TD'),
    ('JEU', time(14, 0), time(16, 0), 'TD'),
    ('VEN', time(14, 0), time(16, 0), 'TD'),
    ('SAM', time(10, 0), time(12, 0), 'CM'),
    # Troisième vague : 2e créneau matin (CM)
    ('LUN', time(10, 0), time(12, 0), 'CM'),
    ('MAR', time(10, 0), time(12, 0), 'CM'),
    ('MER', time(10, 0), time(12, 0), 'CM'),
    ('JEU', time(10, 0), time(12, 0), 'CM'),
    ('VEN', time(10, 0), time(12, 0), 'CM'),
    # Quatrième vague : TP après-midi
    ('LUN', time(16, 0), time(18, 0), 'TP'),
    ('MAR', time(16, 0), time(18, 0), 'TP'),
    ('MER', time(16, 0), time(18, 0), 'TP'),
    ('JEU', time(16, 0), time(18, 0), 'TP'),
    ('VEN', time(16, 0), time(18, 0), 'TP'),
    # Cours du soir
    ('LUN', time(18, 30), time(20, 30), 'SOIR'),
    ('MAR', time(18, 30), time(20, 30), 'SOIR'),
    ('MER', time(18, 30), time(20, 30), 'SOIR'),
    ('JEU', time(18, 30), time(20, 30), 'SOIR'),
    ('VEN', time(18, 30), time(20, 30), 'SOIR'),
    ('SAM', time(14, 0),  time(16, 0), 'TD'),
]

# ── Dates INTENSIF ────────────────────────────────────────────────────────────
# S1 : blocs du 6 octobre 2025 (lundin de la 2e semaine d'octobre)
# S2 : blocs du 9 février 2026
S1_START = date(2025, 10, 6)
S2_START = date(2026, 2, 9)

# Codes tronc commun -> amphi
TC_CODES = {
    'FORMBIL','EDUCIVETH','STATDESCR','DROITCIV',
    'METHORRS','ECONGEN','EOECREENT','TECHEXP',
}

def next_monday(d):
    """Retourne le lundi de la semaine contenant d, ou d lui-même si c'est lundi."""
    return d - timedelta(days=d.weekday())


class Command(BaseCommand):
    help = 'Génère un emploi du temps fictif et réaliste pour toutes les classes'

    def handle(self, *args, **options):
        self.stdout.write('=== SEED PLANNING ===')

        # Supprimer tout le planning existant pour repartir propre
        n_del = Planning.objects.all().delete()[0]
        self.stdout.write(f'  {n_del} anciens créneaux supprimés')

        jours = {j.code_jour: j for j in Jour.objects.all()}
        salles_all = {s.code_salle: s for s in Salle.objects.all()}

        def salle_obj(code):
            return salles_all.get(code)

        classes = list(
            Classe.objects.select_related('code_niveau').prefetch_related(
                'cours_set__code_matiere'
            ).all()
        )

        total_entries = 0
        batch = []

        with transaction.atomic():
            for cl in classes:
                niveau = cl.code_niveau_id or 1
                cours_qs = list(
                    Cours.objects.filter(code_classe=cl)
                    .select_related('code_matiere')
                    .order_by('semestre', 'code_matiere_id')
                )
                if not cours_qs:
                    continue

                if niveau in (1, 2):
                    batch += self._hebdo(cl, cours_qs, jours, salle_obj)
                else:
                    batch += self._intensif(cl, cours_qs, salle_obj)

            # Bulk create en lots
            chunk = 500
            for i in range(0, len(batch), chunk):
                created = Planning.objects.bulk_create(batch[i:i+chunk], ignore_conflicts=True)
                total_entries += len(created)

        self.stdout.write(self.style.SUCCESS(
            f'\n=== {total_entries} créneaux créés pour {len(classes)} classes ==='
        ))

    # ── HEBDO ─────────────────────────────────────────────────────────────────
    def _hebdo(self, cl, cours_list, jours, salle_obj):
        entries = []
        cl_hash = sum(ord(c) for c in cl.code_classe)

        for idx, cours in enumerate(cours_list):
            if idx >= len(SLOTS_HEBDO):
                break
            code_jour_str, h_deb, h_fin, ts = SLOTS_HEDBO_for(idx, cours)
            jour = jours.get(code_jour_str)
            if not jour:
                continue

            # Salle : amphi pour tronc commun, sinon rotation
            mat_code = cours.code_matiere_id or ''
            if cours.groupes or mat_code in TC_CODES:
                salle_pool = SALLES_AMPHI
            elif ts == 'TP':
                salle_pool = SALLES_TP
            elif ts == 'SOIR':
                salle_pool = SALLES_SOIR
            else:
                salle_pool = SALLES_CM if ts == 'CM' else SALLES_TD
            salle_code = salle_pool[(cl_hash + idx) % len(salle_pool)]

            entries.append(Planning(
                code_cours=cours,
                type_planning='HEBDO',
                type_seance=ts,
                h_debut=h_deb,
                h_fin=h_fin,
                code_jour=jour,
                code_salle=salle_obj(salle_code),
            ))
        return entries

    # ── INTENSIF ──────────────────────────────────────────────────────────────
    def _intensif(self, cl, cours_list, salle_obj):
        entries = []
        s1_courses = [c for c in cours_list if c.semestre == 'S1']
        s2_courses = [c for c in cours_list if c.semestre == 'S2']

        for sem_courses, start_date in [
            (s1_courses, S1_START),
            (s2_courses, S2_START),
        ]:
            for week_idx, cours in enumerate(sem_courses):
                lundi = start_date + timedelta(weeks=week_idx)
                vendredi = lundi + timedelta(days=4)

                mat_code = cours.code_matiere_id or ''
                is_tc = (cours.groupes or mat_code in TC_CODES)

                if is_tc:
                    salle_am = salle_obj('AMPH1')
                    salle_pm = salle_obj('AMPH2')
                else:
                    cl_hash = sum(ord(c) for c in cl.code_classe)
                    salle_am = salle_obj(SALLES_CM[cl_hash % len(SALLES_CM)])
                    salle_pm = salle_obj(SALLES_TD[cl_hash % len(SALLES_TD)])

                # Session matin (CM)
                entries.append(Planning(
                    code_cours=cours,
                    type_planning='INTENSIF',
                    type_seance='CM',
                    h_debut=time(8, 0),
                    h_fin=time(12, 0),
                    date_debut=lundi,
                    date_fin=vendredi,
                    code_salle=salle_am,
                ))
                # Session après-midi (TD ou TP)
                ts_pm = 'TP' if _is_tp_course(mat_code) else 'TD'
                entries.append(Planning(
                    code_cours=cours,
                    type_planning='INTENSIF',
                    type_seance=ts_pm,
                    h_debut=time(14, 0),
                    h_fin=time(18, 0),
                    date_debut=lundi,
                    date_fin=vendredi,
                    code_salle=salle_pm,
                ))
        return entries


# ── Helpers module-level ──────────────────────────────────────────────────────

# Codes de matières à dominante pratique -> TP l'après-midi
TP_KEYWORDS = {
    'OUTBUR','INFOBAS','INFOAPP','RESEAUX','SGBD','LABOCHI',
    'LABOPHY','LABOBIO','MECA','ELECTRO','AUTOM','CAO','SIG',
    'B101','B102','B201','LAB',
}

def _is_tp_course(mat_code):
    code_up = mat_code.upper()
    return any(kw in code_up for kw in TP_KEYWORDS)


def SLOTS_HEDBO_for(idx, cours):
    """Retourne le tuple (code_jour, h_debut, h_fin, type_seance) pour ce slot."""
    slot = SLOTS_HEBDO[idx % len(SLOTS_HEBDO)]
    code_jour, h_deb, h_fin, ts = slot
    # Forcer TP si la matière est pratique
    if ts == 'TD' and _is_tp_course(cours.code_matiere_id or ''):
        ts = 'TP'
    return code_jour, h_deb, h_fin, ts
