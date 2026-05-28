import { useState, useEffect, useRef } from 'react';

/**
 * AutocompleteField — champ de recherche avec dropdown connecté à une API.
 *
 * Props:
 *   label         : libellé affiché
 *   name          : nom du champ (clé FK soumise au formulaire)
 *   value         : valeur FK courante (ex: "2025-LCS-00001" ou "LCS1")
 *   onChange      : appelé avec { target: { name, value } } à chaque sélection
 *   service       : service API exposant .list(params) → { data }
 *   labelFn       : (item) => string affiché dans le dropdown et dans l'input
 *   valueFn       : (item) => string valeur FK à stocker
 *   initialLabel  : texte pré-rempli en mode édition (nom déjà connu)
 *   placeholder   : texte placeholder de l'input
 *   required      : affiche le * et marque le champ obligatoire
 *   searchParam   : nom du paramètre de recherche API (défaut : 'search')
 *   extraParams   : paramètres fixes supplémentaires pour l'API
 */
export default function AutocompleteField({
  label,
  name,
  value,
  onChange,
  service,
  labelFn,
  valueFn,
  initialLabel = '',
  placeholder = 'Rechercher…',
  required = false,
  searchParam = 'search',
  extraParams = {},
}) {
  const [display, setDisplay] = useState(initialLabel || value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef   = useRef(null);
  const wrapperRef = useRef(null);

  // Sync display when value changes from outside (reset du formulaire, etc.)
  useEffect(() => {
    if (!display && value) setDisplay(value);
  }, [value]);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = (q) => {
    clearTimeout(timerRef.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const resp  = await service.list({ [searchParam]: q, page_size: 8, ...extraParams });
        const items = resp.data?.results ?? resp.data ?? [];
        setResults(items);
        setOpen(items.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleInput = (e) => {
    const q = e.target.value;
    setDisplay(q);
    // Effacer la valeur FK tant qu'aucun élément n'est sélectionné
    onChange({ target: { name, value: '' } });
    doSearch(q);
  };

  const handleSelect = (item) => {
    const v   = valueFn(item);
    const lbl = labelFn(item);
    setDisplay(lbl);
    onChange({ target: { name, value: v } });
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    setDisplay('');
    onChange({ target: { name, value: '' } });
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="sms-form-group" ref={wrapperRef} style={{ position: 'relative', flex: 1, minWidth: 160 }}>
      <label className="sms-label">
        {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
      </label>

      <div style={{ position: 'relative' }}>
        <input
          className="sms-input"
          value={display}
          onChange={handleInput}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder={placeholder}
          autoComplete="off"
        />
        {/* Bouton × pour effacer */}
        {display && (
          <button
            type="button"
            onClick={handleClear}
            tabIndex={-1}
            title="Effacer"
            style={{
              position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
              color: 'var(--text-muted)', fontSize: 15, lineHeight: 1,
            }}
          >×</button>
        )}
      </div>

      {/* Dropdown résultats */}
      {open && (
        <div style={{
          position: 'absolute', zIndex: 1100, width: '100%',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          boxShadow: '0 6px 20px rgba(0,0,0,.18)',
          maxHeight: 220, overflowY: 'auto',
          top: 'calc(100% + 3px)',
        }}>
          {loading ? (
            <div style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="sms-spinner" style={{ width: 12, height: 12 }}></div>
              Chargement…
            </div>
          ) : results.map((item, i) => (
            <div
              key={i}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                borderBottom: i < results.length - 1 ? '1px solid var(--border-light)' : 'none',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              {labelFn(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
