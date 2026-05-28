/**
 * components/CrudTable.jsx
 * Tableau CRUD avec :
 * - Sélection multiple + bulk delete
 * - Bouton export CSV
 * - Filtres avancés
 * - Pagination améliorée
 */
import { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import SearchableSelect from './SearchableSelect';

export function CrudTable({
  title, subtitle, icon,
  columns, data,
  onAdd, onEdit, onDelete, onBulkDelete,
  renderForm,
  addLabel,
  exportCsvUrl,
  extraHeaderButtons,
  filters,
  sortBy,               // string field | (row) => value — default: auto (first string col)
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
  const [perPage,    setPerPage]    = useState(0);   // 0 = tout afficher (défilement infini)

  const PER_PAGE = perPage;

  const needle = search.toLowerCase();
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
  const filtered = !search.trim() ? data : data.filter(row =>
    columns.some(col => {
      const val = colVal(col, row);
      return val !== null && String(val ?? '').toLowerCase().includes(needle);
    })
  );

  // ── Tri alphabétique ─────────────────────────────────────────────────────
  const sortKey = (row) => {
    if (typeof sortBy === 'function') return sortBy(row);
    if (typeof sortBy === 'string')   return row[sortBy];
    for (const col of columns) {
      const v = colVal(col, row);
      if (v !== null && v !== undefined && typeof v === 'string' && v !== '') return v;
    }
    return '';
  };
  const sorted = [...filtered].sort((a, b) => {
    const va = String(sortKey(a) ?? '');
    const vb = String(sortKey(b) ?? '');
    return va.localeCompare(vb, 'fr', { sensitivity: 'base' });
  });

  const pages      = perPage === 0 ? 1 : Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const safePage   = Math.min(page, pages);
  const paginated  = perPage === 0 ? sorted : sorted.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const openAdd  = () => { setEditItem(null); setShowModal(true); };
  const openEdit = (item) => { setEditItem(item); setShowModal(true); };
  const close    = () => { setShowModal(false); setEditItem(null); };

  // ── Sélection multiple ────────────────────────────────────────────────────
  const getPk = (row) => row.id ?? row.mle_etudiant ?? row.mle_ens ??
    row.code_classe ?? row.login ?? row.code_inscription ??
    row.code_paiement ?? row.code_eval ?? JSON.stringify(row);

  const toggleSelect = (row) => {
    const pk = getPk(row);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk);
      else next.add(pk);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === paginated.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paginated.map(getPk)));
    }
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

  // ── Export CSV ────────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    if (exportCsvUrl) {
      // Récupère le token pour l'export
      const token = localStorage.getItem('sms_access');
      // Ouvre dans un nouvel onglet avec le token dans l'URL
      const url = `http://localhost:8000${exportCsvUrl}`;
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.blob())
        .then(blob => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = exportCsvUrl.split('/').filter(Boolean).pop() + '.csv';
          a.click();
          toast.success(t.toast.exported);
        })
        .catch(() => toast.error(t.toast.error));
    }
  };

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className={`${icon} text-green`} style={{ marginRight:10, fontSize:22 }}></i>
            {title}
          </h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        <div className="flex gap-2" style={{ flexWrap:'wrap' }}>
          {extraHeaderButtons}
          {exportCsvUrl && (
            <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={handleExportCsv}>
              <i className="fas fa-file-csv"></i> Export CSV
            </button>
          )}
          <button className="sms-btn sms-btn-primary" onClick={openAdd}>
            <i className="fas fa-plus"></i> {addLabel || t.common.add}
          </button>
        </div>
      </div>

      {/* Filtres additionnels */}
      {filters && <div style={{ marginBottom:16 }}>{filters}</div>}

      {/* Bulk actions */}
      {selected.size > 0 && onBulkDelete && (
        <div style={{
          display:'flex', alignItems:'center', gap:12, padding:'10px 16px',
          background:'rgba(239,83,80,.08)', border:'1px solid rgba(239,83,80,.2)',
          borderRadius:8, marginBottom:12,
        }}>
          <i className="fas fa-check-square" style={{ color:'var(--danger)' }}></i>
          <span style={{ fontSize:13, color:'var(--text-primary)', fontWeight:600 }}>
            {selected.size} {t.common.elements} {t.common.selected}
          </span>
          <button
            className="sms-btn sms-btn-danger sms-btn-sm"
            onClick={() => setShowBulkConfirm(true)}
          >
            <i className="fas fa-trash"></i> {t.common.deleteSelection}
          </button>
          <button
            className="sms-btn sms-btn-outline sms-btn-sm"
            onClick={() => setSelected(new Set())}
          >
            {t.common.deselect}
          </button>
        </div>
      )}

      {/* Table card */}
      <div className="sms-card" style={{ display:'flex', flexDirection:'column', maxHeight:'calc(100vh - 220px)', overflow:'hidden' }}>
        <div className="sms-card-header" style={{ flexShrink:0 }}>
          <div className="sms-card-title">
            <i className="fas fa-list"></i> {t.common.list} ({sorted.length})
          </div>
          <div className="sms-search">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder={t.common.search}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <div className="sms-table-wrap" style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
          <table className="sms-table">
            <thead>
              <tr>
                {onBulkDelete && (
                  <th style={{ width:40, position:'sticky', top:0, zIndex:3, background:'var(--bg-card)' }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      style={{ cursor:'pointer', accentColor:'var(--green)' }}
                    />
                  </th>
                )}
                {columns.map(col => <th key={col.key || col.accessor} style={{ position:'sticky', top:0, zIndex:3, background:'var(--bg-card)' }}>{col.label}</th>)}
                <th style={{ width:90, position:'sticky', top:0, zIndex:3, background:'var(--bg-card)' }}>{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (onBulkDelete ? 2 : 1)}>
                    <div className="sms-empty">
                      <i className="fas fa-inbox"></i>
                      <p>{t.common.noResult}</p>
                    </div>
                  </td>
                </tr>
              ) : paginated.map((row, i) => {
                const pk = getPk(row);
                const isSelected = selected.has(pk);
                return (
                  <tr key={pk} style={{ background: isSelected ? 'rgba(76,175,80,.05)' : '' }}>
                    {onBulkDelete && (
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(row)}
                          style={{ cursor:'pointer', accentColor:'var(--green)' }}
                        />
                      </td>
                    )}
                    {columns.map(col => (
                      <td key={col.key || col.accessor}>
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

        {/* Footer toujours visible — contenu défile derrière */}
        <div style={{ flexShrink:0, padding:'8px 16px', borderTop:'1px solid var(--border)', boxShadow:'0 -4px 16px rgba(0,0,0,.10)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8, background:'var(--bg-card)', zIndex:2, position:'relative' }}>
            {/* Compteur + sélecteur par page */}
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>
                {perPage === 0
                  ? `${sorted.length} ${sorted.length !== 1 ? t.common.elements : t.common.element}`
                  : `${Math.min((safePage-1)*PER_PAGE+1, sorted.length)}–${Math.min(safePage*PER_PAGE, sorted.length)} ${t.common.of} ${sorted.length}`
                }
              </span>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>{t.common.perPage}</span>
                {[10, 25, 50, 0].map(n => (
                  <button
                    key={n}
                    onClick={() => { setPerPage(n); setPage(1); }}
                    style={{
                      padding:'2px 7px', fontSize:11, borderRadius:4, cursor:'pointer', border:'1px solid',
                      borderColor: perPage === n ? 'var(--green)' : 'var(--border)',
                      background:  perPage === n ? 'var(--green-glow)' : 'transparent',
                      color:       perPage === n ? 'var(--green)' : 'var(--text-muted)',
                      fontWeight:  perPage === n ? 700 : 400,
                    }}
                  >{n === 0 ? t.common.all : n}</button>
                ))}
              </div>
            </div>

            {/* Numéros de page */}
            {perPage !== 0 && pages > 1 && (() => {
              const maxBtn = 5;
              const half   = Math.floor(maxBtn / 2);
              let start    = Math.max(1, safePage - half);
              let end      = Math.min(pages, start + maxBtn - 1);
              if (end - start < maxBtn - 1) start = Math.max(1, end - maxBtn + 1);
              const nums = Array.from({ length: end - start + 1 }, (_, i) => start + i);
              return (
                <div className="sms-pagination">
                  <button className="sms-page-btn" onClick={() => setPage(1)} disabled={safePage===1} title={t.common.first}>
                    <i className="fas fa-angle-double-left" style={{ fontSize:10 }}></i>
                  </button>
                  <button className="sms-page-btn" onClick={() => setPage(p => Math.max(1,p-1))} disabled={safePage===1}>
                    <i className="fas fa-chevron-left" style={{ fontSize:10 }}></i>
                  </button>
                  {start > 1 && <span style={{ fontSize:12, color:'var(--text-muted)', padding:'0 2px' }}>…</span>}
                  {nums.map(p => (
                    <button key={p} className={`sms-page-btn ${p===safePage?'active':''}`} onClick={() => setPage(p)}>{p}</button>
                  ))}
                  {end < pages && <span style={{ fontSize:12, color:'var(--text-muted)', padding:'0 2px' }}>…</span>}
                  <button className="sms-page-btn" onClick={() => setPage(p => Math.min(pages,p+1))} disabled={safePage===pages}>
                    <i className="fas fa-chevron-right" style={{ fontSize:10 }}></i>
                  </button>
                  <button className="sms-page-btn" onClick={() => setPage(pages)} disabled={safePage===pages} title={t.common.last}>
                    <i className="fas fa-angle-double-right" style={{ fontSize:10 }}></i>
                  </button>
                </div>
              );
            })()}
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
          <div className="sms-modal" style={{ maxWidth:400 }}>
            <div className="sms-modal-header">
              <div className="sms-modal-title" style={{ color:'var(--danger)' }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight:8 }}></i>
                {t.common.confirm}
              </div>
            </div>
            <div className="sms-modal-body">
              <p style={{ color:'var(--text-secondary)', fontSize:13 }}>{t.common.confirmMsg}</p>
            </div>
            <div className="sms-modal-footer">
              <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => setDelItem(null)}>{t.common.cancel}</button>
              <button className="sms-btn sms-btn-danger sms-btn-sm" disabled={deleting} onClick={async () => { setDeleting(true); try { await onDelete?.(delItem); setDelItem(null); } finally { setDeleting(false); } }}>
                <i className="fas fa-trash"></i> {t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal suppression multiple */}
      {showBulkConfirm && (
        <div className="sms-overlay" onClick={e => e.target===e.currentTarget && setShowBulkConfirm(false)}>
          <div className="sms-modal" style={{ maxWidth:420 }}>
            <div className="sms-modal-header">
              <div className="sms-modal-title" style={{ color:'var(--danger)' }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight:8 }}></i>
                {t.common.bulkDeleteTitle}
              </div>
            </div>
            <div className="sms-modal-body">
              <p style={{ color:'var(--text-secondary)', fontSize:13 }}>
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

/* ── FormField helper ──────────────────────────────────────── */
export function FormField({ label, name, type='text', value, onChange, options, required, placeholder, disabled }) {
  const { t } = useApp();
  if (type === 'searchable') {
    return (
      <SearchableSelect
        label={label} name={name} value={value} onChange={onChange}
        options={options} required={required} placeholder={placeholder} disabled={disabled}
      />
    );
  }
  return (
    <div className="sms-form-group">
      <label className="sms-label">
        {label}{required && <span style={{ color:'var(--green)' }}> *</span>}
      </label>
      {type === 'select' ? (
        <select className="sms-input" name={name} value={value} onChange={onChange} required={required} disabled={disabled}>
          <option value="">{t.common.select}</option>
          {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea className="sms-input" name={name} value={value} onChange={onChange} rows={3} placeholder={placeholder} disabled={disabled} />
      ) : (
        <input className="sms-input" type={type} name={name} value={value} onChange={onChange} required={required} placeholder={placeholder} disabled={disabled} />
      )}
    </div>
  );
}
