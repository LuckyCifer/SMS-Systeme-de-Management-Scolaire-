/**
 * services/endpoints.js
 * Tous les services API — existants + 19 nouvelles tables
 */
import api from './api';

const crud = (base) => ({
  list:   (params)     => api.get(`${base}/`, { params }),
  get:    (id)         => api.get(`${base}/${id}/`),
  create: (data)       => api.post(`${base}/`, data),
  update: (id, data)   => api.put(`${base}/${id}/`, data),
  patch:  (id, data)   => api.patch(`${base}/${id}/`, data),
  delete: (id)         => api.delete(`${base}/${id}/`),
  bulkDelete: (ids)    => api.post(`${base}/bulk-delete/`, { ids }),
  exportCsv: (params)  => api.get(`${base}/export-csv/`, { params }),
});

// ── Authentification ──────────────────────────────────────────────────────────
export const authService = {
  smsLogin:  (login, password) => api.post('/api/auth/sms-login/', { login, password }),
  jwtLogin:  (username, password) => api.post('/api/auth/login/', { username, password }),
  refresh:   (refresh) => api.post('/api/auth/refresh/', { refresh }),
  verify:    (token)   => api.post('/api/auth/verify/', { token }),
};

// ── Étudiants ─────────────────────────────────────────────────────────────────
export const etudiantService = {
  ...crud('/api/etudiants'),
  inscriptions: (id) => api.get(`/api/etudiants/${id}/inscriptions/`),
  paiements:    (id) => api.get(`/api/etudiants/${id}/paiements/`),
  evaluations:  (id) => api.get(`/api/etudiants/${id}/evaluations/`),
  tuteurs:      (id) => api.get(`/api/etudiants/${id}/tuteurs/`),
  absences:     (id) => api.get(`/api/etudiants/${id}/absences/`),
  decisions:    (id) => api.get(`/api/etudiants/${id}/decisions/`),
};

// ── Enseignants ───────────────────────────────────────────────────────────────
export const enseignantService = {
  ...crud('/api/enseignants'),
  qualifications: (id) => api.get(`/api/enseignants/${id}/qualifications/`),
  planning:       (id) => api.get(`/api/enseignants/${id}/planning/`),
  seances:        (id) => api.get(`/api/enseignants/${id}/seances/`),
};

// ── Classes ───────────────────────────────────────────────────────────────────
export const classeService = {
  ...crud('/api/classes'),
  etudiants:  (id) => api.get(`/api/classes/${id}/etudiants/`),
  exportCsvClasse: (id) => api.get(`/api/classes/${id}/export-csv/`),
};

// ── Référentiels ──────────────────────────────────────────────────────────────
export const faculteService      = crud('/api/facultes');
export const departementService  = crud('/api/departements');
export const specialiteService   = crud('/api/specialites');
export const anneeService = {
  ...crud('/api/annees'),
  enCours:      ()  => api.get('/api/annees/en-cours/'),
  passageAnnee: ()  => api.post('/api/annees/passage-annee/'),
};
export const periodeService      = crud('/api/periodes');
export const matiereService      = crud('/api/matieres');
export const moduleService       = crud('/api/modules');
export const niveauService       = crud('/api/niveaux');
export const cycleService        = crud('/api/cycles');
export const pensionService      = crud('/api/pensions');
export const trancheService      = crud('/api/tranches');
export const fraisService        = crud('/api/frais');
export const typeEvalService     = crud('/api/type-evaluations');
export const jourService         = crud('/api/jours');
export const salleService        = crud('/api/salles');
export const batimentService     = crud('/api/batiments');

// ── Cours & UE ────────────────────────────────────────────────────────────────
export const coursService        = crud('/api/cours');
export const ueService           = crud('/api/unites-ens');
export const qualificationService = crud('/api/qualifications');

// ── Inscriptions ──────────────────────────────────────────────────────────────
export const inscriptionService  = {
  ...crud('/api/inscriptions'),
  stats: (params = {}) => api.get('/api/inscriptions/stats/', { params }),
};

// ── Évaluations ───────────────────────────────────────────────────────────────
export const evaluationService   = {
  ...crud('/api/evaluations'),
  // Moyennes pondérées par étudiant/matière (Contrôle continu 30% + Session normale 70%, etc.
  // — pondération configurée par type d'évaluation dans Paramétrage). Repli automatique sur
  // une moyenne simple côté backend si aucune pondération n'est configurée.
  moyennes: (params) => api.get('/api/evaluations/moyennes/', { params }),
};

// ── Paiements ─────────────────────────────────────────────────────────────────
export const paiementService = {
  ...crud('/api/paiements'),
  stats: (params = {}) => api.get('/api/paiements/stats/', { params }),
};

// ── Paiements de salaires (personnel) — séparé des frais de scolarité/inscription ─
export const paiementSalaireService = {
  ...crud('/api/paiements-salaires'),
  stats: (params = {}) => api.get('/api/paiements-salaires/stats/', { params }),
};

// ── Factures ─────────────────────────────────────────────────────────────────
export const factureService = {
  ...crud('/api/factures'),
  details: (id) => api.get(`/api/factures-detail/?code_facture=${id}`),
  stats:   (params = {}) => api.get('/api/factures/stats/', { params }),
};
export const factureDetailService = crud('/api/factures-detail');
export const rapportFinancierService = crud('/api/rapports-financiers');

// ── Fiches de notes ───────────────────────────────────────────────────────────
export const ficheNotesService = {
  ...crud('/api/fiches-notes'),
  valider:  (id) => api.post(`/api/fiches-notes/${id}/valider/`),
  importer: (id) => api.post(`/api/fiches-notes/${id}/importer/`),
  details:  (id) => api.get(`/api/fiches-notes-detail/?code_fiche=${id}`),
};
export const ficheNotesDetailService = crud('/api/fiches-notes-detail');

// ── Séances & Absences ────────────────────────────────────────────────────────
export const seanceService = {
  ...crud('/api/seances'),
  presences:       (id)  => api.get(`/api/seances/${id}/presences/`),
  saisirPresences: (id, presences) => api.post(`/api/seances/${id}/saisir-presences/`, { presences }),
};
export const absenceService = crud('/api/absences');

// ── Planning ──────────────────────────────────────────────────────────────────
export const planningService = {
  ...crud('/api/planning'),
  parClasse:      (code) => api.get(`/api/planning/classe/${code}/`),
  genererSeances: (date_lundi, code_annee) =>
    api.post('/api/planning/generer-seances/', { date_lundi, code_annee }),
  genererPeriode: (date_debut, date_fin, code_annee) =>
    api.post('/api/planning/generer-periode/', { date_debut, date_fin, code_annee }),
};

// ── Examens & Convocations ────────────────────────────────────────────────────
export const examenService = {
  ...crud('/api/examens'),
  genererConvocations: (id) => api.post(`/api/examens/${id}/generer-convocations/`),
};
export const convocationService = crud('/api/convocations');

// ── Épreuves (sujets soumis par les enseignants, validés par la scolarité) ────
export const epreuveService = {
  ...crud('/api/epreuves'),
  soumettre: (id)              => api.post(`/api/epreuves/${id}/soumettre/`),
  valider:   (id)              => api.post(`/api/epreuves/${id}/valider/`),
  rejeter:   (id, commentaire) => api.post(`/api/epreuves/${id}/rejeter/`, { commentaire }),
};

// ── Rapport statistique ───────────────────────────────────────────────────────
export const rapportStatService = {
  ...crud('/api/rapports-stat'),
  generate: (data) => api.post('/api/rapports-stat/generate/', data),
};
export const rapportAssiduiteService = {
  ...crud('/api/rapports-assiduite'),
  generate: (data) => api.post('/api/rapports-assiduite/generate/', data),
};

// ── Décisions ─────────────────────────────────────────────────────────────────
export const decisionService = crud('/api/decisions');

// ── Documents avancés ─────────────────────────────────────────────────────────
export const diplomeService       = crud('/api/diplomes');
export const carteEtudiantService = crud('/api/cartes-etudiants');
export const stageService         = crud('/api/stages');
export const lettreAdmissionService = crud('/api/lettres-admission');
export const badgeAccesService    = crud('/api/badges-acces');
export const documentGenereService = crud('/api/documents-generes');

// ── Tuteurs ───────────────────────────────────────────────────────────────────
export const tuteurService        = crud('/api/tuteurs');
export const etudiantTuteurService = crud('/api/etudiant-tuteurs');

// ── Personnel ─────────────────────────────────────────────────────────────────
export const personnelService = {
  ...crud('/api/personnel'),
  signataires: () => api.get('/api/personnel/signataires/'),
  exportCsv:   (params) => api.get('/api/personnel/export-csv/', { params }),
};

// ── Utilisateurs ──────────────────────────────────────────────────────────────
export const utilisateurService   = crud('/api/utilisateurs');

// ── Audit ─────────────────────────────────────────────────────────────────────
export const auditService = {
  list:      (params) => api.get('/api/audit/', { params }),
  exportCsv: ()       => api.get('/api/audit/export-csv/'),
};

// ── Établissement ─────────────────────────────────────────────────────────────
export const etablissementService = {
  ...crud('/api/etablissements'),
  current: ()         => api.get('/api/etablissements/current/'),
  patchCurrent: (data) => api.patch('/api/etablissements/current/', data),
};

// ── Niveaux scolaires & Config bulletin ───────────────────────────────────────
export const niveauScolaireService  = crud('/api/niveaux-scolaires');
export const configBulletinService  = crud('/api/config-bulletin');

// ── Import CSV ────────────────────────────────────────────────────────────────
export const importCsvService = {
  upload: (entityType, formData, onProgress) =>
    api.post(`/api/import-csv/${entityType}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    }),
  template: (entityType) =>
    api.get(`/api/import-csv/${entityType}/template/`, { responseType: 'blob' }),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardService = {
  stats: async () => {
    const [etudiants, enseignants, classes, paiements] = await Promise.all([
      api.get('/api/etudiants/'),
      api.get('/api/enseignants/'),
      api.get('/api/classes/'),
      api.get('/api/paiements/'),
    ]);
    const impayes = (paiements.data.results || paiements.data || [])
      .filter(p => p.statut === 'IMPAYE');
    return {
      nbEtudiants:   etudiants.data.count   ?? (etudiants.data.results || etudiants.data).length,
      nbEnseignants: enseignants.data.count ?? (enseignants.data.results || enseignants.data).length,
      nbClasses:     classes.data.count     ?? (classes.data.results || classes.data).length,
      nbImpayes:     impayes.length,
    };
  },
};
