/**
 * hooks/useEtablissement.js
 * Charge les infos de l'établissement courant et les met en cache localStorage.
 * Expose: { etab, typeEtab, systeme, isLoading, error, refresh }
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const CACHE_KEY  = 'sms_etab';
const CACHE_TTL  = 5 * 60 * 1000; // 5 minutes
const ETAB_EVENT = 'sms:etab-updated'; // événement diffusé après chaque sauvegarde

export function notifyEtabUpdated() {
  localStorage.removeItem(CACHE_KEY);
  window.dispatchEvent(new CustomEvent(ETAB_EVENT));
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL) return data;
  } catch {}
  return null;
}

export function useEtablissement() {
  const [etab,      setEtab]      = useState(() => readCache());
  const [isLoading, setIsLoading] = useState(() => !readCache());
  const [error,     setError]     = useState(null);

  const refresh = useCallback(async (force = false) => {
    if (!force) {
      const cached = readCache();
      if (cached) { setEtab(cached); return; }
    }
    setIsLoading(true);
    try {
      const res = await api.get('/api/etablissements/current/');
      const data = res.data;
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
      setEtab(data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!readCache()) refresh();
  }, [refresh]);

  // Re-fetch dès qu'un autre composant notifie une mise à jour
  useEffect(() => {
    const handler = () => refresh(true);
    window.addEventListener(ETAB_EVENT, handler);
    return () => window.removeEventListener(ETAB_EVENT, handler);
  }, [refresh]);

  return {
    etab,
    typeEtab:  etab?.type_etab || 'SUPERIEUR',
    systeme:   etab?.systeme   || 'FRANCOPHONE',
    isLoading,
    error,
    refresh,
  };
}
