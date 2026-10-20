# CLAUDE.md — SMS (School Management System)

> Ce fichier est lu automatiquement par Claude Code à chaque nouvelle session.
> Il contient tout le contexte nécessaire pour reprendre le travail sans historique.

---

## 1. VUE D'ENSEMBLE DU PROJET

**Nom complet :** Système de Management Scolaire (SMS)
**Type :** Application web full stack de gestion d'établissements scolaires (primaire, secondaire, supérieur), plusieurs écoles dans une même instance
**Contexte :** Projet développé par Yemeya Luc (LuckyCifer) à Yaoundé, Cameroun. Soutenance de licence passée (10/09/2026).
**Phase actuelle :** finir le développement → tests → déploiement
**Dépôt GitHub :** github.com/LuckyCifer/SMS-Systeme-de-Management-Scolaire-

---

## 2. STACK TECHNIQUE

### Backend
- **Framework :** Django 5.2 + Django REST Framework
- **Authentification :** SimpleJWT (access 24 h, refresh 30 j)
- **Base de données :** MySQL 8 (conteneur Docker) via mysqlclient
- **Documentation API :** drf-spectacular — Swagger sur `/api/docs/`
- **Python :** 3.11 (IMPORTANT : ne pas utiliser Python 3.14, incompatible avec Django)

### Frontend
- **Framework :** React 18 + Vite 7
- **UI :** styles maison (classes `sms-*`, `frontend/src/styles/custom.css`), icônes Font Awesome
- **Palette de couleurs ACERFI :** `#1F3864` (bleu foncé), `#2E74B5` (bleu moyen), `#D6E4F0` (bleu clair)
- **HTTP Client :** Axios avec intercepteurs JWT (`services/api.js`)
- **État global :** contexte React (`context/AppContext.jsx` : utilisateur, langue, thème, année active)

### Base de données
- **Nom de la base :** `sms`
- **Encodage :** utf8mb4 / utf8mb4_unicode_ci
- **Accès depuis l'hôte :** `127.0.0.1:3309`, utilisateur `root`, mot de passe `smsroot` (conteneur `db` ; port 3306 dans le réseau Docker)
- ⚠️ Quelques tables importées depuis l'ancienne base (MySQL 9) sont en `utf8mb4_0900_ai_ci`. Une clé étrangère entre colonnes de collations différentes échoue (erreur 3780) : voir la migration 0022 pour la méthode de correction.

---

## 3. STRUCTURE DU PROJET

```
Projet SMS/
├── docker-compose.yml         # db (MySQL 8) + backend (Django) + frontend (Vite)
├── DOCKER.md                  # Notice d'installation pour les testeurs
├── docker/mysql-init/         # Dump SQL importé au 1er démarrage (*.sql ignorés par git)
├── backend/
│   ├── api/
│   │   ├── models.py          # Tous les modèles
│   │   ├── serializers.py     # Serializers DRF
│   │   ├── views.py           # ViewSets
│   │   ├── urls.py            # Routes API
│   │   ├── mixins.py          # Isolation par établissement (voir §7)
│   │   ├── permissions.py     # Droits d'écriture par rôle (miroir de roles.js)
│   │   ├── notes.py           # SEUL endroit des calculs de notes (voir §8)
│   │   ├── vie_scolaire.py    # Appel journalier, absences du jour, alertes (voir §8.3)
│   │   ├── horaires.py        # Pauses de l'emploi du temps : aucun cours ne les chevauche (§8.4)
│   │   ├── deduction_classes.py # Déduction niveau/série depuis le libellé d'une classe
│   │   ├── utils.py           # get_client_ip, log_action, moyenne_ponderee
│   │   ├── tests/             # Tests (package) — PAS de fichier tests.py à côté
│   │   └── management/commands/ # Commandes (seeds, déductions, rattachements)
│   ├── sms_backend/           # Config Django (settings, urls, wsgi)
│   └── manage.py
├── frontend/
│   └── src/
│       ├── components/        # Composants réutilisables (CrudTable, GrilleCoefficients…)
│       ├── pages/             # Pages par module
│       ├── layouts/           # Navbar (sélecteur d'école), Sidebar
│       ├── routes/AppRoutes.jsx # Routes (le tableau de bord est `/`, pas `/dashboard`)
│       ├── services/          # api.js, endpoints.js, pdfService.js (bulletins PDF…)
│       ├── context/           # AppContext
│       ├── hooks/             # useApi, useEtablissement (école connectée)
│       ├── i18n/              # fr.js, en.js
│       └── utils/             # roles.js, etabLabels.js, notes.js
└── CLAUDE.md                  # Ce fichier
```

---

## 4. MODÈLE DE DONNÉES

« École » = rattaché à un établissement : champ `etablissement`, ou relation indiquée entre parenthèses. « Commun » = partagé par toutes les écoles (référentiel national ou technique).

### 4.1 Référentiels et structure
| Modèle | Table | Portée | Description |
|---|---|---|---|
| `Etablissement` | `etablissement` | — | Écoles : `type_etab` (PRIMAIRE / SECONDAIRE / SUPERIEUR), `systeme` (FRANCOPHONE / ANGLOPHONE / BILINGUE), statut, agrément |
| `NiveauScolaire` | `niveau_scolaire` | Commun | Niveaux nationaux (6EME_FR, 1ERE_FR, LS_EN, CM2_FR, L1_SUP…) |
| `Annee` | `annee` | Commun | Années scolaires (`code_annee`, ex. 2025-2026) |
| `Periode` | `periode` | Commun par type | Trimestres / semestres ; une séquence a un `periode_parent` (son trimestre) |
| `Jour`, `Langue`, `Module`, `Mention`, `Rapport`, `TypeEtab` | … | Commun | Tables de référence |
| `Matiere`, `TypeEvaluation` | … | Commun par type | Matières, types d'évaluation (pondération %) |
| `Batiment`, `Salle` | … | École | Bâtiments, salles |
| `Departement`, `Specialite`, `Faculte` | … | École | Filières, séries, options, facultés |
| `Cycle`, `Niveau` | … | École | Cycles et niveaux internes (ancienne structure, liés aux pensions) |
| `Classe` | `classe` | École | Classe : `niveau_scolaire`, `serie` (voir §8), `systeme` (si école bilingue) |

### 4.2 Acteurs
| Modèle | Portée | Description |
|---|---|---|
| `Etudiant` | École | Élèves / étudiants (`mle_etudiant`) |
| `Enseignant`, `Personnel` | École | Enseignants, personnel |
| `Utilisateur` | École | Comptes : `login`, `role`, `etablissement` (vide pour SUPER_ADMIN) |
| `Tuteur` / `EtudiantTuteur` | École / (élève) | Parents et liaison élève-parent |

### 4.3 Scolarité et finances
| Modèle | Portée | Description |
|---|---|---|
| `Pension`, `Frais` | École | Pensions (scolarité, APEE…) et frais |
| `Tranche` | (pension) | Tranches de paiement |
| `Inscription`, `Paiement`, `Moratoire`, `Facture` | École | Inscriptions, paiements, échéanciers, factures |
| `FraisInscription`, `FactureDetail` | (inscription, facture) | Détails |
| `PaiementSalaire`, `RapportFinancier` | École | Salaires, rapports financiers |

### 4.4 Pédagogie et notes
| Modèle | Portée | Description |
|---|---|---|
| `Cours` | École | Matière × classe × année ; `semestre` = S1/S2 au supérieur, `AN` (année entière) au primaire et au secondaire ; `credits` et `note_elim` (supérieur) |
| `CoefficientMatiere` | École | Grille des coefficients (primaire / secondaire) : année × niveau × série × matière |
| `Evaluation` | École | Notes /20 ; au primaire, `appreciation` (A/ECA/NA) déduite automatiquement |
| `FicheNotes` / `FicheNotesDetail` | École / (fiche) | Fiches de notes des enseignants |
| `Planning`, `Seance`, `Absence` | (cours) / École / (élève) | Emploi du temps, séances, absences |
| `PauseHoraire` | École | Pauses de l'emploi du temps (récréations, déjeuner) ; voir §8.4 |
| `RapportCours`, `Qualification` | (classe) / (enseignant) | Rapports de cours, qualifications |

### 4.5 Examens, décisions et documents
| Modèle | Portée | Description |
|---|---|---|
| `Examen`, `Epreuve`, `Convocation` | École / École / (élève) | Examens (dont nomenclature des examens officiels : CEP, BEPC, Bac, GCE…) |
| `Decision` | École | Décisions de fin d'année (générables automatiquement, voir §8) |
| `Diplome`, `CarteEtudiant`, `Stage`, `LettreAdmission`, `BadgeAcces`, `DocumentGenere` | École ou (élève) | Documents |
| `RapportStatistique`, `RapportAssiduite` | École | Rapports |
| `AuditLog` | École | Journal d'audit (voir §9) |

`UniteEnseignement` a été supprimé (migration 0019) ; le coefficient est dans `CoefficientMatiere`.

---

## 5. RÔLES ET PERMISSIONS

### 5.1 Rôles (`Utilisateur.ROLE_CHOICES`)
`SUPER_ADMIN`, `ADMIN` (proviseur / directeur), `SCOLARITE`, `ENSEIGNANT`, `COMPTABLE` (économe), `ETUDIANT`, `DIRECTION`, `CENSEUR`, `SURVEILLANT_GENERAL`, `APEE`.

### 5.2 Règle critique : une école à la fois
- Chaque compte (ADMIN, SCOLARITE, CENSEUR…) est lié à **une seule école** et ne voit que ses données.
- Seul le **SUPER_ADMIN** navigue d'une école à l'autre, **une à la fois**, avec le sélecteur d'école du bandeau (`layouts/Navbar.jsx` → `connectToEtab()`, puis rechargement de `/`).
- Le type d'établissement (primaire / secondaire / supérieur), qui pilote libellés et pages (`utils/etabLabels.js`), se déduit **toujours** de l'école connectée. Il n'existe plus de sélecteur ni d'en-tête « type » (l'ancien `X-Type-Etab` est supprimé).

### 5.3 Permissions
- **Pages visibles** : `frontend/src/utils/roles.js` (`ROLE_PERMISSIONS`). ADMIN et SUPER_ADMIN voient tout ; la page `coefficients` est ouverte à SCOLARITE et CENSEUR.
- **Écriture côté serveur** : `backend/api/permissions.py` (`ROLE_WRITE_PERMISSIONS`). Les deux fichiers doivent rester synchronisés.
- **Règles spécifiques** :
  - générer les décisions, modifier les coefficients, valider / rouvrir une fiche de notes, clôturer / rouvrir une période : SUPER_ADMIN, ADMIN, SCOLARITE, CENSEUR (`ROLES_GESTION_NOTES` dans views.py) ;
  - journal d'audit : ADMIN, SUPER_ADMIN ;
  - un ENSEIGNANT ne voit que ses propres matières, classes, fiches et séances (`scope_queryset_to_enseignant*`) ; lien compte ↔ fiche : `Enseignant.utilisateur` ;
  - un ÉTUDIANT ne voit que ses propres données : lien compte ↔ fiche `Etudiant.utilisateur` (champ « Compte de connexion » de la fiche élève ; à défaut, login = matricule). Dans `SMSBaseViewSet`, `etudiant_lookup` donne le chemin vers l'élève et `interdit_etudiant` refuse les données du personnel (salaires, personnel, fiches de notes…). Un compte élève non relié ne voit rien.
- **Actions de détail** (`@action(detail=True)`) : toujours commencer par `self.get_object()`, qui applique école et périmètre. Un filtre direct sur `pk` contourne l'isolation.

---

## 6. AUTHENTIFICATION JWT

- Connexion de l'application : `POST /api/auth/sms-login/` (`login`, `password`) → `access` + `refresh` + profil (rôle, école, type).
- `POST /api/auth/refresh/`, `/api/auth/verify/`, `/api/auth/sms-logout/` (blacklist du refresh).
- Axios ajoute `Authorization: Bearer <access>` et `X-Etablissement-Id` (école connectée, lu dans `localStorage.sms_etab`). Sur une erreur 401, il tente un refresh, puis renvoie vers `/login`.
- Si les erreurs 401 persistent : vider le localStorage et se reconnecter.

---

## 7. ISOLATION PAR ÉTABLISSEMENT (`api/mixins.py`)

- **École courante** = `trusted_etablissement_header(request)` :
  - SUPER_ADMIN : `X-Etablissement-Id` s'il est valide, sinon la première école active ;
  - autres rôles : toujours leur école en base, l'en-tête est ignoré (protection IDOR).
- `EtablissementFilterMixin` (modèles avec un champ `etablissement`) :
  - filtre sur l'école courante, refus par défaut si elle est indéterminée ;
  - impose l'école à la création **et** à la modification (impossible de « déplacer » une donnée vers une autre école).
- `EtablissementParRelationMixin` (modèles sans ce champ) : `etablissement_lookups = ('mle_etudiant__etablissement', …)`, avec le même filtrage, et refus d'écrire une donnée d'une autre école.
- `type_etab_courant(request)` donne le type de l'école courante.
- **Tout nouveau ViewSet de données d'école doit utiliser l'un de ces deux mixins.** Les tests `tests/test_ecole_courante.py` et `test_isolation.py` couvrent ces règles.

---

## 8. NOTES, COEFFICIENTS ET DÉLIBÉRATIONS (`api/notes.py`)

`notes.py` est la seule source de calcul. Le frontend affiche ses résultats sans rien recalculer.

- **Endpoint unique** : `GET /api/evaluations/moyennes/?code_classe=…&code_periode=…` (ou `&code_annee=…` pour le bilan annuel ; `&mle_etudiant=…` en option). Il renvoie, par élève : moyennes par matière, poids, moyenne générale, rang (ex-aequo 1, 2, 2, 4), effectif, moyenne de classe, mention et appréciation.
- **Poids d'une matière** :
  - primaire / secondaire : coefficient de la grille `CoefficientMatiere`, selon le niveau et la série de la classe ;
  - supérieur : `Cours.credits` ;
  - une matière sans poids compte 1 et est signalée (`poids_defaut`) ;
  - une matière non composée compte 0.
- **Séries** (`Classe.serie`, `notes.NIVEAUX_AVEC_SERIE`) :
  - 4ème et 3ème : la troisième langue (ALLEMAND, ESPAGNOL, LATIN, CHINOIS) ;
  - 2nde, 1ère et Tle : A, C, D, E, TI ;
  - Lower et Upper Sixth : ARTS, SCIENCE ;
  - aucune série en 6ème, en 5ème ni au primaire. Dans « 6ème A », la lettre désigne un groupe, pas une série.
- **Grille des coefficients** : page `/coefficients`. API `/api/coefficients/grille/`, `enregistrer-grille/` et `copier/` (copie d'une année sur l'autre).
- **Primaire** : note /20, avec l'appréciation déduite (< 10 NA, < 15 ECA, ≥ 15 A) dans `Evaluation.save()` et pour les moyennes.
- **Secondaire** : moyenne d'un trimestre = moyenne de ses séquences. Le bouton « Générer les séquences » de Paramétrage crée les 6 séquences.
- **Délibération** : `POST /api/decisions/generer/` (`code_classe`, `code_annee`, `session`, `seuil`).
  - Pré-bac : ADMIS si la moyenne annuelle atteint le seuil, sinon REDOUBLE.
  - Supérieur : une matière est validée à partir de 10 ; la compensation s'applique sauf si une matière est sous sa `note_elim`.
  - Les saisies du jury sont conservées.
- **Bulletins PDF** : `pdfService.generateBulletin(etudiant, resultat, periode, etab)`, appelé par les pages Notes, Bulletins et Mon dossier.

### 8.1 Fiches de notes (saisie des enseignants)
- **Circuit** : BROUILLON (l'enseignant saisit) → `soumettre/` → SOUMIS → `valider/` (censeur / administration) → VALIDE, avec report immédiat des notes dans `Evaluation` (`notes.importer_fiche`). `rouvrir/` ramène la fiche en brouillon pour correction. `importer/` est un ancien alias de `valider/`.
- **Saisie** : `POST /api/fiches-notes/<id>/saisir/` enregistre toute la fiche en une transaction (tout ou rien) ; seuls les élèves inscrits dans la classe sont acceptés.
- **Barème** : la note est saisie sur le barème de la fiche et convertie sur 20 au report (8/10 → 16/20).
- **Absences** : un absent non justifié reçoit 0. Un absent justifié donne une évaluation `dispense=True`, sans note, neutralisée dans la moyenne de l'élève (la matière sort de son total si c'est sa seule évaluation).
- **Année** : déduite de la période ; plus de saisie libre.

### 8.2 Clôture des notes (conseil de classe)
- `ClotureNotes` (classe × période) : `POST /api/clotures-notes/` clôture, `DELETE` rouvre ; bouton dans la page Notes. La clôture d'un trimestre couvre ses séquences.
- Une période close refuse toute création, modification ou suppression (y compris en masse) d'évaluation, toute saisie de fiche et tout report (`notes.verifier_periode_ouverte`).
- Chaque modification de note est tracée dans l'audit avec l'ancienne et la nouvelle valeur.

### 8.3 Vie scolaire (`api/vie_scolaire.py`, page `/vie-scolaire`)
- **Appel par séance** (`/api/seances/<id>/saisir-presences/`) : tout le monde présent par défaut ; retards en minutes (`Absence.retard_minutes`) ; l'émargement (« Signé ») n'est affiché qu'au supérieur ; la justification n'est pas modifiée par un nouvel appel.
- **Appel journalier** (`Appel`, `AppelLigne`) : par classe, matin ou après-midi, statut PRÉSENT / ABSENT / RETARD. API `/api/appels/feuille/` et `enregistrer/`. Un enseignant ne fait l'appel que dans ses classes.
- **Surveillant général** : `/api/vie-scolaire/jour/` (absences et retards du jour, deux sources), `justifier/`, `alertes/` (heures non justifiées de l'année ≥ seuil ; une demi-journée d'appel = 4 h par défaut).

### 8.4 Emploi du temps et pauses (`api/horaires.py`, page `/planning`)
- **Primaire et secondaire (francophone et anglophone) : un seul emploi du temps par classe et par année.** Les cours y sont « Année entière » (`Cours.semestre = 'AN'`, imposé par `CoursSerializer`) ; les trimestres ne servent qu'aux notes. Pas de sélecteur de période dans Planning ni de champ semestre dans Cours. Un ajustement en cours d'année = modifier les créneaux.
- Supérieur : un emploi du temps par semestre (S1 / S2), sélecteur conservé.
- Le planning affiché est filtré par classe (et semestre au supérieur), **et par l'année active du bandeau**.
- Les pauses (`PauseHoraire`, API `/api/pauses/`) sont **en base, par école**, et non plus dans le navigateur. Une pause sans jour vaut pour toute la semaine ; les pauses propres à un jour remplacent celles de la semaine ce jour-là.
- **Aucun cours ne chevauche une pause**, contrôle fait par le serveur dans les deux sens : un créneau posé sur une pause est refusé (`PlanningSerializer`), et une pause posée sur un cours aussi (`PauseHoraireSerializer`, y compris la suppression de la dernière pause d'un jour). Seules les années non clôturées comptent.
- Écriture des pauses : SUPER_ADMIN, ADMIN, SCOLARITE, CENSEUR.

---

## 9. AUDIT LOG

`log_action()` (utils.py) enregistre chaque action importante dans `AuditLog`, **avec l'école courante** :
`LOGIN_SUCCESS`, `LOGIN_FAILED`, `CREATE`, `UPDATE`, `DELETE`, `BULK_DELETE`, `EXPORT_CSV`, `LOGOUT`.
Un ADMIN ne voit que les traces de son école. Le SUPER_ADMIN voit aussi les traces sans école (connexions échouées de comptes inconnus, anciennes actions).

---

## 10. EXPORT CSV

Les ViewSets principaux exposent une action `GET /api/<ressource>/export-csv/`, qui respecte les filtres de la liste. Elle est implémentée dans views.py avec le module `csv`.

---

## 11. DÉMARRAGE (Docker uniquement — XAMPP n'est plus utilisé)

```bash
# Prérequis : Docker Desktop démarré (« Engine running »)
docker compose up -d            # démarre db + backend + frontend
docker compose up -d --build    # après un changement de Dockerfile / requirements / package.json
docker compose stop             # arrête sans rien perdre
# ⚠️ Ne pas utiliser « docker compose down -v » : le -v efface la base
```
- Application : http://localhost:5173 — API : http://localhost:8000 — Swagger : http://localhost:8000/api/docs/
- Les migrations sont appliquées automatiquement au démarrage du backend (`docker-entrypoint.sh`).
- Commandes Django : `docker compose exec backend python manage.py <commande>`, par exemple :
  - `migrate`, `makemigrations api` ;
  - `test api --noinput` ;
  - `deduire_niveaux_series` : niveaux et séries des classes ; aperçu par défaut, `--appliquer` pour enregistrer ;
  - `rattacher_donnees_ecoles` : rattache à leur école les données sans école ; aperçu par défaut ;
  - `cours_annuels` : passe les cours du primaire et du secondaire en « Année entière » et fusionne les doublons S1/S2 ou T1/T2/T3 ; aperçu par défaut (appliquée le 16/10/2026). À relancer après les anciens seeds (seed_cameroun, seed_complet…), qui créent encore des cours en S1.
- Vite tourne avec `SMS_VITE_POLLING=true` (sinon les modifications faites sous Windows ne sont pas vues dans le conteneur), et son cache est dans le volume `vite_cache`.
- Shell : Luc utilise l'Invite de commandes (cmd). Exemple de variable : `set SEED_DEMO=false`, et non `$env:…`.

---

## 12. PROBLÈMES CONNUS ET SOLUTIONS

| Problème | Cause | Solution |
|---|---|---|
| `failed to connect to the docker API` | Docker Desktop arrêté | Lancer Docker Desktop |
| Modification de code non visible dans l'app | Fichiers non détectés dans le conteneur | Vérifier `SMS_VITE_POLLING`, actualiser la page |
| « Une erreur inattendue… reading 'useState' » | Modules Vite périmés dans le navigateur | Rechargement automatique prévu (`App.jsx`) ; sinon F5, voire vider le cache |
| Erreur MySQL 3780 lors d'une migration | Collation différente (0900 vs unicode) | Aligner les collations avant d'ajouter la clé (voir migration 0022) |
| Migration à moitié appliquée | MySQL n'annule pas les changements de structure | Compléter à la main, puis `migrate --fake` |
| Token JWT expiré (401 partout) | Session expirée | Vider le localStorage, se reconnecter |
| Colonnes téléphone trop courtes | VARCHAR(15) | Utiliser VARCHAR(20) pour les numéros camerounais |

---

## 13. PROCHAINES ÉTAPES

- [ ] Données à compléter :
  - série (troisième langue) des classes de 4ème et 3ème sans langue dans leur libellé ;
  - grilles de coefficients ;
  - génération des séquences du secondaire ;
  - niveaux de maternelle, absents du référentiel `NiveauScolaire`.
- [ ] Relier chaque compte ÉLÈVE à sa fiche (champ « Compte de connexion ») : aucun ne l'est au 16/10/2026, ces comptes ne voient donc rien.
- [ ] Informer les parents des absences (non traité).
- [ ] Préparer le déploiement : compose de production (gunicorn, build Vite statique, `collectstatic`, secrets, `DEBUG=False`).

---

## 14. CONVENTIONS DE CODE

- **Nommage modèles :** PascalCase français (`TypeEtab`, `FicheNotes`)
- **Nommage tables MySQL :** snake_case (`type_etab`, `fiche_notes`)
- **Clés primaires :** `code_*` pour les entités métier, auto-increment pour les transactions
- **Imports views.py :** regroupés par catégorie (DRF → Django → modèles locaux)
- **Commentaires :** en français, avec séparateurs `# ── Section ───`
- **Données d'école :** toujours via `EtablissementFilterMixin` ou `EtablissementParRelationMixin` (§7)
- **Calculs de notes :** uniquement dans `api/notes.py` (§8)
- **Recherche :** une barre de recherche doit filtrer toutes les données, pas seulement les lignes chargées. Tableau chargé par tranches = recherche serveur (`onServerSearch` → `?search=`), avec des `search_fields` couvrant les colonnes affichées. Le filtre `api/recherche.py` (`RechercheAvecLibelles`, par défaut) trouve aussi les libellés des champs à choix (« Payé » → PAYE). Recherche locale de `CrudTable` : insensible aux accents, porte sur le texte affiché, même en JSX.
- **Langues (FR / EN) :** aucun texte d'interface écrit en dur. Texte partagé → `i18n/fr.js` et `en.js` (`t`). Texte propre à une page → `const tr = useTr()` puis `tr('Texte', 'Text')` (`hooks/useTr.js`). Hors composant React (utils) → `getLang()` de `services/lang.js`. Le serveur renvoie des codes (MATIN, PAYE…), traduits par l'interface.
- **Clés de lignes :** `CrudTable` choisit un champ unique (`rowKey` pour l'imposer). Jamais de champ partagé (code_classe, mle_etudiant d'un paiement) : des lignes périmées resteraient affichées.
- **Tableaux :** pas de boutons de page, défilement infini dans un cadre de hauteur fixe (`.sms-table-wrap`, `index.css`). Avec `CrudTable` en mode serveur, la page parente charge `page_size = TAILLE × page` et `page = 1` : `onServerPage(n)` demande les n premières tranches, et un rechargement renvoie donc toutes les lignes à jour.
- **Commandes de données :** aperçu par défaut, enregistrement avec `--appliquer`
- **Tests :** dans `backend/api/tests/` ; lancer toute la suite avant de considérer un changement terminé

---

*Dernière mise à jour : 16 octobre 2026 — Luc / LuckyCifer*
