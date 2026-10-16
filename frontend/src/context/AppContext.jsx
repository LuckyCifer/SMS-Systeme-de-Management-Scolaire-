/**
 * context/AppContext.jsx
 * Contexte global : thème, langue, toasts, authentification, type d'établissement.
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import fr from '../i18n/fr';
import en from '../i18n/en';
import { setLang as setSingletonLang } from '../services/lang';
import api from '../services/api';
import { unpinEtab } from '../hooks/useEtablissement';

const AppContext = createContext(null);

export function AppProvider({ children }) {

  // ── Thème ────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('sms_theme') || 'dark'
  );

  // ── Langue ───────────────────────────────────────────────────────────────
  const [lang, setLang] = useState(() =>
    localStorage.getItem('sms_lang') || 'fr'
  );

  // ── Authentification ─────────────────────────────────────────────────────
  const [user,            setUser]            = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading,       setIsLoading]       = useState(true);

  // ── Année scolaire active ────────────────────────────────────────────────
  const [anneeActive, setAnneeActiveState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sms_annee_active') || 'null'); }
    catch { return null; }
  });
  const [annees, setAnnees] = useState([]);

  const setAnneeActive = useCallback((annee) => {
    setAnneeActiveState(annee);
    localStorage.setItem('sms_annee_active', JSON.stringify(annee));
  }, []);

  // ── École courante ───────────────────────────────────────────────────────
  // Une seule école à la fois : le type (primaire / secondaire / supérieur) se déduit
  // toujours de l'école connectée (hooks/useEtablissement), jamais d'un filtre séparé.
  // Nettoyage de l'ancien « type actif » qui pouvait contredire l'école connectée.
  useEffect(() => { localStorage.removeItem('sms_type_etab_actif'); }, []);

  // ── Toasts ───────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);

  const t = lang === 'fr' ? fr : en;

  // ── Effets thème / langue ────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sms_theme', theme);
  }, [theme]);

  useEffect(() => {
    setSingletonLang(lang);
    localStorage.setItem('sms_lang', lang);
  }, [lang]);

  // ── Vérifier l'auth au montage ───────────────────────────────────────────
  useEffect(() => {
    try {
      const token    = localStorage.getItem('sms_access');
      const userData = localStorage.getItem('sms_user');
      if (token && token.length > 10 && userData) {
        const parsed = JSON.parse(userData);
        setUser(parsed);
        setIsAuthenticated(true);
        // Pour les non-SUPER_ADMIN, le type est fixe = leur établissement
      } else {
        localStorage.removeItem('sms_user');
        localStorage.removeItem('sms_access');
        localStorage.removeItem('sms_refresh');
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    }
    setIsLoading(false);
  }, []); // eslint-disable-line

  // ── Chargement des années (quand authentifié) ────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    api.get('/api/annees/?page_size=20&ordering=-code_annee').then(res => {
      const list = res.data.results ?? res.data ?? [];
      setAnnees(list);
      if (!anneeActive) {
        const active = list.find(a => a.statut === 'EN COURS') || list[0];
        if (active) setAnneeActive(active);
      }
    }).catch(() => {});
  }, [isAuthenticated]); // eslint-disable-line

  // ── Toggles ──────────────────────────────────────────────────────────────
  const toggleTheme = useCallback(() =>
    setTheme(prev => prev === 'dark' ? 'light' : 'dark'), []);

  const toggleLang = useCallback(() =>
    setLang(prev => prev === 'fr' ? 'en' : 'fr'), []);

  // ── Toasts ───────────────────────────────────────────────────────────────
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id) =>
    setToasts(prev => prev.filter(t => t.id !== id)), []);

  const toast = useMemo(() => ({
    success: (msg) => addToast(msg, 'success'),
    error:   (msg) => addToast(msg, 'error'),
    warning: (msg) => addToast(msg, 'warning'),
    info:    (msg) => addToast(msg, 'info'),
  }), [addToast]);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback((userData, tokens) => {
    localStorage.setItem('sms_user',    JSON.stringify(userData));
    localStorage.setItem('sms_access',  tokens.access  || '');
    localStorage.setItem('sms_refresh', tokens.refresh || '');
    setUser(userData);
    setIsAuthenticated(true);
  }, []);

  // ── Logout — redirige toujours vers /login ───────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('sms_user');
    localStorage.removeItem('sms_access');
    localStorage.removeItem('sms_refresh');
    localStorage.removeItem('sms_type_etab_actif');
    localStorage.removeItem('sms_type_etab'); // compat. ancienne clé
    unpinEtab(); // supprime sms_etab + sms_etab_pinned
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  }, []);

  // ── Provider Value ────────────────────────────────────────────────────────
  const value = useMemo(() => ({
    theme, toggleTheme,
    lang,  toggleLang,
    t, toast, toasts, removeToast,
    user, isAuthenticated, isLoading, login, logout,
    anneeActive, setAnneeActive, annees,
  }), [
    theme, lang, t, toast, toasts, removeToast,
    user, isAuthenticated, isLoading,
    toggleTheme, toggleLang, login, logout,
    anneeActive, setAnneeActive, annees,
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
