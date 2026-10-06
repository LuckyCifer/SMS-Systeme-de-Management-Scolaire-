/**
 * context/NotificationContext.jsx
 * Système de notifications en temps réel.
 * Vérifie automatiquement les alertes depuis l'API toutes les 60 secondes.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread]               = useState(0);
  const [loading, setLoading]             = useState(false);

  // ── Génère des notifications depuis les données API ───────────────────────
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const notifs = [];

      // Vérifier les paiements impayés
      try {
        const paiRes = await api.get('/api/paiements/', { params: { page_size: 100 } });
        const paiements = paiRes.data.results ?? paiRes.data;
        const impayes   = paiements.filter(p => p.statut === 'IMPAYE');
        if (impayes.length > 0) {
          notifs.push({
            id:      'impaye-' + Date.now(),
            type:    'warning',
            icon:    'fas fa-credit-card',
            title:   'Paiements en retard',
            message: `${impayes.length} étudiant(s) ont des paiements impayés.`,
            link:    '/payments',
            time:    new Date(),
            read:    false,
          });
        }
      } catch { /* silencieux */ }

      // Vérifier les inscriptions en attente
      try {
        const insRes = await api.get('/api/inscriptions/', { params: { page_size: 100 } });
        const inscriptions = insRes.data.results ?? insRes.data;
        const enAttente    = inscriptions.filter(i => i.statut === 'EN_ATTENTE');
        if (enAttente.length > 0) {
          notifs.push({
            id:      'attente-' + Date.now(),
            type:    'info',
            icon:    'fas fa-file-signature',
            title:   'Inscriptions en attente',
            message: `${enAttente.length} inscription(s) en attente de validation.`,
            link:    '/inscription',
            time:    new Date(),
            read:    false,
          });
        }
      } catch { /* silencieux */ }

      // Vérifier les années PLANIFIÉE sans dates (après un passage d'année)
      try {
        const anneeRes = await api.get('/api/annees/', { params: { statut: 'PLANIFIEE', page_size: 10 } });
        const annees = anneeRes.data.results ?? anneeRes.data;
        const sansDate = annees.filter(a => !a.date_deb || !a.date_fin);
        sansDate.forEach(a => {
          notifs.push({
            id:      'annee-planifiee-' + a.code_annee,
            type:    'warning',
            icon:    'fas fa-calendar-plus',
            title:   'Nouvelle année scolaire créée',
            message: `L'année "${a.lib_annee || a.code_annee}" est planifiée mais ses dates ne sont pas encore définies.`,
            link:    '/parametrage',
            time:    new Date(),
            read:    false,
          });
        });
      } catch { /* silencieux */ }

      // Notification de bienvenue si aucune autre
      if (notifs.length === 0) {
        notifs.push({
          id:      'welcome',
          type:    'success',
          icon:    'fas fa-check-circle',
          title:   'Système opérationnel',
          message: 'Toutes les données sont à jour.',
          link:    '/',
          time:    new Date(),
          read:    false,
        });
      }

      setNotifications(notifs);
      setUnread(notifs.filter(n => !n.read).length);
    } catch {
      // Silencieux si pas connecté
    } finally {
      setLoading(false);
    }
  }, []);

  // Charge au démarrage et toutes les 60 secondes
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
  }, []);

  const markRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  }, []);

  const dismiss = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    setUnread(prev => Math.max(0, prev - 1));
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications, unread, loading,
      markAllRead, markRead, dismiss, refresh: fetchNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
