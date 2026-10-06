"""
admin.py — SMS (School Management System)
Interface d'administration Django
"""
from django.contrib import admin
from .models import (
    TypeEtab, Batiment, Salle, Jour, Langue, Module, Pension, Mention,
    TypeEvaluation, Rapport, Annee, Etablissement, Departement, Specialite,
    Cycle, Niveau, Classe, MentionClasse, Etudiant, Enseignant, Utilisateur,
    Personnel,
    Tranche, Frais, Inscription, FraisInscription, Paiement, Moratoire,
    Matiere, Qualification, Cours, UniteEnseignement, Periode, Evaluation,
    Planning, RapportCours
)
# ─────────────────────────────────────────
# Tables de référence
# ─────────────────────────────────────────
@admin.register(TypeEtab)
class TypeEtabAdmin(admin.ModelAdmin):
    list_display  = ['code_type', 'lib_type', 'obs_type']
    search_fields = ['lib_type']
@admin.register(Batiment)
class BatimentAdmin(admin.ModelAdmin):
    list_display  = ['code_bat', 'lib_bat', 'obs_bat']
    search_fields = ['lib_bat']
@admin.register(Salle)
class SalleAdmin(admin.ModelAdmin):
    list_display  = ['code_salle', 'lib_salle', 'obs_salle']
    search_fields = ['lib_salle']
@admin.register(Jour)
class JourAdmin(admin.ModelAdmin):
    list_display = ['code_jour', 'lib_jour']
@admin.register(Langue)
class LangueAdmin(admin.ModelAdmin):
    list_display = ['code_langue', 'lib_langue']
@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display  = ['code_module', 'lib_module', 'obs_module']
    search_fields = ['lib_module']
@admin.register(Pension)
class PensionAdmin(admin.ModelAdmin):
    list_display = ['code_pension', 'lib_pension', 'mt_pension', 'nb_tranche',
'mt_inscription']
@admin.register(Mention)
class MentionAdmin(admin.ModelAdmin):
    list_display = ['code_mention', 'lib_mention', 'note_min', 'note_max']
@admin.register(TypeEvaluation)
class TypeEvaluationAdmin(admin.ModelAdmin):
    list_display  = ['code_type_eval', 'lib_type_eval', 'obs_type_eval']
    search_fields = ['lib_type_eval']
@admin.register(Rapport)
class RapportAdmin(admin.ModelAdmin):
    list_display = ['code_rapport', 'lib_rapport']
# ─────────────────────────────────────────
# Année scolaire
# ─────────────────────────────────────────
@admin.register(Annee)
class AnneeAdmin(admin.ModelAdmin):
    list_display  = ['code_annee', 'lib_annee', 'date_deb', 'date_fin', 'statut']
    list_filter   = ['statut']
    search_fields = ['code_annee', 'lib_annee']
    ordering      = ['-date_deb']
# ─────────────────────────────────────────
# Structure académique
# ─────────────────────────────────────────
@admin.register(Etablissement)
class EtablissementAdmin(admin.ModelAdmin):
    list_display  = ['code_etab', 'lib_etab', 'tel', 'email', 'code_type']
    search_fields = ['lib_etab', 'email']
    list_filter   = ['code_type']
@admin.register(Departement)
class DepartementAdmin(admin.ModelAdmin):
    list_display  = ['code_dep', 'lib_dep', 'code_etab']
    search_fields = ['lib_dep']
    list_filter   = ['code_etab']
@admin.register(Specialite)
class SpecialiteAdmin(admin.ModelAdmin):
    list_display  = ['code_sp', 'lib_sp', 'code_dep']
    search_fields = ['lib_sp']
    list_filter   = ['code_dep']
@admin.register(Cycle)
class CycleAdmin(admin.ModelAdmin):
    list_display  = ['code_cycle', 'lib_cycle', 'code_pension']
    search_fields = ['lib_cycle']
@admin.register(Niveau)
class NiveauAdmin(admin.ModelAdmin):
    list_display  = ['code_niveau', 'lib_niveau', 'code_cycle', 'code_annee']
    list_filter   = ['code_cycle']
    search_fields = ['lib_niveau']
@admin.register(Classe)
class ClasseAdmin(admin.ModelAdmin):
    list_display  = ['code_classe', 'lib_classe', 'code_dep', 'code_niveau', 'eff_max']
    list_filter   = ['code_dep', 'code_niveau']
    search_fields = ['code_classe', 'lib_classe']
# ─────────────────────────────────────────
# Personnes
# ─────────────────────────────────────────
@admin.register(Etudiant)
class EtudiantAdmin(admin.ModelAdmin):
    list_display   = ['mle_etudiant', 'nom', 'prenom', 'date_naiss', 'tel', 'email']
    search_fields  = ['mle_etudiant', 'nom', 'prenom', 'email']
    ordering       = ['nom', 'prenom']
    list_per_page  = 25
    readonly_fields = ['photo']  # photo gérée via endpoint dédié
@admin.register(Enseignant)
class EnseignantAdmin(admin.ModelAdmin):
    list_display  = ['mle_ens', 'nom_ens', 'prenom_ens', 'code_dep', 'statut', 'email_ens']
    search_fields = ['mle_ens', 'nom_ens', 'prenom_ens', 'email_ens']
    list_filter   = ['code_dep', 'statut']
    ordering      = ['nom_ens']
@admin.register(Utilisateur)
class UtilisateurAdmin(admin.ModelAdmin):
    list_display = ['login']
    search_fields = ['login']
    # passwd non affiché pour la sécurité
# ─────────────────────────────────────────
# Personnel administratif et de soutien
# ─────────────────────────────────────────
@admin.register(Personnel)
class PersonnelAdmin(admin.ModelAdmin):
    list_display   = ['mle_personnel', 'nom', 'prenom', 'poste', 'categorie',
                      'type_contrat', 'actif', 'etablissement']
    list_filter    = ['poste', 'categorie', 'type_contrat', 'actif', 'etablissement']
    search_fields  = ['nom', 'prenom', 'mle_personnel', 'matricule_fonct']
    ordering       = ['categorie', 'poste', 'nom']
# ─────────────────────────────────────────
# Scolarité & Paiements
# ─────────────────────────────────────────
@admin.register(Tranche)
class TrancheAdmin(admin.ModelAdmin):
    list_display  = ['code_tranche', 'lib_tranche', 'code_pension', 'mt_tranche']
    list_filter   = ['code_pension']
@admin.register(Frais)
class FraisAdmin(admin.ModelAdmin):
    list_display  = ['code_frais', 'lib_frais', 'type_frais', 'mt_frais', 'code_annee']
    list_filter   = ['type_frais', 'code_annee']
    search_fields = ['lib_frais']
class FraisInscriptionInline(admin.TabularInline):
    model  = FraisInscription
    extra  = 0
@admin.register(Inscription)
class InscriptionAdmin(admin.ModelAdmin):
    list_display  = ['code_inscription', 'mle_etudiant', 'code_classe', 'code_annee',
'date_inscription', 'mt_inscription']
    list_filter   = ['code_annee', 'code_classe']
    search_fields = ['mle_etudiant__nom', 'mle_etudiant__prenom']
    inlines       = [FraisInscriptionInline]
@admin.register(Paiement)
class PaiementAdmin(admin.ModelAdmin):
    list_display  = ['code_paiement', 'mle_etudiant', 'code_tranche', 'mt_paiement',
'date_paiement', 'code_annee']
    list_filter   = ['code_annee', 'code_tranche']
    search_fields = ['mle_etudiant__nom']
    ordering      = ['-date_paiement']
@admin.register(Moratoire)
class MoratoireAdmin(admin.ModelAdmin):
    list_display  = ['code_mor', 'mle_etudiant', 'lib_mor', 'date_effet', 'date_exp']
    search_fields = ['mle_etudiant__nom']
# ─────────────────────────────────────────
# Pédagogie
# ─────────────────────────────────────────
@admin.register(Matiere)
class MatiereAdmin(admin.ModelAdmin):
    list_display  = ['code_matiere', 'lib_matiere', 'code_module']
    list_filter   = ['code_module']
    search_fields = ['lib_matiere', 'code_matiere']
class QualificationAdmin(admin.ModelAdmin):
    list_display  = ['mle_ens', 'code_matiere', 'obs_qual']
    list_filter   = ['mle_ens']
@admin.register(Cours)
class CoursAdmin(admin.ModelAdmin):
    list_display  = ['code_matiere', 'code_classe', 'mle_ens', 'semestre', 'code_annee', 'quota_horaire', 'credits']
    list_filter   = ['code_classe', 'semestre', 'code_annee']
    search_fields = ['code_matiere__lib_matiere', 'code_classe__lib_classe']
class UniteEnseignementAdmin(admin.ModelAdmin):
    list_display  = ['code_matiere', 'code_classe', 'coef', 'nbh_total', 'mle_ens', 'code_annee']
    list_filter   = ['code_annee', 'code_classe']
@admin.register(Periode)
class PeriodeAdmin(admin.ModelAdmin):
    list_display  = ['code_periode', 'lib_periode', 'date_debut', 'date_fin', 'code_annee']
    list_filter   = ['code_annee']
@admin.register(Evaluation)
class EvaluationAdmin(admin.ModelAdmin):
    list_display  = ['code_eval', 'mle_etudiant', 'code_matiere', 'code_classe', 'note',
'date_eval', 'code_periode']
    list_filter   = ['code_classe', 'code_periode', 'code_type_eval']
    search_fields = ['mle_etudiant__nom', 'code_matiere__lib_matiere']
    ordering      = ['-date_eval']
# ─────────────────────────────────────────
# Planning & Rapports
# ─────────────────────────────────────────
@admin.register(Planning)
class PlanningAdmin(admin.ModelAdmin):
    list_display  = ['code_cours', 'type_planning', 'type_seance', 'code_jour',
                     'h_debut', 'h_fin', 'code_salle', 'date_debut', 'date_fin']
    list_filter   = ['type_planning', 'type_seance', 'code_jour',
                     'code_cours__code_annee', 'code_cours__semestre']
    search_fields = ['code_cours__code_matiere__lib_matiere',
                     'code_cours__code_classe__lib_classe']
@admin.register(RapportCours)
class RapportCoursAdmin(admin.ModelAdmin):
    list_display  = ['code_lgnrapport', 'code_rapport', 'code_matiere', 'code_classe',
'mle_ens']
    list_filter   = ['code_classe', 'code_rapport']
    search_fields = ['detail_rapport']