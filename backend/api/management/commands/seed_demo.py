"""
seed_demo.py — Données de démonstration SMS
Soutenance Licence Génie Logiciel — août 2026

Crée 3 établissements complets (Primaire / Secondaire / Supérieur)
avec structures académiques, étudiants et comptes utilisateurs.

Idempotent : relançable sans risque (get_or_create / update_or_create).

Usage :
    python manage.py seed_demo
"""
from datetime import date
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import (
    Annee, Pension, Tranche, Cycle, Niveau,
    Etablissement, Departement, Specialite, Classe,
    Etudiant, Enseignant, Inscription, Utilisateur, Personnel,
)

DEMO_PWD   = make_password('Demo2026!')
ANNEE_CODE = '2025-2026'

# ── Données élèves/étudiants ──────────────────────────────────────────────────
ELEVES_PRIMAIRE = [
    ('EL_CP01',  'Mbarga',   'Jean-Pierre',   'M'),
    ('EL_CP02',  'Nkoa',     'Cécile',        'F'),
    ('EL_CP03',  'Fouda',    'Martin',        'M'),
    ('EL_CP04',  'Essama',   'Angéline',      'F'),
    ('EL_CP05',  'Bello',    'David',         'M'),
    ('EL_CE101', 'Kamdem',   'Sylvie',        'F'),
    ('EL_CE102', 'Tchoupo',  'Arnaud',        'M'),
    ('EL_CE103', 'Nkengne',  'Laure',         'F'),
    ('EL_CE104', 'Talla',    'Richard',       'M'),
    ('EL_CE105', 'Samba',    'Odette',        'F'),
]

ELEVES_SECONDAIRE = [
    ('EL_6A01', 'Abanda',  'Nicolas',   'M'),
    ('EL_6A02', 'Kana',    'Marthe',    'F'),
    ('EL_6A03', 'Momo',    'Franck',    'M'),
    ('EL_6A04', 'Ndong',   'Brigitte',  'F'),
    ('EL_6A05', 'Zoa',     'Gaston',    'M'),
    ('EL_3B01', 'Effa',    'Corinne',   'F'),
    ('EL_3B02', 'Same',    'Lionel',    'M'),
    ('EL_3B03', 'Foe',     'Patricia',  'F'),
    ('EL_3B04', 'Nguele',  'Benjamin',  'M'),
    ('EL_3B05', 'Menye',   'Irène',     'F'),
]

ELEVES_SUPERIEUR = [
    ('ETU_ISLT01', 'Tsapi',   'Wilfried',   'M'),
    ('ETU_ISLT02', 'Wondji',  'Élodie',     'F'),
    ('ETU_ISLT03', 'Ekang',   'Cédric',     'M'),
    ('ETU_ISLT04', 'Djoya',   'Solange',    'F'),
    ('ETU_ISLT05', 'Nyemeck', 'Serge',      'M'),
    ('ETU_ISLT06', 'Oyono',   'Nadège',     'F'),
    ('ETU_ISLT07', 'Ewane',   'Maxime',     'M'),
    ('ETU_ISLT08', 'Akoa',    'Stéphanie',  'F'),
    ('ETU_ISLT09', 'Ngako',   'Kevin',      'M'),
    ('ETU_ISLT10', 'Mabou',   'Christine',  'F'),
]


class Command(BaseCommand):
    help = 'Peuple la base avec des données de démonstration (3 établissements)'

    def handle(self, *args, **options):
        with transaction.atomic():
            self._annee()
            self._seed_epbba()
            self._seed_lbnk()
            self._seed_islt()
            self._super_admin()

        self.stdout.write(self.style.SUCCESS(
            '\n✓ seed_demo terminé — 3 établissements + SUPER_ADMIN prêts.\n'
            '\n  Mot de passe commun : Demo2026!\n'
            '\n  SUPER_ADMIN  → lucky_admin\n'
            '  PRIMAIRE     → epbba_admin / epbba_ens / epbba_etud\n'
            '  SECONDAIRE   → lbnk_admin  / lbnk_ens  / lbnk_etud\n'
            '  SUPERIEUR    → islt_admin  / islt_ens  / islt_etud\n'
        ))

    # ── Helpers ───────────────────────────────────────────────────────────────

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

    def _user(self, login, nom, role, etab_code):
        """Crée ou réinitialise un compte SMS + le User Django associé (JWT)."""
        etab = Etablissement.objects.get(code_etab=etab_code)
        Utilisateur.objects.update_or_create(
            login=login,
            defaults={
                'passwd':       DEMO_PWD,
                'nom_user':     nom,
                'role':         role,
                'etablissement': etab,
                'type_etab':    None,
            }
        )
        User.objects.get_or_create(username=login, defaults={'is_active': True})

    def _inscrire(self, mle, nom, prenom, sexe, classe, etab):
        """Crée l'étudiant + inscription (une par année — contrainte unique)."""
        etud, _ = Etudiant.objects.get_or_create(
            mle_etudiant=mle,
            defaults={
                'nom': nom, 'prenom': prenom, 'sexe': sexe,
                'nationalite': 'Camerounaise',
                'etablissement': etab,
            }
        )
        Inscription.objects.get_or_create(
            mle_etudiant=etud,
            code_annee_id=ANNEE_CODE,
            defaults={'code_classe': classe, 'etablissement': etab}
        )
        return etud

    # ── ÉPBBA ── École Primaire Bilingue de Biyem-Assi ───────────────────────

    def _seed_epbba(self):
        CODE = 'EPBBA'
        etab, _ = Etablissement.objects.get_or_create(
            code_etab=CODE,
            defaults={
                'lib_etab':  "École Primaire Bilingue de Biyem-Assi",
                'sigle':     CODE,
                'type_etab': 'PRIMAIRE',
                'statut':    'PUBLIC',
                'systeme':   'BILINGUE',
                'region':    'CENTRE',
                'ville':     'Yaoundé',
                'adresse':   'Quartier Biyem-Assi, Yaoundé',
                'telephone': '+237 222 21 11 11',
                'directeur': 'M. Eboua Jean-Baptiste',
            }
        )

        pension, _ = Pension.objects.get_or_create(
            lib_pension='Scolarité Primaire EPBBA',
            defaults={
                'mt_pension': 45000, 'mt_inscription': 5000,
                'nb_tranche': 3, 'type_etab': 'PRIMAIRE',
            }
        )
        for i, mt in enumerate([20000, 15000, 10000], start=1):
            Tranche.objects.get_or_create(
                lib_tranche=f'T{i}', code_pension=pension,
                defaults={'mt_tranche': mt}
            )

        cycle, _ = Cycle.objects.get_or_create(
            code_cycle='CYC_PRI',
            defaults={'lib_cycle': 'Cycle Primaire', 'code_pension': pension, 'type_etab': 'PRIMAIRE'}
        )

        niv_cp, _ = Niveau.objects.get_or_create(
            lib_niveau='Cours Préparatoire (CP)', code_cycle=cycle,
            defaults={'code_pension': pension, 'code_annee_id': ANNEE_CODE, 'type_etab': 'PRIMAIRE'}
        )
        niv_ce1, _ = Niveau.objects.get_or_create(
            lib_niveau='Cours Élémentaire 1 (CE1)', code_cycle=cycle,
            defaults={'code_pension': pension, 'code_annee_id': ANNEE_CODE, 'type_etab': 'PRIMAIRE'}
        )

        dep, _ = Departement.objects.get_or_create(
            code_dep='DEP_EPBBA',
            defaults={'lib_dep': 'Enseignement Primaire', 'code_etab': etab, 'etablissement': etab}
        )
        sp, _ = Specialite.objects.get_or_create(
            code_sp='SP_EPBBA',
            defaults={'lib_sp': 'Formation Générale Primaire', 'code_dep': dep, 'etablissement': etab}
        )

        cl_cp, _ = Classe.objects.get_or_create(
            code_classe='EPBBA_CP',
            defaults={
                'lib_classe': 'CP A', 'code_dep': dep,
                'code_niveau': niv_cp, 'code_sp': sp,
                'eff_max': 40, 'etablissement': etab,
            }
        )
        cl_ce1, _ = Classe.objects.get_or_create(
            code_classe='EPBBA_CE1',
            defaults={
                'lib_classe': 'CE1 A', 'code_dep': dep,
                'code_niveau': niv_ce1, 'code_sp': sp,
                'eff_max': 40, 'etablissement': etab,
            }
        )

        Enseignant.objects.get_or_create(
            mle_ens='ENS_PRI01',
            defaults={
                'nom_ens': 'Atangana', 'prenom_ens': 'Marie-Claire',
                'sexe': 'F', 'statut': 'FONCTIONNAIRE',
                'tel_ens': '+237 677 11 22 33',
                'code_dep': dep, 'etablissement': etab,
            }
        )

        classes_map = [cl_cp] * 5 + [cl_ce1] * 5
        for (mle, nom, prenom, sexe), classe in zip(ELEVES_PRIMAIRE, classes_map):
            self._inscrire(mle, nom, prenom, sexe, classe, etab)

        self._user('epbba_admin', 'Administrateur EPBBA',   'ADMIN',      CODE)
        self._user('epbba_ens',   'Atangana Marie-Claire',   'ENSEIGNANT', CODE)
        self._user('epbba_etud',  'Mbarga Jean-Pierre',      'ETUDIANT',   CODE)
        self.stdout.write(f'  ✓ {CODE} — École Primaire Bilingue de Biyem-Assi')

    # ── LBNK ── Lycée Bilingue de Nkolbisson ─────────────────────────────────

    def _seed_lbnk(self):
        CODE = 'LBNK'
        etab, _ = Etablissement.objects.get_or_create(
            code_etab=CODE,
            defaults={
                'lib_etab':  'Lycée Bilingue de Nkolbisson',
                'sigle':     CODE,
                'type_etab': 'SECONDAIRE',
                'statut':    'PUBLIC',
                'systeme':   'BILINGUE',
                'region':    'CENTRE',
                'ville':     'Yaoundé',
                'adresse':   'Nkolbisson, Route de Bafoussam, Yaoundé',
                'telephone': '+237 222 32 44 55',
                'directeur': 'Mme Fouda Cécile-Marie',
            }
        )

        pension, _ = Pension.objects.get_or_create(
            lib_pension='Scolarité Secondaire LBNK',
            defaults={
                'mt_pension': 75000, 'mt_inscription': 10000,
                'nb_tranche': 3, 'type_etab': 'SECONDAIRE',
            }
        )
        for i, mt in enumerate([35000, 25000, 15000], start=1):
            Tranche.objects.get_or_create(
                lib_tranche=f'T{i}', code_pension=pension,
                defaults={'mt_tranche': mt}
            )

        cycle, _ = Cycle.objects.get_or_create(
            code_cycle='CYC_SEC',
            defaults={'lib_cycle': 'Cycle Secondaire', 'code_pension': pension, 'type_etab': 'SECONDAIRE'}
        )

        niv_6eme, _ = Niveau.objects.get_or_create(
            lib_niveau='Sixième (6ème)', code_cycle=cycle,
            defaults={'code_pension': pension, 'code_annee_id': ANNEE_CODE, 'type_etab': 'SECONDAIRE'}
        )
        niv_3eme, _ = Niveau.objects.get_or_create(
            lib_niveau='Troisième (3ème)', code_cycle=cycle,
            defaults={'code_pension': pension, 'code_annee_id': ANNEE_CODE, 'type_etab': 'SECONDAIRE'}
        )

        dep, _ = Departement.objects.get_or_create(
            code_dep='DEP_LBNK',
            defaults={'lib_dep': 'Enseignement Secondaire', 'code_etab': etab, 'etablissement': etab}
        )
        sp, _ = Specialite.objects.get_or_create(
            code_sp='SP_LBNK',
            defaults={'lib_sp': 'Formation Générale Secondaire', 'code_dep': dep, 'etablissement': etab}
        )

        cl_6a, _ = Classe.objects.get_or_create(
            code_classe='LBNK_6A',
            defaults={
                'lib_classe': '6ème A', 'code_dep': dep,
                'code_niveau': niv_6eme, 'code_sp': sp,
                'eff_max': 50, 'etablissement': etab,
            }
        )
        cl_3b, _ = Classe.objects.get_or_create(
            code_classe='LBNK_3B',
            defaults={
                'lib_classe': '3ème B', 'code_dep': dep,
                'code_niveau': niv_3eme, 'code_sp': sp,
                'eff_max': 50, 'etablissement': etab,
            }
        )

        Enseignant.objects.get_or_create(
            mle_ens='ENS_SEC01',
            defaults={
                'nom_ens': 'Fouda', 'prenom_ens': 'Bertrand-Alain',
                'sexe': 'M', 'statut': 'FONCTIONNAIRE',
                'tel_ens': '+237 699 55 66 77',
                'code_dep': dep, 'etablissement': etab,
            }
        )

        classes_map = [cl_6a] * 5 + [cl_3b] * 5
        for (mle, nom, prenom, sexe), classe in zip(ELEVES_SECONDAIRE, classes_map):
            self._inscrire(mle, nom, prenom, sexe, classe, etab)

        self._user('lbnk_admin', 'Administrateur LBNK',   'ADMIN',      CODE)
        self._user('lbnk_ens',   'Fouda Bertrand-Alain',   'ENSEIGNANT', CODE)
        self._user('lbnk_etud',  'Abanda Nicolas',         'ETUDIANT',   CODE)
        self.stdout.write(f'  ✓ {CODE} — Lycée Bilingue de Nkolbisson')

    # ── ISLT ── Institut Supérieur LuckyTech ─────────────────────────────────

    def _seed_islt(self):
        CODE = 'ISLT'
        etab, _ = Etablissement.objects.get_or_create(
            code_etab=CODE,
            defaults={
                'lib_etab':  'Institut Supérieur LuckyTech',
                'sigle':     CODE,
                'type_etab': 'SUPERIEUR',
                'statut':    'PRIVE_LAIQUE',
                'systeme':   'BILINGUE',
                'region':    'CENTRE',
                'ville':     'Yaoundé',
                'adresse':   'Quartier Bastos, Avenue des Ambassades, Yaoundé',
                'telephone': '+237 222 20 30 40',
                'email':     'contact@luckytech.cm',
                'directeur': 'Prof. Nkoa Robert-Gilles',
            }
        )

        pension, _ = Pension.objects.get_or_create(
            lib_pension='Scol. Licence ISLT',
            defaults={
                'mt_pension': 350000, 'mt_inscription': 25000,
                'nb_tranche': 3, 'type_etab': 'SUPERIEUR',
            }
        )
        for i, mt in enumerate([150000, 100000, 100000], start=1):
            Tranche.objects.get_or_create(
                lib_tranche=f'T{i}', code_pension=pension,
                defaults={'mt_tranche': mt}
            )

        cycle, _ = Cycle.objects.get_or_create(
            code_cycle='CYC_LMD',
            defaults={'lib_cycle': 'Licence-Master-Doctorat (LMD)', 'code_pension': pension, 'type_etab': 'SUPERIEUR'}
        )

        niv_l1, _ = Niveau.objects.get_or_create(
            lib_niveau='Licence 1 (L1)', code_cycle=cycle,
            defaults={'code_pension': pension, 'code_annee_id': ANNEE_CODE, 'type_etab': 'SUPERIEUR'}
        )
        niv_l2, _ = Niveau.objects.get_or_create(
            lib_niveau='Licence 2 (L2)', code_cycle=cycle,
            defaults={'code_pension': pension, 'code_annee_id': ANNEE_CODE, 'type_etab': 'SUPERIEUR'}
        )
        niv_l3, _ = Niveau.objects.get_or_create(
            lib_niveau='Licence 3 (L3)', code_cycle=cycle,
            defaults={'code_pension': pension, 'code_annee_id': ANNEE_CODE, 'type_etab': 'SUPERIEUR'}
        )

        dep_gi, _ = Departement.objects.get_or_create(
            code_dep='DEP_GI',
            defaults={'lib_dep': 'Génie Informatique', 'code_etab': etab, 'etablissement': etab}
        )
        dep_gc, _ = Departement.objects.get_or_create(
            code_dep='DEP_GC',
            defaults={'lib_dep': 'Génie Civil', 'code_etab': etab, 'etablissement': etab}
        )

        sp_lgi, _ = Specialite.objects.get_or_create(
            code_sp='SP_LGI',
            defaults={'lib_sp': 'Licence Génie Informatique', 'code_dep': dep_gi, 'etablissement': etab}
        )
        Specialite.objects.get_or_create(
            code_sp='SP_LGC',
            defaults={'lib_sp': 'Licence Génie Civil', 'code_dep': dep_gc, 'etablissement': etab}
        )
        Specialite.objects.get_or_create(
            code_sp='SP_MGI',
            defaults={'lib_sp': 'Master Génie Informatique', 'code_dep': dep_gi, 'etablissement': etab}
        )

        cl_l1, _ = Classe.objects.get_or_create(
            code_classe='ISLT_L1GI',
            defaults={
                'lib_classe': 'L1 — Génie Informatique', 'code_dep': dep_gi,
                'code_niveau': niv_l1, 'code_sp': sp_lgi,
                'eff_max': 40, 'etablissement': etab,
            }
        )
        cl_l2, _ = Classe.objects.get_or_create(
            code_classe='ISLT_L2GI',
            defaults={
                'lib_classe': 'L2 — Génie Informatique', 'code_dep': dep_gi,
                'code_niveau': niv_l2, 'code_sp': sp_lgi,
                'eff_max': 35, 'etablissement': etab,
            }
        )
        cl_l3, _ = Classe.objects.get_or_create(
            code_classe='ISLT_L3GI',
            defaults={
                'lib_classe': 'L3 — Génie Informatique', 'code_dep': dep_gi,
                'code_niveau': niv_l3, 'code_sp': sp_lgi,
                'eff_max': 30, 'etablissement': etab,
            }
        )

        Enseignant.objects.get_or_create(
            mle_ens='ENS_SUP01',
            defaults={
                'nom_ens': 'Nkoa', 'prenom_ens': 'Robert-Gilles',
                'sexe': 'M', 'statut': 'PERMANENT',
                'tel_ens': '+237 696 88 99 00',
                'email_ens': 'nkoa.robert@luckytech.cm',
                'code_dep': dep_gi, 'etablissement': etab,
            }
        )

        classes_map = [cl_l1] * 4 + [cl_l2] * 3 + [cl_l3] * 3
        for (mle, nom, prenom, sexe), classe in zip(ELEVES_SUPERIEUR, classes_map):
            self._inscrire(mle, nom, prenom, sexe, classe, etab)

        self._user('islt_admin', 'Administrateur LuckyTech', 'ADMIN',      CODE)
        self._user('islt_ens',   'Nkoa Robert-Gilles',       'ENSEIGNANT', CODE)
        self._user('islt_etud',  'Tsapi Wilfried',            'ETUDIANT',   CODE)

        self._seed_personnel_islt(etab)
        self.stdout.write(f'  ✓ {CODE} — Institut Supérieur LuckyTech')

    # ── Personnel ISLT ────────────────────────────────────────────────────────

    def _seed_personnel_islt(self, etab):
        """Personnel administratif de l'ISLT — 15 agents réalistes."""

        # (mle, nom, prenom, sexe, date_naiss, lieu_naiss, tel, email,
        #  poste, categorie, type_contrat, date_embauche, matricule_fonct)
        STAFF = [
            # ── Direction ────────────────────────────────────────────────────
            ('ISLT_P01', 'Nkoa',       'Robert-Gilles', 'M',
             date(1968, 3, 14), 'Yaoundé',
             '+237 696 88 99 00', 'dg@luckytech.cm',
             'DG', 'DIRECTION', 'TITULAIRE', date(2010, 9, 1), 'FONC-DG-001'),

            ('ISLT_P02', 'Atangana',   'Béatrice',      'F',
             date(1974, 7, 22), 'Mbalmayo',
             '+237 677 55 44 33', 'dga@luckytech.cm',
             'DGA', 'DIRECTION', 'TITULAIRE', date(2012, 1, 15), 'FONC-DGA-002'),

            ('ISLT_P03', 'Essomba',    'Hyacinthe',     'M',
             date(1971, 11, 5), 'Ebolowa',
             '+237 699 11 22 33', 'sg@luckytech.cm',
             'SG', 'DIRECTION', 'TITULAIRE', date(2011, 2, 1), 'FONC-SG-003'),

            ('ISLT_P04', 'Mfoumou',    'Clarisse',      'F',
             date(1980, 4, 18), 'Bafoussam',
             '+237 675 66 77 88', 'daf@luckytech.cm',
             'DAF', 'DIRECTION', 'TITULAIRE', date(2014, 9, 1), 'FONC-DAF-004'),

            ('ISLT_P05', 'Zang',       'Martial',       'M',
             date(1977, 8, 30), 'Sangmélima',
             '+237 691 33 44 55', 'des@luckytech.cm',
             'DES', 'DIRECTION', 'CONTRACTUEL', date(2015, 9, 1), 'FONC-DES-005'),

            # ── Encadrement pédagogique ───────────────────────────────────────
            ('ISLT_P06', 'Nguele',     'François-Xavier','M',
             date(1975, 2, 12), 'Douala',
             '+237 694 22 33 44', 'fxnguele@luckytech.cm',
             'CHEF_DEP', 'PEDAGOGIQUE', 'TITULAIRE', date(2013, 9, 1), 'FONC-CD-006'),

            ('ISLT_P07', 'Biyong',     'Sylviane',       'F',
             date(1983, 6, 9), 'Bafia',
             '+237 678 99 00 11', 'sbiyong@luckytech.cm',
             'CHEF_DEP', 'PEDAGOGIQUE', 'CONTRACTUEL', date(2017, 9, 1), 'FONC-CD-007'),

            # ── Administration ────────────────────────────────────────────────
            ('ISLT_P08', 'Tchibozo',   'Patience',      'F',
             date(1989, 1, 25), 'Ngaoundéré',
             '+237 671 88 99 00', 'scolarite@luckytech.cm',
             'RESP_SCOL', 'ADMIN', 'CONTRACTUEL', date(2018, 9, 1), ''),

            ('ISLT_P09', 'Momo',       'Christian',     'M',
             date(1985, 10, 3), 'Foumban',
             '+237 655 44 55 66', 'compta@luckytech.cm',
             'COMPTABLE', 'ADMIN', 'CONTRACTUEL', date(2016, 1, 10), ''),

            ('ISLT_P10', 'Kana',       'Élise',         'F',
             date(1992, 5, 17), 'Kribi',
             '+237 698 77 88 99', 'caisse@luckytech.cm',
             'CAISSIER', 'ADMIN', 'CONTRACTUEL', date(2020, 9, 1), ''),

            ('ISLT_P11', 'Fomekong',   'Rodrigue',      'M',
             date(1991, 3, 28), 'Dschang',
             '+237 677 33 44 55', 'it@luckytech.cm',
             'INFORMATICIEN', 'ADMIN', 'CONTRACTUEL', date(2019, 9, 1), ''),

            ('ISLT_P12', 'Mbarga',     'Annette',       'F',
             date(1994, 9, 11), 'Yaoundé',
             '+237 654 11 22 33', 'scol2@luckytech.cm',
             'AGENT_SCOL', 'ADMIN', 'VACATAIRE', date(2022, 9, 1), ''),

            # ── Soutien / service ─────────────────────────────────────────────
            ('ISLT_P13', 'Owona',      'Théophile',     'M',
             date(1987, 12, 20), 'Obala',
             '+237 693 00 11 22', '', 'BIBLIOTHECAIRE',
             'SOUTIEN', 'CONTRACTUEL', date(2017, 2, 1), ''),

            ('ISLT_P14', 'Ayissi',     'Marguerite',    'F',
             date(1990, 7, 8), 'Mfou',
             '+237 670 55 66 77', '', 'ENTRETIEN',
             'SOUTIEN', 'VACATAIRE', date(2021, 9, 1), ''),

            ('ISLT_P15', 'Nyamsi',     'Boniface',      'M',
             date(1982, 4, 2), 'Edéa',
             '+237 699 44 55 66', '', 'GARDIEN',
             'SOUTIEN', 'CONTRACTUEL', date(2015, 6, 1), ''),
        ]

        for row in STAFF:
            (mle, nom, prenom, sexe, date_naiss, lieu_naiss,
             tel, email, poste, categorie, type_contrat,
             date_embauche, matricule_fonct) = row
            Personnel.objects.get_or_create(
                mle_personnel=mle,
                defaults={
                    'etablissement':    etab,
                    'nom':              nom,
                    'prenom':           prenom,
                    'sexe':             sexe,
                    'date_naiss':       date_naiss,
                    'lieu_naiss':       lieu_naiss,
                    'tel':              tel,
                    'email':            email,
                    'adresse':          'Quartier Bastos, Yaoundé',
                    'poste':            poste,
                    'categorie':        categorie,
                    'type_contrat':     type_contrat,
                    'date_embauche':    date_embauche,
                    'matricule_fonct':  matricule_fonct,
                    'actif':            True,
                }
            )

    # ── SUPER_ADMIN ───────────────────────────────────────────────────────────

    def _super_admin(self):
        u, created = Utilisateur.objects.update_or_create(
            login='lucky_admin',
            defaults={
                'passwd':       DEMO_PWD,
                'nom_user':     'Lucky — Super Administrateur',
                'role':         'SUPER_ADMIN',
                'etablissement': None,
                'type_etab':    None,
            }
        )
        User.objects.get_or_create(
            username='lucky_admin',
            defaults={'is_active': True, 'is_staff': True, 'is_superuser': True}
        )
        self.stdout.write(f'  ✓ SUPER_ADMIN lucky_admin {"(créé)" if created else "(mis à jour)"}')
