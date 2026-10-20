/**
 * hooks/useTr.js — Traduction en ligne pour les textes propres à une page.
 *
 *   const tr = useTr();
 *   tr('Appel du jour', 'Daily roll call')
 *
 * Les textes partagés par plusieurs pages restent dans i18n/fr.js et i18n/en.js (`t`).
 */
import { useCallback } from 'react';
import { useApp } from '../context/AppContext';

export function useTr() {
  const { lang } = useApp();
  return useCallback((fr, en) => (lang === 'en' ? en : fr), [lang]);
}
