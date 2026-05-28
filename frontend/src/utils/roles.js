/**
 * utils/roles.js
 * Système de gestion des rôles et permissions.
 */

// ── Définition des rôles ──────────────────────────────────────────────────────
export const ROLES = {
  ADMIN:      'ADMIN',
  SCOLARITE:  'SCOLARITE',
  ENSEIGNANT: 'ENSEIGNANT',
  ETUDIANT:   'ETUDIANT',
  COMPTABLE:  'COMPTABLE',
};

// ── Permissions par rôle ──────────────────────────────────────────────────────
// Chaque rôle définit les pages auxquelles il a accès
export const ROLE_PERMISSIONS = {
  ADMIN: {
    pages:   ['*'], // accès total
    canEdit: true,
    canDelete: true,
    canCreate: true,
  },
  SCOLARITE: {
    pages:   ['dashboard', 'students', 'classes', 'cours', 'inscription', 'evaluation', 'grades'],
    canEdit: true,
    canDelete: true,
    canCreate: true,
  },
  ENSEIGNANT: {
    pages:   ['dashboard', 'classes', 'evaluation', 'grades', 'cours'],
    canEdit: true,
    canDelete: false,
    canCreate: true,
  },
  ETUDIANT: {
    // Lecture seule : tableau de bord, ses notes, son planning
    pages:   ['dashboard', 'grades', 'cours'],
    canEdit: false,
    canDelete: false,
    canCreate: false,
  },
  COMPTABLE: {
    pages:   ['dashboard', 'payments', 'inscription'],
    canEdit: true,
    canDelete: false,
    canCreate: true,
  },
  USER: {
    pages:   ['dashboard'],
    canEdit: false,
    canDelete: false,
    canCreate: false,
  },
};

// ── Libellés et styles des rôles ──────────────────────────────────────────────
export const ROLE_INFO = {
  ADMIN:      { label: 'Administrateur', labelEn: 'Administrator', badge: 'badge-danger',    icon: 'fas fa-crown' },
  SCOLARITE:  { label: 'Scolarité',      labelEn: 'Registrar',     badge: 'badge-info',      icon: 'fas fa-school' },
  ENSEIGNANT: { label: 'Enseignant',     labelEn: 'Teacher',       badge: 'badge-success',   icon: 'fas fa-chalkboard-teacher' },
  ETUDIANT:   { label: 'Étudiant',       labelEn: 'Student',       badge: 'badge-secondary', icon: 'fas fa-user-graduate' },
  COMPTABLE:  { label: 'Comptable',      labelEn: 'Accountant',    badge: 'badge-warning',   icon: 'fas fa-calculator' },
  USER:       { label: 'Utilisateur',    labelEn: 'User',          badge: 'badge-secondary', icon: 'fas fa-user' },
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

export const canEdit   = (role) => getPermissions(role).canEdit;
export const canDelete = (role) => getPermissions(role).canDelete;
export const canCreate = (role) => getPermissions(role).canCreate;

export const getRoleInfo = (role) => ROLE_INFO[role] || ROLE_INFO.USER;
