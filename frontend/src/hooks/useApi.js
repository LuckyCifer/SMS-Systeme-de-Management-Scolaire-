/**
 * hooks/useApi.js — Version définitive avec timeout et annulation
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import fr from '../i18n/fr';
import en from '../i18n/en';
import { getLang } from '../services/lang';

const TIMEOUT_MS = 10000;

function getT() {
  return getLang() === 'fr' ? fr : en;
}

export function useApi(fetchFn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const mountedRef    = useRef(true);
  const fnRef         = useRef(fetchFn);
  const controllerRef = useRef(null);
  const initialRef    = useRef(true);

  useEffect(() => { fnRef.current = fetchFn; });

  const load = useCallback(async () => {
    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();

    // Only show the full-page loading spinner on the very first load.
    // Subsequent reloads (after CRUD ops) update data silently so that
    // CrudTable stays mounted and preserves page/search/filter state.
    if (initialRef.current) setLoading(true);
    setError(null);

    const timeoutId = setTimeout(() => {
      controllerRef.current?.abort();
    }, TIMEOUT_MS);

    try {
      const res = await fnRef.current();
      if (!mountedRef.current) return;
      clearTimeout(timeoutId);
      initialRef.current = false;
      setData(res.data?.results ?? res.data ?? []);
      setError(null);
    } catch (err) {
      clearTimeout(timeoutId);
      if (!mountedRef.current) return;
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        setError(getT().errors.timeout);
      } else {
        setError(parseError(err));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, [load]);

  return { data, loading, error, reload: load };
}

export function useMutation(mutateFn) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const mutate = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const res = await mutateFn(...args);
      return res.data;
    } catch (err) {
      const msg = parseError(err);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, [mutateFn]);

  return { mutate, loading, error };
}

export function parseError(err) {
  const t = getT();
  if (!err.response) {
    return t.errors.network;
  }
  const { status, data } = err.response;
  if (status === 401) return t.errors.session;
  if (status === 403) return t.errors.forbidden;
  if (status === 404) return t.errors.notFound;
  if (status === 400 && typeof data === 'object') {
    const detail = Object.entries(data)
      .map(([f, e]) => `${f}: ${Array.isArray(e) ? e.join(', ') : e}`)
      .join(' | ');
    return detail || t.errors.invalid;
  }
  if (status >= 500) return t.errors.server;
  return data?.detail || data?.message || t.errors.unexpected;
}
