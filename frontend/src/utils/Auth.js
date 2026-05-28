/**
 * utils/Auth.js — Gestion de session SMS
 */

export const login = (userData, tokens) => {
  localStorage.setItem('sms_user',    JSON.stringify(userData));
  localStorage.setItem('sms_access',  tokens.access  || '');
  localStorage.setItem('sms_refresh', tokens.refresh || '');
};

export const logout = () => {
  localStorage.removeItem('sms_user');
  localStorage.removeItem('sms_access');
  localStorage.removeItem('sms_refresh');
  // Redirection forcée — fonctionne même hors contexte React
  window.location.href = '/login';
};

export const getUser = () => {
  try {
    const data = localStorage.getItem('sms_user');
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

/**
 * Vérifie si l'utilisateur est authentifié.
 * Exige à la fois sms_user ET sms_access pour éviter
 * l'accès direct sans connexion réelle.
 */
export const isAuthenticated = () => {
  const user   = localStorage.getItem('sms_user');
  const token  = localStorage.getItem('sms_access');
  return !!(user && token && token.length > 10);
};

export const hasRole = (role) => {
  const user = getUser();
  return user?.role === role;
};

export const isAdmin = () => hasRole('ADMIN');
