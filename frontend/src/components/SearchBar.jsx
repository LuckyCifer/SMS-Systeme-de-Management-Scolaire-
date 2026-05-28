/**
 * components/SearchBar.jsx
 * Barre de recherche avec debounce, clear button et raccourci clavier.
 */
import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

export default function SearchBar({ value, onChange, placeholder, autoFocus = false }) {
  const { t } = useApp();
  const [local, setLocal] = useState(value || '');
  const inputRef = useRef(null);

  // Debounce — attend 300ms avant d'appeler onChange
  useEffect(() => {
    const timer = setTimeout(() => onChange(local), 300);
    return () => clearTimeout(timer);
  }, [local, onChange]);

  // Raccourci clavier Ctrl+K ou / pour focus
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey && e.key === 'k') || e.key === '/') {
        if (document.activeElement?.tagName !== 'INPUT' &&
            document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
      if (e.key === 'Escape') {
        setLocal('');
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="sms-search" style={{ position: 'relative' }}>
      <i className="fas fa-search"></i>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder || t.common.search}
        value={local}
        onChange={e => setLocal(e.target.value)}
        autoFocus={autoFocus}
        style={{ paddingRight: local ? 32 : 12 }}
      />
      {/* Bouton clear */}
      {local && (
        <button
          onClick={() => setLocal('')}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 12, padding: 2,
            display: 'flex', alignItems: 'center',
          }}
          title="Effacer"
        >
          <i className="fas fa-times-circle"></i>
        </button>
      )}
    </div>
  );
}
