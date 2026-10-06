/**
 * components/CrudTable.jsx
 * Tableau CRUD avec :
 * - Sélection multiple + bulk delete
 * - Export CSV/Excel
 * - Filtres avancés
 * - Pagination
 * - Colonnes masquables (P3)
 * - Skeleton loading (P4)
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import SearchableSelect from './SearchableSelect';
import EmptyState from './EmptyState';

/* ── Skeleton row ─────────────────────────────────────────────────── */
function SkeletonRows({ colCount, rowCount = 8 }) {
  return Array.from({ length: rowCount }).map((_, i) => (
    <tr key={i} style={{ opacity: 1 - i * 0.08 }}>
      {Array.from({ length: colCount }).map((_, j) => (
        <td key={j} style={{ padding: '12px 16px' }}>
          <div
            className="skeleton"
            style={{ height: 13, width: j === 0 ? '60%' : j % 3 === 0 ? '45%' : '75%', borderRadius: 4 }}
          />
        </td>
      ))}
    </tr>
  ));
}

export function CrudTable({
  title, subtitle, icon,
  columns, data,
  onAdd, onEdit, onDelete, onBulkDelete,
  renderForm,
  addLabel,
  exportCsvUrl,
  extraHeaderButtons,
  filters,
  totalCount,
  sortBy,
  emptyState,
  loading = false,
  // Server-side pagination
  serverSide    = false,
  serverPage    = 1,
  serverPages   = 1,
  onServerPage  = null,
  onServerSearch = null,
}) {
  const { t, toast } = useApp();
  const [search,     setSearch]     = useState('');
  const [page,       setPage]       = useState(1);
  const [showModal,  setShowModal]  = useState(false);
  const [editItem,   setEditItem]   = useState(null);
  const [delItem,    setDelItem]    = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [selected,   setSelected]   = useState(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [perPage,    setPerPage]    = useState(0);
  // P3 — colonnes masquables
  const [hiddenCols,   setHiddenCols]   = useState(new Set());
  const [showColMenu,  setShowColMenu]  = useState(false);
  const colMenuRef     = useRef(null);
  const searchTimerRef = useRef(null);

  // Fermer le menu colonnes au clic extérieur
  useEffect(() => {
    if (!showColMenu) return;
    const handler = (e) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target)) {
        setShowColMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColMenu]);

  const toggleCol = (key) => {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleCols = columns.filter(col => !hiddenCols.has(col.key ?? col.accessor));

  const PER_PAGE = perPage;
  const needle   = search.toLowerCase();

  const colVal = (col, row) => {
    if (col.searchValue) return col.searchValue(row);
    if (col.accessor)    return row[col.accessor];
    if (col.render) {
      try {
        const v = col.render(row);
        if (v !== null && v !== undefined && typeof v !== 'object') return v;
      } catch {}
    }
    return null;
  };

  // In serverSide+onServerSearch mode: skip local filtering (server already filtered)
  const filtered = (serverSide && onServerSearch)
    ? data
    : !search.trim() ? data : data.filter(row =>
        columns.some(col => {
          const val = colVal(col, row);
          return val !== null && String(val ?? '').toLowerCase().includes(needle);
        })
      );

  const sortKey = (row) => {
    if (typeof sortBy === 'function') return sortBy(row);
    if (typeof sortBy === 'string')   return row[sortBy];
    for (const col of columns) {
      const v = colVal(col, row);
      if (v !== null && v !== undefined && typeof v === 'string' && v !== '') return v;
    }
    return '';
  };
  // In serverSide mode: server sorts, skip local sort
  const sorted = serverSide
    ? filtered
    : [...filtered].sort((a, b) =>
        String(sortKey(a) ?? '').localeCompare(String(sortKey(b) ?? ''), 'fr', { sensitivity: 'base' })
      );

  const clientPages    = perPage === 0 ? 1 : Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const clientSafePage = Math.min(page, clientPages);
  // In serverSide mode: data IS the current page — show it all
  const paginated = serverSide
    ? sorted
    : perPage === 0 ? sorted : sorted.slice((clientSafePage - 1) * PER_PAGE, clientSafePage * PER_PAGE);

  // Effective display values (server overrides client when serverSide=true)
  const displayPages = serverSide ? serverPages   : clientPages;
  const displayPage  = serverSide ? serverPage    : clientSafePage;
  const goToPage     = (p) => { if (serverSide) onServerPage?.(p); else setPage(p); };

  const openAdd  = () => { setEditItem(null); setShowModal(true); };
  const openEdit = (item) => { setEditItem(item); setShowModal(true); };
  const close    = () => { setShowModal(false); setEditItem(null); };

  const getPk = (row) => row.id ?? row.mle_etudiant ?? row.mle_ens ??
    row.code_classe ?? row.login ?? row.code_inscription ??
    row.code_paiement ?? row.code_eval ?? JSON.stringify(row);

  const toggleSelect = (row) => {
    const pk = getPk(row);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk); else next.add(pk);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === paginated.length) setSelected(new Set());
    else setSelected(new Set(paginated.map(getPk)));
  };

  const allSelected = paginated.length > 0 && selected.size === paginated.length;

  const handleBulkDelete = async () => {
    if (!onBulkDelete) return;
    try {
      await onBulkDelete([...selected]);
      setSelected(new Set());
      setShowBulkConfirm(false);
      toast.success(`${selected.size} ${t.common.elements} ${t.common.bulkDeleted}`);
    } catch (e) {
      toast.error(e.message || t.common.bulkDeleteTitle);
    }
  };

  const handleExportCsv = async () => {
    if (!exportCsvUrl) return;
    const token = localStorage.getItem('sms_access');
    const url   = `http://localhost:8000${exportCsvUrl}`;
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { toast.error(t.toast.error); return; }
      const disp  = r.headers.get('Content-Disposition') || '';
      const match = disp.match(/filename="?([^";\n]+)"?/);
      const ext   = exportCsvUrl.includes('xlsx') ? '.xlsx' : '.csv';
      const name  = match ? match[1] : (exportCsvUrl.split('/').filter(Boolean).at(-2) || 'export') + ext;
      const blob  = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name; a.click();
      URL.revokeObjectURL(a.href);
      toast.success(t.toast.exported);
    } catch {
      toast.error(t.toast.error);
    }
  };

  const colCount = visibleCols.length + (onBulkDelete ? 2 : 1);

  return (
    <div className="animate-fadeInUp">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className={`${icon} text-green`} style={{ marginRight: 10, fontSize: 22 }}></i>
            {title}
          </h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {extraHeaderButtons}
          {exportCsvUrl && (
            <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={handleExportCsv}>
              <i className="fas fa-file-excel"></i> Export Excel
            </button>
          )}
          <button className="sms-btn sms-btn-primary" onClick={openAdd}>
            <i className="fas fa-plus"></i> {addLabel || t.common.add}
          </button>
        </div>
      </div>

      {/* Filtres additionnels */}
      {filters && <div className="sms-filter-bar" style={{ marginBottom: 16 }}>{filters}</div>}

      {/* Bulk action bar */}
      {selected.size > 0 && onBulkDelete && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
          background: 'rgba(239,83,80,.08)', border: '1px solid rgba(239,83,80,.2)',
          borderRadius: 8, marginBottom: 12,
          animation: 'fadeInUp .2s ease',
        }}>
          <i className="fas fa-check-square" style={{ color: 'var(--danger)' }}></i>
          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
            {selected.size} {t.common.elements} {t.common.selected}
          </span>
          <button className="sms-btn sms-btn-danger sms-btn-sm" onClick={() => setShowBulkConfirm(true)}>
            <i className="fas fa-trash"></i> {t.common.deleteSelection}
          </button>
          <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => setSelected(new Set())}>
            {t.common.deselect}
          </button>
        </div>
      )}

      {/* Table card */}
      <div className="sms-card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 160px)', overflow: 'hidden' }}>
        {/* Card header */}
        <div className="sms-card-header" style={{ flexShrink: 0 }}>
          <div className="sms-card-title">
            <i className="fas fa-list"></i>
            {t.common.list} ({loading ? '…' : (totalCount ?? (serverSide ? data.length : sorted.length))})
            {hiddenCols.size > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 7px',
                background: 'var(--accent-glow)', color: 'var(--accent)',
                borderRadius: 12, border: '1px solid var(--accent)',
              }}>
                {hiddenCols.size} col. masquée{hiddenCols.size > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex gap-2" style={{ alignItems: 'center' }}>
            {/* Barre de recherche */}
            <div className="sms-search">
              <i className="fas fa-search"></i>
              <input
                type="text"
                placeholder={t.common.search}
                value={search}
                onChange={e => {
                  const val = e.target.value;
                  setSearch(val);
                  if (!serverSide) { setPage(1); return; }
                  if (onServerSearch) {
                    clearTimeout(searchTimerRef.current);
                    searchTimerRef.current = setTimeout(() => {
                      onServerPage?.(1);
                      onServerSearch(val);
                    }, 350);
                  }
                }}
              />
            </div>

            {/* P3 — bouton colonnes */}
            <div ref={colMenuRef} style={{ position: 'relative' }}>
              <button
                className="sms-btn-icon"
                onClick={() => setShowColMenu(v => !v)}
                title="Colonnes visibles"
                style={{ borderColor: showColMenu ? 'var(--accent)' : undefined }}
              >
                <i className="fas fa-table-columns" style={{ fontSize: 12 }}></i>
              </button>

              {showColMenu && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                  borderRadius: 10, boxShadow: 'var(--shadow)',
                  minWidth: 210, zIndex: 2000,
                  animation: 'slideUp .15s ease',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '10px 14px 6px',
                    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '.8px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span>Colonnes</span>
                    {hiddenCols.size > 0 && (
                      <button
                        onClick={() => setHiddenCols(new Set())}
                        style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                      >
                        Tout afficher
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: 300, overflowY: 'auto', padding: '4px 0' }}>
                    {columns.map(col => {
                      const key     = col.key ?? col.accessor;
                      const visible = !hiddenCols.has(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleCol(key)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 14px',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            textAlign: 'left',
                            color: visible ? 'var(--text-primary)' : 'var(--text-muted)',
                            fontSize: 12, fontWeight: visible ? 500 : 400,
                            transition: 'background .12s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <i
                            className={`fas fa-${visible ? 'eye' : 'eye-slash'}`}
                            style={{ fontSize: 11, width: 14, textAlign: 'center', color: visible ? 'var(--accent)' : 'var(--border-light)', flexShrink: 0 }}
                          />
                          {col.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="sms-table-wrap" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <table className="sms-table">
            <thead>
              <tr>
                {onBulkDelete && (
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer', accentColor: 'var(--green)' }}
                    />
                  </th>
                )}
                {visibleCols.map(col => (
                  <th key={col.key ?? col.accessor}>{col.label}</th>
                ))}
                <th style={{ width: 90 }}>{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {/* P4 — Skeleton loading */}
              {loading ? (
                <SkeletonRows colCount={colCount} />
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={colCount} style={{ padding: 0 }}>
                    {emptyState
                      ? <EmptyState compact {...emptyState} />
                      : <div className="sms-empty">
                          <i className="fas fa-inbox"></i>
                          <p>{t.common.noResult}</p>
                        </div>
                    }
                  </td>
                </tr>
              ) : paginated.map((row) => {
                const pk         = getPk(row);
                const isSelected = selected.has(pk);
                return (
                  <tr key={pk} style={{ background: isSelected ? 'rgba(76,175,80,.06)' : '' }}>
                    {onBulkDelete && (
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(row)}
                          style={{ cursor: 'pointer', accentColor: 'var(--green)' }}
                        />
                      </td>
                    )}
                    {visibleCols.map(col => (
                      <td key={col.key ?? col.accessor}>
                        {col.render
                          ? col.render(row)
                          : col.bold
                            ? <strong>{row[col.accessor]}</strong>
                            : (row[col.accessor] ?? <span className="text-muted">—</span>)
                        }
                      </td>
                    ))}
                    <td>
                      <div className="flex gap-2">
                        <button className="sms-btn-icon" onClick={() => openEdit(row)} title={t.common.edit}>
                          <i className="fas fa-edit"></i>
                        </button>
                        <button className="sms-btn-icon danger" onClick={() => setDelItem(row)} title={t.common.delete}>
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div style={{
          flexShrink: 0, padding: '8px 16px',
          borderTop: '1px solid var(--border)',
          boxShadow: '0 -4px 16px rgba(0,0,0,.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 8,
          background: 'var(--bg-card)', zIndex: 2, position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {serverSide
                ? `${data.length} ${t.common.of} ${totalCount ?? '?'} ${t.common.elements}`
                : perPage === 0
                  ? `${sorted.length} ${sorted.length !== 1 ? t.common.elements : t.common.element}`
                  : `${Math.min((clientSafePage-1)*PER_PAGE+1, sorted.length)}–${Math.min(clientSafePage*PER_PAGE, sorted.length)} ${t.common.of} ${sorted.length}`
              }
            </span>
            {/* Boutons perPage masqués en mode serveur (le serveur contrôle la taille) */}
            {!serverSide && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.common.perPage}</span>
                {[10, 25, 50, 0].map(n => (
                  <button
                    key={n}
                    onClick={() => { setPerPage(n); setPage(1); }}
                    style={{
                      padding: '2px 7px', fontSize: 11, borderRadius: 4, cursor: 'pointer', border: '1px solid',
                      borderColor: perPage === n ? 'var(--accent)' : 'var(--border)',
                      background:  perPage === n ? 'var(--accent-glow)' : 'transparent',
                      color:       perPage === n ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight:  perPage === n ? 700 : 400,
                      transition:  'all .15s',
                    }}
                  >{n === 0 ? t.common.all : n}</button>
                ))}
              </div>
            )}
          </div>

          {displayPages > 1 && (
            <div className="sms-pagination">
              <button className="sms-page-btn" onClick={() => goToPage(1)} disabled={displayPage===1} title={t.common.first}>
                <i className="fas fa-angle-double-left" style={{ fontSize: 10 }}></i>
              </button>
              <button className="sms-page-btn" onClick={() => goToPage(Math.max(1, displayPage-1))} disabled={displayPage===1}>
                <i className="fas fa-chevron-left" style={{ fontSize: 10 }}></i>
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '0 10px', fontWeight: 600, minWidth: 72, textAlign: 'center', lineHeight: '32px' }}>
                {displayPage} / {displayPages}
              </span>
              <button className="sms-page-btn" onClick={() => goToPage(Math.min(displayPages, displayPage+1))} disabled={displayPage===displayPages}>
                <i className="fas fa-chevron-right" style={{ fontSize: 10 }}></i>
              </button>
              <button className="sms-page-btn" onClick={() => goToPage(displayPages)} disabled={displayPage===displayPages} title={t.common.last}>
                <i className="fas fa-angle-double-right" style={{ fontSize: 10 }}></i>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Ajout / Modification */}
      {showModal && (
        <div className="sms-overlay" onClick={e => e.target===e.currentTarget && close()}>
          <div className="sms-modal">
            <div className="sms-modal-header">
              <div className="sms-modal-title">
                {editItem ? `${t.common.edit} — ${title}` : `${t.common.add} — ${title}`}
              </div>
              <button className="sms-btn-icon" onClick={close}><i className="fas fa-times"></i></button>
            </div>
            <div className="sms-modal-body">
              {renderForm({
                item: editItem,
                onClose: close,
                onSave: (formData) => {
                  if (editItem) onEdit?.({ ...editItem, ...formData });
                  else          onAdd?.(formData);
                  close();
                },
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal suppression unitaire */}
      {delItem && (
        <div className="sms-overlay" onClick={e => e.target===e.currentTarget && setDelItem(null)}>
          <div className="sms-modal" style={{ maxWidth: 400 }}>
            <div className="sms-modal-header">
              <div className="sms-modal-title" style={{ color: 'var(--danger)' }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }}></i>
                {t.common.confirm}
              </div>
            </div>
            <div className="sms-modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{t.common.confirmMsg}</p>
            </div>
            <div className="sms-modal-footer">
              <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => setDelItem(null)}>{t.common.cancel}</button>
              <button
                className="sms-btn sms-btn-danger sms-btn-sm"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try { await onDelete?.(delItem); setDelItem(null); }
                  finally { setDeleting(false); }
                }}
              >
                <i className="fas fa-trash"></i> {t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal suppression multiple */}
      {showBulkConfirm && (
        <div className="sms-overlay" onClick={e => e.target===e.currentTarget && setShowBulkConfirm(false)}>
          <div className="sms-modal" style={{ maxWidth: 420 }}>
            <div className="sms-modal-header">
              <div className="sms-modal-title" style={{ color: 'var(--danger)' }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }}></i>
                {t.common.bulkDeleteTitle}
              </div>
            </div>
            <div className="sms-modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                {t.common.bulkDeleteMsgPre} <strong>{selected.size} {t.common.elements}</strong>.{' '}
                {t.common.bulkDeleteMsgPost}
              </p>
            </div>
            <div className="sms-modal-footer">
              <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => setShowBulkConfirm(false)}>
                {t.common.cancel}
              </button>
              <button className="sms-btn sms-btn-danger sms-btn-sm" onClick={handleBulkDelete}>
                <i className="fas fa-trash"></i> {t.common.delete} {selected.size} {t.common.elements}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── FormField helper ──────────────────────────────────────────────── */
export function FormField({ label, name, type='text', value, onChange, options, required, placeholder, disabled, help, error, onBlur }) {
  const { t } = useApp();
  if (type === 'searchable') {
    return (
      <SearchableSelect
        label={label} name={name} value={value} onChange={onChange}
        options={options} required={required} placeholder={placeholder} disabled={disabled}
      />
    );
  }
  const inputStyle = error ? { borderColor: '#ef5350' } : {};
  return (
    <div className="sms-form-group">
      <label className="sms-label">
        {label}{required && <span style={{ color: 'var(--accent)' }}> *</span>}
      </label>
      {type === 'select' ? (
        <select className="sms-input" name={name} value={value} onChange={onChange} onBlur={onBlur} required={required} disabled={disabled} style={inputStyle}>
          <option value="">{t.common.select}</option>
          {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea className="sms-input" name={name} value={value} onChange={onChange} onBlur={onBlur} rows={3} placeholder={placeholder} disabled={disabled} style={inputStyle} />
      ) : (
        <input className="sms-input" type={type} name={name} value={value} onChange={onChange} onBlur={onBlur} required={required} placeholder={placeholder} disabled={disabled} style={inputStyle} />
      )}
      {help && !error && (
        <small style={{ display: 'block', marginTop: 3, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {help}
        </small>
      )}
      {error && (
        <small style={{ display: 'block', marginTop: 3, fontSize: 11, color: '#ef5350', lineHeight: 1.4 }}>
          <i className="fas fa-exclamation-circle" style={{ marginRight: 4 }}></i>{error}
        </small>
      )}
    </div>
  );
}
