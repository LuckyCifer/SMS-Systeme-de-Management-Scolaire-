"""
seed_complet.py — Seed complet et réaliste pour SMS
Crée: bâtiments/salles, filières, niveaux 2-5, pensions,
classes (5 niveaux × 30 spécialités), enseignants, matières,
cours (+ tronc commun en amphi), 50 étudiants par filière,
inscriptions, évaluations, séances, paiements, factures,
décisions, stages et rapports statistiques.
"""
import random
from datetime import date, time, timedelta, datetime
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import (
    Annee, Batiment, Salle, Module, Cycle, Pension, Tranche, Niveau,
    Departement, Specialite, Classe, Enseignant, Etudiant, Inscription,
    Matiere, Cours, Periode, TypeEvaluation,
    Evaluation, Seance, Absence,
    Facture, FactureDetail, Paiement,
    Decision, Stage, RapportStatistique,
)

SEED = 42
ANNEE = '2025-2026'

# ── Noms camerounais réalistes ────────────────────────────────────────────────
NOMS = [
    "Atangana","Mbarga","Nkoa","Fouda","Essama","Bello","Dang","Kamdem",
    "Tchoupo","Nkengne","Talla","Samba","Bopda","Ango","Eyebe","Ngono",
    "Etaba","Ondoua","Nsangou","Mbida","Abanda","Kana","Tezanou","Momo",
    "Ndong","Zoa","Effa","Same","Foe","Nguele","Menye","Tsapi","Wondji",
    "Ekang","Djoya","Nyemeck","Oyono","Ewane","Akoa","Ngako","Mabou",
    "Ekodeck","Tsafack","Ngoumba","Lontsi","Embolo","Ntonga","Takam",
    "Eloundou","Manga","Sone","Fonyam","Bikam","Datchoua","Abomo",
    "Kuetche","Tambe","Nkoulou","Bingono","Mbele","Temgoua","Pamba",
    "Beyala","Mouchingando","Ombessa","Njuki","Dibango","Fonkeng","Nono",
    "Fongang","Eboua","Yemet","Wandji","Noumbi","Djoumessi","Djimbele",
    "Abeng","Nanga","Yemele","Tibah","Kom","Teguia","Inack","Hameni",
    "Ndjana","Mengue","Mouafo","Sindeu","Ntamag","Djomla","Ketchemen",
    "Balla","Njoya","Tchoffo","Mvomo","Nyobe","Ekani","Mba","Nkodo",
    "Akoua","Nnomo","Obam","Kamga",
]
PRENOMS_M = [
    "Alain","Arnaud","Bertrand","Calvin","Cédric","Christian","Claude",
    "Daniel","David","Désiré","Dieudonné","Edgar","Etienne","Fabrice",
    "Franck","Gaston","Ghislain","Guillaume","Henri","Jacques","Jean-Claude",
    "Jean-Marc","Joël","Jonas","Joseph","Kévin","Landry","Laurent","Lionel",
    "Loïc","Marc","Martin","Maxime","Michel","Nicolas","Olivier","Patrick",
    "Paul","Philippe","Pierre","Richard","Roland","Samuel","Serge","Simon",
    "Stéphane","Thierry","Thomas","Valentin","Victor","Wilfried","Yannick",
]
PRENOMS_F = [
    "Adèle","Albertine","Amandine","Angeline","Aurélie","Béatrice",
    "Bénédicte","Brigitte","Cécile","Christelle","Christine","Claire",
    "Claudine","Corinne","Danielle","Delphine","Diane","Dominique",
    "Edith","Florence","Francine","Ghislaine","Gisèle","Hortense","Irène",
    "Isabelle","Jacqueline","Jessica","Joëlle","Julie","Laure","Léa",
    "Liliane","Lucie","Madeleine","Marie","Marlène","Martine","Nadia",
    "Nicole","Odette","Olivia","Patricia","Rachelle","Régine","Sandra",
    "Sarah","Sophie","Stéphanie","Suzanne","Thérèse","Véronique",
]
VILLES = ["Yaoundé","Douala","Bafoussam","Bamenda","Garoua","Ngaoundéré",
          "Bertoua","Ebolowa","Dschang","Foumban","Kribi","Buéa","Limbé"]
REGIONS = ["Centre","Littoral","Ouest","Nord-Ouest","Adamaoua","Nord",
           "Extrême-Nord","Sud-Ouest","Sud","Est"]
LIEUX_NAISS = ["Yaoundé","Douala","Bafoussam","Bamenda","Maroua","Garoua",
               "Ngaoundéré","Bertoua","Ebolowa","Kribi","Buéa","Nkongsamba"]
ENTREPRISES = [
    ("CAMTEL","Télécoms","Yaoundé"),("Orange Cameroun","Mobile","Douala"),
    ("MTN Cameroun","Mobile","Douala"),("SCDP","Pétrole","Douala"),
    ("ENEO","Énergie","Douala"),("CICAM","Textile","Garoua"),
    ("CDC","Agriculture","Buéa"),("HYSACAM","Environnement","Yaoundé"),
    ("BICEC","Banque","Yaoundé"),("Afriland First Bank","Banque","Yaoundé"),
    ("GIZ Cameroun","Coopération","Yaoundé"),("MINPOSTEL","TIC","Yaoundé"),
    ("LABOGENIE","BTP","Yaoundé"),("COTCO","Pipeline","Douala"),
    ("Total Energies CM","Pétrole","Douala"),("Brasseries du Cameroun","IAA","Douala"),
    ("CHANIMETAL","Métallurgie","Douala"),("SOCAPALM","Agriculture","Douala"),
    ("Pharmacam","Pharmaceutique","Yaoundé"),("SNEC","Eau","Yaoundé"),
]

# ── Sujets de stage réalistes ─────────────────────────────────────────────────
SUJETS_STAGE = {
    'GI': ["Développement d'une application web","Mise en place d'une infrastructure réseau",
           "Analyse et sécurisation d'un système informatique","Implémentation d'une base de données",
           "Développement d'une application mobile","Mise en place d'un système ERP"],
    'GCG': ["Audit financier d'une PME","Mise en place d'une stratégie marketing",
            "Étude de faisabilité d'un projet commercial","Optimisation de la chaîne logistique",
            "Analyse de la politique RH d'une entreprise"],
    'GIT': ["Diagnostic et maintenance d'équipements industriels","Étude d'un système automatisé",
            "Mise en place d'un plan de maintenance préventive","Optimisation d'une ligne de production"],
    'GSS': ["Étude épidémiologique en milieu hospitalier","Analyse de la qualité des soins infirmiers",
            "Étude de la prévalence d'une pathologie","Mise en place d'un protocole de soins"],
    'GAE': ["Étude agropastorale d'un terroir","Analyse des pratiques agricoles durables",
            "Diagnostic d'une exploitation agricole","Étude de l'impact environnemental"],
    'GCM': ["Conception d'une campagne de communication","Réalisation d'un reportage documentaire",
            "Analyse de la stratégie médias d'une organisation"],
    'GHT': ["Amélioration de la qualité de service hôtelier","Étude de faisabilité d'un restaurant",
            "Élaboration d'un circuit touristique régional"],
    'GJA': ["Analyse d'un contentieux commercial","Étude comparative de textes juridiques",
            "Accompagnement dans une procédure administrative"],
}


class Command(BaseCommand):
    help = 'Seed complet et réaliste de toute application SMS'

    def handle(self, *args, **options):
        random.seed(SEED)
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== SEED COMPLET SMS ===\n'))
        annee = Annee.objects.get(code_annee=ANNEE)
        with transaction.atomic():
            self._batiments_salles()
            self._modules()
            pensions = self._pensions_niveaux(annee)
            classes_map = self._classes(pensions, annee)
            enseignants = self._enseignants()
            matieres = self._matieres()
            self._cours(classes_map, matieres, enseignants, annee)
            etudiants_map = self._etudiants(classes_map)
            self._inscriptions(etudiants_map, classes_map, annee, pensions)
            self._evaluations(annee)
            self._seances(annee)
            self._paiements_factures(annee, pensions)
            self._decisions(annee)
            self._stages(annee)
            self._rapports_stats(annee)
        self.stdout.write(self.style.SUCCESS('\n=== SEED TERMINE AVEC SUCCES ==='))

    # ── helpers ───────────────────────────────────────────────────────────────
    def _log(self, msg): self.stdout.write(f'  {msg}')
    def _head(self, msg): self.stdout.write(self.style.HTTP_INFO(f'\n[*] {msg}'))

    # ── 1. Bâtiments & salles ─────────────────────────────────────────────────
    def _batiments_salles(self):
        self._head('Batiments et Salles')
        bats = [
            ('BAT-A','Bat A - Cours'),
            ('BAT-B','Bat B - Travaux Prat.'),
            ('BAT-C','Bat C - Administration'),
            ('BAT-D','Bat D - Amphitheatres'),
            ('BAT-E','Bat E - Laboratoires'),
        ]
        for code, lib in bats:
            _, c = Batiment.objects.get_or_create(code_bat=code, defaults={'lib_bat': lib})
            if c: self._log(f'Batiment: {lib}')

        salles = [
            ('A101','Salle A101'),('A102','Salle A102'),('A103','Salle A103'),
            ('A201','Salle A201'),('A202','Salle A202'),('A203','Salle A203'),
            ('A301','Salle A301'),('A302','Salle A302'),('A303','Salle A303'),
            ('B101','Labo Info 1'),('B102','Labo Info 2'),('B103','Labo Info 3'),
            ('B201','Atelier Mec'),('B202','Atelier Elec'),('B301','Labo Chimie'),
            ('AMPH1','Amphi 1 - 300pl'),('AMPH2','Amphi 2 - 200pl'),
            ('LAB1','Laboratoire 1'),('LAB2','Laboratoire 2'),
        ]
        for code, lib in salles:
            Salle.objects.get_or_create(code_salle=code, defaults={'lib_salle': lib})
        self._log(f'{len(salles)} salles verifiees')

    # ── 2. Modules ────────────────────────────────────────────────────────────
    def _modules(self):
        self._head('Modules')
        mods = [
            ('AGRONOM','Agriculture et Environnement'),
            ('BIOMEDIC','Biomédical et Santé'),
            ('COMMUNIC','Communication et Médias'),
            ('DROIT','Sciences Juridiques'),
            ('ELECTRICT','Génie Electrique'),
            ('GESTION','Gestion et Commerce'),
            ('HOTEL','Hotellerie et Tourisme'),
            ('INDUSTRI','Génie Industriel'),
            ('TRONC','Tronc Commun'),
        ]
        for code, lib in mods:
            _, c = Module.objects.get_or_create(code_module=code, defaults={'lib_module': lib})
            if c: self._log(f'Module: {lib}')

    # ── 3. Pensions & Niveaux 2-5 ─────────────────────────────────────────────
    def _pensions_niveaux(self, annee):
        self._head('Pensions et Niveaux 2-5')
        pensions_data = [
            (2, 'Licence 2',  420000, 55000, 3, 'LIC', [(210000,'T1 L2'),(150000,'T2 L2'),(60000,'T3 L2')]),
            (3, 'Licence 3',  440000, 60000, 3, 'LIC', [(220000,'T1 L3'),(155000,'T2 L3'),(65000,'T3 L3')]),
            (4, 'Master 1',   500000, 75000, 3, 'MAS', [(250000,'T1 M1'),(175000,'T2 M1'),(75000,'T3 M1')]),
            (5, 'Master 2',   550000, 80000, 3, 'MAS', [(275000,'T1 M2'),(190000,'T2 M2'),(85000,'T3 M2')]),
        ]
        pensions = {1: Pension.objects.get(code_pension=1)}
        for code_p, lib_n, mt, mt_ins, nb_t, cycle_code, tranches in pensions_data:
            cycle = Cycle.objects.get(code_cycle=cycle_code)
            p, c = Pension.objects.get_or_create(
                code_pension=code_p,
                defaults={'lib_pension': lib_n, 'mt_pension': mt,
                          'mt_inscription': mt_ins, 'nb_tranche': nb_t},
            )
            if c: self._log(f'Pension {code_p}: {lib_n} ({mt:,} FCFA)')
            pensions[code_p] = p
            for mt_t, lib_t in tranches:
                Tranche.objects.get_or_create(
                    code_pension=p, lib_tranche=lib_t,
                    defaults={'mt_tranche': mt_t},
                )
            niv_code = code_p
            _, cn = Niveau.objects.get_or_create(
                code_niveau=niv_code,
                defaults={'lib_niveau': f'Niveau {niv_code}', 'code_cycle': cycle,
                          'code_pension': p, 'code_annee': annee},
            )
            if cn: self._log(f'Niveau {niv_code} cree')
        return pensions

    # ── 4. Classes (toutes specialites × niveaux 1-5) ─────────────────────────
    def _classes(self, pensions, annee):
        self._head('Classes (30 specialites x 5 niveaux)')
        niveaux = {n.code_niveau: n for n in Niveau.objects.all()}
        specialites = list(Specialite.objects.select_related('code_dep').all())
        salle_def = Salle.objects.filter(code_salle='A101').first()
        classes_map = {}  # (sp_code, niveau) -> Classe

        existing = {c.code_classe: c for c in Classe.objects.all()}
        for sp in specialites:
            for niv_num in range(1, 6):
                code_cl = f'L{sp.code_sp}{niv_num}'
                if len(code_cl) > 10:
                    code_cl = f'L{sp.code_sp[:7]}{niv_num}'
                niv = niveaux.get(niv_num)
                if not niv:
                    continue
                if code_cl in existing:
                    classes_map[(sp.code_sp, niv_num)] = existing[code_cl]
                else:
                    lib = f'{sp.lib_sp} - Niveau {niv_num}'
                    cl = Classe.objects.create(
                        code_classe=code_cl,
                        lib_classe=lib,
                        code_dep=sp.code_dep,
                        code_sp=sp,
                        code_niveau=niv,
                        eff_max=40,
                        code_salle=salle_def,
                    )
                    classes_map[(sp.code_sp, niv_num)] = cl
                    existing[code_cl] = cl

        nb = Classe.objects.count()
        self._log(f'Total classes en base: {nb}')
        return classes_map

    # ── 5. Enseignants ────────────────────────────────────────────────────────
    def _enseignants(self):
        self._head('Enseignants')
        deps = {d.code_dep: d for d in Departement.objects.all()}
        ens_data = [
            # GI
            ('ENS012','Nkoa','Jean-Pierre','M','GI','PERMANENT'),
            ('ENS013','Ondoua','Rosine','F','GI','VACATAIRE'),
            ('ENS014','Mbarga','Patrick','M','GI','CONTRACTUEL'),
            ('ENS015','Tsapi','Cédric','M','GI','PERMANENT'),
            ('ENS016','Foe','Isabelle','F','GI','VACATAIRE'),
            # GCG
            ('ENS017','Atangana','Maurice','M','GCG','PERMANENT'),
            ('ENS018','Beyala','Claudine','F','GCG','CONTRACTUEL'),
            ('ENS019','Djoumessi','René','M','GCG','VACATAIRE'),
            ('ENS020','Ekang','Joelle','F','GCG','PERMANENT'),
            ('ENS021','Fouda','Simon','M','GCG','CONTRACTUEL'),
            # GIT
            ('ENS022','Bopda','Armand','M','GIT','PERMANENT'),
            ('ENS023','Eloundou','Thérèse','F','GIT','VACATAIRE'),
            ('ENS024','Essama','Gaston','M','GIT','CONTRACTUEL'),
            ('ENS025','Kana','Viviane','F','GIT','PERMANENT'),
            ('ENS026','Lontsi','Bertrand','M','GIT','VACATAIRE'),
            ('ENS027','Mabou','Serge','M','GIT','CONTRACTUEL'),
            # GSS
            ('ENS028','Menye','Adèle','F','GSS','PERMANENT'),
            ('ENS029','Ngono','Fabrice','M','GSS','VACATAIRE'),
            ('ENS030','Ntonga','Béatrice','F','GSS','CONTRACTUEL'),
            ('ENS031','Oyono','Wilfried','M','GSS','PERMANENT'),
            # GAE
            ('ENS032','Pamba','Sandrine','F','GAE','PERMANENT'),
            ('ENS033','Same','Mathieu','M','GAE','VACATAIRE'),
            ('ENS034','Takam','Nadège','F','GAE','CONTRACTUEL'),
            ('ENS035','Talla','Auguste','M','GAE','PERMANENT'),
            # GCM
            ('ENS036','Wandji','Laure','F','GCM','VACATAIRE'),
            ('ENS037','Wondji','Constant','M','GCM','PERMANENT'),
            ('ENS038','Yemet','Alice','F','GCM','CONTRACTUEL'),
            # GHT
            ('ENS039','Zoa','Christophe','M','GHT','PERMANENT'),
            ('ENS040','Abanda','Félicité','F','GHT','VACATAIRE'),
            ('ENS041','Abeng','Joseph','M','GHT','CONTRACTUEL'),
            # GJA
            ('ENS042','Djoya','Marie-Claire','F','GJA','PERMANENT'),
            ('ENS043','Embolo','Théodore','M','GJA','VACATAIRE'),
            ('ENS044','Ngako','Jeanne','F','GJA','CONTRACTUEL'),
            # TC/Général
            ('ENS045','Ndjana','Alain','M','GI','PERMANENT'),
            ('ENS046','Etaba','Blanche','F','GCG','CONTRACTUEL'),
            ('ENS047','Fongang','Cyrille','M','GIT','PERMANENT'),
            ('ENS048','Bingono','Fatima','F','GSS','VACATAIRE'),
            ('ENS049','Bikam','Lionel','M','GAE','CONTRACTUEL'),
            ('ENS050','Abomo','Marguerite','F','GCM','PERMANENT'),
        ]
        for mle, nom, prenom, sexe, dep_code, statut in ens_data:
            dep = deps.get(dep_code)
            Enseignant.objects.get_or_create(
                mle_ens=mle,
                defaults={'nom_ens': nom, 'prenom_ens': prenom, 'sexe': sexe,
                          'code_dep': dep, 'statut': statut,
                          'tel_ens': f'+23767{random.randint(1000000,9999999)}'},
            )
        nb = Enseignant.objects.count()
        self._log(f'Total enseignants en base: {nb}')
        return {e.mle_ens: e for e in Enseignant.objects.all()}

    # ── 6. Matières ───────────────────────────────────────────────────────────
    def _matieres(self):
        self._head('Matieres')
        mods = {m.code_module: m for m in Module.objects.all()}

        def mod(code):
            return mods.get(code) or mods.get('TRONC')

        nouvelles = [
            # Tronc commun
            ('TC_EXPREC', "Expression Ecrite et Communication",         'TRONC'),
            ('TC_ANGLAIS',"Anglais Professionnel",                       'TRONC'),
            ('TC_METHODU',"Methodologie du Travail Universitaire",       'TRONC'),
            ('TC_MGMT',   "Management des Organisations",                'TRONC'),
            ('TC_ENTREP', "Entrepreneuriat",                             'TRONC'),
            # GI niveaux 2-5
            ('GI2_ALGADV',"Algorithmique Avancee et Structures",         'ALGO'),
            ('GI2_RESEAU',"Reseaux Informatiques",                       'SYNFO'),
            ('GI2_BDADV', "Bases de Donnees Avancees",                   'SYNFO'),
            ('GI2_POO2',  "Programmation Orientee Objet 2",              'PGR1'),
            ('GI2_SYSEXP',"Systemes d Exploitation",                     'SYNFO'),
            ('GI2_SECU',  "Securite Informatique",                       'SYNFO'),
            ('GI3_ARCSOF',"Architecture Logicielle",                     'THEOLOG'),
            ('GI3_RESVAD',"Reseaux Avances et Protocoles",               'SYNFO'),
            ('GI3_DEVWAD',"Developpement Web Avance",                    'TPLOG'),
            ('GI3_DEVOPS',"DevOps et Integration Continue",              'TPLOG'),
            ('GI3_CLOUD', "Cloud Computing et Virtualisation",           'SYNFO'),
            ('GI4_IAML',  "Intelligence Artificielle et Machine Learning",'THEOLOG'),
            ('GI4_BIGDAT',"Big Data et Analytics",                       'SYNFO'),
            ('GI4_MOBILE',"Developpement Mobile",                        'TPLOG'),
            ('GI4_QUALIT',"Qualite Logicielle et Tests",                 'CONCLOG'),
            ('GI5_DEEPL', "Deep Learning et IA Avancee",                 'THEOLOG'),
            ('GI5_ARCHDI',"Architectures Distribuees",                   'SYNFO'),
            ('GI5_MEMOI', "Memoire et Soutenance",                       'TRONC'),
            # GCG niveaux 1-5
            ('GCG1_MKTG', "Marketing Fondamental",                       'GESTION'),
            ('GCG1_TVNTE',"Techniques de Vente et Negociation",          'GESTION'),
            ('GCG1_DRCOM',"Droit Commercial",                            'DROIT'),
            ('GCG2_MKSTR',"Marketing Strategique",                       'GESTION'),
            ('GCG2_FINEP',"Finance d Entreprise",                        'GESTION'),
            ('GCG2_FISCA',"Fiscalite des Entreprises",                   'GESTION'),
            ('GCG2_LOGIS',"Logistique et Supply Chain",                  'GESTION'),
            ('GCG3_MGPRO',"Management de Projet",                        'GESTION'),
            ('GCG3_BUSIN',"Business Plan et Creation d Entreprise",      'GESTION'),
            ('GCG3_CNTRL',"Controle de Gestion",                        'GESTION'),
            ('GCG3_COMEX',"Commerce Exterieur et Douanes",               'GESTION'),
            ('GCG4_FININ',"Finance Internationale",                      'GESTION'),
            ('GCG4_STRAT',"Strategie d Entreprise",                      'GESTION'),
            ('GCG4_MGRH', "Management des Ressources Humaines",          'GESTION'),
            ('GCG5_LEAD', "Leadership et Gouvernance",                   'GESTION'),
            ('GCG5_MEMOI',"Memoire Professionnel",                       'TRONC'),
            # GIT niveaux 1-5
            ('GIT1_ELECG',"Electricite Generale",                        'ELECTRICT'),
            ('GIT1_MECAN',"Mecanique des Solides",                       'INDUSTRI'),
            ('GIT1_DESID',"Dessin Industriel et CAO",                    'INDUSTRI'),
            ('GIT1_THERM',"Thermodynamique Appliquee",                   'INDUSTRI'),
            ('GIT1_MATER',"Science des Materiaux",                       'INDUSTRI'),
            ('GIT2_MOTEU',"Moteurs et Actionneurs Electriques",          'ELECTRICT'),
            ('GIT2_HYDRA',"Hydraulique et Pneumatique",                  'INDUSTRI'),
            ('GIT2_AUTOM',"Automatismes et Regulation",                  'ELECTRICT'),
            ('GIT2_ELECI',"Electronique de Puissance",                   'ELECTRICT'),
            ('GIT3_MAINT',"Maintenance Preventive et Curative",          'INDUSTRI'),
            ('GIT3_SYSPD',"Systemes de Production",                      'INDUSTRI'),
            ('GIT3_LEAN', "Lean Manufacturing et Amelioration Continue", 'INDUSTRI'),
            ('GIT4_ROBOT',"Robotique Industrielle",                      'INDUSTRI'),
            ('GIT4_GPROD',"Gestion Industrielle",                        'GESTION'),
            ('GIT4_ENERG',"Energies Renouvelables",                      'ELECTRICT'),
            ('GIT5_INNIN',"Innovation et Genie Industriel Avance",       'INDUSTRI'),
            ('GIT5_MEMOI',"Memoire Ingenieur",                           'TRONC'),
            # GSS niveaux 1-5
            ('GSS1_BIOCL',"Biologie Cellulaire et Moleculaire",          'BIOMEDIC'),
            ('GSS1_ANATO',"Anatomie et Physiologie",                     'BIOMEDIC'),
            ('GSS1_CHIMB',"Chimie Biologique",                           'BIOMEDIC'),
            ('GSS1_PSYCH',"Psychologie et Sciences Sociales",            'BIOMEDIC'),
            ('GSS2_MICRO',"Microbiologie et Immunologie",                'BIOMEDIC'),
            ('GSS2_BIOCH',"Biochimie Clinique",                          'BIOMEDIC'),
            ('GSS2_SOINS',"Soins Infirmiers Fondamentaux",               'BIOMEDIC'),
            ('GSS2_PHARM',"Pharmacologie",                               'BIOMEDIC'),
            ('GSS3_PATHO',"Pathologie Medicale",                         'BIOMEDIC'),
            ('GSS3_DIAGN',"Diagnostics et Examens Cliniques",            'BIOMEDIC'),
            ('GSS3_SSPEC',"Soins Specialises",                           'BIOMEDIC'),
            ('GSS4_SPUBL',"Sante Publique et Epidemiologie",             'BIOMEDIC'),
            ('GSS4_LABCL',"Techniques de Laboratoire Clinique",          'BIOMEDIC'),
            ('GSS5_RCHTE',"Recherche en Sciences de la Sante",           'BIOMEDIC'),
            ('GSS5_MEMOI',"Memoire Professionnel Sante",                 'TRONC'),
            # GAE niveaux 1-5
            ('GAE1_BOTAN',"Botanique et Phytologie",                     'AGRONOM'),
            ('GAE1_PEDOL',"Pedologie et Science du Sol",                 'AGRONOM'),
            ('GAE1_ZOOCH',"Zootechnie et Productions Animales",          'AGRONOM'),
            ('GAE1_HYDRL',"Hydrologie et Irrigation",                    'AGRONOM'),
            ('GAE2_PHYTO',"Phytopathologie et Protection des Cultures",  'AGRONOM'),
            ('GAE2_AGDUR',"Agriculture Durable et Biologique",           'AGRONOM'),
            ('GAE2_AFRST',"Agroforesterie",                              'AGRONOM'),
            ('GAE3_GXPLT',"Gestion des Exploitations Agricoles",        'AGRONOM'),
            ('GAE3_AINDU',"Agro-industrie et Transformation",            'AGRONOM'),
            ('GAE4_INNAG',"Innovation Agricole et Technologies",         'AGRONOM'),
            ('GAE4_GRSNT',"Gestion des Ressources Naturelles",           'AGRONOM'),
            ('GAE5_DEVRL',"Developpement Rural et Politiques Agricoles", 'AGRONOM'),
            ('GAE5_MEMOI',"Memoire de Stage Agricole",                   'TRONC'),
            # GCM niveaux 1-5
            ('GCM1_JRNL', "Techniques Journalistiques",                  'COMMUNIC'),
            ('GCM1_CVISU',"Communication Visuelle et Graphisme",         'COMMUNIC'),
            ('GCM1_MEDIA',"Medias et Societe",                           'COMMUNIC'),
            ('GCM1_PHOTO',"Photographie et Production Video",            'COMMUNIC'),
            ('GCM2_REPRT',"Reportage et Enquete Journalistique",         'COMMUNIC'),
            ('GCM2_RLPUB',"Relations Publiques et Protocole",            'COMMUNIC'),
            ('GCM3_CDIG', "Communication Digitale et Reseaux Sociaux",   'COMMUNIC'),
            ('GCM3_MAMED',"Management des Medias",                       'COMMUNIC'),
            ('GCM4_CRISE',"Communication de Crise",                      'COMMUNIC'),
            ('GCM5_MEMOI',"Memoire Communication",                       'TRONC'),
            # GHT niveaux 1-5
            ('GHT1_CUIS', "Techniques Culinaires",                       'HOTEL'),
            ('GHT1_SERVC',"Service en Salle et Sommellerie",             'HOTEL'),
            ('GHT1_RECEP',"Hebergement et Reception Hoteliere",          'HOTEL'),
            ('GHT1_HYGNH',"Hygiene Alimentaire et HACCP",                'HOTEL'),
            ('GHT2_GHOTE',"Gestion Hoteliere",                           'HOTEL'),
            ('GHT2_PATIS',"Patisserie et Boulangerie",                   'HOTEL'),
            ('GHT3_MHOTE',"Management Hotelier International",           'HOTEL'),
            ('GHT3_MKTTV',"Marketing Touristique",                       'HOTEL'),
            ('GHT4_TOURS',"Gestion des Destinations Touristiques",       'HOTEL'),
            ('GHT5_MEMOI',"Memoire Hotellerie et Tourisme",              'TRONC'),
            # GJA niveaux 1-5
            ('GJA1_DCIVL',"Droit Civil Approfondi",                      'DROIT'),
            ('GJA1_DCOMM',"Droit Commercial et des Affaires",            'DROIT'),
            ('GJA1_INSTJ',"Institutions Judiciaires",                    'DROIT'),
            ('GJA1_ADMPB',"Administration Publique Generale",            'DROIT'),
            ('GJA2_DFIS', "Droit Fiscal et Finances Publiques",          'DROIT'),
            ('GJA2_DTRV', "Droit du Travail et Protection Sociale",      'DROIT'),
            ('GJA2_DPEN', "Droit Penal et Criminologie",                 'DROIT'),
            ('GJA3_OHADA',"Droit OHADA et Droit Communautaire",          'DROIT'),
            ('GJA3_ARBIT',"Arbitrage et Mediation",                      'DROIT'),
            ('GJA4_DPUBL',"Droit Public Avance",                        'DROIT'),
            ('GJA5_MEMOI',"Memoire Juridique",                           'TRONC'),
        ]
        for code, lib, mod_code in nouvelles:
            m_obj = mod(mod_code)
            Matiere.objects.get_or_create(
                code_matiere=code,
                defaults={'lib_matiere': lib, 'code_module': m_obj},
            )
        nb = Matiere.objects.count()
        self._log(f'Total matieres en base: {nb}')
        return {m.code_matiere: m for m in Matiere.objects.all()}

    # ── 7. Cours ─────────────────────────────────────────────────────────────
    def _cours(self, classes_map, matieres, enseignants, annee):
        self._head('Cours')
        # Sélection d'enseignants par département
        ens_dep = {}
        for e in Enseignant.objects.select_related('code_dep').all():
            dep = e.code_dep_id
            ens_dep.setdefault(dep, []).append(e)

        def ens_for(dep): return ens_dep.get(dep, list(enseignants.values()))

        # Cours tronc commun (S1 et S2) par niveau
        TC = {
            'S1': {
                1: ['TC_EXPREC','FORMBIL','EDUCIVETH','ANALMATH','STATDESCR'],
                2: ['TC_EXPREC','DROITCIV','EOECREENT','STATDESCR'],
                3: ['TC_MGMT','METHORRS'],
                4: ['TC_MGMT','TC_ENTREP'],
                5: ['TC_ENTREP'],
            },
            'S2': {
                1: ['FORMBIL','EDUCIVETH','ECONGEN','METHORRS'],
                2: ['DROITCIV','TC_ANGLAIS','METHORRS'],
                3: ['METHORRS'],
                4: ['TC_METHODU'],
                5: ['TC_METHODU'],
            },
        }
        # Cours spécifiques par département/niveau
        SP_COURS = {
            'GI': {
                1: {'S1':['ALGOBASE','ARCHORDI','PGRJAVA001','ANALMATH'],
                    'S2':['INTROBD','SE1','PRGRWEB','INSTMAINMATLOG']},
                2: {'S1':['GI2_ALGADV','GI2_RESEAU','GI2_BDADV','GI2_POO2'],
                    'S2':['GI2_SYSEXP','GI2_SECU','ALGEBLIN','MINPROJINFO']},
                3: {'S1':['GI3_ARCSOF','GI3_RESVAD','GI3_DEVWAD'],
                    'S2':['GI3_DEVOPS','GI3_CLOUD','MINPROJINFO']},
                4: {'S1':['GI4_IAML','GI4_BIGDAT','GI4_MOBILE'],
                    'S2':['GI4_QUALIT','GI4_MOBILE']},
                5: {'S1':['GI5_DEEPL','GI5_ARCHDI'],
                    'S2':['GI5_MEMOI']},
            },
            'GCG': {
                1: {'S1':['GCG1_MKTG','GCG1_TVNTE','COMPTAGEN','GCG1_DRCOM'],
                    'S2':['COMPTAANAL','ECONGEN','INTSYSINFO']},
                2: {'S1':['GCG2_MKSTR','GCG2_FINEP','GCG2_FISCA'],
                    'S2':['GCG2_LOGIS','GCG2_FINEP']},
                3: {'S1':['GCG3_MGPRO','GCG3_BUSIN'],
                    'S2':['GCG3_CNTRL','GCG3_COMEX']},
                4: {'S1':['GCG4_FININ','GCG4_STRAT'],
                    'S2':['GCG4_MGRH']},
                5: {'S1':['GCG5_LEAD'], 'S2':['GCG5_MEMOI']},
            },
            'GIT': {
                1: {'S1':['GIT1_ELECG','GIT1_MECAN','GIT1_DESID'],
                    'S2':['GIT1_THERM','GIT1_MATER','OUTBUR']},
                2: {'S1':['GIT2_MOTEU','GIT2_HYDRA','GIT2_AUTOM'],
                    'S2':['GIT2_ELECI','GIT1_MATER']},
                3: {'S1':['GIT3_MAINT','GIT3_SYSPD'],
                    'S2':['GIT3_LEAN']},
                4: {'S1':['GIT4_ROBOT','GIT4_GPROD'],
                    'S2':['GIT4_ENERG']},
                5: {'S1':['GIT5_INNIN'], 'S2':['GIT5_MEMOI']},
            },
            'GSS': {
                1: {'S1':['GSS1_BIOCL','GSS1_ANATO','GSS1_CHIMB'],
                    'S2':['GSS1_PSYCH','STATDESCR']},
                2: {'S1':['GSS2_MICRO','GSS2_BIOCH'],
                    'S2':['GSS2_SOINS','GSS2_PHARM']},
                3: {'S1':['GSS3_PATHO','GSS3_DIAGN'],
                    'S2':['GSS3_SSPEC']},
                4: {'S1':['GSS4_SPUBL'], 'S2':['GSS4_LABCL']},
                5: {'S1':['GSS5_RCHTE'], 'S2':['GSS5_MEMOI']},
            },
            'GAE': {
                1: {'S1':['GAE1_BOTAN','GAE1_PEDOL','GAE1_ZOOCH'],
                    'S2':['GAE1_HYDRL','STATDESCR']},
                2: {'S1':['GAE2_PHYTO','GAE2_AGDUR'],
                    'S2':['GAE2_AFRST']},
                3: {'S1':['GAE3_GXPLT'], 'S2':['GAE3_AINDU']},
                4: {'S1':['GAE4_INNAG'], 'S2':['GAE4_GRSNT']},
                5: {'S1':['GAE5_DEVRL'], 'S2':['GAE5_MEMOI']},
            },
            'GCM': {
                1: {'S1':['GCM1_JRNL','GCM1_CVISU'],
                    'S2':['GCM1_MEDIA','GCM1_PHOTO']},
                2: {'S1':['GCM2_REPRT'], 'S2':['GCM2_RLPUB']},
                3: {'S1':['GCM3_CDIG'], 'S2':['GCM3_MAMED']},
                4: {'S1':['GCM4_CRISE'], 'S2':['GCM4_CRISE']},
                5: {'S1':['GCM5_MEMOI'], 'S2':['GCM5_MEMOI']},
            },
            'GHT': {
                1: {'S1':['GHT1_CUIS','GHT1_SERVC'],
                    'S2':['GHT1_RECEP','GHT1_HYGNH']},
                2: {'S1':['GHT2_GHOTE'], 'S2':['GHT2_PATIS']},
                3: {'S1':['GHT3_MHOTE'], 'S2':['GHT3_MKTTV']},
                4: {'S1':['GHT4_TOURS'], 'S2':['GHT4_TOURS']},
                5: {'S1':['GHT5_MEMOI'], 'S2':['GHT5_MEMOI']},
            },
            'GJA': {
                1: {'S1':['GJA1_DCIVL','GJA1_DCOMM'],
                    'S2':['GJA1_INSTJ','GJA1_ADMPB']},
                2: {'S1':['GJA2_DFIS','GJA2_DTRV'],
                    'S2':['GJA2_DPEN']},
                3: {'S1':['GJA3_OHADA'], 'S2':['GJA3_ARBIT']},
                4: {'S1':['GJA4_DPUBL'], 'S2':['GJA4_DPUBL']},
                5: {'S1':['GJA5_MEMOI'], 'S2':['GJA5_MEMOI']},
            },
        }

        # Amphi groupes par département et niveau (pour les TC)
        def groupes_amphi(dep_code, niv):
            sp_objs = Specialite.objects.filter(code_dep_id=dep_code)
            sp_codes = [sp.code_sp for sp in sp_objs]
            cl_codes = [classes_map.get((sp_c, niv)).code_classe
                        for sp_c in sp_codes
                        if classes_map.get((sp_c, niv))]
            return ', '.join(cl_codes[:8])

        nb_created = 0
        specialites = list(Specialite.objects.select_related('code_dep').all())
        for sp in specialites:
            dep_code = sp.code_dep_id
            sp_pool = SP_COURS.get(dep_code, SP_COURS.get('GI'))

            for niv in range(1, 6):
                classe = classes_map.get((sp.code_sp, niv))
                if not classe:
                    continue
                enseignants_dep = ens_for(dep_code)
                pool_niv = sp_pool.get(niv, {'S1': [], 'S2': []})
                tc_s1 = TC['S1'].get(niv, [])
                tc_s2 = TC['S2'].get(niv, [])

                for sem, mat_list in [('S1', pool_niv['S1'] + tc_s1),
                                      ('S2', pool_niv['S2'] + tc_s2)]:
                    for mat_code in mat_list:
                        m = matieres.get(mat_code)
                        if not m:
                            continue
                        ens = random.choice(enseignants_dep) if enseignants_dep else None
                        is_tc = mat_code in (tc_s1 + tc_s2)
                        grp = groupes_amphi(dep_code, niv) if is_tc else ''
                        salle_cours = 'AMPH1' if is_tc else ''
                        _, c = Cours.objects.get_or_create(
                            code_matiere=m, code_classe=classe,
                            semestre=sem, code_annee=annee,
                            defaults={'mle_ens': ens, 'quota_horaire': 30,
                                      'credits': 2, 'groupes': grp},
                        )
                        if c:
                            nb_created += 1

        nb = Cours.objects.count()
        self._log(f'{nb_created} cours crees | Total: {nb}')

    # ── 8. Étudiants (50 par filière) ─────────────────────────────────────────
    def _etudiants(self, classes_map):
        self._head('Etudiants (50 par filiere)')
        specialites = list(Specialite.objects.all())
        etudiants_map = {}  # (sp_code, niv) -> [Etudiant]

        # Compteur de séquence par (year_prefix, sp_code)
        seq_counters = {}
        for e in Etudiant.objects.all():
            parts = e.mle_etudiant.split('-')
            if len(parts) >= 3:
                key = (parts[0], parts[1])
                try:
                    n = int(parts[2])
                    seq_counters[key] = max(seq_counters.get(key, 0), n)
                except ValueError:
                    pass

        batch = []
        for sp in specialites:
            etudiants_map[sp.code_sp] = {}
            # 10 étudiants par niveau × 5 niveaux = 50 par filière
            for niv in range(1, 6):
                an_pref = 2026 - (niv - 1)  # L1->2026, L2->2025, L3->2024...
                key = (str(an_pref), sp.code_sp)
                base = seq_counters.get(key, 0)
                etuds_niv = []
                for i in range(1, 11):  # 10 par niveau
                    seq = base + i
                    mle = f'{an_pref}-{sp.code_sp}-{seq:05d}'
                    if len(mle) > 20:
                        mle = f'{an_pref}-{sp.code_sp[:6]}-{seq:04d}'
                    sexe = 'F' if random.random() < 0.45 else 'M'
                    prenom = random.choice(PRENOMS_F if sexe == 'F' else PRENOMS_M)
                    nom = random.choice(NOMS)
                    lieu = random.choice(LIEUX_NAISS)
                    region = random.choice(REGIONS)
                    ddn = date(random.randint(1998, 2004), random.randint(1, 12), random.randint(1, 28))
                    tel = f'+23767{random.randint(1000000, 9999999)}'
                    cni_letters = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=2))
                    cni = f'{cni_letters}{random.randint(10000000, 99999999)}'
                    batch.append(Etudiant(
                        mle_etudiant=mle, nom=nom, prenom=prenom, sexe=sexe,
                        date_naiss=ddn, lieu=lieu, region_or=region,
                        nationalite='Camerounaise',
                        numero_cni=cni, code_dep=sp.code_dep, code_sp=sp,
                        tel=tel, nom_tuteur=f'Tuteur de {nom}',
                    ))
                    etuds_niv.append({'mle': mle, 'nom': nom})
                    seq_counters[key] = seq
                etudiants_map[sp.code_sp][niv] = etuds_niv

            # bulk_create par lots
            if len(batch) >= 500:
                Etudiant.objects.bulk_create(batch, ignore_conflicts=True)
                batch = []

        if batch:
            Etudiant.objects.bulk_create(batch, ignore_conflicts=True)

        nb = Etudiant.objects.count()
        self._log(f'Total etudiants en base: {nb}')
        return etudiants_map

    # ── 9. Inscriptions ───────────────────────────────────────────────────────
    def _inscriptions(self, etudiants_map, classes_map, annee, pensions):
        self._head('Inscriptions')
        # Étudiants déjà inscrits cette année
        already = set(
            Inscription.objects.filter(code_annee=annee)
            .values_list('mle_etudiant_id', flat=True)
        )
        batch = []
        for sp_code, niv_dict in etudiants_map.items():
            for niv, etud_list in niv_dict.items():
                classe = classes_map.get((sp_code, niv))
                if not classe:
                    continue
                pension = pensions.get(niv, pensions[1])
                for e_data in etud_list:
                    mle = e_data['mle']
                    if mle in already:
                        continue
                    try:
                        etud = Etudiant.objects.get(mle_etudiant=mle)
                    except Etudiant.DoesNotExist:
                        continue
                    batch.append(Inscription(
                        code_classe=classe,
                        mle_etudiant=etud,
                        code_annee=annee,
                        mt_inscription=int(pension.mt_inscription),
                        date_inscription=datetime(2025, 9, random.randint(1, 30)),
                    ))
                    already.add(mle)
                    if len(batch) >= 500:
                        Inscription.objects.bulk_create(batch, ignore_conflicts=True)
                        batch = []
        if batch:
            Inscription.objects.bulk_create(batch, ignore_conflicts=True)
        nb = Inscription.objects.count()
        self._log(f'Total inscriptions: {nb}')

    # ── 10. Évaluations ───────────────────────────────────────────────────────
    def _evaluations(self, annee):
        self._head('Evaluations')
        p1 = Periode.objects.get(code_periode=1)
        p2 = Periode.objects.get(code_periode=2)
        t_cc = TypeEvaluation.objects.get(code_type_eval=1)
        t_ex = TypeEvaluation.objects.get(code_type_eval=3)

        batch = []
        inscriptions = list(Inscription.objects.filter(code_annee=annee)
                            .select_related('mle_etudiant', 'code_classe'))
        # Index cours par classe
        cours_by_classe = {}
        for c in Cours.objects.filter(code_annee=annee).select_related('code_matiere'):
            cours_by_classe.setdefault(c.code_classe_id, []).append(c)

        for insc in inscriptions:
            etud = insc.mle_etudiant
            classe = insc.code_classe
            cours_list = cours_by_classe.get(classe.code_classe, [])
            # Prendre max 8 cours pour l'évaluation
            cours_sample = random.sample(cours_list, min(8, len(cours_list)))
            for c in cours_sample:
                mat = c.code_matiere
                periode = p1 if c.semestre == 'S1' else p2
                note_cc = round(random.uniform(6, 19), 2)
                note_ex = round(random.uniform(5, 20), 2)
                batch.append(Evaluation(
                    mle_etudiant=etud, code_matiere=mat,
                    code_classe=classe, code_periode=periode,
                    code_type_eval=t_cc, note=note_cc,
                    date_eval=date(2026 if c.semestre == 'S2' else 2025,
                                  random.randint(3, 5) if c.semestre == 'S2' else random.randint(11, 12),
                                  random.randint(1, 28)),
                ))
                batch.append(Evaluation(
                    mle_etudiant=etud, code_matiere=mat,
                    code_classe=classe, code_periode=periode,
                    code_type_eval=t_ex, note=note_ex,
                    date_eval=date(2026 if c.semestre == 'S2' else 2026,
                                  random.randint(4, 6) if c.semestre == 'S2' else random.randint(1, 2),
                                  random.randint(1, 28)),
                ))
                if len(batch) >= 1000:
                    Evaluation.objects.bulk_create(batch, ignore_conflicts=False)
                    batch = []
        if batch:
            Evaluation.objects.bulk_create(batch, ignore_conflicts=False)
        nb = Evaluation.objects.count()
        self._log(f'Total evaluations: {nb}')

    # ── 11. Séances & Présences ───────────────────────────────────────────────
    def _seances(self, annee):
        self._head('Seances et Presences')
        horaires = [(time(7,30),time(9,30)),(time(9,30),time(11,30)),
                    (time(11,30),time(13,30)),(time(14,0),time(16,0))]
        salles_list = ['A101','A102','A103','A201','A202','AMPH1','AMPH2','B101']

        batch_seances = []
        # 2 séances par cours (limité aux cours avec enseignant)
        cours_list = list(Cours.objects.filter(
            code_annee=annee, mle_ens__isnull=False
        ).select_related('code_matiere','code_classe','mle_ens'))

        for c in cours_list:
            base = date(2025, 10, 6) if c.semestre == 'S1' else date(2026, 2, 2)
            for k in range(2):
                h_deb, h_fin = random.choice(horaires)
                s_date = base + timedelta(weeks=k * 3)
                batch_seances.append(Seance(
                    code_matiere=c.code_matiere,
                    code_classe=c.code_classe,
                    mle_ens=c.mle_ens,
                    code_annee=annee,
                    date_seance=s_date,
                    h_debut=h_deb, h_fin=h_fin,
                    salle=random.choice(salles_list),
                    nb_heures_effectuees=2,
                    statut=random.choices(['TENU','ANNULE'],weights=[9,1])[0],
                ))
        Seance.objects.bulk_create(batch_seances, ignore_conflicts=True)

        # Présences pour les séances TENU (par lots)
        batch_abs = []
        seances_tenu = list(Seance.objects.filter(
            code_annee=annee, statut='TENU'
        ).select_related('code_classe'))
        inscr_by_classe = {}
        for ins in Inscription.objects.filter(code_annee=annee).select_related('mle_etudiant'):
            inscr_by_classe.setdefault(ins.code_classe_id, []).append(ins.mle_etudiant)

        existing_abs = set(
            Absence.objects.values_list('code_seance_id','mle_etudiant_id')
        )
        for s in seances_tenu:
            etuds = inscr_by_classe.get(s.code_classe_id, [])
            for etud in etuds:
                if (s.code_seance, etud.mle_etudiant) in existing_abs:
                    continue
                present = random.random() > 0.12
                batch_abs.append(Absence(
                    code_seance=s, mle_etudiant=etud,
                    present=present, signe=present,
                    justifiee=False if present else random.random() > 0.6,
                ))
                if len(batch_abs) >= 2000:
                    Absence.objects.bulk_create(batch_abs, ignore_conflicts=True)
                    batch_abs = []
        if batch_abs:
            Absence.objects.bulk_create(batch_abs, ignore_conflicts=True)

        self._log(f'Seances: {Seance.objects.count()} | Absences: {Absence.objects.count()}')

    # ── 12. Paiements & Factures ──────────────────────────────────────────────
    def _paiements_factures(self, annee, pensions):
        self._head('Paiements et Factures')
        tranches_by_pension = {}
        for p_code, pension in pensions.items():
            tranches_by_pension[p_code] = list(
                Tranche.objects.filter(code_pension=pension).order_by('code_tranche')
            )

        # Statuts de paiement pondérés
        statuts_pay = ['PAYE','PAYE','PAYE','PARTIEL','IMPAYE']
        statuts_fac = ['SOLDEE','SOLDEE','PARTIELLEMENT_PAYEE','EN_ATTENTE']
        poids_fac  = [0.45, 0.15, 0.25, 0.15]

        inscriptions = list(Inscription.objects.filter(code_annee=annee)
                            .select_related('mle_etudiant','code_classe__code_niveau'))
        # Étudiants déjà avec paiement cette année
        already_pay = set(
            Paiement.objects.filter(code_annee=annee)
            .values_list('mle_etudiant_id', flat=True)
        )
        already_fac = set(
            Facture.objects.filter(code_annee=annee)
            .values_list('mle_etudiant_id', flat=True)
        )
        fac_num = Facture.objects.count()
        batch_pay = []
        for insc in inscriptions:
            etud = insc.mle_etudiant
            niv = insc.code_classe.code_niveau_id or 1
            pension = pensions.get(niv, pensions[1])
            tranches = tranches_by_pension.get(niv, tranches_by_pension.get(1, []))

            # Paiement inscription
            if etud.mle_etudiant not in already_pay:
                batch_pay.append(Paiement(
                    mle_etudiant=etud,
                    type_paiement='INSCRIPTION',
                    code_annee=annee,
                    mt_paiement=int(pension.mt_inscription),
                    statut='PAYE',
                    date_paiement=datetime(2025, 9, random.randint(5, 25)),
                ))
                # Paiement scolarité tranche 1
                if tranches:
                    statut = random.choice(statuts_pay)
                    batch_pay.append(Paiement(
                        mle_etudiant=etud,
                        type_paiement='SCOLARITE',
                        code_tranche=tranches[0],
                        code_annee=annee,
                        mt_paiement=tranches[0].mt_tranche,
                        statut=statut,
                        date_paiement=datetime(2025, 10, random.randint(1, 31)),
                    ))
                # Tranche 2 pour 60% des étudiants
                if tranches and len(tranches) > 1 and random.random() < 0.6:
                    batch_pay.append(Paiement(
                        mle_etudiant=etud,
                        type_paiement='SCOLARITE',
                        code_tranche=tranches[1],
                        code_annee=annee,
                        mt_paiement=tranches[1].mt_tranche,
                        statut=random.choice(['PAYE','PARTIEL']),
                        date_paiement=datetime(2026, 1, random.randint(1, 31)),
                    ))

            # Facture
            if etud.mle_etudiant not in already_fac:
                fac_num += 1
                statut_f = random.choices(statuts_fac, weights=poids_fac)[0]
                mt_total = pension.mt_pension + pension.mt_inscription
                if statut_f == 'SOLDEE':
                    mt_paye = mt_total
                elif statut_f == 'PARTIELLEMENT_PAYEE':
                    mt_paye = tranches[0].mt_tranche if tranches else mt_total * Decimal('0.5')
                else:
                    mt_paye = 0
                fac = Facture(
                    numero_facture=f'FAC-{ANNEE[:4]}-{fac_num:05d}',
                    mle_etudiant=etud,
                    code_annee=annee,
                    date_emission=date(2025, 9, 15) + timedelta(days=fac_num % 30),
                    montant_total=mt_total,
                    montant_paye=mt_paye,
                    statut=statut_f,
                )
                try:
                    fac.save()
                    FactureDetail.objects.create(
                        code_facture=fac, libelle='Frais de scolarite',
                        type_frais='SCOLARITE', montant=pension.mt_pension,
                        date_echeance=date(2026, 6, 30),
                    )
                    FactureDetail.objects.create(
                        code_facture=fac, libelle="Frais d inscription",
                        type_frais='INSCRIPTION', montant=pension.mt_inscription,
                        date_echeance=date(2025, 10, 31),
                    )
                    already_fac.add(etud.mle_etudiant)
                except Exception:
                    pass

            if len(batch_pay) >= 1000:
                Paiement.objects.bulk_create(batch_pay, ignore_conflicts=True)
                batch_pay = []

        if batch_pay:
            Paiement.objects.bulk_create(batch_pay, ignore_conflicts=True)

        self._log(f'Paiements: {Paiement.objects.count()} | Factures: {Facture.objects.count()}')

    # ── 13. Décisions ─────────────────────────────────────────────────────────
    def _decisions(self, annee):
        self._head('Decisions de jury')
        already = set(
            Decision.objects.filter(code_annee=annee, session='NORMALE')
            .values_list('mle_etudiant_id', flat=True)
        )
        batch = []
        inscriptions = list(Inscription.objects.filter(code_annee=annee)
                            .select_related('mle_etudiant','code_classe'))
        eff = len(inscriptions)
        for rank, insc in enumerate(inscriptions, 1):
            etud = insc.mle_etudiant
            if etud.mle_etudiant in already:
                continue
            moy = round(random.gauss(12.5, 2.8), 2)
            moy = max(3.0, min(20.0, moy))
            if moy >= 16:     mention, res = 'Tres Bien', 'ADMIS'
            elif moy >= 14:   mention, res = 'Bien', 'ADMIS'
            elif moy >= 12:   mention, res = 'Assez Bien', 'ADMIS'
            elif moy >= 10:   mention, res = 'Passable', 'ADMIS'
            elif moy >= 8:    mention, res = None, 'AJOURNE'
            else:             mention, res = None, 'REDOUBLE'
            batch.append(Decision(
                mle_etudiant=etud,
                code_annee=annee,
                code_classe=insc.code_classe,
                session='NORMALE',
                moyenne_annuelle=Decimal(str(moy)),
                total_credits=60,
                credits_valides=60 if res == 'ADMIS' else random.randint(20, 55),
                resultat=res,
                mention=mention,
                rang=rank,
                effectif=eff,
                date_deliberation=datetime(2026, 7, 5, 9, 0),
                president_jury='Prof. Nkoa Jean-Claude',
            ))
            already.add(etud.mle_etudiant)
            if len(batch) >= 500:
                Decision.objects.bulk_create(batch, ignore_conflicts=True)
                batch = []
        if batch:
            Decision.objects.bulk_create(batch, ignore_conflicts=True)
        self._log(f'Total decisions: {Decision.objects.count()}')

    # ── 14. Stages ────────────────────────────────────────────────────────────
    def _stages(self, annee):
        self._head('Stages')
        already = set(Stage.objects.values_list('mle_etudiant_id', flat=True))
        types = ['OBSERVATION','IMMERSION','PFE','ACADEMIQUE','PROFESSIONNEL']
        statuts = ['EN_COURS','TERMINE','VALIDE','VALIDE']
        batch = []

        # Un stage pour chaque étudiant de niveau 3+ (30% des L1-L2 aussi)
        inscriptions = list(Inscription.objects.filter(code_annee=annee)
                            .select_related('mle_etudiant','code_classe__code_niveau',
                                           'code_classe__code_dep'))
        for insc in inscriptions:
            etud = insc.mle_etudiant
            if etud.mle_etudiant in already:
                continue
            niv = insc.code_classe.code_niveau_id or 1
            # Niveaux 1-2: 20% ont un stage, niveaux 3+: 80%
            proba = 0.80 if niv >= 3 else 0.20
            if random.random() > proba:
                continue
            dep = insc.code_classe.code_dep_id or 'GI'
            ent_nom, secteur, ville = random.choice(ENTREPRISES)
            type_s = random.choice(types)
            statut = random.choice(statuts)
            duree = random.choice([30, 45, 60, 90])
            debut = date(2026, random.randint(1, 3), random.randint(1, 15))
            fin = debut + timedelta(days=duree)
            sujets = SUJETS_STAGE.get(dep, SUJETS_STAGE['GI'])
            batch.append(Stage(
                mle_etudiant=etud,
                code_annee=annee,
                type_stage=type_s,
                entreprise=ent_nom,
                adresse_entreprise=f'{ville}, Cameroun',
                tuteur_entreprise=f'M. {random.choice(NOMS)} {random.choice(PRENOMS_M)}',
                sujet=random.choice(sujets),
                date_debut=debut, date_fin=fin,
                statut=statut,
                certificat_emis=statut in ('TERMINE','VALIDE'),
                date_emission_cert=fin if statut in ('TERMINE','VALIDE') else None,
                note_stage=Decimal(str(round(random.uniform(11,18),1))) if statut == 'VALIDE' else None,
            ))
            already.add(etud.mle_etudiant)
            if len(batch) >= 500:
                Stage.objects.bulk_create(batch, ignore_conflicts=True)
                batch = []
        if batch:
            Stage.objects.bulk_create(batch, ignore_conflicts=True)
        self._log(f'Total stages: {Stage.objects.count()}')

    # ── 15. Rapports statistiques ─────────────────────────────────────────────
    def _rapports_stats(self, annee):
        self._head('Rapports Statistiques')
        classes = list(Classe.objects.filter(
            inscription__code_annee=annee
        ).distinct().select_related('code_dep'))

        for classe in classes:
            if RapportStatistique.objects.filter(code_annee=annee, code_classe=classe).exists():
                continue
            inscrits = Inscription.objects.filter(
                code_annee=annee, code_classe=classe
            ).select_related('mle_etudiant')
            nb = inscrits.count()
            if nb == 0:
                continue
            nb_h = sum(1 for i in inscrits if i.mle_etudiant.sexe == 'M')
            nb_f = nb - nb_h
            decisions_cl = Decision.objects.filter(
                code_annee=annee, code_classe=classe, session='NORMALE'
            )
            nb_admis = decisions_cl.filter(resultat='ADMIS').count()
            nb_aj = decisions_cl.filter(resultat='AJOURNE').count()
            nb_red = decisions_cl.filter(resultat='REDOUBLE').count()
            moyennes = [float(d.moyenne_annuelle) for d in decisions_cl if d.moyenne_annuelle]
            moy_gen = round(sum(moyennes) / len(moyennes), 2) if moyennes else None
            note_min = round(min(moyennes), 2) if moyennes else None
            note_max = round(max(moyennes), 2) if moyennes else None
            RapportStatistique.objects.create(
                code_annee=annee,
                code_classe=classe,
                code_dep=classe.code_dep,
                periode_debut=date(2025, 9, 1),
                periode_fin=date(2026, 7, 15),
                nb_inscrits=nb,
                nb_hommes=nb_h,
                nb_femmes=nb_f,
                nb_admis=nb_admis,
                nb_ajournes=nb_aj,
                nb_redoubles=nb_red,
                moyenne_generale=Decimal(str(moy_gen)) if moy_gen else None,
                note_min=Decimal(str(note_min)) if note_min else None,
                note_max=Decimal(str(note_max)) if note_max else None,
                genere_par='seed_complet',
            )
        nb = RapportStatistique.objects.count()
        self._log(f'Rapports statistiques generes: {nb}')
