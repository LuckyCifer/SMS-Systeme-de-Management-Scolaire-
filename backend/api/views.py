"""
views.py — SMS (School Management System)
ViewSets complets pour toutes les tables + JWT + Audit + Export CSV
"""
from rest_framework import viewsets, status, filters
from django.db.models import Avg, Min, Max
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, BasePermission
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth.models import User
from django.contrib.auth.hashers import check_password
from django.db import IntegrityError
from django.db.models import RestrictedError, ProtectedError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.http import HttpResponse
import csv
import logging

logger = logging.getLogger(__name__)

from .utils import get_client_ip, log_action
from .mixins import EtablissementFilterMixin
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
from .serializers import (
    TypeEtabSerializer, BatimentSerializer, SalleSerializer, JourSerializer,
    LangueSerializer, ModuleSerializer, PensionSerializer, MentionSerializer,
    TypeEvaluationSerializer, RapportSerializer, AnneeSerializer,
    EtablissementSerializer, FaculteSerializer, DepartementSerializer,
    SpecialiteSerializer, CycleSerializer, NiveauSerializer,
    ClasseSerializer, MentionClasseSerializer,
    EtudiantSerializer, EtudiantPhotoSerializer, EnseignantSerializer,
    UtilisateurSerializer, UtilisateurCreateSerializer,
    TuteurSerializer, EtudiantTuteurSerializer,
    TrancheSerializer, FraisSerializer, InscriptionSerializer,
    FraisInscriptionSerializer, PaiementSerializer, MoratoireSerializer,
    FactureSerializer, FactureDetailSerializer, RapportFinancierSerializer,
    MatiereSerializer, QualificationSerializer, CoursSerializer,
    UniteEnseignementSerializer, PeriodeSerializer, EvaluationSerializer,
    FicheNotesSerializer, FicheNotesDetailSerializer,
    PlanningSerializer, RapportCoursSerializer, SeanceSerializer, AbsenceSerializer,
    ExamenSerializer, ConvocationSerializer, RapportStatistiqueSerializer,
    DecisionSerializer, DiplomeSerializer, CarteEtudiantSerializer,
    StageSerializer, LettreAdmissionSerializer, BadgeAccesSerializer,
    DocumentGenereSerializer, AuditLogSerializer,
    NiveauScolaireSerializer, ConfigBulletinSerializer,
)




# ── Permission personnalisée ──────────────────────────────────────────────────
class IsAdminSmsUser(BasePermission):
    """Autorise uniquement les utilisateurs avec le rôle ADMIN dans la table utilisateur."""
    message = "Accès réservé aux administrateurs."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        try:
            return Utilisateur.objects.get(login=request.user.username).role == 'ADMIN'
        except Utilisateur.DoesNotExist:
            return False


# ── Mixin commun ──────────────────────────────────────────────────────────────
class SMSBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    def perform_create(self, serializer):
        instance = serializer.save()
        log_action(self.request, 'CREATE',
                   self.__class__.__name__.replace('ViewSet', ''),
                   getattr(instance, instance._meta.pk.name, ''))

    def perform_update(self, serializer):
        instance = serializer.save()
        log_action(self.request, 'UPDATE',
                   self.__class__.__name__.replace('ViewSet', ''),
                   getattr(instance, instance._meta.pk.name, ''))

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except (RestrictedError, ProtectedError) as exc:
            objs = (
                getattr(exc, 'restricted_objects', None) or
                getattr(exc, 'protected_objects', None) or []
            )
            linked = ', '.join({obj.__class__.__name__ for obj in list(objs)[:10]})
            return Response(
                {'detail': f'Suppression impossible : des enregistrements liés existent ({linked}).'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_destroy(self, instance):
        pk = getattr(instance, instance._meta.pk.name, '')
        log_action(self.request, 'DELETE',
                   self.__class__.__name__.replace('ViewSet', ''), pk)
        instance.delete()

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'Aucun identifiant fourni.'},
                            status=status.HTTP_400_BAD_REQUEST)
        qs    = self.get_queryset().filter(pk__in=ids)
        count = qs.count()
        log_action(request, 'BULK_DELETE',
                   self.__class__.__name__.replace('ViewSet', ''),
                   detail=f'{count} éléments supprimés')
        try:
            qs.delete()
        except IntegrityError as exc:
            return Response(
                {'detail': f'Suppression impossible : des enregistrements liés existent. ({exc})'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response({'deleted': count}, status=status.HTTP_200_OK)


# ── Login SMS ─────────────────────────────────────────────────────────────────
class SmsLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        login    = request.data.get('login', '').strip()
        password = request.data.get('password', '').strip()

        if not login or not password:
            return Response({'detail': 'Identifiant et mot de passe requis.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            user_sms = Utilisateur.objects.get(login=login)
        except Utilisateur.DoesNotExist:
            AuditLog.objects.create(
                utilisateur=login, action='LOGIN_FAILED', modele='Utilisateur',
                objet_id=login, detail='Utilisateur inexistant',
                ip_address=get_client_ip(request))
            return Response({'detail': 'Identifiant ou mot de passe incorrect.'},
                            status=status.HTTP_401_UNAUTHORIZED)

        passwd_ok = check_password(password, user_sms.passwd or '')

        if not passwd_ok:
            AuditLog.objects.create(
                utilisateur=login, action='LOGIN_FAILED', modele='Utilisateur',
                objet_id=login, detail='Mot de passe incorrect',
                ip_address=get_client_ip(request))
            return Response({'detail': 'Identifiant ou mot de passe incorrect.'},
                            status=status.HTTP_401_UNAUTHORIZED)

        django_user, _ = User.objects.get_or_create(
            username=login,
            defaults={'is_active': True, 'is_staff': (user_sms.role == 'ADMIN')}
        )
        if django_user.is_staff != (user_sms.role == 'ADMIN'):
            django_user.is_staff = (user_sms.role == 'ADMIN')
            django_user.save()

        refresh = RefreshToken.for_user(django_user)
        AuditLog.objects.create(
            utilisateur=login, action='LOGIN_SUCCESS', modele='Utilisateur',
            objet_id=login, detail=f'Connexion depuis {get_client_ip(request)}',
            ip_address=get_client_ip(request))

        return Response({
            'login':    user_sms.login,
            'nom_user': getattr(user_sms, 'nom_user', login),
            'role':     getattr(user_sms, 'role', 'ETUDIANT').upper(),
            'access':   str(refresh.access_token),
            'refresh':  str(refresh),
            'message':  'Connexion réussie.',
        }, status=status.HTTP_200_OK)


# ── Logout SMS ───────────────────────────────────────────────────────────────
class SmsLogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'detail': 'Token de rafraîchissement requis.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response({'detail': 'Token invalide ou déjà révoqué.'},
                            status=status.HTTP_400_BAD_REQUEST)
        log_action(request, 'LOGOUT', 'Utilisateur', request.user.username)
        return Response({'detail': 'Déconnexion réussie.'}, status=status.HTTP_200_OK)


# ── Audit Log ─────────────────────────────────────────────────────────────────
class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = AuditLog.objects.all().order_by('-date_action')
    serializer_class   = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter, DjangoFilterBackend]
    search_fields      = ['utilisateur', 'action', 'modele', 'objet_id']
    filterset_fields   = ['action', 'modele', 'utilisateur']

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="audit_log.csv"'
        response.write('﻿')
        writer = csv.writer(response, delimiter=';')
        writer.writerow(['Date', 'Utilisateur', 'Action', 'Modèle', 'ID Objet', 'Détail', 'IP'])
        for log in self.get_queryset():
            writer.writerow([
                log.date_action.strftime('%Y-%m-%d %H:%M:%S') if log.date_action else '',
                log.utilisateur, log.action, log.modele,
                log.objet_id, log.detail, log.ip_address,
            ])
        return response


# ── Tables de référence ───────────────────────────────────────────────────────
class TypeEtabViewSet(SMSBaseViewSet):
    queryset         = TypeEtab.objects.all()
    serializer_class = TypeEtabSerializer
    search_fields    = ['lib_type']

class BatimentViewSet(SMSBaseViewSet):
    queryset         = Batiment.objects.all()
    serializer_class = BatimentSerializer

class SalleViewSet(SMSBaseViewSet):
    queryset         = Salle.objects.all()
    serializer_class = SalleSerializer

class JourViewSet(SMSBaseViewSet):
    queryset         = Jour.objects.all()
    serializer_class = JourSerializer

class LangueViewSet(SMSBaseViewSet):
    queryset         = Langue.objects.all()
    serializer_class = LangueSerializer

class ModuleViewSet(SMSBaseViewSet):
    queryset         = Module.objects.all()
    serializer_class = ModuleSerializer
    search_fields    = ['lib_module']

class PensionViewSet(SMSBaseViewSet):
    queryset         = Pension.objects.all()
    serializer_class = PensionSerializer

class MentionViewSet(SMSBaseViewSet):
    queryset         = Mention.objects.all()
    serializer_class = MentionSerializer

class TypeEvaluationViewSet(SMSBaseViewSet):
    queryset         = TypeEvaluation.objects.all()
    serializer_class = TypeEvaluationSerializer

class RapportViewSet(SMSBaseViewSet):
    queryset         = Rapport.objects.all()
    serializer_class = RapportSerializer


# ── Année scolaire ────────────────────────────────────────────────────────────
class AnneeViewSet(SMSBaseViewSet):
    queryset         = Annee.objects.all()
    serializer_class = AnneeSerializer
    search_fields    = ['lib_annee', 'code_annee']
    filterset_fields = ['statut']

    @action(detail=False, methods=['get'], url_path='en-cours')
    def annee_en_cours(self, request):
        annee = Annee.objects.filter(statut='EN COURS').first()
        if annee:
            return Response(AnneeSerializer(annee).data)
        return Response({'detail': 'Aucune année en cours.'}, status=status.HTTP_404_NOT_FOUND)


# ── Structure académique ──────────────────────────────────────────────────────
class EtablissementViewSet(SMSBaseViewSet):
    queryset         = Etablissement.objects.select_related('code_type').all()
    serializer_class = EtablissementSerializer
    search_fields    = ['lib_etab', 'email']

    @action(detail=False, methods=['get', 'put', 'patch'], url_path='current')
    def current(self, request):
        etab = Etablissement.objects.first()
        if not etab:
            etab = Etablissement.objects.create(
                code_etab='ETAB001',
                lib_etab='Mon Établissement',
                type_etab='SUPERIEUR',
                statut='PRIVE_LAIQUE',
                systeme='FRANCOPHONE',
                actif=True,
            )
        if request.method == 'GET':
            return Response(self.get_serializer(etab).data)
        serializer = self.get_serializer(etab, data=request.data, partial=(request.method == 'PATCH'))
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

# NEW: Faculté (niveau intermédiaire entre Etablissement et Département)
class FaculteViewSet(SMSBaseViewSet):
    queryset         = Faculte.objects.select_related('code_etab').all()
    serializer_class = FaculteSerializer
    search_fields    = ['lib_faculte', 'code_faculte']
    filterset_fields = ['code_etab']

class DepartementViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = Departement.objects.select_related('code_etab', 'code_faculte').all()
    serializer_class = DepartementSerializer
    search_fields    = ['lib_dep']
    filterset_fields = ['code_etab', 'code_faculte']

class SpecialiteViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = Specialite.objects.select_related('code_dep').all()
    serializer_class = SpecialiteSerializer
    search_fields    = ['lib_sp']
    filterset_fields = ['code_dep']

class CycleViewSet(SMSBaseViewSet):
    queryset         = Cycle.objects.select_related('code_pension').all()
    serializer_class = CycleSerializer

class NiveauViewSet(SMSBaseViewSet):
    queryset         = Niveau.objects.select_related('code_cycle', 'code_pension').all()
    serializer_class = NiveauSerializer
    filterset_fields = ['code_cycle']

class ClasseViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = Classe.objects.select_related(
        'code_dep', 'code_niveau', 'code_bat', 'code_salle', 'code_sp').all()
    serializer_class = ClasseSerializer
    search_fields    = ['lib_classe', 'code_classe']
    filterset_fields = ['code_dep', 'code_sp', 'code_niveau']

    @action(detail=True, methods=['get'], url_path='export-csv')
    def export_csv(self, request, pk=None):
        annee = Annee.objects.filter(statut='EN COURS').first()
        inscriptions = Inscription.objects.filter(
            code_classe=pk, code_annee=annee
        ).select_related('mle_etudiant') if annee else []
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="liste_{pk}.csv"'
        response.write('﻿')
        writer = csv.writer(response, delimiter=';')
        writer.writerow(['Matricule', 'Nom', 'Prénom', 'Sexe', 'Date naissance', 'Nationalité', 'Téléphone', 'Email'])
        for insc in inscriptions:
            e = insc.mle_etudiant
            writer.writerow([
                e.mle_etudiant, e.nom, e.prenom or '',
                e.get_sexe_display() if e.sexe else '',
                e.date_naiss.strftime('%d/%m/%Y') if e.date_naiss else '',
                e.nationalite or '',
                f'\t{e.tel}' if e.tel else '', e.email or '',
            ])
        return response

class MentionClasseViewSet(SMSBaseViewSet):
    queryset         = MentionClasse.objects.select_related('code_classe', 'code_mention').all()
    serializer_class = MentionClasseSerializer
    filterset_fields = ['code_classe', 'code_mention']


# ── Personnes ─────────────────────────────────────────────────────────────────
class EtudiantViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = Etudiant.objects.select_related('code_dep', 'code_sp').all()
    serializer_class = EtudiantSerializer
    search_fields    = ['nom', 'prenom', 'mle_etudiant', 'email', 'tel', 'numero_cni']
    filterset_fields = ['code_dep', 'code_sp', 'sexe', 'nationalite']

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        qs = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="etudiants.csv"'
        response.write('﻿')
        writer = csv.writer(response, delimiter=';')
        writer.writerow(['Matricule', 'Nom', 'Prénom', 'Sexe', 'Date naissance',
                         'Lieu', 'Région', 'Nationalité', 'N° CNI',
                         'Téléphone', 'Email', 'Filière', 'Spécialité'])
        for e in qs:
            writer.writerow([
                e.mle_etudiant, e.nom, e.prenom or '',
                e.get_sexe_display() if e.sexe else '',
                e.date_naiss.strftime('%d/%m/%Y') if e.date_naiss else '',
                e.lieu or '', e.region_or or '',
                e.nationalite or '', e.numero_cni or '',
                f'\t{e.tel}' if e.tel else '', e.email or '',
                e.code_dep.lib_dep if e.code_dep else '',
                e.code_sp.lib_sp  if e.code_sp  else '',
            ])
        return response

    @action(detail=True, methods=['get'], url_path='photo')
    def photo(self, request, pk=None):
        return Response(EtudiantPhotoSerializer(self.get_object()).data)

    @action(detail=True, methods=['get'], url_path='inscriptions')
    def inscriptions(self, request, pk=None):
        qs = Inscription.objects.filter(mle_etudiant=pk).select_related('code_classe', 'code_annee')
        return Response(InscriptionSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'], url_path='paiements')
    def paiements(self, request, pk=None):
        qs = Paiement.objects.filter(mle_etudiant=pk).select_related('code_tranche', 'code_annee')
        return Response(PaiementSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'], url_path='evaluations')
    def evaluations(self, request, pk=None):
        qs = Evaluation.objects.filter(mle_etudiant=pk).select_related(
            'code_matiere', 'code_classe', 'code_periode', 'code_type_eval')
        return Response(EvaluationSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'], url_path='tuteurs')
    def tuteurs(self, request, pk=None):
        qs = EtudiantTuteur.objects.filter(mle_etudiant=pk).select_related('code_tuteur')
        return Response(EtudiantTuteurSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'], url_path='absences')
    def absences(self, request, pk=None):
        qs = Absence.objects.filter(mle_etudiant=pk).select_related('code_seance')
        return Response(AbsenceSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'], url_path='decisions')
    def decisions(self, request, pk=None):
        qs = Decision.objects.filter(mle_etudiant=pk).select_related('code_annee', 'code_classe')
        return Response(DecisionSerializer(qs, many=True).data)

class EnseignantViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = Enseignant.objects.select_related('code_dep').all()
    serializer_class = EnseignantSerializer
    search_fields    = ['nom_ens', 'prenom_ens', 'mle_ens', 'email_ens']
    filterset_fields = ['code_dep', 'statut']

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        qs = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="enseignants.csv"'
        response.write('﻿')
        writer = csv.writer(response, delimiter=';')
        writer.writerow(['Matricule', 'Nom', 'Prénom', 'Genre', 'N° CNI', 'Téléphone', 'Email', 'Statut', 'Département'])
        for e in qs:
            writer.writerow([
                e.mle_ens, e.nom_ens, e.prenom_ens or '',
                e.get_sexe_display() if e.sexe else '',
                e.numero_cni or '',
                f'\t{e.tel_ens}' if e.tel_ens else '', e.email_ens or '',
                e.get_statut_display() if e.statut else '',
                e.code_dep.lib_dep if e.code_dep else '',
            ])
        return response

    @action(detail=True, methods=['get'], url_path='planning')
    def planning(self, request, pk=None):
        qs = Planning.objects.filter(mle_ens=pk).select_related('code_matiere', 'code_classe', 'code_jour')
        return Response(PlanningSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'], url_path='seances')
    def seances(self, request, pk=None):
        qs = Seance.objects.filter(mle_ens=pk).select_related('code_matiere', 'code_classe')
        return Response(SeanceSerializer(qs, many=True).data)

# FIX: UtilisateurViewSet — les opérations d'écriture sont maintenant réservées aux ADMIN
class UtilisateurViewSet(viewsets.ModelViewSet):
    queryset = Utilisateur.objects.all()

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return UtilisateurCreateSerializer
        return UtilisateurSerializer

    def get_permissions(self):
        # Lecture : tout utilisateur authentifié
        # Écriture/suppression : ADMIN uniquement
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsAdminSmsUser()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        instance = serializer.save()
        log_action(self.request, 'CREATE', 'Utilisateur', instance.login)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_action(self.request, 'UPDATE', 'Utilisateur', instance.login)

class TuteurViewSet(SMSBaseViewSet):
    queryset         = Tuteur.objects.all()
    serializer_class = TuteurSerializer
    search_fields    = ['nom', 'prenom', 'tel', 'email']
    filterset_fields = ['lien_parente']

class EtudiantTuteurViewSet(SMSBaseViewSet):
    queryset         = EtudiantTuteur.objects.select_related('mle_etudiant', 'code_tuteur').all()
    serializer_class = EtudiantTuteurSerializer
    filterset_fields = ['mle_etudiant', 'code_tuteur', 'est_contact_principal']


# ── Scolarité & Paiements ─────────────────────────────────────────────────────
class TrancheViewSet(SMSBaseViewSet):
    queryset         = Tranche.objects.select_related('code_pension').all()
    serializer_class = TrancheSerializer
    filterset_fields = ['code_pension']

class FraisViewSet(SMSBaseViewSet):
    queryset         = Frais.objects.select_related('code_annee').all()
    serializer_class = FraisSerializer
    search_fields    = ['lib_frais', 'type_frais']
    filterset_fields = ['type_frais', 'code_annee']

class InscriptionViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = Inscription.objects.select_related(
        'code_classe', 'mle_etudiant', 'code_annee').all()
    serializer_class = InscriptionSerializer
    search_fields    = ['mle_etudiant__nom', 'mle_etudiant__prenom']
    filterset_fields = ['code_classe', 'code_annee']

class FraisInscriptionViewSet(SMSBaseViewSet):
    queryset         = FraisInscription.objects.select_related(
        'code_inscription', 'code_frais').all()
    serializer_class = FraisInscriptionSerializer
    filterset_fields = ['code_inscription', 'code_frais']

class PaiementViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = Paiement.objects.select_related(
        'mle_etudiant__code_dep', 'mle_etudiant__code_sp',
        'code_tranche', 'code_annee').all()
    serializer_class = PaiementSerializer
    search_fields    = ['mle_etudiant__nom']
    filterset_fields = ['code_annee', 'code_tranche', 'statut', 'mle_etudiant', 'type_paiement']

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        qs = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="paiements.csv"'
        response.write('﻿')
        writer = csv.writer(response, delimiter=';')
        writer.writerow(['N°', 'Étudiant', 'Tranche', 'Montant (FCFA)', 'Date', 'Statut', 'Année'])
        for p in qs:
            writer.writerow([
                p.code_paiement,
                f"{p.mle_etudiant.nom} {p.mle_etudiant.prenom or ''}" if p.mle_etudiant else '',
                p.code_tranche.lib_tranche if p.code_tranche else '',
                p.mt_paiement,
                p.date_paiement.strftime('%Y-%m-%d') if p.date_paiement else '',
                p.get_statut_display() if p.statut else '',
                p.code_annee.lib_annee if p.code_annee else '',
            ])
        return response

class MoratoireViewSet(SMSBaseViewSet):
    queryset         = Moratoire.objects.select_related('mle_etudiant').all()
    serializer_class = MoratoireSerializer
    filterset_fields = ['mle_etudiant']

class FactureViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = Facture.objects.select_related('mle_etudiant').all()
    serializer_class = FactureSerializer
    search_fields    = ['numero_facture', 'mle_etudiant__nom']
    filterset_fields = ['statut', 'code_annee', 'mle_etudiant']

class FactureDetailViewSet(SMSBaseViewSet):
    queryset         = FactureDetail.objects.select_related('code_facture').all()
    serializer_class = FactureDetailSerializer
    filterset_fields = ['code_facture', 'type_frais']

class RapportFinancierViewSet(SMSBaseViewSet):
    queryset         = RapportFinancier.objects.all()
    serializer_class = RapportFinancierSerializer
    filterset_fields = ['code_annee', 'genere_par']


# ── Pédagogie ─────────────────────────────────────────────────────────────────
class MatiereViewSet(SMSBaseViewSet):
    queryset         = Matiere.objects.select_related('code_module').all()
    serializer_class = MatiereSerializer
    search_fields    = ['lib_matiere', 'code_matiere']
    filterset_fields = ['code_module']

class QualificationViewSet(SMSBaseViewSet):
    queryset         = Qualification.objects.select_related('code_matiere', 'mle_ens').all()
    serializer_class = QualificationSerializer
    filterset_fields = ['mle_ens', 'code_matiere']

class CoursViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = Cours.objects.select_related('code_matiere', 'code_classe', 'mle_ens', 'code_annee').all()
    serializer_class = CoursSerializer
    filterset_fields = ['code_classe', 'code_matiere', 'mle_ens', 'semestre', 'code_annee']

class UniteEnseignementViewSet(SMSBaseViewSet):
    queryset         = UniteEnseignement.objects.select_related(
        'code_matiere', 'code_classe', 'mle_ens', 'code_annee').all()
    serializer_class = UniteEnseignementSerializer
    filterset_fields = ['code_classe', 'code_annee', 'mle_ens']

class PeriodeViewSet(SMSBaseViewSet):
    queryset         = Periode.objects.select_related('code_annee').all()
    serializer_class = PeriodeSerializer
    filterset_fields = ['code_annee']

class EvaluationViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = Evaluation.objects.select_related(
        'mle_etudiant', 'code_matiere', 'code_classe', 'code_periode', 'code_type_eval').all()
    serializer_class = EvaluationSerializer
    search_fields    = ['mle_etudiant__nom', 'code_matiere__lib_matiere']
    filterset_fields = ['code_classe', 'code_periode', 'code_type_eval', 'mle_etudiant']

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        qs = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="evaluations.csv"'
        response.write('﻿')
        writer = csv.writer(response, delimiter=';')
        writer.writerow(['Matricule', 'Étudiant', 'Matière', 'Classe', 'Type', 'Date', 'Note'])
        for e in qs:
            writer.writerow([
                e.mle_etudiant.mle_etudiant if e.mle_etudiant else '',
                str(e.mle_etudiant) if e.mle_etudiant else '',
                e.code_matiere.lib_matiere if e.code_matiere else '',
                e.code_classe.code_classe  if e.code_classe  else '',
                e.code_type_eval.lib_type_eval if e.code_type_eval else '',
                e.date_eval.strftime('%Y-%m-%d') if e.date_eval else '',
                e.note,
            ])
        return response

class FicheNotesViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = FicheNotes.objects.select_related(
        'code_matiere', 'code_classe', 'mle_ens', 'code_periode', 'code_type_eval').all()
    serializer_class = FicheNotesSerializer
    search_fields    = ['code_matiere__lib_matiere']
    filterset_fields = ['code_classe', 'code_annee', 'mle_ens', 'statut']

    @action(detail=True, methods=['post'], url_path='valider')
    def valider(self, request, pk=None):
        fiche = self.get_object()
        fiche.statut = 'VALIDE'
        fiche.save()
        log_action(request, 'UPDATE', 'FicheNotes', pk, 'Validation de la fiche')
        return Response({'statut': fiche.statut})

    @action(detail=True, methods=['post'], url_path='importer')
    def importer_evaluations(self, request, pk=None):
        """Importe les notes de la fiche dans la table evaluation."""
        fiche   = self.get_object()
        details = FicheNotesDetail.objects.filter(code_fiche=fiche)
        created = 0
        for detail in details:
            if detail.note is not None and not detail.absent:
                Evaluation.objects.update_or_create(
                    mle_etudiant=detail.mle_etudiant,
                    code_matiere=fiche.code_matiere,
                    code_classe=fiche.code_classe,
                    code_periode=fiche.code_periode,
                    code_type_eval=fiche.code_type_eval,
                    defaults={'note': detail.note, 'date_eval': fiche.date_evaluation}
                )
                created += 1
        fiche.statut = 'IMPORTE'
        fiche.save()
        log_action(request, 'CREATE', 'Evaluation', pk,
                   f'{created} notes importées depuis fiche {pk}')
        return Response({'imported': created, 'statut': fiche.statut})

class FicheNotesDetailViewSet(SMSBaseViewSet):
    queryset         = FicheNotesDetail.objects.select_related('code_fiche', 'mle_etudiant').all()
    serializer_class = FicheNotesDetailSerializer
    filterset_fields = ['code_fiche', 'mle_etudiant', 'absent']


# ── Planning & Rapports ───────────────────────────────────────────────────────
class PlanningViewSet(SMSBaseViewSet):
    queryset         = Planning.objects.select_related(
        'code_cours__code_matiere', 'code_cours__code_classe',
        'code_cours__mle_ens', 'code_cours__code_annee',
        'code_jour', 'code_salle').all()
    serializer_class = PlanningSerializer
    filterset_fields = ['code_cours__code_classe', 'code_cours__mle_ens',
                        'code_cours__code_annee', 'code_cours__semestre',
                        'code_jour', 'type_planning', 'type_seance']

    @action(detail=False, methods=['get'], url_path='classe/(?P<code_classe>[^/.]+)')
    def par_classe(self, request, code_classe=None):
        qs = Planning.objects.filter(
            code_cours__code_classe=code_classe
        ).select_related(
            'code_cours__code_matiere', 'code_cours__mle_ens',
            'code_cours__code_annee', 'code_jour', 'code_salle'
        ).order_by('code_jour', 'h_debut')
        return Response(PlanningSerializer(qs, many=True).data)

class RapportCoursViewSet(SMSBaseViewSet):
    queryset         = RapportCours.objects.select_related(
        'code_matiere', 'code_classe', 'code_rapport', 'mle_ens').all()
    serializer_class = RapportCoursSerializer
    filterset_fields = ['code_classe', 'mle_ens', 'code_rapport']

class SeanceViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = Seance.objects.select_related(
        'code_matiere', 'code_classe', 'mle_ens', 'code_annee').all()
    serializer_class = SeanceSerializer
    search_fields    = ['code_matiere__lib_matiere']
    filterset_fields = ['code_classe', 'mle_ens', 'code_annee', 'statut', 'date_seance']

    @action(detail=True, methods=['get'], url_path='presences')
    def presences(self, request, pk=None):
        absences = Absence.objects.filter(code_seance=pk).select_related('mle_etudiant')
        return Response(AbsenceSerializer(absences, many=True).data)

    @action(detail=True, methods=['post'], url_path='saisir-presences')
    def saisir_presences(self, request, pk=None):
        """Crée ou met à jour les présences d'une séance.
        Body: { presences: [{mle_etudiant, present, signe}] }
        """
        seance    = self.get_object()
        presences = request.data.get('presences', [])
        errors    = []
        count     = 0
        for item in presences:
            mle = item.get('mle_etudiant')
            if not mle:
                errors.append({'mle_etudiant': None, 'detail': 'Matricule manquant.'})
                continue
            try:
                Absence.objects.update_or_create(
                    code_seance=seance,
                    mle_etudiant_id=mle,
                    defaults={
                        'present':   item.get('present', False),
                        'signe':     item.get('signe', False),
                        'motif':     item.get('motif', ''),
                        'justifiee': item.get('justifiee', False),
                    }
                )
                count += 1
            except IntegrityError as exc:
                errors.append({'mle_etudiant': mle, 'detail': str(exc)})
        log_action(request, 'UPDATE', 'Seance', pk, f'{count} présences saisies')
        response_data = {'updated': count}
        if errors:
            response_data['errors'] = errors
        return Response(response_data)

class AbsenceViewSet(SMSBaseViewSet):
    queryset         = Absence.objects.select_related('code_seance', 'mle_etudiant').all()
    serializer_class = AbsenceSerializer
    search_fields    = ['mle_etudiant__nom']
    filterset_fields = ['code_seance', 'mle_etudiant', 'present', 'justifiee']


# ── Gestion interne ───────────────────────────────────────────────────────────
class ExamenViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = Examen.objects.select_related(
        'code_matiere', 'code_classe', 'code_annee', 'code_periode').all()
    serializer_class = ExamenSerializer
    search_fields    = ['lib_examen']
    filterset_fields = ['code_classe', 'code_annee', 'type_examen']

    @action(detail=True, methods=['post'], url_path='generer-convocations')
    def generer_convocations(self, request, pk=None):
        examen = self.get_object()
        annee  = examen.code_annee
        inscriptions = Inscription.objects.filter(
            code_classe=examen.code_classe, code_annee=annee
        ).select_related('mle_etudiant')
        count = 0
        for insc in inscriptions:
            Convocation.objects.get_or_create(
                type_convocation='EXAMEN',
                destinataire_type='ETUDIANT',
                mle_etudiant=insc.mle_etudiant,
                code_examen=examen,
                defaults={
                    'objet':          f"Convocation — {examen.lib_examen}",
                    'date_evenement': examen.date_examen,
                    'lieu':           examen.code_salle or '',
                }
            )
            count += 1
        examen.convocation_envoyee = True
        examen.save()
        log_action(request, 'CREATE', 'Convocation', pk,
                   f'{count} convocations générées pour {examen.lib_examen}')
        return Response({'generated': count})

class ConvocationViewSet(SMSBaseViewSet):
    queryset         = Convocation.objects.select_related(
        'mle_etudiant', 'mle_ens', 'code_examen').all()
    serializer_class = ConvocationSerializer
    search_fields    = ['objet', 'mle_etudiant__nom']
    filterset_fields = ['type_convocation', 'destinataire_type', 'statut', 'mle_etudiant']

class RapportStatistiqueViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = RapportStatistique.objects.select_related(
        'code_annee', 'code_classe', 'code_dep').all()
    serializer_class = RapportStatistiqueSerializer
    filterset_fields = ['code_annee', 'code_classe', 'code_dep']

    @action(detail=False, methods=['post'], url_path='generate')
    def generate(self, request):
        code_annee = request.data.get('code_annee')
        code_classe = request.data.get('code_classe') or None
        code_dep    = request.data.get('code_dep')    or None

        if not code_annee:
            return Response({'error': 'code_annee est requis'}, status=status.HTTP_400_BAD_REQUEST)

        # ── Inscriptions ────────────────────────────────────────────────────────
        inscr_qs = Inscription.objects.filter(code_annee=code_annee)
        if code_classe:
            inscr_qs = inscr_qs.filter(code_classe=code_classe)
        elif code_dep:
            inscr_qs = inscr_qs.filter(code_classe__code_dep=code_dep)

        nb_inscrits = inscr_qs.count()
        nb_hommes   = inscr_qs.filter(mle_etudiant__sexe='M').count()
        nb_femmes   = inscr_qs.filter(mle_etudiant__sexe='F').count()

        # ── Décisions ───────────────────────────────────────────────────────────
        dec_qs = Decision.objects.filter(code_annee=code_annee)
        if code_classe:
            dec_qs = dec_qs.filter(code_classe=code_classe)
        elif code_dep:
            dec_qs = dec_qs.filter(code_classe__code_dep=code_dep)

        nb_admis     = dec_qs.filter(resultat='ADMIS').count()
        nb_ajournes  = dec_qs.filter(resultat='AJOURNE').count()
        nb_redoubles = dec_qs.filter(resultat='REDOUBLE').count()

        # ── Évaluations ─────────────────────────────────────────────────────────
        eval_qs = Evaluation.objects.all()
        if code_classe:
            eval_qs = eval_qs.filter(code_classe=code_classe)
        elif code_dep:
            eval_qs = eval_qs.filter(code_classe__code_dep=code_dep)

        agg = eval_qs.aggregate(avg=Avg('note'), mn=Min('note'), mx=Max('note'))
        moyenne  = round(float(agg['avg']), 2) if agg['avg'] is not None else None
        note_min = round(float(agg['mn']),  2) if agg['mn']  is not None else None
        note_max = round(float(agg['mx']),  2) if agg['mx']  is not None else None

        genere_par = request.user.get_full_name() or request.user.username \
            if request.user.is_authenticated else 'Système'

        rapport = RapportStatistique.objects.create(
            code_annee_id    = code_annee,
            code_classe_id   = code_classe,
            code_dep_id      = code_dep,
            nb_inscrits      = nb_inscrits,
            nb_hommes        = nb_hommes,
            nb_femmes        = nb_femmes,
            nb_admis         = nb_admis,
            nb_ajournes      = nb_ajournes,
            nb_redoubles     = nb_redoubles,
            moyenne_generale = moyenne,
            note_min         = note_min,
            note_max         = note_max,
            genere_par       = genere_par,
        )
        serializer = self.get_serializer(rapport)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        qs = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="rapport_statistique.csv"'
        response.write('﻿')
        writer = csv.writer(response, delimiter=';')
        writer.writerow(['Année', 'Classe', 'Département', 'Inscrits', 'Hommes', 'Femmes',
                         'Admis', 'Ajournés', 'Taux réussite %', 'Taux féminisation %', 'Moyenne'])
        for r in qs:
            writer.writerow([
                r.code_annee.lib_annee if r.code_annee else '',
                r.code_classe.lib_classe if r.code_classe else '',
                r.code_dep.lib_dep if r.code_dep else '',
                r.nb_inscrits, r.nb_hommes, r.nb_femmes,
                r.nb_admis, r.nb_ajournes,
                r.taux_reussite, r.taux_feminisation,
                r.moyenne_generale or '',
            ])
        return response


# ── Documents avancés ─────────────────────────────────────────────────────────
class DecisionViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = Decision.objects.select_related(
        'mle_etudiant', 'code_annee', 'code_classe').all()
    serializer_class = DecisionSerializer
    search_fields    = ['mle_etudiant__nom']
    filterset_fields = ['code_annee', 'code_classe', 'resultat', 'mention', 'session']

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        qs = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="decisions.csv"'
        response.write('﻿')
        writer = csv.writer(response, delimiter=';')
        writer.writerow(['Matricule', 'Nom', 'Classe', 'Année', 'Session',
                         'Moyenne', 'Crédits validés', 'Résultat', 'Mention', 'Rang'])
        for d in qs:
            writer.writerow([
                d.mle_etudiant.mle_etudiant, d.mle_etudiant.nom,
                d.code_classe.lib_classe if d.code_classe else '',
                d.code_annee.lib_annee  if d.code_annee  else '',
                d.get_session_display(),
                d.moyenne_annuelle or '', d.credits_valides,
                d.get_resultat_display(), d.mention or '', d.rang or '',
            ])
        return response

class DiplomeViewSet(SMSBaseViewSet):
    queryset         = Diplome.objects.select_related('mle_etudiant').all()
    serializer_class = DiplomeSerializer
    search_fields    = ['lib_diplome', 'mle_etudiant__nom', 'numero_serie']
    filterset_fields = ['annee_obtention', 'mention', 'type_diplome']

class CarteEtudiantViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = CarteEtudiant.objects.select_related('mle_etudiant').all()
    serializer_class = CarteEtudiantSerializer
    search_fields    = ['numero_carte', 'mle_etudiant__nom']
    filterset_fields = ['code_annee', 'statut', 'mle_etudiant']

class StageViewSet(EtablissementFilterMixin, SMSBaseViewSet):
    queryset         = Stage.objects.select_related('mle_etudiant').all()
    serializer_class = StageSerializer
    search_fields    = ['entreprise', 'sujet', 'mle_etudiant__nom']
    filterset_fields = ['code_annee', 'type_stage', 'statut', 'certificat_emis']

class LettreAdmissionViewSet(SMSBaseViewSet):
    queryset         = LettreAdmission.objects.select_related('mle_etudiant').all()
    serializer_class = LettreAdmissionSerializer
    search_fields    = ['mle_etudiant__nom']
    filterset_fields = ['type_lettre', 'code_annee', 'envoye_par_email']

class BadgeAccesViewSet(SMSBaseViewSet):
    queryset         = BadgeAcces.objects.select_related('mle_etudiant', 'mle_ens').all()
    serializer_class = BadgeAccesSerializer
    search_fields    = ['numero_badge', 'mle_etudiant__nom']
    filterset_fields = ['type_porteur', 'statut']

class DocumentGenereViewSet(SMSBaseViewSet):
    queryset         = DocumentGenere.objects.select_related(
        'mle_etudiant', 'code_classe', 'code_annee').all()
    serializer_class = DocumentGenereSerializer
    search_fields    = ['nom_fichier', 'type_document']
    filterset_fields = ['type_document', 'format', 'mle_etudiant', 'code_annee']


# ── Multi-établissement ───────────────────────────────────────────────────────
class NiveauScolaireViewSet(SMSBaseViewSet):
    queryset         = NiveauScolaire.objects.all()
    serializer_class = NiveauScolaireSerializer
    filterset_fields = ['type_etab', 'systeme']
    search_fields    = ['lib_niveau', 'lib_en']

class ConfigBulletinViewSet(SMSBaseViewSet):
    queryset         = ConfigBulletin.objects.all()
    serializer_class = ConfigBulletinSerializer
    filterset_fields = ['type_etab']
