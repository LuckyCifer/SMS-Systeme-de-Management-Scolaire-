"""
api/urls.py — Routes API SMS complètes
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView, TokenRefreshView, TokenVerifyView,
)
from . import views

router = DefaultRouter()

# ── Tables de référence ───────────────────────────────────────────────────────
router.register(r'type-etab',         views.TypeEtabViewSet,         basename='type-etab')
router.register(r'batiments',         views.BatimentViewSet,         basename='batiment')
router.register(r'salles',            views.SalleViewSet,            basename='salle')
router.register(r'jours',             views.JourViewSet,             basename='jour')
router.register(r'langues',           views.LangueViewSet,           basename='langue')
router.register(r'modules',           views.ModuleViewSet,           basename='module')
router.register(r'pensions',          views.PensionViewSet,          basename='pension')
router.register(r'mentions',          views.MentionViewSet,          basename='mention')
router.register(r'type-evaluations',  views.TypeEvaluationViewSet,   basename='type-evaluation')
router.register(r'rapports',          views.RapportViewSet,          basename='rapport')

# ── Année scolaire ────────────────────────────────────────────────────────────
router.register(r'annees',            views.AnneeViewSet,            basename='annee')

# ── Structure académique ──────────────────────────────────────────────────────
router.register(r'etablissements',    views.EtablissementViewSet,    basename='etablissement')
router.register(r'facultes',          views.FaculteViewSet,          basename='faculte')
router.register(r'departements',      views.DepartementViewSet,      basename='departement')
router.register(r'specialites',       views.SpecialiteViewSet,       basename='specialite')
router.register(r'cycles',            views.CycleViewSet,            basename='cycle')
router.register(r'niveaux',           views.NiveauViewSet,           basename='niveau')
router.register(r'classes',           views.ClasseViewSet,           basename='classe')
router.register(r'mentions-classes',  views.MentionClasseViewSet,    basename='mention-classe')

# ── Personnes ─────────────────────────────────────────────────────────────────
router.register(r'etudiants',         views.EtudiantViewSet,         basename='etudiant')
router.register(r'enseignants',       views.EnseignantViewSet,       basename='enseignant')
router.register(r'utilisateurs',      views.UtilisateurViewSet,      basename='utilisateur')
router.register(r'tuteurs',           views.TuteurViewSet,           basename='tuteur')
router.register(r'etudiant-tuteurs',  views.EtudiantTuteurViewSet,   basename='etudiant-tuteur')
router.register(r'personnel',         views.PersonnelViewSet,        basename='personnel')

# ── Scolarité & Paiements ─────────────────────────────────────────────────────
router.register(r'tranches',          views.TrancheViewSet,          basename='tranche')
router.register(r'frais',             views.FraisViewSet,            basename='frais')
router.register(r'inscriptions',      views.InscriptionViewSet,      basename='inscription')
router.register(r'frais-inscription', views.FraisInscriptionViewSet, basename='fraisinscription')
router.register(r'paiements',         views.PaiementViewSet,         basename='paiement')
router.register(r'paiements-salaires', views.PaiementSalaireViewSet, basename='paiement-salaire')
router.register(r'moratoires',        views.MoratoireViewSet,        basename='moratoire')
router.register(r'factures',          views.FactureViewSet,          basename='facture')
router.register(r'factures-detail',   views.FactureDetailViewSet,    basename='facture-detail')
router.register(r'rapports-financiers', views.RapportFinancierViewSet, basename='rapport-financier')

# ── Pédagogie ─────────────────────────────────────────────────────────────────
router.register(r'matieres',          views.MatiereViewSet,          basename='matiere')
router.register(r'qualifications',    views.QualificationViewSet,    basename='qualification')
router.register(r'cours',             views.CoursViewSet,            basename='cours')
router.register(r'unites-ens',        views.UniteEnseignementViewSet,basename='uniteenseignement')
router.register(r'periodes',          views.PeriodeViewSet,          basename='periode')
router.register(r'evaluations',       views.EvaluationViewSet,       basename='evaluation')
router.register(r'fiches-notes',      views.FicheNotesViewSet,       basename='fiche-notes')
router.register(r'fiches-notes-detail', views.FicheNotesDetailViewSet, basename='fiche-notes-detail')

# ── Planning, Séances & Absences ──────────────────────────────────────────────
router.register(r'planning',          views.PlanningViewSet,         basename='planning')
router.register(r'rapports-cours',    views.RapportCoursViewSet,     basename='rapport-cours')
router.register(r'seances',           views.SeanceViewSet,           basename='seance')
router.register(r'absences',          views.AbsenceViewSet,          basename='absence')

# ── Gestion interne ───────────────────────────────────────────────────────────
router.register(r'examens',           views.ExamenViewSet,           basename='examen')
router.register(r'epreuves',          views.EpreuveViewSet,          basename='epreuve')
router.register(r'convocations',      views.ConvocationViewSet,      basename='convocation')
router.register(r'rapports-stat',     views.RapportStatistiqueViewSet, basename='rapport-stat')
router.register(r'rapports-assiduite', views.RapportAssiduiteViewSet,  basename='rapport-assiduite')

# ── Documents avancés ─────────────────────────────────────────────────────────
router.register(r'decisions',         views.DecisionViewSet,         basename='decision')
router.register(r'diplomes',          views.DiplomeViewSet,          basename='diplome')
router.register(r'cartes-etudiants',  views.CarteEtudiantViewSet,    basename='carte-etudiant')
router.register(r'stages',            views.StageViewSet,            basename='stage')
router.register(r'lettres-admission', views.LettreAdmissionViewSet,  basename='lettre-admission')
router.register(r'badges-acces',      views.BadgeAccesViewSet,       basename='badge-acces')
router.register(r'documents-generes', views.DocumentGenereViewSet,   basename='document-genere')

# ── Journal d'audit ───────────────────────────────────────────────────────────
router.register(r'audit',             views.AuditLogViewSet,         basename='audit')

# ── Multi-établissement ───────────────────────────────────────────────────────
router.register(r'niveaux-scolaires', views.NiveauScolaireViewSet,   basename='niveau-scolaire')
router.register(r'config-bulletin',   views.ConfigBulletinViewSet,   basename='config-bulletin')

# ── URL patterns ──────────────────────────────────────────────────────────────
urlpatterns = [
    path('api/', include(router.urls)),
    path('api/auth/login/',     TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/',   TokenRefreshView.as_view(),   name='token_refresh'),
    path('api/auth/verify/',    TokenVerifyView.as_view(),    name='token_verify'),
    path('api/auth/sms-login/',  views.SmsLoginView.as_view(),  name='sms_login'),
    path('api/auth/sms-logout/', views.SmsLogoutView.as_view(), name='sms_logout'),
    path('api/envoi-email/',      views.EnvoiEmailView.as_view(),    name='envoi_email'),
    path('api/dashboard/stats/', views.DashboardStatsView.as_view(), name='dashboard_stats'),
    # ── Import CSV ──────────────────────────────────────────────────────────────
    path('api/import-csv/<str:entity_type>/',
         views.ImportCsvView.as_view(), name='import_csv'),
    path('api/import-csv/<str:entity_type>/template/',
         views.ImportCsvTemplateView.as_view(), name='import_csv_template'),
]
