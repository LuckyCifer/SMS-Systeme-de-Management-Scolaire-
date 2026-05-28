# SMS — Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Data Models](#data-models)
3. [API Endpoints](#api-endpoints)
4. [JWT Authentication Flow](#jwt-authentication-flow)
5. [Multi-Institution Isolation](#multi-institution-isolation)
6. [Frontend Architecture](#frontend-architecture)

---

## Overview

SMS follows a strict **client–server** separation:

```
Browser (React SPA)
       │  HTTP/JSON + Bearer JWT
       ▼
Django REST Framework API  (localhost:8000)
       │
       ▼
MySQL 9.5 database
```

The frontend is a pure SPA served by Vite. Every data access goes through the REST API. There is no server-side rendering.

---

## Data Models

### Reference tables (read-only in production)

| Model | Table | Description |
|---|---|---|
| `TypeEtab` | `type_etab` | Institution type (Primary / Secondary / Higher) |
| `Batiment` | `batiment` | Buildings |
| `Salle` | `salle` | Classrooms |
| `Jour` | `jour` | Weekdays (LUN … SAM) |
| `Mention` | `mention` | Grade mentions (Passable, Bien…) |
| `Pension` | `pension` | Tuition fee regimes |

### Academic structure

```
Etablissement
  └── Faculte (Higher Ed only)
        └── Departement
              └── Specialite
                    └── Classe (NiveauScolaire)
```

| Model | Key fields |
|---|---|
| `Etablissement` | `code_etab`, `lib_etab`, `type_etab`, `systeme` (FR/EN) |
| `Departement` | `code_dep`, `lib_dep`, `etablissement` |
| `Specialite` | `code_sp`, `lib_sp`, `code_dep` |
| `Classe` | `code_classe`, `lib_classe`, `niveau_scolaire`, `eff_max` |
| `NiveauScolaire` | `code_niveau`, `lib_niveau`, `type_etab` |

### People

| Model | Table | Key fields |
|---|---|---|
| `Etudiant` | `etudiant` | `mle_etudiant`, `nom`, `prenom`, `sexe`, `date_naiss`, `code_dep`, `code_sp` |
| `Enseignant` | `enseignant` | `mle_ens`, `nom`, `prenom`, `grade`, `specialite` |
| `Utilisateur` | `utilisateur` | `login`, `role` (ADMIN / SECRETAIRE / ENSEIGNANT / ETUDIANT) |

### Enrolment & Finance

| Model | Key fields |
|---|---|
| `Inscription` | `code_inscription`, `mle_etudiant`, `code_classe`, `annee`, `pension` |
| `Paiement` | `code_paiement`, `code_inscription`, `montant`, `date_paiement` |
| `Facture` | `code_facture`, `code_inscription`, `montant_total`, `statut` |

### Academic management

| Model | Key fields |
|---|---|
| `Cours` | `code_cours`, `code_matiere`, `code_classe`, `mle_ens`, `semestre` |
| `Planning` | `id`, `code_cours`, `type_planning` (HEBDO/INTENSIF), `code_jour`, `h_debut`, `h_fin` |
| `Seance` | `id`, `code_cours`, `date_seance`, `h_debut`, `h_fin`, `effectif_present` |
| `Evaluation` | `code_eval`, `code_cours`, `type_eval`, `date_eval`, `bareme` |
| `FicheNotes` | `id`, `code_eval`, `mle_etudiant`, `note` |

### Documents

| Model | Description |
|---|---|
| `Examen` | Exam scheduling and room assignment |
| `Convocation` | Student exam invitations |
| `Stage` | Internship management |
| `CarteEtudiant` | Student ID cards |
| `Decision` | Jury decisions (admitted / deferred / repeated) |
| `RapportStatistique` | Aggregated statistics per class |

### Audit

| Model | Key fields |
|---|---|
| `AuditLog` | `utilisateur`, `action`, `modele`, `objet_id`, `detail`, `ip_address`, `timestamp` |

---

## API Endpoints

All endpoints are prefixed with `/api/`. Authentication required unless noted.

### Authentication (public)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/sms-login/` | Login with username + password → JWT pair |
| `POST` | `/api/auth/refresh/` | Refresh access token using refresh token |
| `POST` | `/api/auth/verify/` | Verify token validity |
| `POST` | `/api/auth/sms-logout/` | Blacklist the refresh token |

### Academic structure

| Prefix | Description |
|---|---|
| `/api/etablissements/` | Institutions |
| `/api/departements/` | Departments |
| `/api/specialites/` | Specialities |
| `/api/classes/` | Classes |
| `/api/niveaux-scolaires/` | School levels |
| `/api/annees/` | Academic years |

### People

| Prefix | Description |
|---|---|
| `/api/etudiants/` | Students (+ `export-csv/`, `bulk-delete/`) |
| `/api/enseignants/` | Teachers |
| `/api/utilisateurs/` | System users |

### Finance

| Prefix | Description |
|---|---|
| `/api/inscriptions/` | Enrolments |
| `/api/paiements/` | Payments |
| `/api/factures/` | Invoices |
| `/api/tranches/` | Payment tranches |
| `/api/pensions/` | Tuition regimes |

### Pedagogy & Schedule

| Prefix | Description |
|---|---|
| `/api/cours/` | Course catalogue |
| `/api/planning/` | Timetable slots |
| `/api/seances/` | Attendance sessions |
| `/api/evaluations/` | Evaluations |
| `/api/fiches-notes/` | Grade sheets |
| `/api/matieres/` | Subjects |

### Documents & Reports

| Prefix | Description |
|---|---|
| `/api/examens/` | Exams |
| `/api/decisions/` | Jury decisions |
| `/api/stages/` | Internships |
| `/api/cartes-etudiants/` | Student cards |
| `/api/rapports-stat/` | Statistics reports |
| `/api/audit/` | Audit log |

All list endpoints support:
- `?search=` — full-text search
- `?ordering=field` — column sort
- `?page=N&page_size=N` — pagination
- Django-filter parameters per model

---

## JWT Authentication Flow

```
1. User POSTs credentials to /api/auth/sms-login/
        │
        ▼
2. Django validates user → returns:
   { access: "<JWT, 24h>", refresh: "<JWT, 30d>", user: {...} }
        │
        ▼
3. Frontend stores tokens in localStorage
   (sms_access, sms_refresh)
        │
        ▼
4. Every API request injects:
   Authorization: Bearer <access_token>
   X-Etablissement-Id: <code_etab>
        │
        ▼
5. On 401 response:
   - If refresh token exists → POST /api/auth/refresh/
   - New access token saved → original request retried
   - If refresh also fails → clearTokens() → redirect to /login
```

The refresh logic is implemented in `frontend/src/services/api.js` using an Axios response interceptor with a request queue to avoid parallel refresh races.

---

## Multi-Institution Isolation

Every protected ViewSet inherits `EtablissementFilterMixin` (`api/mixins.py`):

```python
class EtablissementFilterMixin:
    def get_queryset(self):
        qs = super().get_queryset()
        etab_id = self.request.META.get('HTTP_X_ETABLISSEMENT_ID', '').strip()
        if etab_id and _has_etab_field(qs.model):
            return qs.filter(etablissement_id=etab_id)
        return qs

    def perform_create(self, serializer):
        etab_id = self.get_etablissement_id()
        serializer.save(etablissement_id=etab_id)
```

The frontend sends the `X-Etablissement-Id` header on every request via an Axios interceptor. The header is read from `localStorage['sms_etab']` which is set at login time.

---

## Frontend Architecture

```
src/
├── context/
│   └── AppContext.jsx      # Global state: theme, lang, user, toasts
├── services/
│   ├── api.js              # Axios instance + JWT interceptors
│   └── endpoints.js        # Service objects per model
├── hooks/
│   ├── useApi.js           # Declarative data fetching hook
│   └── useEtablissement.js # Institution config hook
├── pages/                  # 25+ page components (one per route)
├── components/
│   └── CrudTable.jsx       # Generic CRUD table (search, sort, paginate, bulk-delete)
└── i18n/
    ├── fr.js               # French translations
    └── en.js               # English translations
```

### State management

No external state library. State is managed with:
- `useContext` + `useReducer` for global concerns (auth, theme, language, toasts)
- Local `useState` within page components
- `useApi` hook for server state (loading / error / data / reload)

### Role-based access control

Roles: `ADMIN > SECRETAIRE > ENSEIGNANT > ETUDIANT`

Route-level guards in `src/utils/roles.js` + `src/components/RoleGuard.jsx` prevent unauthorised access both at navigation and at component render level.
