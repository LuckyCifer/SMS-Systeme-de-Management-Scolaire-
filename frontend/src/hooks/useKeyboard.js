/**
 * hooks/useKeyboard.js
 * Raccourcis clavier globaux pour l'application.
 * Usage : useKeyboard({ 'ctrl+n': () => openForm(), 'Escape': () => close() })
 */
import { useEffect } from 'react';

export function useKeyboard(shortcuts) {
  useEffect(() => {
    const handler = (e) => {
      // Ignore si on est dans un input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      const key = [
        e.ctrlKey  ? 'ctrl'  : '',
        e.shiftKey ? 'shift' : '',
        e.altKey   ? 'alt'   : '',
        e.key,
      ].filter(Boolean).join('+').toLowerCase();

      if (shortcuts[key]) {
        e.preventDefault();
        shortcuts[key](e);
      }
      // Essaie aussi juste la touche sans modificateurs
      if (shortcuts[e.key]) {
        shortcuts[e.key](e);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [shortcuts]);
}

// Hook pour fermer une modale avec Escape
export function useEscapeKey(onClose) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
}
