"""
seed_cameroun.py — Données camerounaises réalistes SMS
3 établissements complets : PRIMAIRE (EPPM) / SECONDAIRE (LBN) / SUPERIEUR (ISTA)
Idempotent — relançable sans risque de doublons.

Usage : python manage.py seed_cameroun
"""
import random
from datetime import date, timedelta

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import (
    Annee, Classe, Cours, Cycle, Departement, Enseignant,
    Etablissement, Etudiant, Evaluation, Frais, Inscription,
    Matiere, Module, Niveau, Paiement, Pension, Periode,
    Personnel, Specialite, Tranche, TypeEvaluation, Utilisateur,
)

random.seed(42)

DEMO_PWD   = make_password('Demo2026!')
ANNEE_CODE = '2025-2026'

# ── Répertoire de noms camerounais ────────────────────────────────────────────
NOMS_CM = [
    'MBALLA', 'NKOA', 'ESSAMA', 'BIYONG', 'ATEBA', 'ONANA', 'ETOA', 'MANGA',
    'NDONGO', 'ABANDA', 'FOUDA', 'NDJANA', 'KAMGA', 'TSAPI', 'WONDJI', 'EKANG',
    'NGUELE', 'BELLO', 'KANA', 'MOMO', 'ABOMO', 'ZANGA', 'TEKEU', 'FOTSO',
    'TALLA', 'NDONG', 'MENYE', 'SAME', 'FOE', 'EFFA', 'AKOA', 'NGAKO',
    'MABOU', 'EWANE', 'DJOYA', 'OMGBA', 'NKENGNE', 'TCHOUPO', 'SAMBA', 'ZOA',
    'ELOUNDOU', 'ONDOA', 'MVOGO', 'NYAMSI', 'FOMBA', 'MOUKAM', 'NGONO',
    'ETEME', 'BITA', 'NGANOU', 'WAMBA', 'DJOUFACK', 'BIKELE', 'AMOUGOU',
    'ETOUNDI', 'NKEMDIRIM', 'KENFACK', 'KUETE', 'TCHIBOZO', 'DJATCHEU',
]
PRENOMS_M = [
    'Pierre', 'Paul', 'Martin', 'David', 'Arnaud', 'Nicolas', 'Franck', 'Gaston',
    'Lionel', 'Benjamin', 'Wilfried', 'Cédric', 'Serge', 'Maxime', 'Kevin',
    'Jean-Pierre', 'François', 'Emmanuel', 'Roland', 'Bertrand', 'Alain', 'Éric',
    'Théodore', 'Michel', 'André', 'Robert', 'Clément', 'Alexis', 'Boris', 'Cyril',
    'Simplice', 'Hervé', 'Junior', 'Rodrigue', 'Stéphane', 'Patrick', 'Martial',
    'Arnaud', 'Gilles', 'Yannick',
]
PRENOMS_F = [
    'Hélène', 'Cécile', 'Marie', 'Angéline', 'Sylvie', 'Laure', 'Marthe',
    'Brigitte', 'Corinne', 'Patricia', 'Irène', 'Élodie', 'Solange', 'Nadège',
    'Stéphanie', 'Christine', 'Odette', 'Rose', 'Clémentine', 'Thérèse',
    'Marie-Claire', 'Céline', 'Nathalie', 'Josiane', 'Flavie', 'Clarisse',
    'Sandrine', 'Viviane', 'Bernadette', 'Pascale', 'Christelle', 'Audrey',
    'Ornella', 'Vanessa', 'Alvine', 'Guilaine', 'Ornelle', 'Carole', 'Diane',
    'Jeannette',
]
REGIONS_CM = [
    'Centre', 'Littoral', 'Ouest', 'Nord-Ouest', 'Sud-Ouest',
    'Adamaoua', 'Est', 'Nord', 'Extrême-Nord', 'Sud',
]

# ── Helpers globaux ───────────────────────────────────────────────────────────

def _nom(i):
    return NOMS_CM[i % len(NOMS_CM)]

def _prenom(i, sexe):
    pool = PRENOMS_M if sexe == 'M' else PRENOMS_F
    return pool[i % len(pool)]

def _region(i):
    return REGIONS_CM[i % len(REGIONS_CM)]

def _date_naiss(annee_min, annee_max):
    y = random.randint(annee_min, annee_max)
    m = random.randint(1, 12)
    d = random.randint(1, 28)
    return date(y, m, d)

def _tel():
    return f'+237 6{random.randint(70,99):02d} {random.randint(10,99):02d} {random.randint(10,99):02d} {random.randint(10,99):02d}'

def _statut_paiement():
    """70% payé, 20% partiel, 10% impayé."""
    return random.choices(
        ['PAYE', 'PARTIEL', 'IMPAYE'],
        weights=[70, 20, 10],
        k=1
    )[0]


class Command(BaseCommand):
    help = 'Peuple la base avec des données camerounaises réalistes (EPPM, LBN, ISTA)'

    def handle(self, *args, **options):
        with transaction.atomic():
            self._annee()
            self._modules()
            self._types_eval()
            stats_eppm = self._seed_eppm()
            stats_lbn  = self._seed_lbn()
            stats_ista = self._seed_ista()
            self._super_admin()

        self.stdout.write(self.style.SUCCESS('\n=== SEED CAMEROUN TERMINÉ ==='))
        self.stdout.write(
            f'  EPPM : {stats_eppm["eleves"]} élèves, '
            f'{stats_eppm["ens"]} enseignants, '
            f'{stats_eppm["evals"]} évaluations'
        )
        self.stdout.write(
            f'  LBN  : {stats_lbn["eleves"]} élèves, '
            f'{stats_lbn["ens"]} enseignants, '
            f'{stats_lbn["evals"]} évaluations'
        )
        self.stdout.write(
            f'  ISTA : {stats_ista["eleves"]} étudiants, '
            f'{stats_ista["ens"]} enseignants, '
            f'{stats_ista["evals"]} évaluations'
        )
        self.stdout.write('\n  Mot de passe tous comptes : Demo2026!\n')
        self.stdout.write('  Comptes disponibles :')
        self.stdout.write('    SUPER_ADMIN  -> lucky_admin')
        for etab in ['eppm', 'lbn', 'ista']:
            for role in ['admin', 'scol', 'ens', 'compt', 'etud']:
                self.stdout.write(f'    {etab}_{role}')

    # ── Références globales ───────────────────────────────────────────────────

    def _annee(self):
        Annee.objects.get_or_create(
            code_annee=ANNEE_CODE,
            defaults={
                'lib_annee': 'Année scolaire 2025-2026',
                'statut':    'EN COURS',
                'date_deb':  date(2025, 9, 1),
                'date_fin':  date(2026, 7, 31),
            }
        )

    def _modules(self):
        for code, lib in [
            ('GEN', 'Enseignement Général'),
            ('SCI', 'Sciences'),
            ('LIT', 'Lettres et Langues'),
            ('TEC', 'Technologie'),
            ('GES', 'Gestion'),
            ('SPO', 'Sport et Arts'),
        ]:
            Module.objects.get_or_create(code_module=code, defaults={'lib_module': lib})

    def _types_eval(self):
        specs = [
            ('Devoir de classe',       'PRIMAIRE'),
            ('Composition',            'PRIMAIRE'),
            ('Interrogation',          'PRIMAIRE'),
            # Maternelle : appréciation qualitative (pas de notes chiffrées)
            ('Appreciation qualitative', 'PRIMAIRE'),
            ('Devoir',              'SECONDAIRE'),
            ('Composition',         'SECONDAIRE'),
            ('Interrogation orale', 'SECONDAIRE'),
            ('Devoir',              'SUPERIEUR'),
            ('Examen semestriel',   'SUPERIEUR'),
            ('Travaux Pratiques',   'SUPERIEUR'),
            ('Projet',              'SUPERIEUR'),
        ]
        for lib, te in specs:
            TypeEvaluation.objects.get_or_create(lib_type_eval=lib, type_etab=te)

    # ── Compte utilisateur ────────────────────────────────────────────────────

    def _user(self, login, nom, role, etab_code):
        etab = Etablissement.objects.get(code_etab=etab_code)
        Utilisateur.objects.update_or_create(
            login=login,
            defaults={
                'passwd':        DEMO_PWD,
                'nom_user':      nom,
                'role':          role,
                'etablissement': etab,
                'type_etab':     None,
            }
        )
        User.objects.get_or_create(username=login, defaults={'is_active': True})

    # ── Inscription élève ─────────────────────────────────────────────────────

    def _inscrire(self, mle, nom, prenom, sexe, date_naiss, region, tuteur,
                  classe, etab, mt_insc):
        etud, _ = Etudiant.objects.get_or_create(
            mle_etudiant=mle,
            defaults={
                'nom':         nom,
                'prenom':      prenom,
                'sexe':        sexe,
                'date_naiss':  date_naiss,
                'region_or':   region,
                'nationalite': 'Camerounaise',
                'nom_tuteur':  tuteur,
                'etablissement': etab,
            }
        )
        Inscription.objects.get_or_create(
            mle_etudiant=etud,
            code_annee_id=ANNEE_CODE,
            defaults={
                'code_classe':    classe,
                'etablissement':  etab,
                'mt_inscription': mt_insc,
                'date_inscription': date(2025, 9, random.randint(1, 25)),
            }
        )
        return etud

    # ────────────────────────────────────────────────────────────────────────────
    # EPPM — École Primaire Publique de Melen
    # ────────────────────────────────────────────────────────────────────────────

    def _seed_eppm(self):
        CODE = 'EPPM'
        self.stdout.write(f'\n[1/3] Création EPPM — École Primaire Publique de Melen...')

        etab, _ = Etablissement.objects.get_or_create(
            code_etab=CODE,
            defaults={
                'lib_etab':          'École Primaire Publique de Melen',
                'sigle':             CODE,
                'type_etab':         'PRIMAIRE',
                'statut':            'PUBLIC',
                'systeme':           'BILINGUE',
                'region':            'CENTRE',
                'ville':             'Yaoundé',
                'adresse':           'Quartier Melen, Yaoundé, Centre',
                'telephone':         '+237 222 21 45 67',
                'directeur':         'M. ABOMO Pierre',
                'ministere_tutelle': 'Ministère des Enseignements de Base (MINEDUB)',
            }
        )

        pension, _ = Pension.objects.get_or_create(
            lib_pension='APE + Manuels EPPM',
            defaults={'mt_pension': 8000, 'mt_inscription': 2000, 'nb_tranche': 2, 'type_etab': 'PRIMAIRE'}
        )
        tr1, _ = Tranche.objects.get_or_create(
            lib_tranche='T1-EPPM', code_pension=pension,
            defaults={'mt_tranche': 5000}
        )
        tr2, _ = Tranche.objects.get_or_create(
            lib_tranche='T2-EPPM', code_pension=pension,
            defaults={'mt_tranche': 3000}
        )

        cycle, _ = Cycle.objects.get_or_create(
            code_cycle='CYC_PRI',
            defaults={'lib_cycle': 'Cycle Primaire', 'code_pension': pension, 'type_etab': 'PRIMAIRE'}
        )

        dep, _ = Departement.objects.get_or_create(
            code_dep='DEP_EPPM',
            defaults={'lib_dep': 'Enseignement Primaire EPPM', 'code_etab': etab, 'etablissement': etab}
        )
        sp, _ = Specialite.objects.get_or_create(
            code_sp='SP_EPPM',
            defaults={'lib_sp': 'Formation Générale Primaire', 'code_dep': dep, 'etablissement': etab}
        )

        # Niveaux
        niveaux_fr = {}
        for lib in ['SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2']:
            niv, _ = Niveau.objects.get_or_create(
                lib_niveau=lib, code_cycle=cycle,
                defaults={'code_pension': pension, 'code_annee_id': ANNEE_CODE, 'type_etab': 'PRIMAIRE'}
            )
            niveaux_fr[lib] = niv

        niveaux_en = {}
        for lib in ['Nursery', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5']:
            niv, _ = Niveau.objects.get_or_create(
                lib_niveau=lib, code_cycle=cycle,
                defaults={'code_pension': pension, 'code_annee_id': ANNEE_CODE, 'type_etab': 'PRIMAIRE'}
            )
            niveaux_en[lib] = niv

        # Classes (2 par niveau fr + 1 par niveau en)
        # codes max 10 chars : PM_{NIV}{Suf}
        classes_list = []
        for niv_lib in ['SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2']:
            for suf in ['A', 'B']:
                code_cl = f'PM_{niv_lib}{suf}'       # ex: PM_SILA (7 chars)
                cl, _ = Classe.objects.get_or_create(
                    code_classe=code_cl,
                    defaults={
                        'lib_classe': f'{niv_lib} {suf}',
                        'code_dep':   dep,
                        'code_niveau': niveaux_fr[niv_lib],
                        'code_sp':    sp,
                        'eff_max':    60,
                        'etablissement': etab,
                    }
                )
                classes_list.append(cl)

        EN_SHORT = {
            'Nursery': 'NUR', 'Class 1': 'CL1', 'Class 2': 'CL2',
            'Class 3': 'CL3', 'Class 4': 'CL4', 'Class 5': 'CL5',
        }
        for niv_lib in ['Nursery', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5']:
            code_cl = f'PM_{EN_SHORT[niv_lib]}A'     # ex: PM_NURA (8 chars)
            cl, _ = Classe.objects.get_or_create(
                code_classe=code_cl,
                defaults={
                    'lib_classe': f'{niv_lib} A',
                    'code_dep':   dep,
                    'code_niveau': niveaux_en[niv_lib],
                    'code_sp':    sp,
                    'eff_max':    50,
                    'etablissement': etab,
                }
            )
            classes_list.append(cl)

        # Enseignants (15)
        ENS_DATA = [
            ('EPM01', 'ESSAMA',   'Hélène',    'F', 'FONCTIONNAIRE'),
            ('EPM02', 'MBARGA',   'Paul',       'M', 'FONCTIONNAIRE'),
            ('EPM03', 'NKOA',     'Célestine',  'F', 'FONCTIONNAIRE'),
            ('EPM04', 'ATEBA',    'Joseph',     'M', 'FONCTIONNAIRE'),
            ('EPM05', 'BIYONG',   'Marie',      'F', 'FONCTIONNAIRE'),
            ('EPM06', 'ONDOA',    'François',   'M', 'CONTRACTUEL'),
            ('EPM07', 'NGUELE',   'Angeline',   'F', 'FONCTIONNAIRE'),
            ('EPM08', 'ABENA',    'Jean',       'M', 'CONTRACTUEL'),
            ('EPM09', 'ELOUNDOU', 'Thérèse',    'F', 'FONCTIONNAIRE'),
            ('EPM10', 'NGONO',    'Michel',     'M', 'CONTRACTUEL'),
            ('EPM11', 'MVOGO',    'Sandrine',   'F', 'CONTRACTUEL'),
            ('EPM12', 'OMGBA',    'Alexis',     'M', 'FONCTIONNAIRE'),
            ('EPM13', 'TCHOUPO',  'Viviane',    'F', 'CONTRACTUEL'),
            ('EPM14', 'SAMBA',    'Roland',     'M', 'FONCTIONNAIRE'),
            ('EPM15', 'ETOA',     'Clarisse',   'F', 'CONTRACTUEL'),
        ]
        ens_list = []
        for mle, nom, prenom, sexe, statut in ENS_DATA:
            ens, _ = Enseignant.objects.get_or_create(
                mle_ens=mle,
                defaults={
                    'nom_ens': nom, 'prenom_ens': prenom, 'sexe': sexe,
                    'statut': statut, 'tel_ens': _tel(),
                    'code_dep': dep, 'etablissement': etab,
                }
            )
            ens_list.append(ens)

        # Matières primaires
        mod_gen = Module.objects.get(code_module='GEN')
        mod_sci = Module.objects.get(code_module='SCI')
        mod_spo = Module.objects.get(code_module='SPO')
        MATIERES_PRI = [
            ('PRI_LEC', 'Lecture / Reading',         mod_gen),
            ('PRI_ECR', 'Écriture / Writing',        mod_gen),
            ('PRI_CAL', 'Calcul / Arithmetic',       mod_sci),
            ('PRI_GEO', 'Géographie / Geography',    mod_gen),
            ('PRI_HIS', 'Histoire / Social Studies', mod_gen),
            ('PRI_SCI', "Sciences d'Éveil / Science", mod_sci),
            ('PRI_ECM', 'Éducation Civique / Civics', mod_gen),
            ('PRI_FRA', 'Français / French',          mod_gen),
            ('PRI_ANG', 'Anglais / English',          mod_gen),
            ('PRI_SPO', 'Sport / Physical Education', mod_spo),
        ]
        matieres_pri = {}
        for code, lib, mod in MATIERES_PRI:
            m, _ = Matiere.objects.get_or_create(
                code_matiere=code,
                defaults={'lib_matiere': lib, 'code_module': mod, 'type_etab': 'PRIMAIRE'}
            )
            matieres_pri[code] = m

        # Périodes (3 trimestres)
        periodes_pri = []
        for lib, deb, fin in [
            ('Trimestre 1 PRI', date(2025, 10, 1),  date(2025, 12, 20)),
            ('Trimestre 2 PRI', date(2026, 1, 5),   date(2026, 3, 27)),
            ('Trimestre 3 PRI', date(2026, 4, 7),   date(2026, 6, 26)),
        ]:
            p, _ = Periode.objects.get_or_create(
                lib_periode=lib,
                defaults={'date_debut': deb, 'date_fin': fin, 'type_etab': 'PRIMAIRE', 'code_annee_id': ANNEE_CODE}
            )
            periodes_pri.append(p)

        te_devoir = TypeEvaluation.objects.get(lib_type_eval='Devoir de classe', type_etab='PRIMAIRE')
        te_compo  = TypeEvaluation.objects.get(lib_type_eval='Composition',      type_etab='PRIMAIRE')

        # 120 élèves répartis sur les 12 premières classes fr (10 par classe)
        nb_evals = 0
        mat_codes_eval = ['PRI_LEC', 'PRI_CAL', 'PRI_FRA', 'PRI_SCI', 'PRI_ANG']
        for i in range(120):
            self.stdout.write(f'\r  Élèves EPPM : {i+1}/120', ending='')
            self.stdout.flush()
            sexe     = 'M' if i % 2 == 0 else 'F'
            nom      = _nom(i)
            prenom   = _prenom(i, sexe)
            region   = _region(i)
            tuteur   = f'{_nom(i+5)} {_prenom(i+2, "M" if i%3==0 else "F")}'
            mle      = f'EP{i+1:04d}'
            d_naiss  = _date_naiss(2009, 2018)
            cl       = classes_list[i % 12]   # 12 classes fr
            ens_ref  = ens_list[i % len(ens_list)]
            mat_obj  = list(matieres_pri.values())[i % len(matieres_pri)]

            etud = self._inscrire(mle, nom, prenom, sexe, d_naiss, region, tuteur, cl, etab, 2000)

            # Paiement T1
            sp_val = _statut_paiement()
            Paiement.objects.get_or_create(
                mle_etudiant=etud,
                code_annee_id=ANNEE_CODE,
                code_tranche=tr1,
                defaults={
                    'type_paiement':  'INSCRIPTION',
                    'mt_paiement':    5000 if sp_val == 'PAYE' else (2500 if sp_val == 'PARTIEL' else 0),
                    'statut':         sp_val,
                    'date_paiement':  date(2025, 9, random.randint(1, 30)),
                    'mode_paiement':  random.choice(['ESPECES', 'MOBILE_MONEY', 'VIREMENT']),
                    'ref_paiement':   f'REF{i+1:05d}',
                    'etablissement':  etab,
                }
            )

            # Cours + Évaluations pour 5 matières × 2 périodes × 2 types
            for mat_code in mat_codes_eval:
                mat_obj = matieres_pri[mat_code]
                Cours.objects.get_or_create(
                    code_matiere=mat_obj, code_classe=cl,
                    semestre='S1', code_annee_id=ANNEE_CODE,
                    defaults={'mle_ens': ens_ref, 'quota_horaire': 30, 'credits': 0, 'etablissement': etab}
                )
                for per in periodes_pri[:2]:
                    for te in [te_devoir, te_compo]:
                        Evaluation.objects.get_or_create(
                            mle_etudiant=etud,
                            code_matiere=mat_obj,
                            code_classe=cl,
                            code_periode=per,
                            code_type_eval=te,
                            defaults={
                                'note':      round(random.uniform(5, 20), 2),
                                'date_eval': per.date_debut + timedelta(days=random.randint(5, 45)),
                                'etablissement': etab,
                            }
                        )
                        nb_evals += 1

        self.stdout.write('')

        # ── Section Maternelle (intégrée à l'EPPM) ────────────────────────────
        nb_evals_mat = self._seed_maternelle_eppm(etab, dep, sp, matieres_pri)
        nb_evals += nb_evals_mat

        # Comptes utilisateurs EPPM
        first_mle = 'EP0001'
        etud_ref  = Etudiant.objects.get(mle_etudiant=first_mle)
        for login, nom, role in [
            ('eppm_admin', 'ABOMO Pierre — Directeur EPPM',    'ADMIN'),
            ('eppm_scol',  'ESSAMA Hélène — Scolarité EPPM',   'SCOLARITE'),
            ('eppm_ens',   'MBARGA Paul — Enseignant EPPM',    'ENSEIGNANT'),
            ('eppm_compt', 'ONDOA François — Comptable EPPM',  'COMPTABLE'),
            ('eppm_etud',  f'{etud_ref.nom} {etud_ref.prenom or ""}', 'ETUDIANT'),
        ]:
            self._user(login, nom, role, CODE)

        total_el = 120 + 30  # primaire + maternelle
        # ── Personnel EPPM ─────────────────────────────────────────────────────
        PERS_EPPM = [
            ('PPM_PRV01', 'ABOMO',   'Pierre',     'M', 'DIRECTEUR',     'DIRECTION',   'TITULAIRE'),
            ('PPM_PRV02', 'ESSAMA',  'Véronique',  'F', 'DIRECTEUR_ADJ', 'DIRECTION',   'TITULAIRE'),
            ('PPM_ADM01', 'NKOLO',   'Rose',       'F', 'SECRETAIRE',    'ADMIN',       'CONTRACTUEL'),
            ('PPM_ADM02', 'MANGA',   'André',      'M', 'ECONOME',       'ADMIN',       'CONTRACTUEL'),
            ('PPM_PED01', 'BIKELE',  'Claire',     'F', 'SURVEILLANT',   'PEDAGOGIQUE', 'CONTRACTUEL'),
            ('PPM_SOU01', 'ATEBA',   'Sylvestre',  'M', 'GARDIEN',       'SOUTIEN',     'CONTRACTUEL'),
            ('PPM_SOU02', 'BIYONG',  'Clarisse',   'F', 'ENTRETIEN',     'SOUTIEN',     'BENEVOLE'),
        ]
        nb_pers = self._seed_personnel(etab, PERS_EPPM)
        self.stdout.write(f'  [OK] EPPM termine - {total_el} eleves (dont 30 maternelle), {len(ENS_DATA)+4} enseignants, {nb_pers} personnel')
        return {'eleves': total_el, 'ens': len(ENS_DATA) + 4, 'evals': nb_evals}

    # ────────────────────────────────────────────────────────────────────────────
    # EPPM — Section Maternelle
    # ────────────────────────────────────────────────────────────────────────────

    def _seed_maternelle_eppm(self, etab, dep, sp, matieres_pri):
        """
        Cycle Maternelle intégré à l'EPPM.
        Pas de notes chiffrées : appréciation qualitative uniquement.
        Ages : 3-5 ans (nés 2020-2022 pour l'année 2025-2026).
        """
        # Pension spécifique maternelle (légèrement > primaire)
        pension_mat, _ = Pension.objects.get_or_create(
            lib_pension='APE Maternel EPPM',
            defaults={'mt_pension': 13000, 'mt_inscription': 3000, 'nb_tranche': 2, 'type_etab': 'PRIMAIRE'}
        )
        tr_mat1, _ = Tranche.objects.get_or_create(
            lib_tranche='TM1-EPPM', code_pension=pension_mat,
            defaults={'mt_tranche': 8000}    # APE
        )
        tr_mat2, _ = Tranche.objects.get_or_create(
            lib_tranche='TM2-EPPM', code_pension=pension_mat,
            defaults={'mt_tranche': 5000}    # Fournitures
        )

        # Cycle maternel séparé du cycle primaire
        cycle_mat, _ = Cycle.objects.get_or_create(
            code_cycle='CYC_MAT',
            defaults={'lib_cycle': 'Cycle Maternel', 'code_pension': pension_mat, 'type_etab': 'PRIMAIRE'}
        )

        # Niveaux maternelle
        NIV_MAT_FR = [
            ('Petite Section (PS)',   '3-4 ans'),
            ('Moyenne Section (MS)',  '4-5 ans'),
            ('Grande Section (GS)',   '5-6 ans'),
        ]
        NIV_MAT_EN = [
            ('Nursery 1',    '3-4 ans'),
            ('Nursery 2',    '4-5 ans'),
            ('Kindergarten', '5-6 ans'),
        ]
        niveaux_mat = {}
        for lib, _ in NIV_MAT_FR + NIV_MAT_EN:
            niv, _ = Niveau.objects.get_or_create(
                lib_niveau=lib, code_cycle=cycle_mat,
                defaults={'code_pension': pension_mat, 'code_annee_id': ANNEE_CODE, 'type_etab': 'PRIMAIRE'}
            )
            niveaux_mat[lib] = niv

        # Classes maternelle (1 par niveau, max 40 élèves)
        CL_MAT_MAP = {
            'Petite Section (PS)':  ('PM_PSA',  'Petite Section A'),
            'Moyenne Section (MS)': ('PM_MSA',  'Moyenne Section A'),
            'Grande Section (GS)':  ('PM_GSA',  'Grande Section A'),
            'Nursery 1':            ('PM_NU1A', 'Nursery 1 A'),
            'Nursery 2':            ('PM_NU2A', 'Nursery 2 A'),
            'Kindergarten':         ('PM_KINA', 'Kindergarten A'),
        }
        classes_mat = {}
        for niv_lib, (code_cl, lib_cl) in CL_MAT_MAP.items():
            cl, _ = Classe.objects.get_or_create(
                code_classe=code_cl,
                defaults={
                    'lib_classe':  lib_cl,
                    'code_dep':    dep,
                    'code_niveau': niveaux_mat[niv_lib],
                    'code_sp':     sp,
                    'eff_max':     40,
                    'etablissement': etab,
                }
            )
            classes_mat[niv_lib] = cl

        # Enseignantes dédiées maternelle (4 femmes — tradition camerounaise)
        ENS_MAT = [
            ('EMA01', 'BIKELE',  'Angéline',   'F', 'FONCTIONNAIRE'),
            ('EMA02', 'NGONO',   'Christelle', 'F', 'CONTRACTUEL'),
            ('EMA03', 'AMOUGOU', 'Jeannette',  'F', 'CONTRACTUEL'),
            ('EMA04', 'ETEME',   'Alvine',     'F', 'FONCTIONNAIRE'),
        ]
        ens_mat = []
        for mle, nom, prenom, sexe, statut in ENS_MAT:
            ens, _ = Enseignant.objects.get_or_create(
                mle_ens=mle,
                defaults={
                    'nom_ens': nom, 'prenom_ens': prenom, 'sexe': sexe,
                    'statut': statut, 'tel_ens': _tel(),
                    'code_dep': dep, 'etablissement': etab,
                }
            )
            ens_mat.append(ens)

        # Matières maternelle (codes distincts du primaire)
        mod_gen = Module.objects.get(code_module='GEN')
        mod_spo = Module.objects.get(code_module='SPO')
        mod_lit = Module.objects.get(code_module='LIT')
        MATIERES_MAT = [
            ('MAT_EOR', 'Expression Orale',              mod_gen),
            ('MAT_GRP', 'Graphisme',                     mod_gen),
            ('MAT_COL', 'Coloriage et Dessin',           mod_spo),
            ('MAT_CPM', 'Comptage et Pre-mathematiques', mod_gen),
            ('MAT_MUS', 'Eveil Musical',                 mod_spo),
            ('MAT_PSY', 'Psychomotricite',               mod_spo),
            ('MAT_ACT', 'Activites Manuelles',           mod_spo),
            ('MAT_AIA', 'Anglais (initiation)',          mod_lit),
            ('MAT_AIF', 'Francais (initiation)',         mod_lit),
        ]
        matieres_mat = {}
        for code, lib, mod in MATIERES_MAT:
            m, _ = Matiere.objects.get_or_create(
                code_matiere=code,
                defaults={'lib_matiere': lib, 'code_module': mod, 'type_etab': 'PRIMAIRE'}
            )
            matieres_mat[code] = m

        # Périodes maternelle (mêmes trimestres que le primaire)
        periodes_mat = []
        for lib in ['Trimestre 1 PRI', 'Trimestre 2 PRI', 'Trimestre 3 PRI']:
            p = Periode.objects.get(lib_periode=lib)
            periodes_mat.append(p)

        # TypeEvaluation qualitative (pas de notes chiffrées)
        te_qual = TypeEvaluation.objects.get(lib_type_eval='Appreciation qualitative', type_etab='PRIMAIRE')

        # Appréciations qualitatives mappées à une note indicative (pour la DB)
        APPRE_MAP = {
            'Tres Bien':  18.0,
            'Bien':       14.0,
            'En progres': 10.0,
            'A consolider': 6.0,
        }
        appre_list = list(APPRE_MAP.items())

        # 30 élèves maternelle (20 fr + 10 en), ages 3-5 ans (nés 2020-2022)
        NIVEAUX_FR_MAT = ['Petite Section (PS)', 'Moyenne Section (MS)', 'Grande Section (GS)']
        NIVEAUX_EN_MAT = ['Nursery 1', 'Nursery 2', 'Kindergarten']

        nb_evals = 0
        for i in range(30):
            self.stdout.write(f'\r  Eleves maternelle EPPM : {i+1}/30', ending='')
            self.stdout.flush()
            sexe    = 'M' if i % 2 == 0 else 'F'
            nom     = _nom(i + 50)
            prenom  = _prenom(i + 15, sexe)
            region  = _region(i + 13)
            tuteur  = f'{_nom(i+55)} {_prenom(i+20, "F")}'
            mle     = f'EPK{i+1:04d}'

            # Ages 3-5 ans : nés entre 2020 et 2022
            year = random.choice([2020, 2021, 2022])
            d_naiss = date(year, random.randint(1, 12), random.randint(1, 28))

            # Répartition : 0-19 = francophones, 20-29 = anglophones
            if i < 20:
                niv_lib = NIVEAUX_FR_MAT[i % 3]
            else:
                niv_lib = NIVEAUX_EN_MAT[(i - 20) % 3]

            cl      = classes_mat[niv_lib]
            ens_ref = ens_mat[i % len(ens_mat)]

            etud = self._inscrire(mle, nom, prenom, sexe, d_naiss, region, tuteur, cl, etab, 3000)

            # Paiement T1 maternelle (13 000 FCFA total)
            sp_val = _statut_paiement()
            Paiement.objects.get_or_create(
                mle_etudiant=etud,
                code_annee_id=ANNEE_CODE,
                code_tranche=tr_mat1,
                defaults={
                    'type_paiement':  'INSCRIPTION',
                    'mt_paiement':    8000 if sp_val == 'PAYE' else (4000 if sp_val == 'PARTIEL' else 0),
                    'statut':         sp_val,
                    'date_paiement':  date(2025, 9, random.randint(1, 30)),
                    'mode_paiement':  random.choice(['ESPECES', 'MOBILE_MONEY']),
                    'ref_paiement':   f'MAT{i+1:04d}',
                    'etablissement':  etab,
                }
            )

            # Évaluations qualitatives (5 matières × 1 période × 1 appréciation)
            mat_codes_mat = ['MAT_EOR', 'MAT_GRP', 'MAT_CPM', 'MAT_MUS', 'MAT_PSY']
            for mat_code in mat_codes_mat:
                mat_obj = matieres_mat[mat_code]
                Cours.objects.get_or_create(
                    code_matiere=mat_obj, code_classe=cl,
                    semestre='S1', code_annee_id=ANNEE_CODE,
                    defaults={'mle_ens': ens_ref, 'quota_horaire': 20, 'credits': 0, 'etablissement': etab}
                )
                for per in periodes_mat[:2]:
                    appre_label, note_val = random.choice(appre_list)
                    Evaluation.objects.get_or_create(
                        mle_etudiant=etud,
                        code_matiere=mat_obj,
                        code_classe=cl,
                        code_periode=per,
                        code_type_eval=te_qual,
                        defaults={
                            'note':      note_val,   # valeur indicative
                            'obs_eval':  appre_label, # appréciation qualitative réelle
                            'date_eval': per.date_debut + timedelta(days=random.randint(10, 40)),
                            'etablissement': etab,
                        }
                    )
                    nb_evals += 1

        self.stdout.write(f'\n  [OK] Maternelle EPPM - 30 eleves (20 fr + 10 en), 4 enseignantes')
        return nb_evals

    # ────────────────────────────────────────────────────────────────────────────
    # LBN — Lycée Bilingue de Nkolbisson
    # ────────────────────────────────────────────────────────────────────────────

    def _seed_lbn(self):
        CODE = 'LBN'
        self.stdout.write(f'\n[2/3] Création LBN — Lycée Bilingue de Nkolbisson...')

        etab, _ = Etablissement.objects.get_or_create(
            code_etab=CODE,
            defaults={
                'lib_etab':          'Lycée Bilingue de Nkolbisson',
                'sigle':             CODE,
                'type_etab':         'SECONDAIRE',
                'statut':            'PUBLIC',
                'systeme':           'BILINGUE',
                'region':            'CENTRE',
                'ville':             'Yaoundé',
                'adresse':           'Nkolbisson, Route de Bafoussam, Yaoundé',
                'telephone':         '+237 222 32 44 55',
                'directeur':         'M. ZANGA Théodore (Proviseur)',
                'ministere_tutelle': 'Ministère des Enseignements Secondaires (MINESEC)',
            }
        )

        pension, _ = Pension.objects.get_or_create(
            lib_pension='APE + Sport + COGES LBN',
            defaults={'mt_pension': 22500, 'mt_inscription': 5000, 'nb_tranche': 2, 'type_etab': 'SECONDAIRE'}
        )
        tr1, _ = Tranche.objects.get_or_create(
            lib_tranche='T1-LBN', code_pension=pension,
            defaults={'mt_tranche': 12500}
        )
        tr2, _ = Tranche.objects.get_or_create(
            lib_tranche='T2-LBN', code_pension=pension,
            defaults={'mt_tranche': 10000}
        )

        cyc1, _ = Cycle.objects.get_or_create(
            code_cycle='CYC_COL',
            defaults={'lib_cycle': 'Cycle 1 — Collège', 'code_pension': pension, 'type_etab': 'SECONDAIRE'}
        )
        cyc2, _ = Cycle.objects.get_or_create(
            code_cycle='CYC_LYC',
            defaults={'lib_cycle': 'Cycle 2 — Lycée', 'code_pension': pension, 'type_etab': 'SECONDAIRE'}
        )

        dep_fr, _ = Departement.objects.get_or_create(
            code_dep='DEP_LBN_FR',
            defaults={'lib_dep': 'Filières Francophones LBN', 'code_etab': etab, 'etablissement': etab}
        )
        dep_en, _ = Departement.objects.get_or_create(
            code_dep='DEP_LBN_EN',
            defaults={'lib_dep': 'Anglophone Studies LBN', 'code_etab': etab, 'etablissement': etab}
        )

        sp_col, _ = Specialite.objects.get_or_create(
            code_sp='SP_LBN_COL',
            defaults={'lib_sp': 'Collège Général', 'code_dep': dep_fr, 'etablissement': etab}
        )
        sp_a, _ = Specialite.objects.get_or_create(
            code_sp='SP_LBN_A',
            defaults={'lib_sp': 'Série A — Lettres et Sciences Humaines', 'code_dep': dep_fr, 'etablissement': etab}
        )
        sp_c, _ = Specialite.objects.get_or_create(
            code_sp='SP_LBN_C',
            defaults={'lib_sp': 'Série C — Mathématiques et Sciences Physiques', 'code_dep': dep_fr, 'etablissement': etab}
        )
        sp_d, _ = Specialite.objects.get_or_create(
            code_sp='SP_LBN_D',
            defaults={'lib_sp': 'Série D — Sciences Naturelles', 'code_dep': dep_fr, 'etablissement': etab}
        )
        sp_en, _ = Specialite.objects.get_or_create(
            code_sp='SP_LBN_EN',
            defaults={'lib_sp': 'Anglophone Stream', 'code_dep': dep_en, 'etablissement': etab}
        )

        # Niveaux collège
        NIVEAUX_COL = [
            ('6ème / Form 1', cyc1), ('5ème / Form 2', cyc1),
            ('4ème / Form 3', cyc1), ('3ème / Form 4', cyc1),
        ]
        # Niveaux lycée
        NIVEAUX_LYC = [
            ('2nde', cyc2), ('1ère', cyc2), ('Terminale', cyc2),
        ]
        niveaux = {}
        for lib, cyc in NIVEAUX_COL + NIVEAUX_LYC:
            niv, _ = Niveau.objects.get_or_create(
                lib_niveau=lib, code_cycle=cyc,
                defaults={'code_pension': pension, 'code_annee_id': ANNEE_CODE, 'type_etab': 'SECONDAIRE'}
            )
            niveaux[lib] = niv

        # Classes collège : 2 fr + 1 en par niveau → 12 classes collège
        # Classes lycée  : A, C, D fr → 9 classes lycée
        classes_lbn = []
        col_short = {
            '6ème / Form 1': '6eme',
            '5ème / Form 2': '5eme',
            '4ème / Form 3': '4eme',
            '3ème / Form 4': '3eme',
        }
        for niv_lib in col_short:
            niv = niveaux[niv_lib]
            short = col_short[niv_lib]
            for suf in ['A', 'B']:
                cl, _ = Classe.objects.get_or_create(
                    code_classe=f'LBN_{short}{suf}',
                    defaults={
                        'lib_classe': f'{niv_lib.split("/")[0].strip()} {suf}',
                        'code_dep': dep_fr, 'code_niveau': niv,
                        'code_sp': sp_col, 'eff_max': 55, 'etablissement': etab,
                    }
                )
                classes_lbn.append(cl)
            # Classe anglophone
            cl_en, _ = Classe.objects.get_or_create(
                code_classe=f'LBN_{short}EN',
                defaults={
                    'lib_classe': f'{niv_lib.split("/")[1].strip()}',
                    'code_dep': dep_en, 'code_niveau': niv,
                    'code_sp': sp_en, 'eff_max': 45, 'etablissement': etab,
                }
            )
            classes_lbn.append(cl_en)

        lyc_suf = {
            '2nde': [('2ndeA', '2nde A', sp_a), ('2ndeC', '2nde C', sp_c), ('2ndeD', '2nde D', sp_d)],
            '1ère': [('1ereA', '1ère A', sp_a), ('1ereC', '1ère C', sp_c), ('1ereD', '1ère D', sp_d)],
            'Terminale': [('TleA', 'Terminale A', sp_a), ('TleC', 'Terminale C', sp_c), ('TleD', 'Terminale D', sp_d)],
        }
        for niv_lib, cls_def in lyc_suf.items():
            niv = niveaux[niv_lib]
            for code_suf, lib_classe, sp in cls_def:
                cl, _ = Classe.objects.get_or_create(
                    code_classe=f'LBN_{code_suf}',
                    defaults={
                        'lib_classe': lib_classe,
                        'code_dep': dep_fr, 'code_niveau': niv,
                        'code_sp': sp, 'eff_max': 50, 'etablissement': etab,
                    }
                )
                classes_lbn.append(cl)

        # 25 enseignants
        ENS_LBN = [
            ('LBN01', 'TSAPI',    'Alain',        'M', 'FONCTIONNAIRE'),
            ('LBN02', 'NDJANA',   'Rose',          'F', 'FONCTIONNAIRE'),
            ('LBN03', 'MBARGA',   'Clémentine',   'F', 'FONCTIONNAIRE'),
            ('LBN04', 'TEKEU',    'Roland',        'M', 'FONCTIONNAIRE'),
            ('LBN05', 'FOTSO',    'Jean',          'M', 'FONCTIONNAIRE'),
            ('LBN06', 'NGUELE',   'Patricia',      'F', 'FONCTIONNAIRE'),
            ('LBN07', 'BIYONG',   'Emmanuel',      'M', 'VACATAIRE'),
            ('LBN08', 'KANA',     'Serge',         'M', 'FONCTIONNAIRE'),
            ('LBN09', 'ABANDA',   'Christine',     'F', 'CONTRACTUEL'),
            ('LBN10', 'NKOA',     'Bertrand',      'M', 'VACATAIRE'),
            ('LBN11', 'OMGBA',    'Gilles',        'M', 'FONCTIONNAIRE'),
            ('LBN12', 'EWANE',    'Nadège',        'F', 'FONCTIONNAIRE'),
            ('LBN13', 'FOUDA',    'Martial',       'M', 'FONCTIONNAIRE'),
            ('LBN14', 'MABOU',    'Flavie',        'F', 'VACATAIRE'),
            ('LBN15', 'ZANGA',    'Nicolas',       'M', 'FONCTIONNAIRE'),
            ('LBN16', 'AKOA',     'Josiane',       'F', 'CONTRACTUEL'),
            ('LBN17', 'SAME',     'Boris',         'M', 'VACATAIRE'),
            ('LBN18', 'DJOUFACK', 'Ornella',       'F', 'FONCTIONNAIRE'),
            ('LBN19', 'DJOYA',    'Kevin',         'M', 'VACATAIRE'),
            ('LBN20', 'BIKELE',   'Carole',        'F', 'CONTRACTUEL'),
            ('LBN21', 'NKENGNE',  'Stéphane',     'M', 'FONCTIONNAIRE'),
            ('LBN22', 'ETOUNDI',  'Viviane',       'F', 'FONCTIONNAIRE'),
            ('LBN23', 'KUETE',    'Patrick',       'M', 'VACATAIRE'),
            ('LBN24', 'WAMBA',    'Christelle',   'F', 'CONTRACTUEL'),
            ('LBN25', 'AMOUGOU',  'Yannick',       'M', 'FONCTIONNAIRE'),
        ]
        ens_lbn = []
        for mle, nom, prenom, sexe, statut in ENS_LBN:
            ens, _ = Enseignant.objects.get_or_create(
                mle_ens=mle,
                defaults={
                    'nom_ens': nom, 'prenom_ens': prenom, 'sexe': sexe,
                    'statut': statut, 'tel_ens': _tel(),
                    'code_dep': dep_fr, 'etablissement': etab,
                }
            )
            ens_lbn.append(ens)

        # Matières secondaires
        mod_gen = Module.objects.get(code_module='GEN')
        mod_sci = Module.objects.get(code_module='SCI')
        mod_lit = Module.objects.get(code_module='LIT')
        mod_spo = Module.objects.get(code_module='SPO')
        MATIERES_SEC = [
            ('SEC_FRA', 'Français',                    mod_lit),
            ('SEC_ANG', 'Anglais',                     mod_lit),
            ('SEC_MAT', 'Mathématiques',               mod_sci),
            ('SEC_PCH', 'Physique-Chimie',             mod_sci),
            ('SEC_SVT', 'Sciences de la Vie et Terre', mod_sci),
            ('SEC_HGO', 'Histoire-Géographie',         mod_gen),
            ('SEC_PHI', 'Philosophie',                 mod_lit),
            ('SEC_ECM', 'Éducation à la Citoyenneté',  mod_gen),
            ('SEC_EPS', 'Éducation Physique (EPS)',    mod_spo),
            ('SEC_INF', 'Informatique',                mod_sci),
        ]
        matieres_sec = {}
        for code, lib, mod in MATIERES_SEC:
            m, _ = Matiere.objects.get_or_create(
                code_matiere=code,
                defaults={'lib_matiere': lib, 'code_module': mod, 'type_etab': 'SECONDAIRE'}
            )
            matieres_sec[code] = m

        # Périodes (3 trimestres)
        periodes_sec = []
        for lib, deb, fin in [
            ('Trimestre 1 SEC', date(2025, 10, 1),  date(2025, 12, 20)),
            ('Trimestre 2 SEC', date(2026, 1, 5),   date(2026, 3, 27)),
            ('Trimestre 3 SEC', date(2026, 4, 7),   date(2026, 6, 26)),
        ]:
            p, _ = Periode.objects.get_or_create(
                lib_periode=lib,
                defaults={'date_debut': deb, 'date_fin': fin, 'type_etab': 'SECONDAIRE', 'code_annee_id': ANNEE_CODE}
            )
            periodes_sec.append(p)

        te_dv  = TypeEvaluation.objects.get(lib_type_eval='Devoir',       type_etab='SECONDAIRE')
        te_cp  = TypeEvaluation.objects.get(lib_type_eval='Composition',  type_etab='SECONDAIRE')

        mat_codes_eval = ['SEC_FRA', 'SEC_MAT', 'SEC_PCH', 'SEC_SVT', 'SEC_ANG']

        nb_evals = 0
        for i in range(200):
            self.stdout.write(f'\r  Élèves LBN : {i+1}/200', ending='')
            self.stdout.flush()
            sexe    = 'M' if i % 2 == 0 else 'F'
            nom     = _nom(i + 10)
            prenom  = _prenom(i, sexe)
            region  = _region(i + 3)
            tuteur  = f'{_nom(i+7)} {_prenom(i+4, "M")}'
            mle     = f'LB{i+1:04d}'
            d_naiss = _date_naiss(2003, 2013)
            cl      = classes_lbn[i % len(classes_lbn)]
            ens_ref = ens_lbn[i % len(ens_lbn)]

            etud = self._inscrire(mle, nom, prenom, sexe, d_naiss, region, tuteur, cl, etab, 5000)

            sp_val = _statut_paiement()
            Paiement.objects.get_or_create(
                mle_etudiant=etud,
                code_annee_id=ANNEE_CODE,
                code_tranche=tr1,
                defaults={
                    'type_paiement':  'INSCRIPTION',
                    'mt_paiement':    12500 if sp_val == 'PAYE' else (6000 if sp_val == 'PARTIEL' else 0),
                    'statut':         sp_val,
                    'date_paiement':  date(2025, 9, random.randint(1, 30)),
                    'mode_paiement':  random.choice(['ESPECES', 'MOBILE_MONEY', 'VIREMENT']),
                    'ref_paiement':   f'LBN{i+1:05d}',
                    'etablissement':  etab,
                }
            )

            for mat_code in mat_codes_eval:
                mat_obj = matieres_sec[mat_code]
                Cours.objects.get_or_create(
                    code_matiere=mat_obj, code_classe=cl,
                    semestre='S1', code_annee_id=ANNEE_CODE,
                    defaults={'mle_ens': ens_ref, 'quota_horaire': 40, 'credits': 0, 'etablissement': etab}
                )
                for per in periodes_sec[:2]:
                    for te in [te_dv, te_cp]:
                        Evaluation.objects.get_or_create(
                            mle_etudiant=etud,
                            code_matiere=mat_obj,
                            code_classe=cl,
                            code_periode=per,
                            code_type_eval=te,
                            defaults={
                                'note':      round(random.uniform(4, 20), 2),
                                'date_eval': per.date_debut + timedelta(days=random.randint(5, 45)),
                                'etablissement': etab,
                            }
                        )
                        nb_evals += 1

        self.stdout.write('')

        first_lb = Etudiant.objects.get(mle_etudiant='LB0001')
        for login, nom, role in [
            ('lbn_admin', 'ZANGA Théodore — Proviseur LBN',  'ADMIN'),
            ('lbn_scol',  'NDJANA Rose — Scolarité LBN',     'SCOLARITE'),
            ('lbn_ens',   'TSAPI Alain — Enseignant LBN',    'ENSEIGNANT'),
            ('lbn_compt', 'FOUDA Martial — Comptable LBN',   'COMPTABLE'),
            ('lbn_etud',  f'{first_lb.nom} {first_lb.prenom or ""}', 'ETUDIANT'),
        ]:
            self._user(login, nom, role, CODE)

        # ── Personnel LBN ──────────────────────────────────────────────────────
        PERS_LBN = [
            ('LBN_PRV01', 'ZANGA',    'Théodore',   'M', 'PROVISEUR',      'DIRECTION',   'TITULAIRE'),
            ('LBN_PRV02', 'NKOA',     'Bernadette',  'F', 'PROVISEUR_ADJ',  'DIRECTION',   'TITULAIRE'),
            ('LBN_PED01', 'MBARGA',   'Cyrille',    'M', 'CENSEUR',        'PEDAGOGIQUE', 'TITULAIRE'),
            ('LBN_PED02', 'ONDOA',    'Félicité',   'F', 'CENSEUR_ADJ',    'PEDAGOGIQUE', 'TITULAIRE'),
            ('LBN_ADM01', 'ETOA',     'Samuel',     'M', 'SG',             'ADMIN',       'TITULAIRE'),
            ('LBN_ADM02', 'NGONO',    'Patricia',   'F', 'DAC',            'ADMIN',       'TITULAIRE'),
            ('LBN_ADM03', 'ABANDA',   'Henri',      'M', 'INTENDANT',      'ADMIN',       'CONTRACTUEL'),
            ('LBN_PED03', 'BIYONG',   'Lucie',      'F', 'CONSEILLER_ORI', 'PEDAGOGIQUE', 'TITULAIRE'),
            ('LBN_ADM04', 'MANGA',    'Jean',       'M', 'AGENT_SCOL',     'ADMIN',       'CONTRACTUEL'),
            ('LBN_ADM05', 'ESSAMA',   'Martine',    'F', 'AGENT_SCOL',     'ADMIN',       'CONTRACTUEL'),
            ('LBN_PED04', 'ATEBA',    'Clément',    'M', 'SURVEILLANT',    'PEDAGOGIQUE', 'CONTRACTUEL'),
            ('LBN_SOU01', 'FOUDA',    'Rodrigue',   'M', 'GARDIEN',        'SOUTIEN',     'CONTRACTUEL'),
            ('LBN_SOU02', 'EYEBE',    'Claudine',   'F', 'GARDIEN',        'SOUTIEN',     'CONTRACTUEL'),
            ('LBN_SOU03', 'NDJANA',   'Sylvie',     'F', 'ENTRETIEN',      'SOUTIEN',     'BENEVOLE'),
            ('LBN_SOU04', 'ENGOLO',   'Marthe',     'F', 'ENTRETIEN',      'SOUTIEN',     'BENEVOLE'),
            ('LBN_SOU05', 'ZANG',     'Annette',    'F', 'ENTRETIEN',      'SOUTIEN',     'BENEVOLE'),
        ]
        nb_pers = self._seed_personnel(etab, PERS_LBN)
        self.stdout.write(f'  [OK] LBN termine - 200 eleves, 25 enseignants, {nb_pers} personnel')
        return {'eleves': 200, 'ens': len(ENS_LBN), 'evals': nb_evals}

    # ────────────────────────────────────────────────────────────────────────────
    # ISTA — Institut Supérieur de Technologies Appliquées
    # ────────────────────────────────────────────────────────────────────────────

    def _seed_ista(self):
        CODE = 'ISTA'
        self.stdout.write(f'\n[3/3] Création ISTA — Institut Supérieur de Technologies Appliquées...')

        etab, _ = Etablissement.objects.get_or_create(
            code_etab=CODE,
            defaults={
                'lib_etab':          'Institut Supérieur de Technologies Appliquées',
                'sigle':             CODE,
                'type_etab':         'SUPERIEUR',
                'statut':            'PRIVE_LAIQUE',
                'systeme':           'FRANCOPHONE',
                'region':            'CENTRE',
                'ville':             'Yaoundé',
                'adresse':           'Quartier Omnisports, Avenue du 20 Mai, Yaoundé',
                'telephone':         '+237 222 20 55 66',
                'email':             'contact@ista-yaounde.cm',
                'directeur':         'Dr. KAMGA Éric',
                'ministere_tutelle': "Ministère de l'Enseignement Supérieur (MINESUP)",
            }
        )

        # Pensions par niveau
        # lib_pension max 25 chars, lib_tranche max 10 chars
        FRAIS_NIVEAUX = [
            ('Scolarité BTS ISTA',  450000, 50000, 'BTS'),
            ('Scolarité Lic. ISTA', 500000, 50000, 'LICENCE'),
            ('Scolarité L3 ISTA',   600000, 50000, 'L3'),
        ]
        pensions = {}
        tranches = {}
        for lib, mt, mt_insc, tag in FRAIS_NIVEAUX:
            p, _ = Pension.objects.get_or_create(
                lib_pension=lib,
                defaults={'mt_pension': mt, 'mt_inscription': mt_insc, 'nb_tranche': 3, 'type_etab': 'SUPERIEUR'}
            )
            pensions[tag] = p
            tag_short = {'BTS': 'B', 'LICENCE': 'L', 'L3': 'L3'}[tag]
            for suf, val in [('T1', mt//3), ('T2', mt//3), ('T3', mt - 2*(mt//3))]:
                t, _ = Tranche.objects.get_or_create(
                    lib_tranche=f'I{tag_short}{suf}', code_pension=p,  # ex: IBT1 (4), ILT2 (4)
                    defaults={'mt_tranche': val}
                )
                tranches[f'{tag}_{suf}'] = t

        pension_bts = pensions['BTS']
        pension_lic = pensions['LICENCE']
        pension_l3  = pensions['L3']

        cyc_bts, _ = Cycle.objects.get_or_create(
            code_cycle='CYC_BTS',
            defaults={'lib_cycle': 'BTS — Brevet de Technicien Supérieur', 'code_pension': pension_bts, 'type_etab': 'SUPERIEUR'}
        )
        cyc_lic, _ = Cycle.objects.get_or_create(
            code_cycle='CYC_LIC',
            defaults={'lib_cycle': 'Cycle Licence (L1–L3)', 'code_pension': pension_lic, 'type_etab': 'SUPERIEUR'}
        )

        # Niveaux
        NIV_ISTA = [
            ('BTS 1', cyc_bts, pension_bts),
            ('BTS 2', cyc_bts, pension_bts),
            ('Licence 1 (L1)', cyc_lic, pension_lic),
            ('Licence 2 (L2)', cyc_lic, pension_lic),
            ('Licence 3 (L3)', cyc_lic, pension_l3),
        ]
        niveaux = {}
        for lib, cyc, pen in NIV_ISTA:
            niv, _ = Niveau.objects.get_or_create(
                lib_niveau=lib, code_cycle=cyc,
                defaults={'code_pension': pen, 'code_annee_id': ANNEE_CODE, 'type_etab': 'SUPERIEUR'}
            )
            niveaux[lib] = niv

        # Départements (code_dep max 10 chars)
        dep_gi, _ = Departement.objects.get_or_create(
            code_dep='IST_GI',
            defaults={'lib_dep': 'Génie Informatique', 'code_etab': etab, 'etablissement': etab}
        )
        dep_gcg, _ = Departement.objects.get_or_create(
            code_dep='IST_GCG',
            defaults={'lib_dep': 'Génie Commercial et Gestion', 'code_etab': etab, 'etablissement': etab}
        )
        dep_gcb, _ = Departement.objects.get_or_create(
            code_dep='IST_GCB',
            defaults={'lib_dep': 'Génie Civil et Bâtiment', 'code_etab': etab, 'etablissement': etab}
        )

        # Spécialités
        sp_dl, _ = Specialite.objects.get_or_create(code_sp='SP_DL', defaults={'lib_sp': 'Développement Logiciel', 'code_dep': dep_gi, 'etablissement': etab})
        sp_ia, _ = Specialite.objects.get_or_create(code_sp='SP_IA', defaults={'lib_sp': 'Intelligence Artificielle', 'code_dep': dep_gi, 'etablissement': etab})
        sp_rt, _ = Specialite.objects.get_or_create(code_sp='SP_RT', defaults={'lib_sp': 'Réseaux et Télécommunications', 'code_dep': dep_gi, 'etablissement': etab})
        sp_cs, _ = Specialite.objects.get_or_create(code_sp='SP_CS', defaults={'lib_sp': 'Cybersécurité', 'code_dep': dep_gi, 'etablissement': etab})
        sp_mc, _ = Specialite.objects.get_or_create(code_sp='SP_MC', defaults={'lib_sp': 'Marketing et Commerce', 'code_dep': dep_gcg, 'etablissement': etab})
        sp_cf, _ = Specialite.objects.get_or_create(code_sp='SP_CF', defaults={'lib_sp': 'Comptabilité et Finance', 'code_dep': dep_gcg, 'etablissement': etab})
        sp_btp,_ = Specialite.objects.get_or_create(code_sp='SP_BTP', defaults={'lib_sp': 'Bâtiment et Travaux Publics', 'code_dep': dep_gcb, 'etablissement': etab})

        # Classes : codes max 10 chars — DL_B1A = Developpement Logiciel BTS1 A
        CLASSES_ISTA = [
            ('DL_B1A', 'DL BTS1 A', sp_dl, dep_gi, 'BTS 1'),
            ('DL_B1B', 'DL BTS1 B', sp_dl, dep_gi, 'BTS 1'),
            ('DL_B2A', 'DL BTS2 A', sp_dl, dep_gi, 'BTS 2'),
            ('DL_B2B', 'DL BTS2 B', sp_dl, dep_gi, 'BTS 2'),
            ('DL_L1A', 'DL L1 A',   sp_dl, dep_gi, 'Licence 1 (L1)'),
            ('DL_L1B', 'DL L1 B',   sp_dl, dep_gi, 'Licence 1 (L1)'),
            ('DL_L2A', 'DL L2 A',   sp_dl, dep_gi, 'Licence 2 (L2)'),
            ('DL_L3A', 'DL L3 A',   sp_dl, dep_gi, 'Licence 3 (L3)'),
            ('IA_B1A', 'IA BTS1 A', sp_ia, dep_gi, 'BTS 1'),
            ('IA_L1A', 'IA L1 A',   sp_ia, dep_gi, 'Licence 1 (L1)'),
            ('RT_B1A', 'RT BTS1 A', sp_rt, dep_gi, 'BTS 1'),
            ('RT_L1A', 'RT L1 A',   sp_rt, dep_gi, 'Licence 1 (L1)'),
            ('CS_L1A', 'CS L1 A',   sp_cs, dep_gi, 'Licence 1 (L1)'),
            ('MC_B1A', 'MC BTS1 A', sp_mc, dep_gcg,'BTS 1'),
            ('MC_L1A', 'MC L1 A',   sp_mc, dep_gcg,'Licence 1 (L1)'),
            ('CF_B1A', 'CF BTS1 A', sp_cf, dep_gcg,'BTS 1'),
            ('CF_L1A', 'CF L1 A',   sp_cf, dep_gcg,'Licence 1 (L1)'),
            ('BTP_B1A','BTP BTS1 A',sp_btp,dep_gcb,'BTS 1'),
        ]
        classes_ista = []
        for code_cl, lib_cl, sp, dep, niv_lib in CLASSES_ISTA:
            cl, _ = Classe.objects.get_or_create(
                code_classe=code_cl,
                defaults={
                    'lib_classe': lib_cl,
                    'code_dep':   dep,
                    'code_niveau': niveaux[niv_lib],
                    'code_sp':    sp,
                    'eff_max':    35,
                    'etablissement': etab,
                }
            )
            classes_ista.append((cl, niv_lib))

        # 30 enseignants
        ENS_ISTA = [
            ('IST01', 'KAMGA',     'Éric',        'M', 'PERMANENT'),
            ('IST02', 'TSAPI',     'Wilfried',     'M', 'PERMANENT'),
            ('IST03', 'WONDJI',    'Solange',      'F', 'VACATAIRE'),
            ('IST04', 'EKANG',     'Cédric',       'M', 'VACATAIRE'),
            ('IST05', 'NDJANA',    'Flavie',       'F', 'PERMANENT'),
            ('IST06', 'NGUELE',    'Bertrand',     'M', 'VACATAIRE'),
            ('IST07', 'BELLO',     'Serge',        'M', 'PERMANENT'),
            ('IST08', 'EWANE',     'Nadège',       'F', 'VACATAIRE'),
            ('IST09', 'DJOYA',     'Maxime',       'M', 'VACATAIRE'),
            ('IST10', 'AKOA',      'Christine',    'F', 'PERMANENT'),
            ('IST11', 'NGAKO',     'Kevin',        'M', 'VACATAIRE'),
            ('IST12', 'MABOU',     'Alvine',       'F', 'PERMANENT'),
            ('IST13', 'KENFACK',   'Robert',       'M', 'VACATAIRE'),
            ('IST14', 'NYAMSI',    'Ornella',      'F', 'VACATAIRE'),
            ('IST15', 'FOTSO',     'Emmanuel',     'M', 'PERMANENT'),
            ('IST16', 'TEKEU',     'Rodrigue',     'M', 'VACATAIRE'),
            ('IST17', 'ABOMO',     'Sandrine',     'F', 'VACATAIRE'),
            ('IST18', 'NKOA',      'Clément',      'M', 'PERMANENT'),
            ('IST19', 'DJOUFACK',  'Carole',       'F', 'VACATAIRE'),
            ('IST20', 'FOMBA',     'Patrick',      'M', 'VACATAIRE'),
            ('IST21', 'MOUKAM',    'Viviane',      'F', 'PERMANENT'),
            ('IST22', 'ETEME',     'Cyril',        'M', 'VACATAIRE'),
            ('IST23', 'NGANOU',    'Bernadette',   'F', 'VACATAIRE'),
            ('IST24', 'BITA',      'Martial',      'M', 'PERMANENT'),
            ('IST25', 'AMOUGOU',   'Pascale',      'F', 'VACATAIRE'),
            ('IST26', 'ETOUNDI',   'Hervé',        'M', 'VACATAIRE'),
            ('IST27', 'WAMBA',     'Josiane',      'F', 'PERMANENT'),
            ('IST28', 'TCHIBOZO',  'André',        'M', 'VACATAIRE'),
            ('IST29', 'NKEMDIRIM', 'Céline',       'F', 'VACATAIRE'),
            ('IST30', 'OMGBA',     'Gilles',       'M', 'PERMANENT'),
        ]
        ens_ista = []
        for mle, nom, prenom, sexe, statut in ENS_ISTA:
            ens, _ = Enseignant.objects.get_or_create(
                mle_ens=mle,
                defaults={
                    'nom_ens': nom, 'prenom_ens': prenom, 'sexe': sexe,
                    'statut': statut, 'tel_ens': _tel(),
                    'email_ens': f'{nom.lower()}.{prenom.lower().replace("é","e").replace("è","e")[:4]}@ista-yaounde.cm',
                    'code_dep': dep_gi, 'etablissement': etab,
                }
            )
            ens_ista.append(ens)

        # Matières GI
        mod_tec = Module.objects.get(code_module='TEC')
        mod_sci = Module.objects.get(code_module='SCI')
        mod_ges = Module.objects.get(code_module='GES')
        mod_lit = Module.objects.get(code_module='LIT')
        MATIERES_SUP = [
            ('SUP_ALGO', 'Algorithmique et Programmation', mod_tec),
            ('SUP_BDD',  'Bases de Données',               mod_tec),
            ('SUP_RES',  'Réseaux Informatiques',          mod_tec),
            ('SUP_SYS',  "Systèmes d'Exploitation",        mod_tec),
            ('SUP_WEB',  'Développement Web',              mod_tec),
            ('SUP_MAT',  'Mathématiques pour l\'Info',     mod_sci),
            ('SUP_ANG',  'Anglais Technique',              mod_lit),
            ('SUP_EXP',  'Expression Française',           mod_lit),
            ('SUP_DRO',  'Droit de l\'Informatique',       mod_ges),
            ('SUP_GES',  'Gestion de Projets',             mod_ges),
        ]
        matieres_sup = {}
        for code, lib, mod in MATIERES_SUP:
            m, _ = Matiere.objects.get_or_create(
                code_matiere=code,
                defaults={'lib_matiere': lib, 'code_module': mod, 'type_etab': 'SUPERIEUR'}
            )
            matieres_sup[code] = m

        # Périodes (2 semestres)
        periodes_sup = []
        for lib, deb, fin in [
            ('Semestre 1 ISTA', date(2025, 9, 15),  date(2026, 1, 31)),
            ('Semestre 2 ISTA', date(2026, 2, 1),   date(2026, 6, 30)),
        ]:
            p, _ = Periode.objects.get_or_create(
                lib_periode=lib,
                defaults={'date_debut': deb, 'date_fin': fin, 'type_etab': 'SUPERIEUR', 'code_annee_id': ANNEE_CODE}
            )
            periodes_sup.append(p)

        te_dv = TypeEvaluation.objects.get(lib_type_eval='Devoir',            type_etab='SUPERIEUR')
        te_ex = TypeEvaluation.objects.get(lib_type_eval='Examen semestriel', type_etab='SUPERIEUR')

        # Frais par niveau (pour les paiements de scolarité)
        NIV_PENSION_MAP = {
            'BTS 1': ('BTS', 'T1'),
            'BTS 2': ('BTS', 'T1'),
            'Licence 1 (L1)': ('LICENCE', 'T1'),
            'Licence 2 (L2)': ('LICENCE', 'T1'),
            'Licence 3 (L3)': ('L3', 'T1'),
        }
        BTS_MT   = 450000 // 3
        LIC_MT   = 500000 // 3
        L3_MT    = 600000 // 3
        NIV_MONTANT = {
            'BTS 1': BTS_MT, 'BTS 2': BTS_MT,
            'Licence 1 (L1)': LIC_MT, 'Licence 2 (L2)': LIC_MT,
            'Licence 3 (L3)': L3_MT,
        }

        mat_codes_eval = ['SUP_ALGO', 'SUP_BDD', 'SUP_RES', 'SUP_MAT', 'SUP_ANG']

        nb_evals = 0
        for i in range(300):
            self.stdout.write(f'\r  Étudiants ISTA : {i+1}/300', ending='')
            self.stdout.flush()
            sexe    = 'M' if i % 2 == 0 else 'F'
            nom     = _nom(i + 20)
            prenom  = _prenom(i + 5, sexe)
            region  = _region(i + 7)
            tuteur  = f'{_nom(i+11)} {_prenom(i+8, "M")}'
            mle     = f'IS{i+1:04d}'
            d_naiss = _date_naiss(1998, 2007)
            cl, niv_lib = classes_ista[i % len(classes_ista)]
            ens_ref = ens_ista[i % len(ens_ista)]
            tag, t_suf = NIV_PENSION_MAP.get(niv_lib, ('BTS', 'T1'))
            tranche_ref = tranches[f'{tag}_{t_suf}']

            etud = self._inscrire(mle, nom, prenom, sexe, d_naiss, region, tuteur, cl, etab, 50000)

            sp_val = _statut_paiement()
            mt = NIV_MONTANT.get(niv_lib, BTS_MT)
            Paiement.objects.get_or_create(
                mle_etudiant=etud,
                code_annee_id=ANNEE_CODE,
                code_tranche=tranche_ref,
                defaults={
                    'type_paiement':  'SCOLARITE',
                    'mt_paiement':    mt if sp_val == 'PAYE' else (mt//2 if sp_val == 'PARTIEL' else 0),
                    'statut':         sp_val,
                    'date_paiement':  date(2025, 9, random.randint(1, 30)),
                    'mode_paiement':  random.choice(['ESPECES', 'MOBILE_MONEY', 'VIREMENT']),
                    'ref_paiement':   f'IST{i+1:05d}',
                    'etablissement':  etab,
                }
            )

            for mat_code in mat_codes_eval:
                mat_obj = matieres_sup[mat_code]
                Cours.objects.get_or_create(
                    code_matiere=mat_obj, code_classe=cl,
                    semestre='S1', code_annee_id=ANNEE_CODE,
                    defaults={'mle_ens': ens_ref, 'quota_horaire': 45, 'credits': 3, 'etablissement': etab}
                )
                for per in periodes_sup[:1]:
                    for te in [te_dv, te_ex]:
                        Evaluation.objects.get_or_create(
                            mle_etudiant=etud,
                            code_matiere=mat_obj,
                            code_classe=cl,
                            code_periode=per,
                            code_type_eval=te,
                            defaults={
                                'note':      round(random.uniform(5, 20), 2),
                                'date_eval': per.date_debut + timedelta(days=random.randint(10, 60)),
                                'etablissement': etab,
                            }
                        )
                        nb_evals += 1

        self.stdout.write('')

        first_is = Etudiant.objects.get(mle_etudiant='IS0001')
        for login, nom, role in [
            ('ista_admin', 'KAMGA Éric — Directeur ISTA',         'ADMIN'),
            ('ista_scol',  'AKOA Christine — Scolarité ISTA',      'SCOLARITE'),
            ('ista_ens',   'BELLO Serge — Enseignant ISTA',        'ENSEIGNANT'),
            ('ista_compt', 'FOTSO Emmanuel — Comptable ISTA',      'COMPTABLE'),
            ('ista_etud',  f'{first_is.nom} {first_is.prenom or ""}', 'ETUDIANT'),
        ]:
            self._user(login, nom, role, CODE)

        # ── Personnel ISTA ─────────────────────────────────────────────────────
        PERS_ISTA = [
            ('IST_DIR01', 'KAMGA',     'Éric',       'M', 'DG',          'DIRECTION',   'CONTRACTUEL'),
            ('IST_DIR02', 'TCHOUAMO',  'Irène',      'F', 'DGA',         'DIRECTION',   'CONTRACTUEL'),
            ('IST_ADM01', 'FOMBA',     'Roland',     'M', 'SG',          'ADMIN',       'CONTRACTUEL'),
            ('IST_ADM02', 'NGUELE',    'Christine',  'F', 'DAF',         'ADMIN',       'CONTRACTUEL'),
            ('IST_PED01', 'ABENA',     'Michel',     'M', 'DES',         'PEDAGOGIQUE', 'CONTRACTUEL'),
            ('IST_ADM03', 'NKOA',      'Brigitte',   'F', 'RESP_SCOL',   'ADMIN',       'CONTRACTUEL'),
            ('IST_ADM04', 'TSAPI',     'Hervé',      'M', 'INFORMATICIEN','ADMIN',      'CONTRACTUEL'),
            ('IST_ADM05', 'ONANA',     'Cécile',     'F', 'COMPTABLE',   'ADMIN',       'CONTRACTUEL'),
            ('IST_ADM06', 'MBALLA',    'Joël',       'M', 'CAISSIER',    'ADMIN',       'CONTRACTUEL'),
            ('IST_ADM07', 'ELOUNDOU',  'Martine',    'F', 'AGENT_SCOL',  'ADMIN',       'CONTRACTUEL'),
            ('IST_ADM08', 'ETEME',     'Arlette',    'F', 'AGENT_SCOL',  'ADMIN',       'CONTRACTUEL'),
            ('IST_SOU01', 'BIYONG',    'Serge',      'M', 'GARDIEN',     'SOUTIEN',     'CONTRACTUEL'),
            ('IST_SOU02', 'AMOUGOU',   'Nadège',     'F', 'ENTRETIEN',   'SOUTIEN',     'CONTRACTUEL'),
            ('IST_SOU03', 'ONDOUA',    'Pauline',    'F', 'ENTRETIEN',   'SOUTIEN',     'CONTRACTUEL'),
        ]
        nb_pers = self._seed_personnel(etab, PERS_ISTA)
        self.stdout.write(f'  [OK] ISTA termine - 300 etudiants, 30 enseignants, {nb_pers} personnel')
        return {'eleves': 300, 'ens': len(ENS_ISTA), 'evals': nb_evals}

    # ── Personnel administratif ────────────────────────────────────────────────

    def _seed_personnel(self, etab, membres):
        """
        Crée les membres du personnel administratif et de soutien d'un établissement.
        membres : list de tuples (mle, nom, prenom, sexe, poste, categorie, contrat)
        """
        created = 0
        for mle, nom, prenom, sexe, poste, categorie, contrat in membres:
            _, is_new = Personnel.objects.get_or_create(
                mle_personnel=mle,
                defaults={
                    'etablissement': etab,
                    'nom':           nom,
                    'prenom':        prenom,
                    'sexe':          sexe,
                    'poste':         poste,
                    'categorie':     categorie,
                    'type_contrat':  contrat,
                    'actif':         True,
                }
            )
            if is_new:
                created += 1
        return created

    # ── SUPER_ADMIN ───────────────────────────────────────────────────────────

    def _super_admin(self):
        Utilisateur.objects.update_or_create(
            login='lucky_admin',
            defaults={
                'passwd':        DEMO_PWD,
                'nom_user':      'Lucky — Super Administrateur',
                'role':          'SUPER_ADMIN',
                'etablissement': None,
                'type_etab':     None,
            }
        )
        User.objects.get_or_create(
            username='lucky_admin',
            defaults={'is_active': True, 'is_staff': True, 'is_superuser': True}
        )
        self.stdout.write('  [OK] SUPER_ADMIN lucky_admin conserve/mis a jour')
