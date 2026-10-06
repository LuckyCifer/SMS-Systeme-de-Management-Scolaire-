"""
seed_personnel_esmata.py — Personnel administratif de l'ESMATA (ETAB001)
Ecole Supérieure de Management et des Technologies Appliquées

Idempotent : relançable sans risque (get_or_create).

Usage :
    python manage.py seed_personnel_esmata
"""
from datetime import date
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Etablissement, Personnel

ETAB_CODE = 'ETAB001'


class Command(BaseCommand):
    help = 'Ajoute 15 agents de personnel réalistes à l\'ESMATA (ETAB001)'

    def handle(self, *args, **options):
        try:
            etab = Etablissement.objects.get(code_etab=ETAB_CODE)
        except Etablissement.DoesNotExist:
            self.stdout.write(self.style.ERROR(
                f'Etablissement {ETAB_CODE} introuvable. '
                'Vérifiez que l\'ESMATA est bien en base.'
            ))
            return

        # (mle, nom, prenom, sexe, date_naiss, lieu_naiss, tel, email,
        #  poste, categorie, type_contrat, date_embauche, matricule_fonct)
        STAFF = [
            # ── Direction ─────────────────────────────────────────────────────
            ('ESMT_P01', 'Abomo',       'Pierre-Alain',  'M',
             date(1965, 5, 20), 'Yaoundé',
             '+237 699 10 20 30', 'dg@esmata.cm',
             'DG', 'DIRECTION', 'TITULAIRE', date(2008, 9, 1), 'FONC-DG-001'),

            ('ESMT_P02', 'Ebongue',     'Nadine',        'F',
             date(1972, 9, 14), 'Douala',
             '+237 677 40 50 60', 'dga@esmata.cm',
             'DGA', 'DIRECTION', 'TITULAIRE', date(2010, 1, 10), 'FONC-DGA-002'),

            ('ESMT_P03', 'Ondoua',      'Léopold',       'M',
             date(1969, 3, 8), 'Mbalmayo',
             '+237 696 70 80 90', 'sg@esmata.cm',
             'SG', 'DIRECTION', 'TITULAIRE', date(2009, 9, 1), 'FONC-SG-003'),

            ('ESMT_P04', 'Toukam',      'Ghislaine',     'F',
             date(1978, 11, 25), 'Bafoussam',
             '+237 675 11 22 33', 'daf@esmata.cm',
             'DAF', 'DIRECTION', 'TITULAIRE', date(2013, 2, 1), 'FONC-DAF-004'),

            ('ESMT_P05', 'Mekoulou',    'Guy-Serge',     'M',
             date(1974, 7, 3), 'Kribi',
             '+237 691 44 55 66', 'des@esmata.cm',
             'DES', 'DIRECTION', 'CONTRACTUEL', date(2014, 9, 1), 'FONC-DES-005'),

            # ── Encadrement pédagogique ────────────────────────────────────────
            ('ESMT_P06', 'Ngoumou',     'Arsène',        'M',
             date(1973, 1, 17), 'Ebolowa',
             '+237 693 22 33 44', 'angoumou@esmata.cm',
             'CHEF_DEP', 'PEDAGOGIQUE', 'TITULAIRE', date(2012, 9, 1), 'FONC-CD-006'),

            ('ESMT_P07', 'Djoukouo',    'Christelle',    'F',
             date(1981, 4, 29), 'Dschang',
             '+237 678 55 66 77', 'cdjoukouo@esmata.cm',
             'CHEF_DEP', 'PEDAGOGIQUE', 'CONTRACTUEL', date(2016, 9, 1), 'FONC-CD-007'),

            # ── Administration ─────────────────────────────────────────────────
            ('ESMT_P08', 'Mvogo',       'Carine',        'F',
             date(1988, 6, 12), 'Sangmélima',
             '+237 670 88 99 00', 'scolarite@esmata.cm',
             'RESP_SCOL', 'ADMIN', 'CONTRACTUEL', date(2017, 9, 1), ''),

            ('ESMT_P09', 'Kouam',       'Joël',          'M',
             date(1984, 2, 21), 'Bafia',
             '+237 655 77 88 99', 'compta@esmata.cm',
             'COMPTABLE', 'ADMIN', 'CONTRACTUEL', date(2015, 3, 1), ''),

            ('ESMT_P10', 'Nkemdirim',   'Lydie',         'F',
             date(1993, 8, 6), 'Ngaoundéré',
             '+237 697 33 44 55', 'caisse@esmata.cm',
             'CAISSIER', 'ADMIN', 'CONTRACTUEL', date(2019, 9, 1), ''),

            ('ESMT_P11', 'Tchatchoua',  'Kevin',         'M',
             date(1990, 10, 15), 'Foumban',
             '+237 676 11 22 33', 'it@esmata.cm',
             'INFORMATICIEN', 'ADMIN', 'CONTRACTUEL', date(2018, 9, 1), ''),

            ('ESMT_P12', 'Bello',       'Odette-Marie',  'F',
             date(1995, 3, 30), 'Maroua',
             '+237 654 66 77 88', 'scol2@esmata.cm',
             'AGENT_SCOL', 'ADMIN', 'VACATAIRE', date(2021, 9, 1), ''),

            # ── Soutien / service ──────────────────────────────────────────────
            ('ESMT_P13', 'Foe',         'Véronique',     'F',
             date(1986, 5, 24), 'Obala',
             '+237 692 99 00 11', '', 'BIBLIOTHECAIRE',
             'SOUTIEN', 'CONTRACTUEL', date(2016, 9, 1), ''),

            ('ESMT_P14', 'Mbida',       'Prosper',       'M',
             date(1988, 12, 11), 'Edéa',
             '+237 671 44 55 66', '', 'ENTRETIEN',
             'SOUTIEN', 'VACATAIRE', date(2020, 9, 1), ''),

            ('ESMT_P15', 'Ntouba',      'Adolphe',       'M',
             date(1980, 9, 18), 'Mfou',
             '+237 698 22 33 44', '', 'GARDIEN',
             'SOUTIEN', 'CONTRACTUEL', date(2013, 1, 15), ''),
        ]

        created_count = 0
        with transaction.atomic():
            for row in STAFF:
                (mle, nom, prenom, sexe, date_naiss, lieu_naiss,
                 tel, email, poste, categorie, type_contrat,
                 date_embauche, matricule_fonct) = row
                _, created = Personnel.objects.get_or_create(
                    mle_personnel=mle,
                    defaults={
                        'etablissement':   etab,
                        'nom':             nom,
                        'prenom':          prenom,
                        'sexe':            sexe,
                        'date_naiss':      date_naiss,
                        'lieu_naiss':      lieu_naiss,
                        'tel':             tel,
                        'email':           email,
                        'adresse':         'Centre-ville, Yaoundé',
                        'poste':           poste,
                        'categorie':       categorie,
                        'type_contrat':    type_contrat,
                        'date_embauche':   date_embauche,
                        'matricule_fonct': matricule_fonct,
                        'actif':           True,
                    }
                )
                if created:
                    created_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'\nPersonnel ESMATA ({ETAB_CODE}) : '
            f'{created_count} agent(s) cree(s), '
            f'{len(STAFF) - created_count} deja existant(s).\n'
            '\n  Direction    : DG, DGA, SG, DAF, DES'
            '\n  Pedagogique  : 2 Chefs de Departement'
            '\n  Administration : Resp. Scolarite, Comptable, Caissier, Informaticien, Agent Scol.'
            '\n  Soutien      : Bibliothecaire, Entretien, Gardien\n'
        ))
