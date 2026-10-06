/**
 * utils/roles.js
 * Système de gestion des rôles et permissions.
 */

// ── Définition des rôles ──────────────────────────────────────────────────────
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN:       'ADMIN',
  SCOLARITE:   'SCOLARITE',
  ENSEIGNANT:  'ENSEIGNANT',
  ETUDIANT:    'ETUDIANT',
  COMPTABLE:   'COMPTABLE',
  DIRECTION:   'DIRECTION',
  CENSEUR:             'CENSEUR',
  SURVEILLANT_GENERAL: 'SURVEILLANT_GENERAL',
  APEE:                'APEE',
};

// ── Permissions par rôle ──────────────────────────────────────────────────────
export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: {
    pages:        ['*'],
    canEdit:      true,
    canDelete:    true,
    canCreate:    true,
    canSwitchEtab: true,  // peut changer de type d'établissement sans changer de compte
  },
  ADMIN: {
    pages:        ['*'],
    canEdit:      true,
    canDelete:    true,
    canCreate:    true,
    canSwitchEtab: false,
  },
  SCOLARITE: {
    pages:   ['dashboard', 'students', 'classes', 'cours', 'inscription', 'evaluation', 'grades',
              'absences', 'bulletins', 'importCsv', 'personnel', 'epreuves'],
    canEdit: true,
    canDelete: true,
    canCreate: true,
    canSwitchEtab: false,
  },
  ENSEIGNANT: {
    pages:   ['dashboard', 'classes', 'evaluation', 'grades', 'cours', 'absences', 'epreuves'],
    canEdit: true,
    canDelete: false,
    canCreate: true,
    canSwitchEtab: false,
  },
  ETUDIANT: {
    pages:   ['dashboard', 'grades', 'cours', 'monDossier'],
    canEdit: false,
    canDelete: false,
    canCreate: false,
    canSwitchEtab: false,
  },
  COMPTABLE: {
    pages:   ['dashboard', 'payments', 'inscription'],
    canEdit: true,
    canDelete: false,
    canCreate: true,
    canSwitchEtab: false,
  },
  DIRECTION: {
    pages:   ['dashboard', 'reports', 'statistics', 'absences', 'bulletins', 'personnel'],
    canEdit: false,
    canDelete: false,
    canCreate: false,
    canSwitchEtab: false,
  },
  // Censeur / Préfet des études : supervision pédagogique, emplois du temps, suivi
  // des enseignements — pas de droit de suppression (rôle de coordination, pas
  // d'administration système).
  CENSEUR: {
    pages:   ['dashboard', 'students', 'teachers', 'classes', 'cours', 'evaluation',
              'grades', 'examens', 'planning', 'absences', 'bulletins'],
    canEdit: true,
    canDelete: false,
    canCreate: true,
    canSwitchEtab: false,
  },
  // Surveillant Général : discipline, ponctualité, vie scolaire quotidienne.
  SURVEILLANT_GENERAL: {
    pages:   ['dashboard', 'students', 'classes', 'absences'],
    canEdit: true,
    canDelete: false,
    canCreate: true,
    canSwitchEtab: false,
  },
  // Représentant APEE : visibilité de représentation des parents, sans droit de
  // modification — périmètre volontairement minimal (à étendre sur demande).
  APEE: {
    pages:   ['dashboard'],
    canEdit: false,
    canDelete: false,
    canCreate: false,
    canSwitchEtab: false,
  },
  USER: {
    pages:   ['dashboard'],
    canEdit: false,
    canDelete: false,
    canCreate: false,
    canSwitchEtab: false,
  },
};

// ── Libellés et styles des rôles ──────────────────────────────────────────────
export const ROLE_INFO = {
  SUPER_ADMIN: { label: 'Super Admin',  labelEn: 'Super Admin',    badge: 'badge-dark',      icon: 'fas fa-shield-alt' },
  ADMIN:       { label: 'Administrateur', labelEn: 'Administrator', badge: 'badge-danger',    icon: 'fas fa-crown' },
  SCOLARITE:   { label: 'Scolarité',    labelEn: 'Registrar',      badge: 'badge-info',      icon: 'fas fa-school' },
  ENSEIGNANT:  { label: 'Enseignant',   labelEn: 'Teacher',        badge: 'badge-success',   icon: 'fas fa-chalkboard-teacher' },
  ETUDIANT:    { label: 'Étudiant',     labelEn: 'Student',        badge: 'badge-secondary', icon: 'fas fa-user-graduate' },
  COMPTABLE:   { label: 'Comptable',    labelEn: 'Accountant',     badge: 'badge-warning',   icon: 'fas fa-calculator' },
  DIRECTION:   { label: 'Direction',    labelEn: 'Management',     badge: 'badge-primary',   icon: 'fas fa-user-tie' },
  CENSEUR:             { label: 'Censeur',            labelEn: 'Vice-Principal (Studies)', badge: 'badge-info',    icon: 'fas fa-user-clock' },
  SURVEILLANT_GENERAL: { label: 'Surveillant Général', labelEn: 'Discipline Officer',       badge: 'badge-warning', icon: 'fas fa-user-shield' },
  APEE:                { label: 'Représentant APEE',   labelEn: 'PTA Representative',       badge: 'badge-purple',  icon: 'fas fa-users' },
  USER:        { label: 'Utilisateur',  labelEn: 'User',           badge: 'badge-secondary', icon: 'fas fa-user' },
};

// ── Fonctions utilitaires ─────────────────────────────────────────────────────
export const getPermissions = (role) => {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.USER;
};

export const canAccessPage = (role, page) => {
  const perms = getPermissions(role);
  if (perms.pages.includes('*')) return true;
  return perms.pages.includes(page);
};

export const canEdit        = (role) => getPermissions(role).canEdit;
export const canDelete      = (role) => getPermissions(role).canDelete;
export const canCreate      = (role) => getPermissions(role).canCreate;
export const canSwitchEtab  = (role) => getPermissions(role).canSwitchEtab ?? false;

export const getRoleInfo = (role) => ROLE_INFO[role] || ROLE_INFO.USER;
