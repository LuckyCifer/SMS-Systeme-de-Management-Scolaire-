import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';

/**
 * SearchableSelect — liste déroulante avec filtre textuel intégré.
 * Le dropdown est rendu via un portal (document.body, position:fixed)
 * pour éviter tout problème de z-index / overflow / stacking context.
 */
export default function SearchableSelect({
  label, name, value, onChange,
  options = [], required, placeholder, disabled,
}) {
  const { t } = useApp();
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState('');
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 200, openUp: false });

  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const searchRef  = useRef(null);

  const selected     = options.find(o => String(o.value) === String(value));
  const displayLabel = selected?.label ?? '';

  const norm     = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const filtered = query.trim()
    ? options.filter(o => norm(o.label).includes(norm(query)))
    : options;

  // Calcule la position du dropdown en fixed par rapport au trigger
  const calcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect       = triggerRef.current.getBoundingClientRect();
    const viewH      = window.innerHeight;
    const dropH      = Math.min(filtered.length * 36 + 60, 300); // estimation
    const spaceBelow = viewH - rect.bottom;
    const openUp     = spaceBelow < dropH && rect.top > dropH;
    setDropPos({
      top:   openUp ? rect.top - 4    : rect.bottom + 4,
      left:  rect.left,
      width: rect.width,
      openUp,
    });
  }, [filtered.length]);

  // Ferme au clic extérieur (trigger OU dropdown)
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropRef.current    && !dropRef.current.contains(e.target)
      ) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // Recalcule la position au scroll / resize
  useEffect(() => {
    if (!open) return;
    const update = () => calcPos();
    window.addEventListener('scroll',  update, true);
    window.addEventListener('resize',  update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, calcPos]);

  const openDropdown = () => {
    if (disabled) return;
    calcPos();
    setOpen(true);
    setQuery('');
    setTimeout(() => searchRef.current?.focus(), 40);
  };

  const pick = (opt) => {
    onChange({ target: { name, value: opt.value } });
    setOpen(false);
    setQuery('');
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange({ target: { name, value: '' } });
    setOpen(false);
    setQuery('');
  };

  const isSelected = (opt) => String(opt.value) === String(value);

  // ── Dropdown rendu via portal ──────────────────────────────────────────────
  const dropdown = open && !disabled && createPortal(
    <div
      ref={dropRef}
      style={{
        position: 'fixed',
        top:      dropPos.openUp ? 'auto' : dropPos.top,
        bottom:   dropPos.openUp ? window.innerHeight - dropPos.top : 'auto',
        left:     dropPos.left,
        width:    dropPos.width,
        zIndex:   9999,
        background:   'var(--bg-card)',
        border:       '1px solid var(--border)',
        borderRadius: 6,
        boxShadow:    '0 8px 28px rgba(0,0,0,.28)',
        overflow:     'hidden',
      }}
    >
      {/* Champ de recherche */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-secondary)' }}>
        <div style={{ position: 'relative' }}>
          <i className="fas fa-search" style={{
            position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
            fontSize: 10, color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            ref={searchRef}
            className="sms-input"
            style={{ paddingLeft: 26, height: 30, fontSize: 11 }}
            value={query}
            onChange={e => { setQuery(e.target.value); calcPos(); }}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Escape') { setOpen(false); setQuery(''); }
              if (e.key === 'Enter' && filtered.length === 1) { e.preventDefault(); pick(filtered[0]); }
            }}
            placeholder={t.common.search}
          />
        </div>
        {query && filtered.length > 0 && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, paddingLeft: 2 }}>
            {filtered.length}
          </div>
        )}
      </div>

      {/* Liste */}
      <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {!required && !query && (
          <div
            onMouseDown={e => { e.preventDefault(); onChange({ target: { name, value: '' } }); setOpen(false); setQuery(''); }}
            style={{
              padding: '7px 12px', fontSize: 11,
              color: 'var(--text-muted)', cursor: 'pointer',
              borderBottom: '1px solid var(--border-light)', fontStyle: 'italic',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}
          >
            {t.common.select}
          </div>
        )}

        {filtered.length === 0 ? (
          <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
            {t.common.noResult}
          </div>
        ) : filtered.map((opt, i) => {
          const sel = isSelected(opt);
          return (
            <div
              key={i}
              onMouseDown={e => { e.preventDefault(); pick(opt); }}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 7,
                background: sel ? 'var(--green-dark)22' : '',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border-light)' : 'none',
                color:      sel ? 'var(--green)'       : 'var(--text-primary)',
                fontWeight: sel ? 600                  : 400,
              }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = sel ? 'var(--green-dark)22' : ''; }}
            >
              {sel
                ? <i className="fas fa-check" style={{ fontSize: 9, color: 'var(--green)', flexShrink: 0 }} />
                : <span style={{ width: 13, flexShrink: 0 }} />
              }
              {opt.label}
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );

  return (
    <div className="sms-form-group" style={{ position: 'relative' }}>
      {label && (
        <label className="sms-label">
          {label}{required && <span style={{ color: 'var(--green)' }}> *</span>}
        </label>
      )}

      {/* ── Déclencheur ── */}
      <div
        ref={triggerRef}
        className="sms-input"
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          cursor: disabled ? 'default' : 'pointer',
          userSelect: 'none',
          opacity: disabled ? .6 : 1,
          minHeight: 34,
        }}
        onClick={openDropdown}
      >
        <span style={{
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: 12,
          color: displayLabel ? 'var(--text-primary)' : 'var(--text-muted)',
        }}>
          {displayLabel || placeholder || t.common.select}
        </span>

        {value !== '' && value !== null && value !== undefined && !disabled && (
          <span
            onMouseDown={e => { e.preventDefault(); clear(e); }}
            style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1, cursor: 'pointer', padding: '0 2px' }}
            title="Effacer"
          >×</span>
        )}

        <i className="fas fa-chevron-down" style={{
          fontSize: 9, color: 'var(--text-muted)', flexShrink: 0,
          transition: 'transform .15s',
          transform: open ? 'rotate(180deg)' : 'none',
        }} />
      </div>

      {dropdown}
    </div>
  );
}
