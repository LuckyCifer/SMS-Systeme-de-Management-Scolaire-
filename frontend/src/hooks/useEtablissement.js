/**
 * hooks/useEtablissement.js
 * Charge les infos de l'établissement courant et les met en cache localStorage.
 *
 * Persistance :
 *   sms_etab        — cache des données (TTL 5 min)
 *   sms_etab_pinned — code_etab de l'établissement explicitement choisi via "Se connecter"
 *                     Survit aux refreshs et aux invalidations de cache.
 *
 * Expose: { etab, typeEtab, systeme, isLoading, error, refresh }
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const CACHE_KEY          = 'sms_etab';
const PINNED_KEY         = 'sms_etab_pinned';  // persistance cross-refresh
const CACHE_TTL          = 5 * 60 * 1000;
const ETAB_EVENT         = 'sms:etab-updated';
const ETAB_CONNECT_EVENT = 'sms:etab-connected';

// ── Fonctions utilitaires publiques ──────────────────────────────────────────

/** Appelée après modification des données d'un établissement (sauvegarde). */
export function notifyEtabUpdated() {
  localStorage.removeItem(CACHE_KEY);
  // Ne pas supprimer PINNED_KEY — l'utilisateur reste connecté au même établissement
  window.dispatchEvent(new CustomEvent(ETAB_EVENT));
}

/**
 * Connecte l'utilisateur à un établissement spécifique.
 * Persiste le choix dans PINNED_KEY pour survivre aux refreshs de page.
 */
export function connectToEtab(etabData) {
  localStorage.setItem(PINNED_KEY, etabData.code_etab);
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data: etabData, ts: Date.now() }));
  // Un établissement épinglé prime sur le filtre par type : un ancien type resté en cache
  // (ex. 'PRIMAIRE' sélectionné avant de se connecter à un établissement SECONDAIRE) serait
  // sinon toujours envoyé tel quel dans l'en-tête X-Type-Etab par l'intercepteur Axios, qui lit
  // sms_type_etab_actif indépendamment de l'épinglage — et EtablissementFilterMixin donne la
  // priorité à ce type sur X-Etablissement-Id, court-circuitant silencieusement l'épinglage.
  localStorage.removeItem('sms_type_etab_actif');
  window.dispatchEvent(new CustomEvent(ETAB_CONNECT_EVENT));
}

/** Déconnecte de l'établissement épinglé (appeler au logout). */
export function unpinEtab() {
  localStorage.removeItem(PINNED_KEY);
  localStorage.removeItem(CACHE_KEY);
}

// ── Helpers privés ────────────────────────────────────────────────────────────

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL) return data;
  } catch {}
  return null;
}

function getPinnedId() {
  return localStorage.getItem(PINNED_KEY) || null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useEtablissement() {
  const [etab,      setEtab]      = useState(() => readCache());
  const [isLoading, setIsLoading] = useState(() => !readCache());
  const [error,     setError]     = useState(null);
  const [isPinned,  setIsPinned]  = useState(() => !!getPinnedId());

  const refresh = useCallback(async (force = false) => {
    // Si les données sont en cache et qu'on ne force pas, utiliser le cache
    if (!force) {
      const cached = readCache();
      if (cached) { setEtab(cached); return; }
    }

    setIsLoading(true);
    try {
      const pinnedId = getPinnedId();
      let res;

      if (pinnedId) {
        // Re-fetch l'établissement spécifiquement choisi par l'utilisateur
        res = await api.get(`/api/etablissements/${pinnedId}/`);
      } else {
        // Comportement par défaut : premier établissement actif
        res = await api.get('/api/etablissements/current/');
      }

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

  // Chargement initial si cache vide
  useEffect(() => {
    if (!readCache()) refresh();
  }, [refresh]);

  // Données modifiées → re-fetch l'établissement actif (pinné ou current)
  useEffect(() => {
    const handler = () => refresh(true);
    window.addEventListener(ETAB_EVENT, handler);
    return () => window.removeEventListener(ETAB_EVENT, handler);
  }, [refresh]);

  // Connexion choisie → lire depuis le cache (déjà écrit par connectToEtab)
  useEffect(() => {
    const handler = () => { setIsPinned(true); refresh(false); };
    window.addEventListener(ETAB_CONNECT_EVENT, handler);
    return () => window.removeEventListener(ETAB_CONNECT_EVENT, handler);
  }, [refresh]);

  return {
    etab,
    typeEtab:  etab?.type_etab || 'SUPERIEUR',
    systeme:   etab?.systeme   || 'FRANCOPHONE',
    isLoading,
    error,
    refresh,
    isPinned,
  };
}
