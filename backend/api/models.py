"""
models.py — SMS (School Management System)
"""
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models import CompositePrimaryKey


# ─────────────────────────────────────────
# Tables de référence
# ─────────────────────────────────────────
class TypeEtab(models.Model):
    code_type = models.AutoField(primary_key=True)
    lib_type  = models.CharField(max_length=25, null=True, blank=True)
    obs_type  = models.CharField(max_length=45, null=True, blank=True)
    class Meta:
        db_table = 'type_etab'
    def __str__(self):
        return self.lib_type or str(self.code_type)

class Batiment(models.Model):
    code_bat = models.CharField(max_length=5, primary_key=True)
    lib_bat  = models.CharField(max_length=25, null=True, blank=True)
    obs_bat  = models.CharField(max_length=45, null=True, blank=True)
    class Meta:
        db_table = 'batiment'
    def __str__(self):
        return self.lib_bat or self.code_bat

class Salle(models.Model):
    code_salle = models.CharField(max_length=5, primary_key=True)
    lib_salle  = models.CharField(max_length=15, null=True, blank=True)
    obs_salle  = models.CharField(max_length=45, default='')
    class Meta:
        db_table = 'salle'
    def __str__(self):
        return self.lib_salle or self.code_salle

class Jour(models.Model):
    code_jour = models.CharField(max_length=10, primary_key=True)
    lib_jour  = models.CharField(max_length=15)
    obs_jour  = models.CharField(max_length=45, null=True, blank=True)
    class Meta:
        db_table = 'jour'
    def __str__(self):
        return self.lib_jour

class Langue(models.Model):
    code_langue = models.CharField(max_length=5, primary_key=True)
    lib_langue  = models.CharField(max_length=20)
    class Meta:
        db_table = 'langue'
    def __str__(self):
        return self.lib_langue

class Module(models.Model):
    code_module = models.CharField(max_length=10, primary_key=True)
    lib_module  = models.CharField(max_length=25)
    obs_module  = models.CharField(max_length=45, null=True, blank=True)
    class Meta:
        db_table = 'module'
    def __str__(self):
        return self.lib_module

class Pension(models.Model):
    code_pension   = models.PositiveIntegerField(primary_key=True)
    lib_pension    = models.CharField(max_length=25, null=True, blank=True)
    mt_pension     = models.FloatField(default=0)
    obs_pension    = models.CharField(max_length=45, null=True, blank=True)
    nb_tranche     = models.PositiveIntegerField(null=True, blank=True)
    mt_inscription = models.FloatField(default=0)
    class Meta:
        db_table = 'pension'
    def __str__(self):
        return self.lib_pension or str(self.code_pension)

class Mention(models.Model):
    code_mention = models.AutoField(primary_key=True)
    lib_mention  = models.CharField(max_length=15)
    # FIX: étaient PositiveIntegerField — les notes sont décimales (ex : 12,50/20)
    note_min     = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    note_max     = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    class Meta:
        db_table = 'mention'
    def __str__(self):
        return self.lib_mention

class TypeEvaluation(models.Model):
    # FIX: db_column standardisé en snake_case (était 'code_typeEval')
    code_type_eval = models.AutoField(primary_key=True, db_column='code_type_eval')
    lib_type_eval  = models.CharField(max_length=20)
    obs_type_eval  = models.CharField(max_length=45, null=True, blank=True, db_column='obs_type_eval')
    class Meta:
        db_table = 'type_evaluation'
    def __str__(self):
        return self.lib_type_eval

class Rapport(models.Model):
    code_rapport = models.AutoField(primary_key=True)
    lib_rapport  = models.CharField(max_length=25)
    class Meta:
        db_table = 'rapport'
    def __str__(self):
        return self.lib_rapport

class Annee(models.Model):
    STATUT_CHOICES = [
        ('EN COURS',  'En cours'),
        ('CLOTUREE',  'Clôturée'),
        ('PLANIFIEE', 'Planifiée'),
    ]
    code_annee = models.CharField(max_length=10, primary_key=True)
    lib_annee  = models.CharField(max_length=45, null=True, blank=True)
    obs_annee  = models.CharField(max_length=45, null=True, blank=True)
    date_deb   = models.DateTimeField(null=True, blank=True)
    date_fin   = models.DateTimeField(null=True, blank=True)
    # FIX: choices ajoutés pour éviter les valeurs libres
    statut     = models.CharField(max_length=10, null=True, blank=True, choices=STATUT_CHOICES)
    class Meta:
        db_table = 'annee'
    def __str__(self):
        return self.lib_annee or self.code_annee
    @property
    def est_en_cours(self):
        return self.statut == 'EN COURS'


# ─────────────────────────────────────────
# Structure académique
# ─────────────────────────────────────────
class Etablissement(models.Model):
    TYPE_CHOICES = [
        ('PRIMAIRE',   'Primaire'),
        ('SECONDAIRE', 'Secondaire'),
        ('SUPERIEUR',  'Supérieur'),
    ]
    STATUT_CHOICES = [
        ('PUBLIC',        'Public'),
        ('PRIVE_LAIQUE',  'Privé laïque'),
        ('CONFESSIONNEL', 'Confessionnel'),
    ]
    SYSTEME_CHOICES = [
        ('FRANCOPHONE', 'Francophone'),
        ('ANGLOPHONE',  'Anglophone'),
        ('BILINGUE',    'Bilingue'),
    ]
    REGIONS = [
        ('ADAMAOUA',    'Adamaoua'),
        ('CENTRE',      'Centre'),
        ('EST',         'Est'),
        ('EXTREME_NORD','Extrême-Nord'),
        ('LITTORAL',    'Littoral'),
        ('NORD',        'Nord'),
        ('NORD_OUEST',  'Nord-Ouest'),
        ('OUEST',       'Ouest'),
        ('SUD',         'Sud'),
        ('SUD_OUEST',   'Sud-Ouest'),
    ]
    code_etab           = models.CharField(max_length=10, primary_key=True)
    lib_etab            = models.CharField(max_length=200)
    sigle               = models.CharField(max_length=20, blank=True)
    type_etab           = models.CharField(max_length=20, choices=TYPE_CHOICES, default='SUPERIEUR')
    statut              = models.CharField(max_length=20, choices=STATUT_CHOICES, default='PRIVE_LAIQUE')
    systeme             = models.CharField(max_length=15, choices=SYSTEME_CHOICES, default='FRANCOPHONE')
    region              = models.CharField(max_length=20, choices=REGIONS, null=True, blank=True)
    ville               = models.CharField(max_length=100, null=True, blank=True)
    adresse             = models.CharField(max_length=45, null=True, blank=True)
    telephone           = models.CharField(max_length=20, null=True, blank=True)
    tel                 = models.CharField(max_length=30, null=True, blank=True)
    fax                 = models.CharField(max_length=30, null=True, blank=True)
    email               = models.CharField(max_length=100, null=True, blank=True)
    site_web            = models.CharField(max_length=200, null=True, blank=True)
    siteweb             = models.CharField(max_length=100, null=True, blank=True, db_column='Siteweb')
    logo                = models.ImageField(upload_to='logos/', blank=True, null=True)
    code_type           = models.ForeignKey(TypeEtab, on_delete=models.CASCADE, db_column='code_type', null=True, blank=True)
    ministere_tutelle   = models.CharField(max_length=200, null=True, blank=True)
    numero_autorisation = models.CharField(max_length=100, null=True, blank=True)
    numero_agrement     = models.CharField(max_length=50, null=True, blank=True)
    date_agrement       = models.DateField(null=True, blank=True)
    directeur           = models.CharField(max_length=150, null=True, blank=True)
    date_creation       = models.DateField(null=True, blank=True)
    actif               = models.BooleanField(default=True)
    class Meta:
        db_table = 'etablissement'
    def __str__(self):
        return self.lib_etab

# NEW: niveau intermédiaire manquant — Faculté/École/Institut entre Etablissement et Département
class Faculte(models.Model):
    code_faculte = models.CharField(max_length=10, primary_key=True)
    lib_faculte  = models.CharField(max_length=100)
    obs_faculte  = models.CharField(max_length=100, null=True, blank=True)
    code_etab    = models.ForeignKey(
        Etablissement, on_delete=models.RESTRICT, db_column='code_etab'
    )
    class Meta:
        db_table = 'faculte'
    def __str__(self):
        return self.lib_faculte

class Departement(models.Model):
    code_dep     = models.CharField(max_length=10, primary_key=True, db_column='Code_dep')
    lib_dep      = models.CharField(max_length=100)
    obs_dep      = models.CharField(max_length=100, null=True, blank=True)
    code_etab    = models.ForeignKey(
        Etablissement, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_etab'
    )
    # NEW: lien vers la faculté de rattachement
    code_faculte = models.ForeignKey(
        Faculte, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_faculte'
    )
    etablissement = models.ForeignKey(
        Etablissement, on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table = 'departement'
    def __str__(self):
        return self.lib_dep

class Specialite(models.Model):
    code_sp  = models.CharField(max_length=10, primary_key=True)
    lib_sp   = models.CharField(max_length=70)
    obs_sp   = models.CharField(max_length=50, null=True, blank=True)
    code_dep = models.ForeignKey(Departement, on_delete=models.RESTRICT, db_column='code_dep')
    etablissement = models.ForeignKey(
        Etablissement, on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table = 'specialite'
    def __str__(self):
        return self.lib_sp

class Cycle(models.Model):
    code_cycle   = models.CharField(max_length=10, primary_key=True)
    lib_cycle    = models.CharField(max_length=45)
    obs_cycle    = models.CharField(max_length=45, null=True, blank=True)
    code_pension = models.ForeignKey(
        Pension, on_delete=models.SET_NULL, null=True, blank=True, db_column='Code_pension'
    )
    class Meta:
        db_table = 'cycle'
    def __str__(self):
        return self.lib_cycle

class Niveau(models.Model):
    code_niveau  = models.PositiveIntegerField(primary_key=True)
    lib_niveau   = models.CharField(max_length=25)
    obs_niveau   = models.CharField(max_length=45, null=True, blank=True)
    code_cycle   = models.ForeignKey(
        Cycle, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_cycle'
    )
    # FIX: était PositiveIntegerField brut — doit être une vraie FK
    code_pension = models.ForeignKey(
        Pension, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_pension'
    )
    code_annee   = models.ForeignKey(
        Annee, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_annee'
    )
    class Meta:
        db_table = 'niveau'
    def __str__(self):
        return self.lib_niveau

class Classe(models.Model):
    code_classe     = models.CharField(max_length=10, primary_key=True)
    lib_classe      = models.CharField(max_length=100)
    obs_classe      = models.CharField(max_length=45, null=True, blank=True)
    code_dep        = models.ForeignKey(
        Departement, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_dep'
    )
    # FIX: étaient des CharField bruts — intégrité référentielle brisée
    code_niveau     = models.ForeignKey(
        Niveau, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_niveau'
    )
    niveau_scolaire = models.ForeignKey(
        'NiveauScolaire', on_delete=models.SET_NULL, null=True, blank=True,
        db_column='niveau_scolaire', related_name='classes'
    )
    code_bat    = models.ForeignKey(
        Batiment, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_bat'
    )
    code_salle  = models.ForeignKey(
        Salle, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_salle'
    )
    eff_max     = models.PositiveIntegerField(default=50, db_column='EffMax')
    code_sp     = models.ForeignKey(
        Specialite, on_delete=models.SET_NULL, null=True, blank=True,
        db_column='code_sp', related_name='classes'
    )
    etablissement = models.ForeignKey(
        Etablissement, on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table = 'classe'
    def __str__(self):
        return self.lib_classe

class MentionClasse(models.Model):
    code_classe  = models.ForeignKey(Classe,  on_delete=models.RESTRICT, db_column='code_classe')
    code_mention = models.ForeignKey(Mention, on_delete=models.RESTRICT, db_column='code_mention')
    obs_mention  = models.CharField(max_length=45, default='')
    class Meta:
        db_table        = 'mention_classe'
        unique_together = (('code_classe', 'code_mention'),)


# ─────────────────────────────────────────
# Personnes
# ─────────────────────────────────────────
class Etudiant(models.Model):
    SEXE_CHOICES = [('M', 'Masculin'), ('F', 'Féminin')]
    mle_etudiant = models.CharField(max_length=20, primary_key=True)
    nom          = models.CharField(max_length=45)
    prenom       = models.CharField(max_length=45, null=True, blank=True)
    # NEW: champ obligatoire pour les rapports MINESUP et statistiques
    sexe         = models.CharField(max_length=1, choices=SEXE_CHOICES, null=True, blank=True)
    # FIX: était DateTimeField — une date de naissance n'a pas d'heure
    date_naiss   = models.DateField(null=True, blank=True)
    lieu         = models.CharField(max_length=25, null=True, blank=True)
    region_or    = models.CharField(max_length=25, null=True, blank=True)
    # NEW: requis pour le suivi des étudiants étrangers et rapports MINESUP
    nationalite  = models.CharField(max_length=30, default='Camerounaise', null=True, blank=True)
    # NEW: requis pour l'émission des diplômes et convocations officielles
    numero_cni   = models.CharField(max_length=20, null=True, blank=True)
    code_dep     = models.ForeignKey(
        Departement, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_dep'
    )
    code_sp      = models.ForeignKey(
        Specialite, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_sp'
    )
    nom_pere     = models.CharField(max_length=45, null=True, blank=True)
    nom_mere     = models.CharField(max_length=45, null=True, blank=True)
    adresse      = models.CharField(max_length=45, null=True, blank=True)
    tel          = models.CharField(max_length=30, null=True, blank=True)
    email        = models.CharField(max_length=50, null=True, blank=True)
    domicile     = models.CharField(max_length=45, null=True, blank=True)
    nom_tuteur   = models.CharField(max_length=45, db_column='Nom_tuteur')
    # DEPRECATED: stocker les photos en BinaryField est très mauvais pour les perfs.
    # Utiliser le champ 'chemin' pour stocker le chemin du fichier.
    photo        = models.BinaryField(null=True, blank=True)
    chemin       = models.CharField(max_length=254, null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at   = models.DateTimeField(auto_now=True, null=True, blank=True)
    etablissement = models.ForeignKey(
        'Etablissement', on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table = 'etudiant'
    def __str__(self):
        return f"{self.nom} {self.prenom or ''}".strip()

class Enseignant(models.Model):
    STATUT_CHOICES = [
        ('PERMANENT',     'Permanent'),
        ('VACATAIRE',     'Vacataire'),
        ('CONTRACTUEL',   'Contractuel'),
        ('FONCTIONNAIRE', 'Fonctionnaire'),
    ]
    SEXE_CHOICES = [('M', 'Masculin'), ('F', 'Féminin')]
    mle_ens     = models.CharField(max_length=10, primary_key=True)
    nom_ens     = models.CharField(max_length=25)
    prenom_ens  = models.CharField(max_length=25, null=True, blank=True)
    sexe        = models.CharField(max_length=1, choices=SEXE_CHOICES, null=True, blank=True)
    numero_cni  = models.CharField(max_length=20, null=True, blank=True)
    adresse_ens = models.CharField(max_length=45, null=True, blank=True)
    tel_ens     = models.CharField(max_length=30, null=True, blank=True)
    email_ens   = models.CharField(max_length=45, null=True, blank=True)
    code_dep    = models.ForeignKey(
        Departement, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_dep'
    )
    # FIX: choices ajoutés — statuts standards des enseignants au Cameroun
    statut      = models.CharField(max_length=15, null=True, blank=True, choices=STATUT_CHOICES)
    etablissement = models.ForeignKey(
        'Etablissement', on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table = 'enseignant'
    def __str__(self):
        return f"{self.nom_ens} {self.prenom_ens or ''}".strip()

class Utilisateur(models.Model):
    ROLE_CHOICES = [
        ('ADMIN',      'Administrateur'),
        ('SCOLARITE',  'Scolarité'),
        ('ENSEIGNANT', 'Enseignant'),
        ('COMPTABLE',  'Comptable'),
        ('ETUDIANT',   'Étudiant'),
        ('DIRECTION',  'Direction'),
    ]
    login    = models.CharField(max_length=15, primary_key=True)
    passwd   = models.CharField(max_length=255)
    nom_user = models.CharField(max_length=50, null=True, blank=True)
    # FIX: default était 'USER' (inexistant dans le système de rôles)
    role     = models.CharField(max_length=20, default='ETUDIANT', choices=ROLE_CHOICES)
    class Meta:
        db_table = 'utilisateur'
    def __str__(self):
        return self.login


# ─────────────────────────────────────────
# Tuteurs / Parents
# ─────────────────────────────────────────
class Tuteur(models.Model):
    code_tuteur  = models.AutoField(primary_key=True)
    nom          = models.CharField(max_length=50)
    prenom       = models.CharField(max_length=50, null=True, blank=True)
    lien_parente = models.CharField(max_length=20)
    tel          = models.CharField(max_length=30, null=True, blank=True)
    email        = models.CharField(max_length=50, null=True, blank=True)
    adresse      = models.CharField(max_length=100, null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'tuteur'
    def __str__(self):
        return f"{self.nom} {self.prenom or ''} ({self.lien_parente})"

class EtudiantTuteur(models.Model):
    mle_etudiant          = models.ForeignKey(Etudiant, on_delete=models.CASCADE, db_column='mle_etudiant')
    code_tuteur           = models.ForeignKey(Tuteur,   on_delete=models.CASCADE, db_column='code_tuteur')
    est_contact_principal = models.BooleanField(default=False)
    class Meta:
        db_table        = 'etudiant_tuteur'
        unique_together = (('mle_etudiant', 'code_tuteur'),)


# ─────────────────────────────────────────
# Scolarité & Paiements
# ─────────────────────────────────────────
class Tranche(models.Model):
    code_tranche = models.AutoField(primary_key=True)
    lib_tranche  = models.CharField(max_length=10)
    code_pension = models.ForeignKey(Pension, on_delete=models.RESTRICT, db_column='code_pension')
    obs_tranche  = models.CharField(max_length=45, null=True, blank=True)
    mt_tranche   = models.PositiveIntegerField(default=0)
    class Meta:
        db_table = 'tranche'
    def __str__(self):
        return self.lib_tranche

class Frais(models.Model):
    code_frais = models.PositiveIntegerField(primary_key=True)
    lib_frais  = models.CharField(max_length=30)
    obs_frais  = models.CharField(max_length=45, null=True, blank=True)
    type_frais = models.CharField(max_length=25)
    mt_frais   = models.FloatField(default=0)
    code_annee = models.ForeignKey(
        Annee, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_annee'
    )
    class Meta:
        db_table = 'frais'
    def __str__(self):
        return self.lib_frais

class Inscription(models.Model):
    code_inscription = models.AutoField(primary_key=True)
    code_classe      = models.ForeignKey(Classe,   on_delete=models.CASCADE, db_column='code_classe')
    mle_etudiant     = models.ForeignKey(Etudiant, on_delete=models.CASCADE, db_column='mle_etudiant')
    code_annee       = models.ForeignKey(Annee,    on_delete=models.CASCADE, db_column='code_annee')
    date_inscription = models.DateTimeField(null=True, blank=True)
    mt_inscription   = models.PositiveIntegerField(default=0)
    updated_at       = models.DateTimeField(auto_now=True, null=True, blank=True)
    etablissement = models.ForeignKey(
        'Etablissement', on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table        = 'inscription'
        # FIX: contrainte manquante — un étudiant ne peut être inscrit qu'une fois par année
        unique_together = (('mle_etudiant', 'code_annee'),)
    def __str__(self):
        return f"Inscription {self.code_inscription}"

class FraisInscription(models.Model):
    code_inscription = models.ForeignKey(Inscription, on_delete=models.CASCADE, db_column='code_inscription')
    code_frais       = models.ForeignKey(Frais,       on_delete=models.CASCADE, db_column='code_frais')
    date_frais       = models.DateTimeField(null=True, blank=True)
    class Meta:
        db_table = 'frais_inscription'

class Paiement(models.Model):
    TYPE_CHOICES = [
        ('SCOLARITE',          'Scolarité'),
        ('INSCRIPTION',        'Inscription'),
        ('EXAMEN_BTS',         'Frais d\'examen BTS'),
        ('SOUTENANCE_BTS',     'Frais de soutenance BTS'),
        ('SOUTENANCE_LICENCE', 'Frais de soutenance Licence'),
        ('SOUTENANCE_MASTER',  'Frais de soutenance Master'),
    ]
    STATUT_CHOICES = [
        ('EN_ATTENTE', 'En attente'),
        ('PAYE',       'Payé'),
        ('ANNULE',     'Annulé'),
        ('REMBOURSE',  'Remboursé'),
    ]
    code_paiement  = models.AutoField(primary_key=True)
    mle_etudiant   = models.ForeignKey(Etudiant, on_delete=models.RESTRICT, db_column='mle_etudiant')
    type_paiement  = models.CharField(max_length=20, default='SCOLARITE', choices=TYPE_CHOICES)
    code_tranche   = models.ForeignKey(Tranche, on_delete=models.RESTRICT, db_column='code_tranche',
                                       null=True, blank=True)
    date_paiement  = models.DateTimeField(null=True, blank=True)
    mt_paiement    = models.PositiveIntegerField(default=0)
    obs_paiement   = models.CharField(max_length=45, default='')
    statut         = models.CharField(max_length=20, default='EN_ATTENTE', null=True, blank=True, choices=STATUT_CHOICES)
    updated_at     = models.DateTimeField(auto_now=True, null=True, blank=True)
    code_annee     = models.ForeignKey(Annee, on_delete=models.RESTRICT, db_column='code_annee')
    etablissement = models.ForeignKey(
        'Etablissement', on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table = 'paiement'
    def __str__(self):
        return f"Paiement {self.code_paiement}"

class Moratoire(models.Model):
    code_mor     = models.AutoField(primary_key=True)
    lib_mor      = models.CharField(max_length=45, null=True, blank=True)
    date_exp     = models.DateTimeField(null=True, blank=True)
    date_effet   = models.DateTimeField(null=True, blank=True)
    mle_etudiant = models.ForeignKey(Etudiant, on_delete=models.RESTRICT, db_column='mle_etudiant')
    class Meta:
        db_table = 'moratoire'
    def __str__(self):
        return self.lib_mor or f"Moratoire {self.code_mor}"

class Facture(models.Model):
    STATUT_CHOICES = [
        ('EN_ATTENTE',          'En attente'),
        ('PARTIELLEMENT_PAYEE', 'Partiellement payée'),
        ('SOLDEE',              'Soldée'),
        ('ANNULEE',             'Annulée'),
    ]
    code_facture   = models.AutoField(primary_key=True)
    numero_facture = models.CharField(max_length=30, unique=True)
    mle_etudiant   = models.ForeignKey(Etudiant, on_delete=models.RESTRICT, db_column='mle_etudiant')
    code_annee     = models.ForeignKey(Annee, on_delete=models.RESTRICT, db_column='code_annee')
    # FIX: était DateTimeField(auto_now_add) — doublon avec created_at.
    # Maintenant DateField explicitement settable (utile pour l'antédatage).
    date_emission  = models.DateField(null=True, blank=True)
    montant_total  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    montant_paye   = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    statut         = models.CharField(max_length=25, default='EN_ATTENTE', choices=STATUT_CHOICES)
    observations   = models.TextField(null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)
    etablissement = models.ForeignKey(
        'Etablissement', on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table = 'facture'
    def __str__(self):
        return self.numero_facture
    @property
    def montant_restant(self):
        return self.montant_total - self.montant_paye

class FactureDetail(models.Model):
    id            = models.AutoField(primary_key=True)
    code_facture  = models.ForeignKey(Facture, on_delete=models.CASCADE, db_column='code_facture')
    libelle       = models.CharField(max_length=100)
    type_frais    = models.CharField(max_length=30)
    montant       = models.DecimalField(max_digits=10, decimal_places=2)
    date_echeance = models.DateField(null=True, blank=True)
    class Meta:
        db_table = 'facture_detail'

class RapportFinancier(models.Model):
    code_rapport_fin  = models.AutoField(primary_key=True)
    code_annee        = models.ForeignKey(Annee, on_delete=models.RESTRICT, db_column='code_annee')
    periode_debut     = models.DateField()
    periode_fin       = models.DateField()
    total_attendu     = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_encaisse    = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    nb_etudiants      = models.PositiveIntegerField(default=0)
    nb_etudiants_jour = models.PositiveIntegerField(default=0)
    genere_par        = models.CharField(max_length=50, null=True, blank=True)
    genere_le         = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'rapport_financier'
    @property
    def total_impaye(self):
        return self.total_attendu - self.total_encaisse
    @property
    def taux_recouvrement(self):
        if self.total_attendu > 0:
            return round((self.total_encaisse / self.total_attendu) * 100, 2)
        return 0


# ─────────────────────────────────────────
# Pédagogie
# ─────────────────────────────────────────
class Matiere(models.Model):
    code_matiere = models.CharField(max_length=20, primary_key=True)
    lib_matiere  = models.CharField(max_length=60)
    obs_matiere  = models.CharField(max_length=45, null=True, blank=True, db_column='Obs_matiere')
    code_module  = models.ForeignKey(Module, on_delete=models.RESTRICT, db_column='Code_module')
    class Meta:
        db_table = 'matiere'
    def __str__(self):
        return self.lib_matiere

class Qualification(models.Model):
    pk           = CompositePrimaryKey('code_matiere_id', 'mle_ens_id')
    code_matiere = models.ForeignKey(Matiere,    on_delete=models.RESTRICT, db_column='code_matiere')
    mle_ens      = models.ForeignKey(Enseignant, on_delete=models.RESTRICT, db_column='mle_ens')
    obs_qual     = models.CharField(max_length=45, null=True, blank=True)
    class Meta:
        db_table = 'qualification'

class Cours(models.Model):
    """Attribution : matière enseignée à une classe pour un semestre donné."""
    SEMESTRE_CHOICES = [
        ('S1', 'Semestre 1'),
        ('S2', 'Semestre 2'),
    ]
    code_matiere  = models.ForeignKey(Matiere,    on_delete=models.RESTRICT, db_column='code_matiere')
    code_classe   = models.ForeignKey(Classe,     on_delete=models.CASCADE,  db_column='code_classe')
    mle_ens       = models.ForeignKey(
        Enseignant, on_delete=models.SET_NULL, null=True, blank=True, db_column='mle_ens'
    )
    semestre      = models.CharField(max_length=2, choices=SEMESTRE_CHOICES)
    code_annee    = models.ForeignKey(Annee, on_delete=models.RESTRICT, db_column='code_annee')
    quota_horaire = models.PositiveIntegerField(default=20,
                        help_text="Nombre total d'heures prévu sur le semestre (ex: 20h, 30h, 45h)")
    credits       = models.PositiveIntegerField(default=0,
                        help_text="Crédits LMD attribués à cette matière")
    groupes       = models.CharField(max_length=200, null=True, blank=True,
                        help_text="Groupes/spécialités concernés pour les cours tronc commun en amphi (ex: GI1, GL1, IA1)")
    etablissement = models.ForeignKey(
        'Etablissement', on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table        = 'cours'
        unique_together = (('code_matiere', 'code_classe', 'semestre', 'code_annee'),)
    def __str__(self):
        return f"{self.code_matiere} — {self.code_classe} — {self.semestre}"

class UniteEnseignement(models.Model):
    pk            = CompositePrimaryKey('code_matiere_id', 'code_classe_id')
    code_matiere  = models.ForeignKey(Matiere,    on_delete=models.RESTRICT, db_column='code_matiere')
    code_classe   = models.ForeignKey(Classe,     on_delete=models.CASCADE,  db_column='code_classe')
    coef          = models.PositiveIntegerField(default=0)
    duree_eval    = models.PositiveIntegerField(default=0)
    nbh_total     = models.PositiveIntegerField(default=0)
    mle_ens       = models.ForeignKey(Enseignant, on_delete=models.RESTRICT, db_column='mle_ens')
    code_annee    = models.ForeignKey(Annee,      on_delete=models.RESTRICT, db_column='code_annee')
    note_elim     = models.PositiveIntegerField(null=True, blank=True)
    credits_ects  = models.PositiveIntegerField(default=3)
    class Meta:
        db_table = 'unite_enseignement'

class Periode(models.Model):
    code_periode = models.PositiveIntegerField(primary_key=True)
    lib_periode  = models.CharField(max_length=20)
    date_debut   = models.DateTimeField(null=True, blank=True)
    date_fin     = models.DateTimeField(null=True, blank=True)
    obs_periode  = models.CharField(max_length=45, null=True, blank=True)
    code_annee   = models.ForeignKey(
        Annee, on_delete=models.RESTRICT, null=True, blank=True, db_column='code_annee'
    )
    class Meta:
        db_table = 'periode'
    def __str__(self):
        return self.lib_periode

class Evaluation(models.Model):
    code_eval      = models.AutoField(primary_key=True)
    mle_etudiant   = models.ForeignKey(Etudiant,       on_delete=models.CASCADE,  db_column='mle_etudiant')
    code_matiere   = models.ForeignKey(Matiere,        on_delete=models.CASCADE,  db_column='code_matiere')
    code_classe    = models.ForeignKey(Classe,         on_delete=models.CASCADE,  db_column='code_classe')
    date_eval      = models.DateTimeField(null=True, blank=True)
    note           = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(0), MaxValueValidator(20)],
    )
    obs_eval       = models.CharField(max_length=45, null=True, blank=True)
    code_periode   = models.ForeignKey(Periode,        on_delete=models.CASCADE,  db_column='code_periode')
    # FIX: db_column standardisé en snake_case (était 'code_typeEval')
    code_type_eval = models.ForeignKey(TypeEvaluation, on_delete=models.CASCADE,  db_column='code_type_eval')
    created_at     = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at     = models.DateTimeField(auto_now=True, null=True, blank=True)
    etablissement = models.ForeignKey(
        'Etablissement', on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table = 'evaluation'
    def __str__(self):
        return f"Eval {self.code_eval} — {self.note}/20"

class FicheNotes(models.Model):
    STATUT_CHOICES = [
        ('BROUILLON', 'Brouillon'),
        ('VALIDE',    'Validé'),
        ('IMPORTE',   'Importé'),
    ]
    code_fiche      = models.AutoField(primary_key=True)
    code_matiere    = models.ForeignKey(Matiere,        on_delete=models.RESTRICT, db_column='code_matiere')
    code_classe     = models.ForeignKey(Classe,         on_delete=models.CASCADE,  db_column='code_classe')
    mle_ens         = models.ForeignKey(Enseignant,     on_delete=models.RESTRICT, db_column='mle_ens')
    code_periode    = models.ForeignKey(Periode,        on_delete=models.RESTRICT, db_column='code_periode')
    code_annee      = models.ForeignKey(Annee,          on_delete=models.RESTRICT, db_column='code_annee')
    # FIX: db_column standardisé en snake_case (était 'code_type_eval' incohérent avec TypeEvaluation)
    code_type_eval  = models.ForeignKey(TypeEvaluation, on_delete=models.RESTRICT, db_column='code_type_eval')
    date_evaluation = models.DateField()
    duree_minutes   = models.PositiveIntegerField(null=True, blank=True)
    bareme          = models.DecimalField(max_digits=5, decimal_places=2, default=20)
    statut          = models.CharField(max_length=20, default='BROUILLON', choices=STATUT_CHOICES)
    observations    = models.TextField(null=True, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)
    etablissement = models.ForeignKey(
        'Etablissement', on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table = 'fiche_notes'
    def __str__(self):
        return f"Fiche {self.code_fiche} — {self.code_matiere} — {self.statut}"

class FicheNotesDetail(models.Model):
    id           = models.AutoField(primary_key=True)
    code_fiche   = models.ForeignKey(FicheNotes, on_delete=models.CASCADE, db_column='code_fiche')
    mle_etudiant = models.ForeignKey(Etudiant,   on_delete=models.CASCADE, db_column='mle_etudiant')
    note         = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    absent       = models.BooleanField(default=False)
    observation  = models.CharField(max_length=100, null=True, blank=True)
    class Meta:
        db_table        = 'fiche_notes_detail'
        unique_together = (('code_fiche', 'mle_etudiant'),)


# ─────────────────────────────────────────
# Planning & Rapports
# ─────────────────────────────────────────
class Planning(models.Model):
    """
    Emploi du temps — supporte deux systèmes :
    • HEBDO    : créneau fixe récurrent chaque semaine (ex: Lundi 08h-10h)
    • INTENSIF : semaine entière dédiée à une seule matière (ex: du 03/02 au 07/02, 4h/jour)
    Dans les deux cas, on peut préciser si c'est un cours du jour ou du soir (type_seance).
    """
    TYPE_PLANNING = [
        ('HEBDO',    'Hebdomadaire (créneau fixe chaque semaine)'),
        ('INTENSIF', 'Intensif (semaine entière dédiée à une matière)'),
    ]
    TYPE_SEANCE = [
        ('CM',   'Cours Magistral'),
        ('TD',   'Travaux Dirigés'),
        ('TP',   'Travaux Pratiques'),
        ('SOIR', 'Cours du soir'),
    ]

    code_cours    = models.ForeignKey(
        Cours, on_delete=models.CASCADE,
        help_text="Attribution (matière + classe + semestre) concernée"
    )
    type_planning = models.CharField(max_length=10, choices=TYPE_PLANNING, default='HEBDO')
    type_seance   = models.CharField(max_length=5,  choices=TYPE_SEANCE,   default='CM')
    h_debut       = models.TimeField(help_text="Heure de début (ex : 08:00)")
    h_fin         = models.TimeField(help_text="Heure de fin   (ex : 10:00)")
    code_salle    = models.ForeignKey(
        Salle, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_salle'
    )

    # ── Système HEBDO ─────────────────────────────────────────────────────────
    # Requis si type_planning = 'HEBDO'. Jour de la semaine du créneau récurrent.
    code_jour     = models.ForeignKey(
        Jour, on_delete=models.RESTRICT, null=True, blank=True, db_column='code_jour'
    )

    # ── Système INTENSIF ──────────────────────────────────────────────────────
    # Requis si type_planning = 'INTENSIF'. Plage de la semaine dédiée.
    date_debut    = models.DateField(null=True, blank=True,
                        help_text="Premier jour de la semaine intensive (ex: 2026-02-03)")
    date_fin      = models.DateField(null=True, blank=True,
                        help_text="Dernier jour de la semaine intensive (ex: 2026-02-07)")

    class Meta:
        db_table = 'planning'

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.type_planning == 'HEBDO' and not self.code_jour_id:
            raise ValidationError(
                {'code_jour': "Le jour de la semaine est requis pour un planning hebdomadaire."}
            )
        if self.type_planning == 'INTENSIF' and (not self.date_debut or not self.date_fin):
            raise ValidationError(
                {'date_debut': "Les dates de début et de fin sont requises pour un planning intensif."}
            )
        if self.date_debut and self.date_fin and self.date_debut > self.date_fin:
            raise ValidationError({'date_fin': "La date de fin doit être après la date de début."})

    def __str__(self):
        cours = str(self.code_cours)
        if self.type_planning == 'HEBDO':
            return f"{cours} — {self.code_jour} {self.h_debut}-{self.h_fin} ({self.get_type_seance_display()})"
        return f"{cours} — Intensif {self.date_debut} → {self.date_fin} ({self.get_type_seance_display()})"

class RapportCours(models.Model):
    code_lgnrapport = models.AutoField(primary_key=True)
    code_matiere    = models.ForeignKey(Matiere,    on_delete=models.RESTRICT, db_column='code_matiere')
    code_classe     = models.ForeignKey(Classe,     on_delete=models.RESTRICT, db_column='code_classe')
    code_rapport    = models.ForeignKey(Rapport,    on_delete=models.RESTRICT, db_column='code_rapport')
    mle_ens         = models.ForeignKey(Enseignant, on_delete=models.RESTRICT, db_column='mle_ens')
    detail_rapport  = models.CharField(max_length=45)
    class Meta:
        db_table = 'rapport_cours'

class Seance(models.Model):
    STATUT_CHOICES = [
        ('TENU',    'Tenu'),
        ('ANNULE',  'Annulé'),
        ('REPORTE', 'Reporté'),
    ]
    code_seance          = models.AutoField(primary_key=True)
    code_matiere         = models.ForeignKey(Matiere,    on_delete=models.RESTRICT, db_column='code_matiere')
    code_classe          = models.ForeignKey(Classe,     on_delete=models.CASCADE,  db_column='code_classe')
    mle_ens              = models.ForeignKey(Enseignant, on_delete=models.RESTRICT, db_column='mle_ens')
    code_annee           = models.ForeignKey(Annee,      on_delete=models.RESTRICT, db_column='code_annee')
    date_seance          = models.DateField()
    h_debut              = models.TimeField()
    h_fin                = models.TimeField()
    salle                = models.CharField(max_length=20, null=True, blank=True)
    nb_heures_effectuees = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    statut               = models.CharField(max_length=15, default='TENU', choices=STATUT_CHOICES)
    observations         = models.CharField(max_length=200, null=True, blank=True)
    created_at           = models.DateTimeField(auto_now_add=True)
    etablissement = models.ForeignKey(
        'Etablissement', on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table = 'seance'
    def __str__(self):
        return f"Séance {self.code_seance} — {self.code_matiere} — {self.date_seance}"

class Absence(models.Model):
    code_absence = models.AutoField(primary_key=True)
    code_seance  = models.ForeignKey(Seance,   on_delete=models.CASCADE, db_column='code_seance')
    mle_etudiant = models.ForeignKey(Etudiant, on_delete=models.CASCADE, db_column='mle_etudiant')
    present      = models.BooleanField(default=False)
    signe        = models.BooleanField(default=False)
    motif        = models.CharField(max_length=100, null=True, blank=True)
    justifiee    = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table        = 'absence'
        unique_together = (('code_seance', 'mle_etudiant'),)
    def __str__(self):
        statut = 'Présent' if self.present else 'Absent'
        return f"{self.mle_etudiant} — {self.code_seance} — {statut}"


# ─────────────────────────────────────────
# Gestion interne
# ─────────────────────────────────────────
class Examen(models.Model):
    TYPE_CHOICES = [
        ('ECRIT',      'Écrit'),
        ('ORAL',       'Oral'),
        ('PRATIQUE',   'Pratique'),
        ('TP',         'Travaux Pratiques'),
        ('RATTRAPAGE', 'Session de rattrapage'),
    ]
    code_examen         = models.AutoField(primary_key=True)
    lib_examen          = models.CharField(max_length=100)
    code_matiere        = models.ForeignKey(Matiere, on_delete=models.RESTRICT, db_column='code_matiere')
    code_classe         = models.ForeignKey(Classe,  on_delete=models.CASCADE,  db_column='code_classe')
    code_annee          = models.ForeignKey(Annee,   on_delete=models.RESTRICT, db_column='code_annee')
    code_periode        = models.ForeignKey(
        Periode, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_periode'
    )
    code_salle          = models.CharField(max_length=5, null=True, blank=True)
    date_examen         = models.DateTimeField()
    duree_minutes       = models.PositiveIntegerField(default=60)
    # FIX: choices ajoutés — 'RATTRAPAGE' manquait
    type_examen         = models.CharField(max_length=30, default='ECRIT', choices=TYPE_CHOICES)
    surveillant         = models.CharField(max_length=10, null=True, blank=True)
    convocation_envoyee = models.BooleanField(default=False)
    created_at          = models.DateTimeField(auto_now_add=True)
    etablissement = models.ForeignKey(
        'Etablissement', on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table = 'examen'
    def __str__(self):
        return self.lib_examen

class Convocation(models.Model):
    code_convocation  = models.AutoField(primary_key=True)
    type_convocation  = models.CharField(max_length=20, default='EXAMEN')
    destinataire_type = models.CharField(max_length=20, default='ETUDIANT')
    mle_etudiant      = models.ForeignKey(
        Etudiant, on_delete=models.SET_NULL, null=True, blank=True, db_column='mle_etudiant'
    )
    mle_ens           = models.ForeignKey(
        Enseignant, on_delete=models.SET_NULL, null=True, blank=True, db_column='mle_ens'
    )
    code_examen       = models.ForeignKey(
        Examen, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_examen'
    )
    objet             = models.CharField(max_length=200)
    date_evenement    = models.DateTimeField()
    lieu              = models.CharField(max_length=100, null=True, blank=True)
    message           = models.TextField(null=True, blank=True)
    date_envoi        = models.DateTimeField(null=True, blank=True)
    statut            = models.CharField(max_length=15, default='CREEE')
    created_at        = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'convocation'
    def __str__(self):
        return f"Convocation {self.code_convocation} — {self.objet}"

class RapportStatistique(models.Model):
    code_rapport_stat = models.AutoField(primary_key=True)
    code_annee        = models.ForeignKey(Annee, on_delete=models.RESTRICT, db_column='code_annee')
    # FIX: étaient des CharField bruts — intégrité référentielle brisée
    code_classe       = models.ForeignKey(
        Classe, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_classe'
    )
    code_dep          = models.ForeignKey(
        Departement, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_dep'
    )
    periode_debut     = models.DateField(null=True, blank=True)
    periode_fin       = models.DateField(null=True, blank=True)
    nb_inscrits       = models.PositiveIntegerField(default=0)
    nb_hommes         = models.PositiveIntegerField(default=0)
    nb_femmes         = models.PositiveIntegerField(default=0)
    nb_admis          = models.PositiveIntegerField(default=0)
    nb_ajournes       = models.PositiveIntegerField(default=0)
    nb_redoubles      = models.PositiveIntegerField(default=0)
    moyenne_generale  = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    note_min          = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    note_max          = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    genere_par        = models.CharField(max_length=50, null=True, blank=True)
    genere_le         = models.DateTimeField(auto_now_add=True)
    etablissement = models.ForeignKey(
        'Etablissement', on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table = 'rapport_statistique'
    @property
    def taux_reussite(self):
        if self.nb_inscrits > 0:
            return round((self.nb_admis / self.nb_inscrits) * 100, 2)
        return 0
    @property
    def taux_feminisation(self):
        if self.nb_inscrits > 0:
            return round((self.nb_femmes / self.nb_inscrits) * 100, 2)
        return 0


# ─────────────────────────────────────────
# Documents avancés
# ─────────────────────────────────────────
class Decision(models.Model):
    SESSION_CHOICES = [
        ('NORMALE',    'Session normale'),
        ('RATTRAPAGE', 'Session de rattrapage'),
    ]
    RESULTAT_CHOICES = [
        ('ADMIS',      'Admis(e)'),
        ('AJOURNE',    'Ajourné(e)'),
        ('REDOUBLE',   'Redoublant(e)'),
        ('EXCLU',      'Exclu(e)'),
        ('EN_ATTENTE', 'En attente de délibération'),
    ]
    code_decision    = models.AutoField(primary_key=True)
    mle_etudiant     = models.ForeignKey(Etudiant, on_delete=models.RESTRICT, db_column='mle_etudiant')
    code_annee       = models.ForeignKey(Annee,    on_delete=models.RESTRICT, db_column='code_annee')
    code_classe      = models.ForeignKey(Classe,   on_delete=models.RESTRICT, db_column='code_classe')
    # NEW: distingue session normale et rattrapage — était impossible avant
    session          = models.CharField(max_length=15, default='NORMALE', choices=SESSION_CHOICES)
    moyenne_annuelle = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    total_credits    = models.PositiveIntegerField(default=0)
    credits_valides  = models.PositiveIntegerField(default=0)
    resultat         = models.CharField(max_length=20, choices=RESULTAT_CHOICES)
    mention          = models.CharField(max_length=20, null=True, blank=True)
    rang             = models.PositiveIntegerField(null=True, blank=True)
    effectif         = models.PositiveIntegerField(null=True, blank=True)
    date_deliberation = models.DateTimeField(null=True, blank=True)
    president_jury   = models.CharField(max_length=100, null=True, blank=True)
    observations     = models.TextField(null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    etablissement = models.ForeignKey(
        'Etablissement', on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table        = 'decision'
        # FIX: 'session' ajouté — permet d'avoir normale + rattrapage pour le même étudiant/année
        unique_together = (('mle_etudiant', 'code_annee', 'session'),)
    def __str__(self):
        return f"{self.mle_etudiant} — {self.resultat} — {self.code_annee} ({self.session})"

class Diplome(models.Model):
    TYPE_CHOICES = [
        ('LICENCE',     'Licence'),
        ('LICENCE_PRO', 'Licence Professionnelle'),
        ('MASTER',      'Master'),
        ('MASTER_PRO',  'Master Professionnel'),
        ('DOCTORAT',    'Doctorat / PhD'),
        ('BTS',         'Brevet de Technicien Supérieur'),
        ('HND',         'Higher National Diploma'),
        ('DUT',         'Diplôme Universitaire de Technologie'),
        ('INGENIEUR',   "Diplôme d'Ingénieur"),
        ('DEA',         'DEA'),
        ('DESS',        'DESS'),
        ('AUTRE',       'Autre'),
    ]
    code_diplome    = models.AutoField(primary_key=True)
    mle_etudiant    = models.ForeignKey(Etudiant, on_delete=models.RESTRICT, db_column='mle_etudiant')
    # NEW: type structuré (BTS, HND, Licence, Master, etc.) — requis pour les rapports MINESUP
    type_diplome    = models.CharField(max_length=20, choices=TYPE_CHOICES, null=True, blank=True)
    lib_diplome     = models.CharField(max_length=100)
    specialite      = models.CharField(max_length=100, null=True, blank=True)
    mention         = models.CharField(max_length=30, null=True, blank=True)
    annee_obtention = models.CharField(max_length=10)
    numero_serie    = models.CharField(max_length=30, null=True, blank=True, unique=True)
    date_emission   = models.DateField(null=True, blank=True)
    signe_par       = models.CharField(max_length=100, null=True, blank=True)
    qr_code_data    = models.TextField(null=True, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'diplome'
    def __str__(self):
        return f"{self.lib_diplome} — {self.mle_etudiant}"

class CarteEtudiant(models.Model):
    code_carte      = models.AutoField(primary_key=True)
    mle_etudiant    = models.ForeignKey(Etudiant, on_delete=models.CASCADE, db_column='mle_etudiant')
    code_annee      = models.ForeignKey(Annee, on_delete=models.RESTRICT, db_column='code_annee')
    numero_carte    = models.CharField(max_length=20, null=True, blank=True)
    date_emission   = models.DateField(auto_now_add=True)
    date_expiration = models.DateField(null=True, blank=True)
    qr_code_data    = models.TextField(null=True, blank=True)
    statut          = models.CharField(max_length=15, default='ACTIVE')
    created_at      = models.DateTimeField(auto_now_add=True)
    etablissement = models.ForeignKey(
        'Etablissement', on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table        = 'carte_etudiant'
        unique_together = (('mle_etudiant', 'code_annee'),)
    def __str__(self):
        return f"Carte {self.numero_carte} — {self.mle_etudiant}"

class Stage(models.Model):
    TYPE_CHOICES = [
        ('OBSERVATION',   "Stage d'observation"),
        ('IMMERSION',     "Stage d'immersion"),
        ('PFE',           "Projet de Fin d'Études"),
        ('ACADEMIQUE',    'Stage académique'),
        ('PROFESSIONNEL', 'Stage professionnel'),
    ]
    STATUT_CHOICES = [
        ('EN_COURS', 'En cours'),
        ('TERMINE',  'Terminé'),
        ('VALIDE',   'Validé'),
        ('ANNULE',   'Annulé'),
    ]
    code_stage         = models.AutoField(primary_key=True)
    mle_etudiant       = models.ForeignKey(Etudiant, on_delete=models.RESTRICT, db_column='mle_etudiant')
    code_annee         = models.ForeignKey(Annee, on_delete=models.RESTRICT, db_column='code_annee')
    entreprise         = models.CharField(max_length=150)
    adresse_entreprise = models.CharField(max_length=200, null=True, blank=True)
    tuteur_entreprise  = models.CharField(max_length=100, null=True, blank=True)
    date_debut         = models.DateField()
    date_fin           = models.DateField()
    sujet              = models.CharField(max_length=200, null=True, blank=True)
    type_stage         = models.CharField(max_length=30, default='OBSERVATION', choices=TYPE_CHOICES)
    note_stage         = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    statut             = models.CharField(max_length=20, default='EN_COURS', choices=STATUT_CHOICES)
    certificat_emis    = models.BooleanField(default=False)
    date_emission_cert = models.DateField(null=True, blank=True)
    created_at         = models.DateTimeField(auto_now_add=True)
    updated_at         = models.DateTimeField(auto_now=True)
    etablissement = models.ForeignKey(
        'Etablissement', on_delete=models.CASCADE, null=True, blank=True,
        db_column='etablissement_id', related_name='+',
    )
    class Meta:
        db_table = 'stage'
    def __str__(self):
        return f"Stage {self.code_stage} — {self.mle_etudiant} — {self.entreprise}"

class LettreAdmission(models.Model):
    code_lettre          = models.AutoField(primary_key=True)
    mle_etudiant         = models.ForeignKey(Etudiant, on_delete=models.CASCADE, db_column='mle_etudiant')
    code_annee           = models.ForeignKey(Annee, on_delete=models.RESTRICT, db_column='code_annee')
    type_lettre          = models.CharField(max_length=20, default='ACCEPTATION')
    code_classe_proposee = models.CharField(max_length=10, null=True, blank=True)
    date_emission        = models.DateTimeField(auto_now_add=True)
    date_limite_reponse  = models.DateField(null=True, blank=True)
    conditions           = models.TextField(null=True, blank=True)
    message_personnalise = models.TextField(null=True, blank=True)
    envoye_par_email     = models.BooleanField(default=False)
    date_envoi_email     = models.DateTimeField(null=True, blank=True)
    created_at           = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'lettre_admission'
    def __str__(self):
        return f"Lettre {self.type_lettre} — {self.mle_etudiant}"

class BadgeAcces(models.Model):
    code_badge      = models.AutoField(primary_key=True)
    mle_etudiant    = models.ForeignKey(
        Etudiant, on_delete=models.SET_NULL, null=True, blank=True, db_column='mle_etudiant'
    )
    mle_ens         = models.ForeignKey(
        Enseignant, on_delete=models.SET_NULL, null=True, blank=True, db_column='mle_ens'
    )
    type_porteur    = models.CharField(max_length=20, default='ETUDIANT')
    numero_badge    = models.CharField(max_length=30, unique=True)
    qr_code_data    = models.TextField()
    date_emission   = models.DateField(auto_now_add=True)
    date_expiration = models.DateField(null=True, blank=True)
    zones_acces     = models.CharField(max_length=200, null=True, blank=True)
    statut          = models.CharField(max_length=15, default='ACTIF')
    created_at      = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'badge_acces'
    def __str__(self):
        return f"Badge {self.numero_badge} — {self.statut}"

class DocumentGenere(models.Model):
    code_document   = models.AutoField(primary_key=True)
    type_document   = models.CharField(max_length=50)
    format          = models.CharField(max_length=10, default='PDF')
    mle_etudiant    = models.ForeignKey(
        Etudiant, on_delete=models.SET_NULL, null=True, blank=True,
        db_column='mle_etudiant', related_name='documents_generes'
    )
    # FIX: étaient des CharField bruts — intégrité référentielle brisée
    code_classe     = models.ForeignKey(
        Classe, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_classe'
    )
    code_annee      = models.ForeignKey(
        Annee, on_delete=models.SET_NULL, null=True, blank=True, db_column='code_annee'
    )
    reference_id    = models.PositiveIntegerField(null=True, blank=True)
    nom_fichier     = models.CharField(max_length=200)
    chemin_stockage = models.CharField(max_length=500, null=True, blank=True)
    taille_octets   = models.PositiveIntegerField(null=True, blank=True)
    genere_par      = models.CharField(max_length=50, null=True, blank=True)
    genere_le       = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'document_genere'
    def __str__(self):
        return f"{self.type_document} — {self.nom_fichier}"


# ─────────────────────────────────────────
# Journal d'audit
# ─────────────────────────────────────────
class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('LOGIN_SUCCESS', 'Connexion réussie'),
        ('LOGIN_FAILED',  'Échec de connexion'),
        ('CREATE',        'Création'),
        ('UPDATE',        'Modification'),
        ('DELETE',        'Suppression'),
        ('BULK_DELETE',   'Suppression multiple'),
        ('EXPORT_CSV',    'Export CSV'),
        ('LOGOUT',        'Déconnexion'),
    ]
    utilisateur = models.CharField(max_length=50, blank=True)
    action      = models.CharField(max_length=30, choices=ACTION_CHOICES)
    modele      = models.CharField(max_length=50, blank=True)
    objet_id    = models.CharField(max_length=100, blank=True)
    detail      = models.TextField(blank=True)
    ip_address  = models.GenericIPAddressField(null=True, blank=True)
    date_action = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table            = 'audit_log'
        ordering            = ['-date_action']
        verbose_name        = "Journal d'audit"
        verbose_name_plural = "Journal d'audit"
    def __str__(self):
        return f"[{self.date_action}] {self.utilisateur} — {self.action} — {self.modele}"


# ─────────────────────────────────────────
# Multi-établissement — niveaux scolaires & config bulletin
# ─────────────────────────────────────────
class NiveauScolaire(models.Model):
    code_niveau = models.CharField(max_length=20, primary_key=True)
    lib_niveau  = models.CharField(max_length=100)
    lib_en      = models.CharField(max_length=100, blank=True)
    type_etab   = models.CharField(max_length=20)   # PRIMAIRE / SECONDAIRE / SUPERIEUR
    systeme     = models.CharField(max_length=15, default='FRANCOPHONE')
    ordre       = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'niveau_scolaire'
        ordering = ['type_etab', 'ordre']

    def __str__(self):
        return f"{self.lib_niveau} ({self.type_etab})"


class ConfigBulletin(models.Model):
    type_etab          = models.CharField(max_length=20, unique=True)
    afficher_rang      = models.BooleanField(default=True)
    afficher_mention   = models.BooleanField(default=True)
    afficher_coef      = models.BooleanField(default=True)
    afficher_apprec    = models.BooleanField(default=True)
    note_eliminatoire  = models.DecimalField(max_digits=5, decimal_places=2, default=8.00)
    moyenne_passage    = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    bareme_defaut      = models.PositiveSmallIntegerField(default=20)
    pied_page_bulletin = models.TextField(blank=True)

    class Meta:
        db_table = 'config_bulletin'

    def __str__(self):
        return f"Config bulletin — {self.type_etab}"
