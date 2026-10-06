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

  // ── Type d'établissement actif ───────────────────────────────────────────
  // Valeur = string 'PRIMAIRE' | 'SECONDAIRE' | 'SUPERIEUR' | null
  const [activeTypeEtab, setActiveTypeEtabState] = useState(() =>
    localStorage.getItem('sms_type_etab_actif') || null
  );
  const [typesEtab, setTypesEtab] = useState([]);

  const setActiveTypeEtab = useCallback((typeStr) => {
    setActiveTypeEtabState(typeStr || null);
    if (typeStr) {
      localStorage.setItem('sms_type_etab_actif', typeStr);
    } else {
      localStorage.removeItem('sms_type_etab_actif');
    }
    // Effacer l'établissement épinglé : le changement de type invalide le choix précédent
    unpinEtab();
  }, []);

  // Symétrique : épingler un établissement (connectToEtab) invalide le filtre par type actif —
  // sinon un type resté en cache (ex. 'PRIMAIRE' sélectionné avant de se connecter à un
  // établissement SECONDAIRE) resterait affiché comme actif ici même si connectToEtab l'a déjà
  // effacé du localStorage.
  useEffect(() => {
    const handler = () => setActiveTypeEtabState(null);
    window.addEventListener('sms:etab-connected', handler);
    return () => window.removeEventListener('sms:etab-connected', handler);
  }, []);

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
        if (parsed.role !== 'SUPER_ADMIN' && parsed.type_etab && !activeTypeEtab) {
          setActiveTypeEtabState(parsed.type_etab);  // string 'PRIMAIRE'/'SECONDAIRE'/'SUPERIEUR'
        }
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

  // ── Chargement des types d'établissement (SUPER_ADMIN uniquement) ────────
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (user.role !== 'SUPER_ADMIN') return;
    api.get('/api/type-etab/').then(res => {
      const list = res.data.results ?? res.data ?? [];
      setTypesEtab(list);
    }).catch(() => {});
  }, [isAuthenticated, user?.role]); // eslint-disable-line

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
    // Pour un utilisateur non SUPER_ADMIN, fixer son type d'établissement (string direct)
    if (userData.role !== 'SUPER_ADMIN' && userData.type_etab) {
      setActiveTypeEtabState(userData.type_etab);
      localStorage.setItem('sms_type_etab_actif', userData.type_etab);
    }
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
    setActiveTypeEtabState(null);
    setTypesEtab([]);
    window.location.href = '/login';
  }, []);

  // ── Provider Value ────────────────────────────────────────────────────────
  const value = useMemo(() => ({
    theme, toggleTheme,
    lang,  toggleLang,
    t, toast, toasts, removeToast,
    user, isAuthenticated, isLoading, login, logout,
    anneeActive, setAnneeActive, annees,
    activeTypeEtab, setActiveTypeEtab, typesEtab,
  }), [
    theme, lang, t, toast, toasts, removeToast,
    user, isAuthenticated, isLoading,
    toggleTheme, toggleLang, login, logout,
    anneeActive, setAnneeActive, annees,
    activeTypeEtab, setActiveTypeEtab, typesEtab,
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
