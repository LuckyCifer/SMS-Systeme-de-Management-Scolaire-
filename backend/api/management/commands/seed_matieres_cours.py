"""
seed_matieres_cours.py
Ajoute des matières spécifiques à chaque spécialité (2 par niveau/semestre)
+ 6 nouvelles matières de tronc commun, crée tous les Cours associés,
puis régénère l'emploi du temps complet.
"""
import random
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.db import transaction
from api.models import (
    Matiere, Module, Cours, Classe, Annee, Enseignant, Specialite
)

# ─────────────────────────────────────────────────────────────────────────────
# NOUVELLES MATIÈRES DE TRONC COMMUN
# Format : (code, libellé, module_code, {niveau: semestre})
# ─────────────────────────────────────────────────────────────────────────────
NEW_TC = [
    ('TC_FRA',    'Expression Française et Communication',   'TRONC', {1: 'S1'}),
    ('TC_SPORT',  'Éducation Physique et Sportive',          'TRONC', {1: 'S2', 2: 'S1'}),
    ('TC_ANGLPR', 'Anglais Professionnel Avancé',            'TRONC', {2: 'S2', 3: 'S1'}),
    ('TC_INNOV',  'Entrepreneuriat et Innovation Sociale',   'TRONC', {3: 'S2', 4: 'S1'}),
    ('TC_ETHIQ',  'Éthique Professionnelle et Déontologie',  'TRONC', {4: 'S2'}),
    ('TC_LEADER', 'Leadership et Intelligence Émotionnelle', 'TRONC', {5: 'S1'}),
]

# ─────────────────────────────────────────────────────────────────────────────
# NOUVELLES MATIÈRES PAR SPÉCIALITÉ
# Format : (code, libellé, module_code, niveau, semestre)
# ─────────────────────────────────────────────────────────────────────────────
SP_MATIERES = {

    # ── GAE ──────────────────────────────────────────────────────────────────
    'AGRO': [
        ('AGRO2_IRRIG',  'Irrigation et Hydraulique Agricole',        'AGRONOM', 2, 'S1'),
        ('AGRO2_MACH',   'Machinisme et Mécanisation Agricole',        'AGRONOM', 2, 'S2'),
        ('AGRO3_AGIND',  'Transformation Agro-industrielle',           'AGRONOM', 3, 'S1'),
        ('AGRO3_SEMV',   'Sélection Variétale et Semencière',          'AGRONOM', 3, 'S2'),
        ('AGRO4_MNGT',   'Management des Exploitations Agricoles',     'AGRONOM', 4, 'S1'),
        ('AGRO4_COOPR',  'Coopératives et Développement Rural',        'AGRONOM', 4, 'S2'),
        ('AGRO5_CLIMAG', 'Agriculture face au Changement Climatique',  'AGRONOM', 5, 'S1'),
        ('AGRO5_PROJAG', 'Projet de Développement Agricole',           'AGRONOM', 5, 'S2'),
    ],
    'ELV': [
        ('ELV2_ZOOT',   'Zootechnie et Productions Animales',          'AGRONOM', 2, 'S1'),
        ('ELV2_ALIMAN', 'Alimentation et Nutrition Animales',          'AGRONOM', 2, 'S2'),
        ('ELV3_REPRO',  'Reproduction et Génétique Animale',           'AGRONOM', 3, 'S1'),
        ('ELV3_SANTE',  'Santé Animale et Prophylaxie',                'AGRONOM', 3, 'S2'),
        ('ELV4_AVICOL', 'Aviculture et Production Avicole',            'AGRONOM', 4, 'S1'),
        ('ELV4_PISCIC', 'Pisciculture et Aquaculture',                 'AGRONOM', 4, 'S2'),
        ('ELV5_FILIER', 'Filières d\'Élevage et Marchés',             'AGRONOM', 5, 'S1'),
        ('ELV5_INTENS', 'Systèmes d\'Élevage Intensif et Innovation', 'AGRONOM', 5, 'S2'),
    ],
    'FOREST': [
        ('FOR2_SYLV',   'Sylviculture et Reboisement',                 'AGRONOM', 2, 'S1'),
        ('FOR2_DEND',   'Dendrologie et Identification Botanique',      'AGRONOM', 2, 'S2'),
        ('FOR3_CARTF',  'Cartographie Forestière et SIG',              'AGRONOM', 3, 'S1'),
        ('FOR3_EXPLT',  'Exploitation Forestière Durable',             'AGRONOM', 3, 'S2'),
        ('FOR4_BOIS',   'Technologie du Bois et Valorisation',         'AGRONOM', 4, 'S1'),
        ('FOR4_GEST',   'Gestion et Aménagement Forestier',            'AGRONOM', 4, 'S2'),
        ('FOR5_CERTIF', 'Certification Forestière FSC/PEFC',           'AGRONOM', 5, 'S1'),
        ('FOR5_REDD',   'REDD+ et Finance Carbone Forestière',         'AGRONOM', 5, 'S2'),
    ],
    'GE': [
        ('GE2_POLLU',   'Pollution et Toxicologie Environnementale',   'AGRONOM', 2, 'S1'),
        ('GE2_ECOBASE', 'Écologie Fondamentale et Biodiversité',       'AGRONOM', 2, 'S2'),
        ('GE3_EIE',     "Évaluation d'Impact Environnemental",         'AGRONOM', 3, 'S1'),
        ('GE3_DECHET',  'Gestion des Déchets et Économie Circulaire',  'AGRONOM', 3, 'S2'),
        ('GE4_CLIM',    'Climatologie et Changements Climatiques',     'AGRONOM', 4, 'S1'),
        ('GE4_ECOIND',  'Écologie Industrielle et Éco-conception',     'AGRONOM', 4, 'S2'),
        ('GE5_DRENV',   "Droit International de l'Environnement",      'AGRONOM', 5, 'S1'),
        ('GE5_PROJENV', 'Gestion de Projets Environnementaux',         'AGRONOM', 5, 'S2'),
    ],

    # ── GCG ──────────────────────────────────────────────────────────────────
    'CC': [
        ('CC2_SYSOHAD', 'Système Comptable SYSCOHADA',                 'COMPTA',  2, 'S1'),
        ('CC2_FISC',    'Fiscalité des Entreprises',                   'COMPTA',  2, 'S2'),
        ('CC3_AUDIT',   'Audit et Révision Comptable',                 'COMPTA',  3, 'S1'),
        ('CC3_CONSOL',  'Comptabilité des Sociétés et Consolidation',  'COMPTA',  3, 'S2'),
        ('CC4_CONTR',   'Contrôle de Gestion et Tableau de Bord',      'COMPTA',  4, 'S1'),
        ('CC4_EXPERT',  'Expertise Comptable et Commissariat',         'COMPTA',  4, 'S2'),
        ('CC5_NORMI',   'Normes Comptables Internationales IFRS',      'COMPTA',  5, 'S1'),
        ('CC5_FINPUB',  'Analyse Financière et Évaluation Entreprise', 'COMPTA',  5, 'S2'),
    ],
    'GEA': [
        ('GEA2_ORGENT', "Organisation des Entreprises",                'GESTION', 2, 'S1'),
        ('GEA2_DROITE', 'Droit des Affaires OHADA',                    'DROIT',   2, 'S2'),
        ('GEA3_GRH',    'Gestion des Ressources Humaines',             'GESTION', 3, 'S1'),
        ('GEA3_GPROJ',  'Gestion de Projet et Planification',          'GESTION', 3, 'S2'),
        ('GEA4_STRAT',  "Stratégie d'Entreprise",                      'GESTION', 4, 'S1'),
        ('GEA4_CHANG',  'Management du Changement Organisationnel',    'GESTION', 4, 'S2'),
        ('GEA5_GOUV',   'Gouvernance et Responsabilité Sociale',       'GESTION', 5, 'S1'),
        ('GEA5_DIRSTR', 'Direction Générale et Vision Stratégique',    'GESTION', 5, 'S2'),
    ],
    'LT': [
        ('LT2_CHAIAP',  "Gestion de la Chaîne d'Approvisionnement",   'GESTION', 2, 'S1'),
        ('LT2_ENTREP',  "Gestion d'Entrepôt et Gestion des Stocks",   'GESTION', 2, 'S2'),
        ('LT3_TRANSP',  'Modes et Contrats de Transport',              'GESTION', 3, 'S1'),
        ('LT3_DOUANE',  'Procédures Douanières et Incoterms',          'DROIT',   3, 'S2'),
        ('LT4_SCMADV',  'Supply Chain Management Avancé',              'GESTION', 4, 'S1'),
        ('LT4_LOGNUM',  'Logistique Numérique et Traçabilité',         'GESTION', 4, 'S2'),
        ('LT5_PORTAIR', 'Logistique Portuaire et Aérienne',            'GESTION', 5, 'S1'),
        ('LT5_PROJLOG', 'Projet Intégrateur Logistique',               'GESTION', 5, 'S2'),
    ],
    'MC': [
        ('MC2_TECHVNT', 'Techniques de Vente et Négociation',          'GESTION', 2, 'S1'),
        ('MC2_CRMBASE', 'CRM et Gestion de la Relation Client',        'GESTION', 2, 'S2'),
        ('MC3_MKTDIG',  'Marketing Digital et Réseaux Sociaux',        'GESTION', 3, 'S1'),
        ('MC3_INTEXPT', 'Marketing International et Export',           'GESTION', 3, 'S2'),
        ('MC4_BRAND',   'Gestion de la Marque et Branding',            'GESTION', 4, 'S1'),
        ('MC4_ETMARK',  'Études de Marché et Veille Concurrentielle',  'GESTION', 4, 'S2'),
        ('MC5_STMKT',   'Stratégie Marketing Globale',                 'GESTION', 5, 'S1'),
        ('MC5_ROIKMKT', 'Marketing ROI et Performance Commerciale',    'GESTION', 5, 'S2'),
    ],

    # ── GCM ──────────────────────────────────────────────────────────────────
    'AV': [
        ('AV2_MONTAGV', 'Montage Vidéo et Post-production',            'COMMUNIC', 2, 'S1'),
        ('AV2_PRODTV',  'Production TV et Documentaire',               'COMMUNIC', 2, 'S2'),
        ('AV3_REALFILM','Réalisation Cinématographique',               'COMMUNIC', 3, 'S1'),
        ('AV3_SON',     'Ingénierie du Son et Mixage Audio',           'COMMUNIC', 3, 'S2'),
        ('AV4_STREAM',  'Streaming et Diffusion Numérique',            'COMMUNIC', 4, 'S1'),
        ('AV4_DRONE',   'Drone et Prises de Vues Aériennes',          'COMMUNIC', 4, 'S2'),
        ('AV5_CONTCRE', 'Création de Contenus et Médias Indépendants','COMMUNIC', 5, 'S1'),
        ('AV5_PRODLNG', 'Production Longue Durée et Séries TV',       'COMMUNIC', 5, 'S2'),
    ],
    'CE': [
        ('CE2_RLPRESS', 'Relations Presse et Attachés de Presse',     'COMMUNIC', 2, 'S1'),
        ('CE2_CORPCOM', 'Communication Institutionnelle et Corporate', 'COMMUNIC', 2, 'S2'),
        ('CE3_EVENTCO', 'Communication Événementielle',               'COMMUNIC', 3, 'S1'),
        ('CE3_PUBLICT', 'Publicité et Media Planning',                'COMMUNIC', 3, 'S2'),
        ('CE4_CRISCOM', 'Gestion de Crise Communicationnelle',        'COMMUNIC', 4, 'S1'),
        ('CE4_DIGINTR', 'Communication Interne et Digitale',          'COMMUNIC', 4, 'S2'),
        ('CE5_LOBBY',   'Lobbying et Communication Politique',        'COMMUNIC', 5, 'S1'),
        ('CE5_CONSEIL', 'Conseil en Communication Stratégique',       'COMMUNIC', 5, 'S2'),
    ],
    'DG': [
        ('DG2_TYPOGR',  'Typographie et Mise en Page Professionnelle','COMMUNIC', 2, 'S1'),
        ('DG2_ILLUST',  'Illustration Numérique et Techniques Mixtes','COMMUNIC', 2, 'S2'),
        ('DG3_UXUI',    'UX/UI Design et Prototypage Figma',          'COMMUNIC', 3, 'S1'),
        ('DG3_PAO',     'PAO et Production Graphique (Indesign)',     'COMMUNIC', 3, 'S2'),
        ('DG4_ANIMAT',  'Animation 2D/3D et Motion Design',          'COMMUNIC', 4, 'S1'),
        ('DG4_BRAND',   "Design de Marque et Identité Visuelle",     'COMMUNIC', 4, 'S2'),
        ('DG5_DIRAR',   'Direction Artistique',                       'COMMUNIC', 5, 'S1'),
        ('DG5_INTERACT','Design Interactif et Expérience Utilisateur','COMMUNIC', 5, 'S2'),
    ],
    'J': [
        ('J2_REPORTG',  'Techniques du Reportage Terrain',            'COMMUNIC', 2, 'S1'),
        ('J2_REDACAV',  'Rédaction Journalistique Avancée',           'COMMUNIC', 2, 'S2'),
        ('J3_JOURNUM',  'Journalisme Numérique et Multimédia',        'COMMUNIC', 3, 'S1'),
        ('J3_RADIO',    'Journalisme Radio et Podcast',               'COMMUNIC', 3, 'S2'),
        ('J4_PRESSINV', "Journalisme d'Investigation",                'COMMUNIC', 4, 'S1'),
        ('J4_DRTPRESS', 'Droit de la Presse et Éthique Journalistique','COMMUNIC',4, 'S2'),
        ('J5_DIRREDAC', 'Direction de Rédaction et Gestion Éditoriale','COMMUNIC',5,'S1'),
        ('J5_MEDJOUR',  'Médias Internationaux et Correspondance',    'COMMUNIC', 5, 'S2'),
    ],

    # ── GHT ──────────────────────────────────────────────────────────────────
    'GH': [
        ('GH2_GOVERN',  "Gouvernance et Entretien Hôtelier",          'HOTEL',    2, 'S1'),
        ('GH2_FRONTOF', 'Front Office et Gestion de la Réception',    'HOTEL',    2, 'S2'),
        ('GH3_REVMGT',  'Revenue Management et Tarification',         'HOTEL',    3, 'S1'),
        ('GH3_MKTHTL',  'Marketing Hôtelier et Distribution',         'HOTEL',    3, 'S2'),
        ('GH4_LUXHTL',  "Hôtellerie de Luxe et Standards Premiums",   'HOTEL',    4, 'S1'),
        ('GH4_EVNTHT',  "Gestion d'Événements Hôteliers",             'HOTEL',    4, 'S2'),
        ('GH5_STRATHT', 'Stratégie et Développement Hôtelier',        'HOTEL',    5, 'S1'),
        ('GH5_FRANCH',  'Franchise Hôtelière Internationale',         'HOTEL',    5, 'S2'),
    ],
    'REST': [
        ('RST2_NUTRIT', 'Nutrition, Hygiène Alimentaire et Diétét.',  'HOTEL',    2, 'S1'),
        ('RST2_GASTRC', 'Gastronomie Camerounaise et Africaine',       'HOTEL',    2, 'S2'),
        ('RST3_MGTRS',  'Management de Restaurant et de Bar',         'HOTEL',    3, 'S1'),
        ('RST3_VINOL',  'Œnologie et Gestion des Boissons',           'HOTEL',    3, 'S2'),
        ('RST4_BANQ',   "Art du Traiteur, Banquets et Réceptions",    'HOTEL',    4, 'S1'),
        ('RST4_FOODC',  'Food Cost et Contrôle de la Restauration',   'HOTEL',    4, 'S2'),
        ('RST5_INNCULN','Innovation Culinaire et Tendances Gastrono.','HOTEL',    5, 'S1'),
        ('RST5_CHEFEX', 'Direction Culinaire et Chef Exécutif',       'HOTEL',    5, 'S2'),
    ],
    'TOUR': [
        ('TUR2_GEOTUR', 'Géographie Touristique du Cameroun',         'HOTEL',    2, 'S1'),
        ('TUR2_PATRIM', 'Patrimoine Culturel et Tourisme Mémoriel',   'HOTEL',    2, 'S2'),
        ('TUR3_ECOTOUR','Écotourisme et Tourisme Durable',            'HOTEL',    3, 'S1'),
        ('TUR3_TRANSTUR','Transport Touristique et Guiding',          'HOTEL',    3, 'S2'),
        ('TUR4_TOUROP', "Tour-Opérateur et Agences de Voyage",        'HOTEL',    4, 'S1'),
        ('TUR4_EVTTUR', 'Tourisme MICE et Événementiel',              'HOTEL',    4, 'S2'),
        ('TUR5_STRTUR', 'Stratégie de Développement Touristique',     'HOTEL',    5, 'S1'),
        ('TUR5_PROJET', 'Étude de Cas et Projet Touristique',         'HOTEL',    5, 'S2'),
    ],

    # ── GI ───────────────────────────────────────────────────────────────────
    'CS': [
        ('CS2_CRYPTO',  'Cryptographie Appliquée',                    'SYNFO',   2, 'S1'),
        ('CS2_FORENSC', 'Forensique Numérique et Investigation',      'SYNFO',   2, 'S2'),
        ('CS3_PENTEST', 'Tests de Pénétration (Pentest)',             'SYNFO',   3, 'S1'),
        ('CS3_WEBSECU', 'Sécurité des Applications Web et API',      'SYNFO',   3, 'S2'),
        ('CS4_SOC',     "Gestion d'un Centre de Sécurité (SOC)",     'SYNFO',   4, 'S1'),
        ('CS4_COMPLI',  'Cybersécurité, RGPD et Conformité Légale',  'SYNFO',   4, 'S2'),
        ('CS5_THREAT',  'Threat Intelligence et Cyber-CTI',          'SYNFO',   5, 'S1'),
        ('CS5_SECARCH', 'Architecture Sécurité et Zero Trust',        'SYNFO',   5, 'S2'),
    ],
    'DL': [
        ('DL2_REACTJS', 'Frameworks Front-end React et Vue.js',      'TPLOG',   2, 'S1'),
        ('DL2_NODEJS',  'Node.js, Express et APIs REST',             'TPLOG',   2, 'S2'),
        ('DL3_MOBILE',  'Développement Mobile Flutter / React Native','TPLOG',  3, 'S1'),
        ('DL3_MICRO',   'Architecture Microservices et Docker',       'CONCLOG', 3, 'S2'),
        ('DL4_ARCHLOG', 'Architecture Logicielle Avancée (DDD, CQRS)','CONCLOG',4, 'S1'),
        ('DL4_PERF',    'Performance, Cache et Scalabilité App.',     'CONCLOG', 4, 'S2'),
        ('DL5_INNTECH', 'Innovation Technologique et Veille',         'CONCLOG', 5, 'S1'),
        ('DL5_APIDESN', 'Design et Documentation API Avancée',        'CONCLOG', 5, 'S2'),
    ],
    'EC': [
        ('EC2_SEOSEM',  'SEO/SEM et Référencement Web',               'SYNFO',   2, 'S1'),
        ('EC2_SMKTG',   'Social Media Marketing et Influence',        'SYNFO',   2, 'S2'),
        ('EC3_PLATFEC', 'Plateformes E-Commerce (Shopify, Woo)',      'SYNFO',   3, 'S1'),
        ('EC3_ANALWEB', 'Analytics Web et Data Marketing (GA4)',      'SYNFO',   3, 'S2'),
        ('EC4_LOGECM',  'Logistique et Fulfilment E-Commerce',        'SYNFO',   4, 'S1'),
        ('EC4_PAYNUM',  'Paiements Numériques et Fintech',            'SYNFO',   4, 'S2'),
        ('EC5_STRDIGI', 'Stratégie de Transformation Digitale',       'SYNFO',   5, 'S1'),
        ('EC5_DATAMKT', 'Data-Driven Marketing et CRO',               'SYNFO',   5, 'S2'),
    ],
    'GL': [
        ('GL2_PATDESN', 'Design Patterns et Refactoring',             'CONCLOG', 2, 'S1'),
        ('GL2_TESTLOG', 'Tests Logiciels, TDD et BDD',                'CONCLOG', 2, 'S2'),
        ('GL3_DEVOPS',  'DevOps et Intégration Continue (CI/CD)',     'CONCLOG', 3, 'S1'),
        ('GL3_AGILE',   'Méthodes Agiles Avancées (SAFe, Scrum)',     'CONCLOG', 3, 'S2'),
        ('GL4_QUALLOG', 'Qualité Logicielle et Certification CMMI',   'CONCLOG', 4, 'S1'),
        ('GL4_ARCHENT', 'Architecture Logicielle Entreprise (SOA)',   'CONCLOG', 4, 'S2'),
        ('GL5_ARCHD',   'Systèmes Distribués et Cloud Computing',     'CONCLOG', 5, 'S1'),
        ('GL5_AUDITSW', 'Audit et Certification Logicielle',          'CONCLOG', 5, 'S2'),
    ],
    'IA': [
        ('IA2_SKLEARN', 'Machine Learning avec Scikit-learn',         'ALGO',    2, 'S1'),
        ('IA2_STATIA',  'Statistiques et Probabilités pour IA',       'MATHS',   2, 'S2'),
        ('IA3_DEEPL',   'Deep Learning et Réseaux de Neurones',       'ALGO',    3, 'S1'),
        ('IA3_NLP',     'Traitement Automatique du Langage (NLP)',    'ALGO',    3, 'S2'),
        ('IA4_COMPVIS', 'Vision par Ordinateur (Computer Vision)',    'ALGO',    4, 'S1'),
        ('IA4_MLOPS',   'MLOps et Mise en Production de Modèles IA',  'ALGO',    4, 'S2'),
        ('IA5_GENAI',   'IA Générative et Grands Modèles (LLMs)',     'ALGO',    5, 'S1'),
        ('IA5_ETHIQIA', "Éthique, Gouvernance et Biais de l'IA",     'ALGO',    5, 'S2'),
    ],
    'RAS': [
        ('RAS2_CISCO',  'Réseaux Cisco et CCNA Fondamentaux',        'SYNFO',   2, 'S1'),
        ('RAS2_WLAN',   'Réseaux Sans Fil, WiFi et Bluetooth',        'SYNFO',   2, 'S2'),
        ('RAS3_FIREWL', 'Pare-feux, VPN et Sécurité Réseau',         'SYNFO',   3, 'S1'),
        ('RAS3_MONIT',  'Supervision et Monitoring Réseau (Zabbix)',  'SYNFO',   3, 'S2'),
        ('RAS4_CLOUD',  'Infrastructure Cloud AWS / Azure / GCP',     'SYNFO',   4, 'S1'),
        ('RAS4_SDN',    'Software Defined Networking et NFV',         'SYNFO',   4, 'S2'),
        ('RAS5_5G',     'Réseaux 5G et Technologies Émergentes',      'SYNFO',   5, 'S1'),
        ('RAS5_SECING', 'Ingénierie Sécurité Réseau Avancée',         'SYNFO',   5, 'S2'),
    ],

    # ── GIT ──────────────────────────────────────────────────────────────────
    'GC': [
        ('GC2_BETON',   'Béton Armé et Calcul de Structures',         'INDUSTRI',2, 'S1'),
        ('GC2_TOPOGR',  'Topographie et Levés de Terrain',            'INDUSTRI',2, 'S2'),
        ('GC3_HYDURB',  "Hydraulique Urbaine et Assainissement",       'INDUSTRI',3, 'S1'),
        ('GC3_GEOTCH',  'Géotechnique et Conception des Fondations',  'INDUSTRI',3, 'S2'),
        ('GC4_VRD',     'Voirie, Routes et Réseaux Divers',           'INDUSTRI',4, 'S1'),
        ('GC4_BIM',     'BIM et Modélisation 3D du Bâtiment',         'INDUSTRI',4, 'S2'),
        ('GC5_MGBTP',   'Management de Projets de Construction',      'INDUSTRI',5, 'S1'),
        ('GC5_ECOBTP',  'Construction Durable et Éco-Bâtiment',       'INDUSTRI',5, 'S2'),
    ],
    'GEE': [
        ('GEE2_MOTEUR', 'Machines Tournantes et Moteurs Électriques', 'ELECTRICT',2,'S1'),
        ('GEE2_SCHEMA', 'Schémas Électriques BT/HTA',                 'ELECTRICT',2,'S2'),
        ('GEE3_EPUI',   'Électronique de Puissance',                  'ELECTRICT',3,'S1'),
        ('GEE3_HABIL',  'Habilitation et Sécurité Électrique',        'ELECTRICT',3,'S2'),
        ('GEE4_PROTEC', 'Systèmes de Protection BT/HTA',              'ELECTRICT',4,'S1'),
        ('GEE4_PV',     'Photovoltaïque et Énergies Renouvelables',   'ELECTRICT',4,'S2'),
        ('GEE5_SMART',  'Smart Grid et Gestion Énergétique',          'ELECTRICT',5,'S1'),
        ('GEE5_RESEL',  'Conception et Exploitation de Réseaux Élec.','ELECTRICT',5,'S2'),
    ],
    'GM': [
        ('GM2_RDM',     'Résistance des Matériaux (RDM)',             'INDUSTRI',2, 'S1'),
        ('GM2_CAO',     'CAO/DAO et Solidworks',                      'INDUSTRI',2, 'S2'),
        ('GM3_FABR',    'Procédés de Fabrication et Usinage',         'INDUSTRI',3, 'S1'),
        ('GM3_THFLUID', 'Thermique Industrielle et Mécanique Fluides','INDUSTRI',3, 'S2'),
        ('GM4_MECATR',  'Mécatronique et Systèmes Asservis',          'INDUSTRI',4, 'S1'),
        ('GM4_METROL',  'Métrologie et Contrôle Qualité Mécanique',   'INDUSTRI',4, 'S2'),
        ('GM5_INNOMEC', 'Innovation et Conception Mécanique Avancée','INDUSTRI',5, 'S1'),
        ('GM5_ROBOT',   'Robotique Industrielle Appliquée',           'INDUSTRI',5, 'S2'),
    ],
    'MI': [
        ('MI2_DIAGPAN', 'Diagnostic de Pannes et Analyse Défaillance','INDUSTRI',2, 'S1'),
        ('MI2_LUBR',    'Lubrification et Tribologie Industrielle',   'INDUSTRI',2, 'S2'),
        ('MI3_FIABIL',  'Fiabilité, AMDEC et Maintenance Préventive', 'INDUSTRI',3, 'S1'),
        ('MI3_TPM',     'Maintenance Conditionnelle et TPM',          'INDUSTRI',3, 'S2'),
        ('MI4_GMAO',    'GMAO et Maintenance Informatisée',           'INDUSTRI',4, 'S1'),
        ('MI4_VIBRAT',  'Analyse Vibratoire et Contrôle Non Destruct.','INDUSTRI',4,'S2'),
        ('MI5_PREDMNT', 'Maintenance Prédictive et IoT Industriel',   'INDUSTRI',5, 'S1'),
        ('MI5_STRATMT', 'Stratégie de Maintenance Totale (WCM)',      'INDUSTRI',5, 'S2'),
    ],

    # ── GJA ──────────────────────────────────────────────────────────────────
    'AP': [
        ('AP2_COMPTPB', 'Comptabilité Publique et Budget de l\'État', 'DROIT',   2, 'S1'),
        ('AP2_REDADM',  'Rédaction Administrative et Rapports',       'DROIT',   2, 'S2'),
        ('AP3_SERVPB',  'Management des Services Publics',            'DROIT',   3, 'S1'),
        ('AP3_STATPB',  'Statistiques Publiques et Indicateurs',      'DROIT',   3, 'S2'),
        ('AP4_MARCHPB', 'Marchés Publics et Commande Publique',       'DROIT',   4, 'S1'),
        ('AP4_DECENT',  'Décentralisation et Collectivités Territ.',  'DROIT',   4, 'S2'),
        ('AP5_ADMINT',  'Administration Internationale et Diplo.',    'DROIT',   5, 'S1'),
        ('AP5_GVPUB',   'Gouvernance Publique et Politiques Sectori.','DROIT',   5, 'S2'),
    ],
    'D': [
        ('D2_OHADAC',   'Droit OHADA des Contrats et Affaires',       'DROIT',   2, 'S1'),
        ('D2_DRTRAV',   'Droit du Travail et des Contrats Emploi',    'DROIT',   2, 'S2'),
        ('D3_PROCEDC',  'Procédure Civile et Contentieux Judiciaire', 'DROIT',   3, 'S1'),
        ('D3_DRFISCA',  'Droit Fiscal et Para-fiscal Approfondi',     'DROIT',   3, 'S2'),
        ('D4_ARBITRG',  "Arbitrage et Modes Alt. de Règlement",       'DROIT',   4, 'S1'),
        ('D4_DRINTL',   'Droit International des Affaires',           'DROIT',   4, 'S2'),
        ('D5_DRFOND',   'Droits Fondamentaux et Convention EDH',      'DROIT',   5, 'S1'),
        ('D5_PLAIDOY',  'Plaidoirie et Défense Judiciaire',           'DROIT',   5, 'S2'),
    ],

    # ── GSS ──────────────────────────────────────────────────────────────────
    'AB': [
        ('AB2_HEMATO',  'Hématologie et Numération Formule Sanguine', 'BIOMEDIC',2, 'S1'),
        ('AB2_BIOCLIN', 'Biochimie Clinique Fondamentale',            'BIOMEDIC',2, 'S2'),
        ('AB3_PARASIT', 'Parasitologie et Mycologie Médicale',        'BIOMEDIC',3, 'S1'),
        ('AB3_SEROIM',  'Sérologie et Immunologie Clinique',          'BIOMEDIC',3, 'S2'),
        ('AB4_HISTOPTH','Histologie et Anatomie Pathologique',        'BIOMEDIC',4, 'S1'),
        ('AB4_MOLBIO',  'Biologie Moléculaire et Techniques PCR',     'BIOMEDIC',4, 'S2'),
        ('AB5_GENOMQ',  'Génomique et Médecine de Précision',         'BIOMEDIC',5, 'S1'),
        ('AB5_LABMGT',  "Gestion de Laboratoire d'Analyses",         'BIOMEDIC',5, 'S2'),
    ],
    'AS': [
        ('AS2_SOCBASE', 'Sociologie Générale et Développement Social','BIOMEDIC',2, 'S1'),
        ('AS2_PSYCHS',  'Psychologie Sociale et Communautaire',       'BIOMEDIC',2, 'S2'),
        ('AS3_INTERV',  'Méthodes d\'Intervention Sociale Individ.',  'BIOMEDIC',3, 'S1'),
        ('AS3_ONG',     'Associations, ONG et Projets de Dev.',       'BIOMEDIC',3, 'S2'),
        ('AS4_PROTINF', "Protection de l'Enfance et Droit de Famille",'BIOMEDIC',4,'S1'),
        ('AS4_GERONT',  'Gérontologie et Aide aux Personnes Âgées',  'BIOMEDIC',4, 'S2'),
        ('AS5_POLSOC',  'Politiques Sociales et Droits Humains',      'BIOMEDIC',5, 'S1'),
        ('AS5_COPSOC',  'Coopération Internationale et Dev. Social',  'BIOMEDIC',5, 'S2'),
    ],
    'SI': [
        ('SI2_SEMIO',   'Séméiologie et Soins Infirmiers de Base',    'BIOMEDIC',2, 'S1'),
        ('SI2_PHARMAC', 'Pharmacologie Clinique Appliquée',           'BIOMEDIC',2, 'S2'),
        ('SI3_URGENC',  "Soins d'Urgence et Réanimation",             'BIOMEDIC',3, 'S1'),
        ('SI3_CHIRURG', 'Soins Infirmiers en Chirurgie et Bloc Op.',  'BIOMEDIC',3, 'S2'),
        ('SI4_ICU',     'Soins Infirmiers Spécialisés UCM/ICU',       'BIOMEDIC',4, 'S1'),
        ('SI4_PEDINEO', 'Soins Pédiatriques et Néonataux',            'BIOMEDIC',4, 'S2'),
        ('SI5_HOSPIT',  'Gestion Hospitalière et Qualité des Soins',  'BIOMEDIC',5, 'S1'),
        ('SI5_RECHSOI', 'Recherche en Sciences Infirmières',          'BIOMEDIC',5, 'S2'),
    ],
}


class Command(BaseCommand):
    help = 'Ajoute des matières par spécialité + TC, crée les cours, régénère le planning'

    def handle(self, *args, **options):
        self.stdout.write('=== SEED MATIERES & COURS ===\n')

        annee = (Annee.objects.filter(statut='EN_COURS').first()
                 or Annee.objects.order_by('-code_annee').first())
        if not annee:
            self.stderr.write('Aucune année trouvée.'); return

        modules = {m.code_module: m for m in Module.objects.all()}

        with transaction.atomic():
            nb_mat, nb_cours = 0, 0

            # ── 1. Matières Tronc Commun ──────────────────────────────────
            self.stdout.write('[*] Matières Tronc Commun')
            for code, lib, mod_code, niveau_sem in NEW_TC:
                mat, created = Matiere.objects.get_or_create(
                    code_matiere=code,
                    defaults={'lib_matiere': lib,
                              'code_module': modules.get(mod_code)})
                if created:
                    nb_mat += 1
                    self.stdout.write(f'    + {code}: {lib}')

                # Cours pour toutes les classes aux niveaux/semestres indiqués
                for niv, sem in niveau_sem.items():
                    classes = Classe.objects.filter(
                        code_niveau_id=niv).select_related('code_sp')
                    for cl in classes:
                        ens = self._pick_ens(cl)
                        _, c = Cours.objects.get_or_create(
                            code_matiere=mat, code_classe=cl,
                            defaults={'semestre': sem, 'code_annee': annee,
                                      'mle_ens': ens, 'credits': 2,
                                      'groupes': None})
                        if c: nb_cours += 1

            # ── 2. Matières Spécialité ────────────────────────────────────
            self.stdout.write('\n[*] Matières par Spécialité')
            for sp_code, mats in SP_MATIERES.items():
                sp = Specialite.objects.filter(code_sp=sp_code).first()
                if not sp:
                    continue
                count_sp = 0
                for code, lib, mod_code, niv, sem in mats:
                    mat, created = Matiere.objects.get_or_create(
                        code_matiere=code,
                        defaults={'lib_matiere': lib,
                                  'code_module': modules.get(mod_code)})
                    if created:
                        nb_mat += 1

                    classes = Classe.objects.filter(
                        code_sp=sp, code_niveau_id=niv)
                    for cl in classes:
                        ens = self._pick_ens(cl)
                        _, c = Cours.objects.get_or_create(
                            code_matiere=mat, code_classe=cl,
                            defaults={'semestre': sem, 'code_annee': annee,
                                      'mle_ens': ens, 'credits': 3,
                                      'groupes': None})
                        if c: nb_cours += 1; count_sp += 1

                self.stdout.write(
                    f'    {sp_code:8} ({sp.lib_sp[:35]}): '
                    f'{len(mats)} matières -> {count_sp} cours créés')

        self.stdout.write(
            self.style.SUCCESS(
                f'\n=== {nb_mat} nouvelles matières, {nb_cours} nouveaux cours ==='))

        # ── 3. Régénération du planning ───────────────────────────────────
        self.stdout.write('\n[*] Régénération du planning...')
        call_command('seed_planning')

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _pick_ens(self, classe):
        """Retourne un enseignant du même département que la classe, ou le premier dispo."""
        dep = classe.code_dep_id
        qs = Enseignant.objects.filter(code_dep_id=dep)
        if not qs.exists():
            qs = Enseignant.objects.all()
        if not qs.exists():
            return None
        items = list(qs.values_list('mle_ens', flat=True))
        # Rotation déterministe basée sur le code de la classe
        idx = sum(ord(c) for c in (classe.code_classe or '')) % len(items)
        return Enseignant.objects.get(mle_ens=items[idx])
