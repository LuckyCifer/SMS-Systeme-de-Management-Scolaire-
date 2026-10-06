# CLAUDE.md — SMS (School Management System)

> Ce fichier est lu automatiquement par Claude Code à chaque nouvelle session.
> Il contient tout le contexte nécessaire pour reprendre le travail sans historique.

---

## 1. VUE D'ENSEMBLE DU PROJET

**Nom complet :** Système de Management Scolaire (SMS)
**Type :** Application web full stack de gestion d'établissements scolaires
**Contexte :** Projet développé par Yemeya Luc (LuckyCifer) à Yaoundé, Cameroun
**Dépôt GitHub :** github.com/LuckyCifer

---

## 2. STACK TECHNIQUE

### Backend
- **Framework :** Django 5.2
- **API :** Django REST Framework (DRF)
- **Authentification :** SimpleJWT (djangorestframework-simplejwt)
- **Base de données :** MySQL 8 via mysqlclient
- **Python :** 3.11.9 (IMPORTANT : ne pas utiliser Python 3.14, incompatible avec Django)

### Frontend
- **Framework :** React 18 + Vite
- **UI :** AdminLTE 3.2
- **Palette de couleurs ACERFI :**
  - `#1F3864` — bleu foncé (primaire)
  - `#2E74B5` — bleu moyen
  - `#D6E4F0` — bleu clair (accents)
- **HTTP Client :** Axios avec intercepteurs JWT
- **Gestionnaire d'état auth :** Zustand

### Base de données
- **Nom de la base :** `sms`
- **Encodage :** utf8mb4 / utf8mb4_unicode_ci
- **Host :** 127.0.0.1 (pas "localhost" — important pour mysqlclient)
- **Port :** 3306

---

## 3. STRUCTURE DU PROJET

```
Projet SMS/
├── backend/
│   ├── api/
│   │   ├── models.py          # Tous les modèles (40+ tables)
│   │   ├── serializers.py     # Serializers DRF
│   │   ├── views.py           # ViewSets complets
│   │   ├── urls.py            # Routes API
│   │   ├── admin.py           # Interface admin Django
│   │   ├── mixins.py          # EtablissementFilterMixin
│   │   ├── pagination.py      # Pagination personnalisée
│   │   ├── utils.py           # get_client_ip, log_action
│   │   └── permissions.py     # Permissions personnalisées
│   ├── management/            # App Django séparée
│   ├── sms_backend/           # Config Django (settings, urls, wsgi)
│   ├── fixtures/              # Données de test
│   ├── .env                   # Variables d'environnement (ne pas committer)
│   └── manage.py
├── frontend/
│   ├── src/
│   │   ├── components/        # Composants réutilisables
│   │   ├── pages/             # Pages par module
│   │   ├── layouts/           # Layout AdminLTE
│   │   ├── services/          # Appels API Axios
│   │   ├── context/           # AuthContext
│   │   ├── hooks/             # Hooks personnalisés
│   │   └── utils/
│   │       └── roles.js       # Système de rôles et permissions
│   └── package.json
└── CLAUDE.md                  # Ce fichier
```

---

## 4. MODÈLE DE DONNÉES COMPLET

### 4.1 Tables de référence
| Modèle | Table MySQL | Description |
|---|---|---|
| `TypeEtab` | `type_etab` | Types d'établissement |
| `Batiment` | `batiment` | Bâtiments |
| `Salle` | `salle` | Salles de cours |
| `Jour` | `jour` | Jours de la semaine |
| `Langue` | `langue` | Langues d'enseignement |
| `Module` | `module` | Modules fonctionnels |
| `Pension` | `pension` | Types de pension |
| `Mention` | `mention` | Mentions (TB, B, AB…) |
| `TypeEvaluation` | `type_evaluation` | Types d'évaluation |
| `Rapport` | `rapport` | Types de rapport |

### 4.2 Tables principales
| Modèle | Table MySQL | Clé primaire | Description |
|---|---|---|---|
| `Annee` | `annee` | `code_annee` (char) | Années académiques |
| `Etablissement` | `etablissement` | `code_etab` (char) | Établissements scolaires |
| `Departement` | `departement` | `code_dep` (char) | Départements/filières |
| `Specialite` | `specialite` | `code_spec` (char) | Spécialités |
| `Cycle` | `cycle` | `code_cycle` (char) | Cycles d'études |
| `Niveau` | `niveau` | `code_niveau` (char) | Niveaux |
| `Classe` | `classe` | `code_classe` (char) | Classes |
| `MentionClasse` | `mention_classe` | composite | Mentions par classe |

### 4.3 Acteurs
| Modèle | Table MySQL | Clé primaire | Description |
|---|---|---|---|
| `Etudiant` | `etudiant` | `mle_etudiant` (char) | Étudiants |
| `Enseignant` | `enseignant` | `mle_ens` (char) | Enseignants |
| `Utilisateur` | `utilisateur` | `login` (char) | Comptes système |
| `Tuteur` | `tuteur` | auto | Tuteurs/parents |
| `EtudiantTuteur` | `etudiant_tuteur` | composite | Liaison étudiant-tuteur |

### 4.4 Scolarité & Finances
| Modèle | Table MySQL | Description |
|---|---|---|
| `Tranche` | `tranche` | Tranches de paiement |
| `Frais` | `frais` | Frais scolaires |
| `Inscription` | `inscription` | Inscriptions |
| `FraisInscription` | `frais_inscription` | Frais par inscription |
| `Paiement` | `paiement` | Paiements |
| `Moratoire` | `moratoire` | Échéanciers |
| `Facture` | `facture` | Factures |
| `FactureDetail` | `facture_detail` | Détails factures |
| `RapportFinancier` | `rapport_financier` | Rapports financiers |

### 4.5 Pédagogie
| Modèle | Table MySQL | Description |
|---|---|---|
| `Matiere` | `matiere` | Matières |
| `Qualification` | `qualification` | Qualifications enseignants |
| `Cours` | `cours` | Cours |
| `UniteEnseignement` | `unite_enseignement` | UE |
| `Periode` | `periode` | Périodes (semestres…) |
| `Evaluation` | `evaluation` | Évaluations/notes |
| `FicheNotes` | `fiche_notes` | Fiches de notes |
| `FicheNotesDetail` | `fiche_notes_detail` | Détails fiches |
| `Planning` | `planning` | Emploi du temps |
| `RapportCours` | `rapport_cours` | Rapports de cours |
| `Seance` | `seance` | Séances |
| `Absence` | `absence` | Absences |

### 4.6 Examens & Documents
| Modèle | Table MySQL | Description |
|---|---|---|
| `Examen` | `examen` | Examens |
| `Convocation` | `convocation` | Convocations |
| `RapportStatistique` | `rapport_statistique` | Stats |
| `Decision` | `decision` | Décisions jury |
| `Diplome` | `diplome` | Diplômes |
| `CarteEtudiant` | `carte_etudiant` | Cartes étudiantes |
| `Stage` | `stage` | Stages |
| `LettreAdmission` | `lettre_admission` | Lettres d'admission |
| `BadgeAcces` | `badge_acces` | Badges |
| `DocumentGenere` | `document_genere` | Documents générés |
| `AuditLog` | `audit_log` | Journal d'audit |

---

## 5. SYSTÈME DE RÔLES ET PERMISSIONS

### 5.1 Rôles définis (dans utils/roles.js et models.py)

```python
ROLE_CHOICES = [
    ('SUPER_ADMIN', 'Super Administrateur'),  # ← Rôle spécial
    ('ADMIN',       'Administrateur'),
    ('SCOLARITE',   'Scolarité'),
    ('ENSEIGNANT',  'Enseignant'),
    ('ETUDIANT',    'Étudiant'),
    ('COMPTABLE',   'Comptable'),
    ('DIRECTION',   'Direction'),
]
```

### 5.2 Règle critique : Types d'établissement (EN COURS D'IMPLÉMENTATION)

> ⚠️ C'est la fonctionnalité qui était en cours quand la limite a été atteinte.

**Règle métier :**
- Le **SUPER_ADMIN** peut naviguer librement entre tous les types d'établissement sans changer de compte
- Les **autres utilisateurs** (ADMIN, SCOLARITE, etc.) sont liés à un seul type d'établissement. Pour accéder à un autre type, ils doivent créer un nouveau compte

**Implémentation prévue :**
- Champ `type_etab` sur le modèle `Utilisateur` (FK vers `TypeEtab`)
- Le `SUPER_ADMIN` n'a pas de restriction sur ce champ (null=True, blank=True)
- Middleware ou permission DRF qui vérifie la cohérence type_etab au login
- Côté frontend : le SUPER_ADMIN voit un sélecteur de type d'établissement dans le header

**Types d'établissement (TypeEtab) :**
```python
# Exemples typiques dans le contexte camerounais
- Lycée / Collège
- Université / Grande École
- Institut de formation professionnelle
- École primaire
```

### 5.3 Permissions par rôle (frontend — roles.js)

```javascript
ROLE_PERMISSIONS = {
  SUPER_ADMIN: { pages: ['*'], canEdit: true, canDelete: true, canCreate: true, canSwitchEtab: true },
  ADMIN:       { pages: ['*'], canEdit: true, canDelete: true, canCreate: true, canSwitchEtab: false },
  SCOLARITE:   { pages: ['dashboard','students','teachers','classes','inscription','evaluation','grades','cours'] },
  ENSEIGNANT:  { pages: ['dashboard','classes','evaluation','grades','cours'] },
  ETUDIANT:    { pages: ['dashboard','grades'] },
  COMPTABLE:   { pages: ['dashboard','payments','inscription'] },
  DIRECTION:   { pages: ['dashboard','reports','statistics'] },
}
```

---

## 6. AUTHENTIFICATION JWT

### Fonctionnement
- Login → retourne `access` (court) + `refresh` (long)
- Axios intercepteur : ajoute `Authorization: Bearer <access>` à chaque requête
- Si 401 → tente refresh automatique → si échec → redirect login

### Endpoints auth
```
POST /api/token/          → obtenir access + refresh
POST /api/token/refresh/  → renouveler le access token
POST /api/token/verify/   → vérifier un token
POST /api/logout/         → blacklister le refresh token
```

### Problème récurrent
Le token expire fréquemment en développement. Si erreur 401 persistante :
1. Vider le localStorage
2. Se reconnecter
3. Vérifier `SIMPLE_JWT` dans settings.py (ACCESS_TOKEN_LIFETIME)

---

## 7. MIXIN ÉTABLISSEMENT

Le `EtablissementFilterMixin` (dans mixins.py) filtre automatiquement les QuerySets par établissement selon l'utilisateur connecté.

```python
# Comportement
- SUPER_ADMIN → voit tous les établissements (pas de filtre)
- Autres rôles → filtrés sur leur etablissement lié
```

---

## 8. AUDIT LOG

Toutes les actions importantes sont tracées dans `AuditLog` via `log_action()` (utils.py) :

```python
# Actions tracées
LOGIN_SUCCESS, LOGIN_FAILED, CREATE, UPDATE, DELETE, BULK_DELETE, EXPORT_CSV, LOGOUT
```

---

## 9. EXPORT CSV

Les ViewSets principaux supportent l'export CSV via un paramètre `?format=csv`.
Implémenté directement dans views.py avec le module `csv` Python standard.

---

## 10. COMMANDES DE DÉMARRAGE

### Ordre impératif (toujours respecter cet ordre)
```bash
# 1. Démarrer MySQL (via XAMPP ou service Windows)
# Vérifier que MySQL tourne sur le port 3306

# 2. Démarrer le backend Django
cd backend
.venv\Scripts\activate          # Windows
python manage.py runserver      # http://127.0.0.1:8000

# 3. Démarrer le frontend React
cd frontend
npm run dev                     # http://localhost:5173
```

### Variables d'environnement (.env backend)
```env
DB_NAME=sms
DB_USER=root
DB_PASSWORD=          # vide si pas de mot de passe
DB_HOST=127.0.0.1     # IMPORTANT : pas "localhost"
DB_PORT=3306
SECRET_KEY=...
DEBUG=True
```

---

## 11. PROBLÈMES CONNUS ET SOLUTIONS

| Problème | Cause | Solution |
|---|---|---|
| `django.db.utils.OperationalError` au démarrage | MySQL pas encore lancé | Démarrer MySQL en premier |
| Token JWT expiré (401 partout) | `ACCESS_TOKEN_LIFETIME` trop court | Vider localStorage, se reconnecter |
| `mysqlclient`/`MySQLdb` not found | Mauvais environnement Python | Activer le venv Python 3.11 |
| Import SQL échoue (#1046) | `USE sms;` manquant | Créer la DB d'abord dans phpMyAdmin |
| Colonnes téléphone trop courtes | VARCHAR(15) | Utiliser VARCHAR(20) pour les numéros camerounais |

---

## 12. PROCHAINES ÉTAPES (au moment de la coupure)

- [ ] **Finaliser le système TypeEtab** — logique SUPER_ADMIN vs autres utilisateurs
  - Modifier le modèle `Utilisateur` : ajouter contrainte type_etab (nullable pour SUPER_ADMIN)
  - Créer permission DRF `IsSuperAdmin`
  - Créer endpoint `/api/switch-type-etab/` pour le SUPER_ADMIN
  - Ajouter sélecteur de type d'établissement dans le header frontend (visible SUPER_ADMIN seulement)
- [ ] Tests unitaires backend (tests.py)
- [ ] Documentation API (Swagger/drf-spectacular)
- [ ] Déploiement

---

## 13. CONVENTIONS DE CODE

- **Nommage modèles :** PascalCase français (`TypeEtab`, `FicheNotes`)
- **Nommage tables MySQL :** snake_case (`type_etab`, `fiche_notes`)
- **Clés primaires :** `code_*` pour les entités métier, auto-increment pour les transactions
- **Imports views.py :** regroupés par catégorie (DRF → Django → modèles locaux)
- **Commentaires :** en français, avec séparateurs `# ── Section ───`

---

*Dernière mise à jour : Juin 2026 — Luc / LuckyCifer*