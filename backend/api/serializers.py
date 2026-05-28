"""
serializers.py — SMS (School Management System)
"""
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from django.contrib.auth.hashers import make_password
from .models import (
    TypeEtab, Batiment, Salle, Jour, Langue, Module, Pension, Mention,
    TypeEvaluation, Rapport, Annee, Etablissement, Faculte, Departement,
    Specialite, Cycle, Niveau, Classe, MentionClasse,
    Etudiant, Enseignant, Utilisateur, Tuteur, EtudiantTuteur,
    Tranche, Frais, Inscription, FraisInscription, Paiement, Moratoire,
    Facture, FactureDetail, RapportFinancier,
    Matiere, Qualification, Cours, UniteEnseignement, Periode, Evaluation,
    FicheNotes, FicheNotesDetail,
    Planning, RapportCours, Seance, Absence,
    Examen, Convocation, RapportStatistique,
    Decision, Diplome, CarteEtudiant, Stage, LettreAdmission,
    BadgeAcces, DocumentGenere, AuditLog,
    NiveauScolaire, ConfigBulletin,
)


# ── Tables de référence ───────────────────────────────────────────────────────
class TypeEtabSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeEtab
        fields = '__all__'

class BatimentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Batiment
        fields = '__all__'

class SalleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Salle
        fields = '__all__'

class JourSerializer(serializers.ModelSerializer):
    class Meta:
        model = Jour
        fields = '__all__'

class LangueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Langue
        fields = '__all__'

class ModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = '__all__'

class PensionSerializer(serializers.ModelSerializer):
    code_pension = serializers.IntegerField(
        validators=[UniqueValidator(queryset=Pension.objects.all(),
                                    message="Ce code régime est déjà utilisé.")]
    )
    class Meta:
        model = Pension
        fields = '__all__'

    def update(self, instance, validated_data):
        validated_data.pop('code_pension', None)  # PK immutable after creation
        return super().update(instance, validated_data)

class MentionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mention
        fields = '__all__'

class TypeEvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeEvaluation
        fields = '__all__'

class RapportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rapport
        fields = '__all__'


# ── Année scolaire ────────────────────────────────────────────────────────────
class AnneeSerializer(serializers.ModelSerializer):
    est_en_cours = serializers.BooleanField(read_only=True)
    class Meta:
        model = Annee
        fields = '__all__'


# ── Structure académique ──────────────────────────────────────────────────────
class EtablissementSerializer(serializers.ModelSerializer):
    lib_type          = serializers.CharField(source='code_type.lib_type', read_only=True, default=None)
    type_etab_display = serializers.CharField(source='get_type_etab_display', read_only=True)
    statut_display    = serializers.CharField(source='get_statut_display',    read_only=True)
    systeme_display   = serializers.CharField(source='get_systeme_display',   read_only=True)
    region_display    = serializers.CharField(source='get_region_display',    read_only=True)
    class Meta:
        model  = Etablissement
        fields = '__all__'

# NEW: Faculte
class FaculteSerializer(serializers.ModelSerializer):
    lib_etab = serializers.CharField(source='code_etab.lib_etab', read_only=True)
    class Meta:
        model = Faculte
        fields = '__all__'

class DepartementSerializer(serializers.ModelSerializer):
    lib_etab    = serializers.CharField(source='code_etab.lib_etab',       read_only=True)
    lib_faculte = serializers.CharField(source='code_faculte.lib_faculte', read_only=True)
    class Meta:
        model = Departement
        fields = '__all__'

class SpecialiteSerializer(serializers.ModelSerializer):
    lib_dep = serializers.CharField(source='code_dep.lib_dep', read_only=True)
    class Meta:
        model = Specialite
        fields = '__all__'

class CycleSerializer(serializers.ModelSerializer):
    lib_pension = serializers.CharField(source='code_pension.lib_pension', read_only=True)
    class Meta:
        model = Cycle
        fields = '__all__'

class NiveauSerializer(serializers.ModelSerializer):
    lib_cycle   = serializers.CharField(source='code_cycle.lib_cycle',     read_only=True)
    lib_pension = serializers.CharField(source='code_pension.lib_pension', read_only=True)
    class Meta:
        model = Niveau
        fields = '__all__'

class ClasseSerializer(serializers.ModelSerializer):
    lib_dep          = serializers.CharField(source='code_dep.lib_dep',           read_only=True)
    lib_niveau       = serializers.CharField(source='code_niveau.lib_niveau',     read_only=True)
    lib_bat          = serializers.CharField(source='code_bat.lib_bat',           read_only=True)
    lib_salle        = serializers.CharField(source='code_salle.lib_salle',       read_only=True)
    lib_niv_scolaire = serializers.CharField(source='niveau_scolaire.lib_niveau', read_only=True)
    class Meta:
        model = Classe
        fields = '__all__'

class MentionClasseSerializer(serializers.ModelSerializer):
    lib_mention = serializers.CharField(source='code_mention.lib_mention', read_only=True)
    lib_classe  = serializers.CharField(source='code_classe.lib_classe',   read_only=True)
    class Meta:
        model = MentionClasse
        fields = '__all__'


# ── Personnes ─────────────────────────────────────────────────────────────────
class EtudiantSerializer(serializers.ModelSerializer):
    mle_etudiant = serializers.CharField(max_length=20, required=False, allow_blank=True)
    lib_dep      = serializers.CharField(source='code_dep.lib_dep', read_only=True)
    lib_sp       = serializers.CharField(source='code_sp.lib_sp',   read_only=True)

    class Meta:
        model = Etudiant
        exclude = ['photo']

    def _generate_matricule(self, code_sp):
        import re
        from datetime import datetime
        year   = datetime.now().year
        sp_str = str(code_sp.code_sp if hasattr(code_sp, 'code_sp') else code_sp)[:6].upper()
        prefix = f"{year}-{sp_str}-"
        max_seq = 0
        for e in Etudiant.objects.filter(mle_etudiant__startswith=prefix):
            m = re.match(rf'^{re.escape(prefix)}(\d+)$', e.mle_etudiant)
            if m:
                max_seq = max(max_seq, int(m.group(1)))
        return f"{prefix}{str(max_seq + 1).zfill(5)}"

    def create(self, validated_data):
        if not validated_data.get('mle_etudiant'):
            validated_data['mle_etudiant'] = self._generate_matricule(
                validated_data.get('code_sp')
            )
        return super().create(validated_data)

class EtudiantPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Etudiant
        fields = ['mle_etudiant', 'photo', 'chemin']

class EnseignantSerializer(serializers.ModelSerializer):
    lib_dep = serializers.CharField(source='code_dep.lib_dep', read_only=True)
    class Meta:
        model = Enseignant
        fields = '__all__'

class UtilisateurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Utilisateur
        fields = ['login', 'nom_user', 'role']

class UtilisateurCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Utilisateur
        fields = '__all__'
        extra_kwargs = {'passwd': {'write_only': True}}

    def create(self, validated_data):
        validated_data['passwd'] = make_password(validated_data['passwd'])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'passwd' in validated_data:
            validated_data['passwd'] = make_password(validated_data['passwd'])
        return super().update(instance, validated_data)

class TuteurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tuteur
        fields = '__all__'

class EtudiantTuteurSerializer(serializers.ModelSerializer):
    nom_tuteur   = serializers.CharField(source='code_tuteur.nom',          read_only=True)
    lien_parente = serializers.CharField(source='code_tuteur.lien_parente', read_only=True)
    tel_tuteur   = serializers.CharField(source='code_tuteur.tel',          read_only=True)
    class Meta:
        model = EtudiantTuteur
        fields = '__all__'


# ── Scolarité & Paiements ─────────────────────────────────────────────────────
class TrancheSerializer(serializers.ModelSerializer):
    lib_pension = serializers.CharField(source='code_pension.lib_pension', read_only=True)
    class Meta:
        model = Tranche
        fields = '__all__'

class FraisSerializer(serializers.ModelSerializer):
    lib_annee = serializers.CharField(source='code_annee.lib_annee', read_only=True)
    class Meta:
        model = Frais
        fields = '__all__'

class InscriptionSerializer(serializers.ModelSerializer):
    nom_etudiant        = serializers.CharField(source='mle_etudiant.nom',       read_only=True)
    lib_classe          = serializers.CharField(source='code_classe.lib_classe', read_only=True)
    lib_annee           = serializers.CharField(source='code_annee.lib_annee',   read_only=True)
    statut_paiement     = serializers.SerializerMethodField()
    mt_paye_inscription = serializers.SerializerMethodField()

    def _paiements_insc(self, obj):
        return Paiement.objects.filter(
            mle_etudiant=obj.mle_etudiant,
            code_annee=obj.code_annee,
            type_paiement='INSCRIPTION',
        )

    def get_mt_paye_inscription(self, obj):
        from django.db.models import Sum
        return self._paiements_insc(obj).aggregate(s=Sum('mt_paiement'))['s'] or 0

    def get_statut_paiement(self, obj):
        total = self.get_mt_paye_inscription(obj)
        attendu = obj.mt_inscription or 0
        if total == 0:
            return 'EN_ATTENTE'
        if attendu > 0 and total >= attendu:
            return 'PAYE'
        return 'PARTIEL'

    class Meta:
        model = Inscription
        fields = '__all__'

class FraisInscriptionSerializer(serializers.ModelSerializer):
    lib_frais = serializers.CharField(source='code_frais.lib_frais', read_only=True)
    class Meta:
        model = FraisInscription
        fields = '__all__'

class PaiementSerializer(serializers.ModelSerializer):
    nom_etudiant    = serializers.CharField(source='mle_etudiant.nom',              read_only=True)
    prenom_etudiant = serializers.CharField(source='mle_etudiant.prenom',           read_only=True)
    lib_tranche     = serializers.CharField(source='code_tranche.lib_tranche',      read_only=True)
    mt_tranche      = serializers.IntegerField(source='code_tranche.mt_tranche',    read_only=True)
    lib_annee       = serializers.CharField(source='code_annee.lib_annee',          read_only=True)
    lib_dep         = serializers.CharField(source='mle_etudiant.code_dep.lib_dep', read_only=True)
    lib_sp          = serializers.CharField(source='mle_etudiant.code_sp.lib_sp',   read_only=True)
    lib_classe      = serializers.SerializerMethodField()

    mt_total    = serializers.SerializerMethodField()
    lib_pension = serializers.SerializerMethodField()
    lib_classe  = serializers.SerializerMethodField()
    total_paye  = serializers.SerializerMethodField()

    def _get_inscription(self, obj):
        key = f'_insc_{obj.pk}'
        if not hasattr(self, key):
            from .models import Inscription
            insc = Inscription.objects.filter(
                mle_etudiant=obj.mle_etudiant,
                code_annee=obj.code_annee,
            ).select_related('code_classe__code_niveau__code_pension').first()
            setattr(self, key, insc)
        return getattr(self, key)

    def get_lib_classe(self, obj):
        insc = self._get_inscription(obj)
        if insc and insc.code_classe:
            return insc.code_classe.lib_classe
        return None

    def _get_pension(self, obj):
        insc = self._get_inscription(obj)
        if insc and insc.code_classe and insc.code_classe.code_niveau:
            return insc.code_classe.code_niveau.code_pension
        return None

    def get_mt_total(self, obj):
        p = self._get_pension(obj)
        if p:
            return p.mt_inscription if obj.type_paiement == 'INSCRIPTION' else p.mt_pension
        return None

    def get_lib_pension(self, obj):
        p = self._get_pension(obj)
        return p.lib_pension if p else None

    def get_total_paye(self, obj):
        from django.db.models import Sum
        result = Paiement.objects.filter(
            mle_etudiant=obj.mle_etudiant,
            code_annee=obj.code_annee,
            type_paiement=obj.type_paiement,
        ).aggregate(total=Sum('mt_paiement'))
        return result['total'] or 0

    class Meta:
        model = Paiement
        fields = '__all__'

class MoratoireSerializer(serializers.ModelSerializer):
    nom_etudiant = serializers.CharField(source='mle_etudiant.nom', read_only=True)
    class Meta:
        model = Moratoire
        fields = '__all__'

class FactureDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = FactureDetail
        fields = '__all__'

class FactureSerializer(serializers.ModelSerializer):
    nom_etudiant    = serializers.CharField(source='mle_etudiant.nom', read_only=True)
    montant_restant = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    lignes          = FactureDetailSerializer(source='facturedetail_set', many=True, read_only=True)
    class Meta:
        model = Facture
        fields = '__all__'

class RapportFinancierSerializer(serializers.ModelSerializer):
    total_impaye      = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    taux_recouvrement = serializers.FloatField(read_only=True)
    class Meta:
        model = RapportFinancier
        fields = '__all__'


# ── Pédagogie ─────────────────────────────────────────────────────────────────
class MatiereSerializer(serializers.ModelSerializer):
    lib_module = serializers.CharField(source='code_module.lib_module', read_only=True)
    class Meta:
        model = Matiere
        fields = '__all__'

class QualificationSerializer(serializers.ModelSerializer):
    lib_matiere = serializers.CharField(source='code_matiere.lib_matiere', read_only=True)
    nom_ens     = serializers.CharField(source='mle_ens.nom_ens',          read_only=True)
    class Meta:
        model = Qualification
        fields = '__all__'

class CoursSerializer(serializers.ModelSerializer):
    lib_matiere = serializers.CharField(source='code_matiere.lib_matiere', read_only=True)
    lib_classe  = serializers.CharField(source='code_classe.lib_classe',   read_only=True)
    nom_ens     = serializers.CharField(source='mle_ens.nom_ens',          read_only=True)
    lib_annee   = serializers.CharField(source='code_annee.lib_annee',     read_only=True)
    class Meta:
        model = Cours
        fields = '__all__'

class UniteEnseignementSerializer(serializers.ModelSerializer):
    lib_matiere = serializers.CharField(source='code_matiere.lib_matiere', read_only=True)
    lib_classe  = serializers.CharField(source='code_classe.lib_classe',   read_only=True)
    nom_ens     = serializers.CharField(source='mle_ens.nom_ens',          read_only=True)
    class Meta:
        model = UniteEnseignement
        fields = '__all__'

class PeriodeSerializer(serializers.ModelSerializer):
    lib_annee = serializers.CharField(source='code_annee.lib_annee', read_only=True)
    class Meta:
        model = Periode
        fields = '__all__'

class EvaluationSerializer(serializers.ModelSerializer):
    nom_etudiant  = serializers.CharField(source='mle_etudiant.nom',            read_only=True)
    lib_matiere   = serializers.CharField(source='code_matiere.lib_matiere',    read_only=True)
    lib_classe    = serializers.CharField(source='code_classe.lib_classe',      read_only=True)
    lib_periode   = serializers.CharField(source='code_periode.lib_periode',    read_only=True)
    lib_type_eval = serializers.CharField(source='code_type_eval.lib_type_eval',read_only=True)
    class Meta:
        model = Evaluation
        fields = '__all__'

class FicheNotesDetailSerializer(serializers.ModelSerializer):
    nom_etudiant = serializers.CharField(source='mle_etudiant.nom', read_only=True)
    class Meta:
        model = FicheNotesDetail
        fields = '__all__'

class FicheNotesSerializer(serializers.ModelSerializer):
    lib_matiere   = serializers.CharField(source='code_matiere.lib_matiere',      read_only=True)
    lib_classe    = serializers.CharField(source='code_classe.lib_classe',         read_only=True)
    nom_ens       = serializers.CharField(source='mle_ens.nom_ens',               read_only=True)
    lib_periode   = serializers.CharField(source='code_periode.lib_periode',       read_only=True)
    lib_type_eval = serializers.CharField(source='code_type_eval.lib_type_eval',   read_only=True)
    notes         = FicheNotesDetailSerializer(source='fichenotesdetail_set', many=True, read_only=True)
    class Meta:
        model = FicheNotes
        fields = '__all__'


# ── Planning & Rapports ───────────────────────────────────────────────────────
class PlanningSerializer(serializers.ModelSerializer):
    lib_matiere   = serializers.CharField(source='code_cours.code_matiere.lib_matiere', read_only=True)
    code_classe   = serializers.CharField(source='code_cours.code_classe.code_classe',  read_only=True)
    lib_classe    = serializers.CharField(source='code_cours.code_classe.lib_classe',   read_only=True)
    nom_ens       = serializers.CharField(source='code_cours.mle_ens.nom_ens',          read_only=True)
    lib_jour      = serializers.CharField(source='code_jour.lib_jour',                  read_only=True)
    lib_salle     = serializers.CharField(source='code_salle.lib_salle',                read_only=True)
    semestre      = serializers.CharField(source='code_cours.semestre',                 read_only=True)
    lib_annee     = serializers.CharField(source='code_cours.code_annee.lib_annee',     read_only=True)
    groupes       = serializers.CharField(source='code_cours.groupes',                  read_only=True)
    class Meta:
        model = Planning
        fields = '__all__'

class RapportCoursSerializer(serializers.ModelSerializer):
    lib_matiere = serializers.CharField(source='code_matiere.lib_matiere', read_only=True)
    lib_classe  = serializers.CharField(source='code_classe.lib_classe',   read_only=True)
    lib_rapport = serializers.CharField(source='code_rapport.lib_rapport', read_only=True)
    nom_ens     = serializers.CharField(source='mle_ens.nom_ens',          read_only=True)
    class Meta:
        model = RapportCours
        fields = '__all__'

class SeanceSerializer(serializers.ModelSerializer):
    lib_matiere = serializers.CharField(source='code_matiere.lib_matiere', read_only=True)
    lib_classe  = serializers.CharField(source='code_classe.lib_classe',   read_only=True)
    nom_ens     = serializers.CharField(source='mle_ens.nom_ens',          read_only=True)
    lib_annee   = serializers.CharField(source='code_annee.lib_annee',     read_only=True)
    class Meta:
        model = Seance
        fields = '__all__'

class AbsenceSerializer(serializers.ModelSerializer):
    nom_etudiant = serializers.CharField(source='mle_etudiant.nom', read_only=True)
    lib_matiere  = serializers.CharField(source='code_seance.code_matiere.lib_matiere', read_only=True)
    date_seance  = serializers.DateField(source='code_seance.date_seance', read_only=True)
    class Meta:
        model = Absence
        fields = '__all__'


# ── Gestion interne ───────────────────────────────────────────────────────────
class ExamenSerializer(serializers.ModelSerializer):
    lib_matiere = serializers.CharField(source='code_matiere.lib_matiere', read_only=True)
    lib_classe  = serializers.CharField(source='code_classe.lib_classe',   read_only=True)
    lib_annee   = serializers.CharField(source='code_annee.lib_annee',     read_only=True)
    class Meta:
        model = Examen
        fields = '__all__'

class ConvocationSerializer(serializers.ModelSerializer):
    nom_etudiant = serializers.CharField(source='mle_etudiant.nom', read_only=True)
    nom_ens      = serializers.CharField(source='mle_ens.nom_ens',  read_only=True)
    class Meta:
        model = Convocation
        fields = '__all__'

class RapportStatistiqueSerializer(serializers.ModelSerializer):
    taux_reussite     = serializers.FloatField(read_only=True)
    taux_feminisation = serializers.FloatField(read_only=True)
    lib_classe        = serializers.CharField(source='code_classe.lib_classe', read_only=True)
    lib_dep           = serializers.CharField(source='code_dep.lib_dep',       read_only=True)
    class Meta:
        model = RapportStatistique
        fields = '__all__'


# ── Documents avancés ─────────────────────────────────────────────────────────
class DecisionSerializer(serializers.ModelSerializer):
    nom_etudiant = serializers.CharField(source='mle_etudiant.nom',       read_only=True)
    lib_classe   = serializers.CharField(source='code_classe.lib_classe', read_only=True)
    lib_annee    = serializers.CharField(source='code_annee.lib_annee',   read_only=True)
    class Meta:
        model = Decision
        fields = '__all__'

class DiplomeSerializer(serializers.ModelSerializer):
    nom_etudiant = serializers.CharField(source='mle_etudiant.nom', read_only=True)
    class Meta:
        model = Diplome
        fields = '__all__'

class CarteEtudiantSerializer(serializers.ModelSerializer):
    nom_etudiant = serializers.CharField(source='mle_etudiant.nom', read_only=True)
    class Meta:
        model = CarteEtudiant
        fields = '__all__'

class StageSerializer(serializers.ModelSerializer):
    nom_etudiant = serializers.CharField(source='mle_etudiant.nom', read_only=True)
    class Meta:
        model = Stage
        fields = '__all__'

class LettreAdmissionSerializer(serializers.ModelSerializer):
    nom_etudiant = serializers.CharField(source='mle_etudiant.nom', read_only=True)
    class Meta:
        model = LettreAdmission
        fields = '__all__'

class BadgeAccesSerializer(serializers.ModelSerializer):
    nom_etudiant = serializers.CharField(source='mle_etudiant.nom', read_only=True)
    nom_ens      = serializers.CharField(source='mle_ens.nom_ens',  read_only=True)
    class Meta:
        model = BadgeAcces
        fields = '__all__'

class DocumentGenereSerializer(serializers.ModelSerializer):
    nom_etudiant = serializers.CharField(source='mle_etudiant.nom',       read_only=True)
    lib_classe   = serializers.CharField(source='code_classe.lib_classe', read_only=True)
    lib_annee    = serializers.CharField(source='code_annee.lib_annee',   read_only=True)
    class Meta:
        model = DocumentGenere
        fields = '__all__'


# ── Journal d'audit ───────────────────────────────────────────────────────────
class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = '__all__'
        read_only_fields = ['date_action']


# ── Multi-établissement ───────────────────────────────────────────────────────
class NiveauScolaireSerializer(serializers.ModelSerializer):
    class Meta:
        model  = NiveauScolaire
        fields = '__all__'

class ConfigBulletinSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ConfigBulletin
        fields = '__all__'
