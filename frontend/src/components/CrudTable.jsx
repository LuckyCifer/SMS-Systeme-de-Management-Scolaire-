/**
 * components/CrudTable.jsx
 * Tableau CRUD avec :
 * - Sélection multiple + bulk delete
 * - Export CSV/Excel
 * - Filtres avancés
 * - Défilement infini dans un cadre de hauteur fixe (plus de boutons de page) :
 *   mode client → les lignes s'affichent par tranches au fil du défilement ;
 *   mode serveur → onServerPage(n) demande les n premières tranches (la page parente
 *   charge page_size = taille × n, page 1), si bien qu'un rechargement après
 *   ajout / modification / suppression renvoie toujours des lignes à jour.
 * - Colonnes masquables (P3)
 * - Skeleton loading (P4)
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import SearchableSelect from './SearchableSelect';
import EmptyState from './EmptyState';

// Recherche insensible à la casse et aux accents (« eleve » trouve « Élève »).
const sansAccents = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Texte visible d'une cellule rendue en JSX : chaînes et nombres des enfants, plus les
// props textuelles usuelles (label, title) des composants. Sert à la recherche.
function texteAffiche(noeud) {
  if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return '';
  if (typeof noeud === 'string' || typeof noeud === 'number') return String(noeud);
  if (Array.isArray(noeud)) return noeud.map(texteAffiche).join(' ');
  if (typeof noeud === 'object' && noeud.props) {
    const { children, label, title } = noeud.props;
    return [texteAffiche(children),
            typeof label === 'string' ? label : '',
            typeof title === 'string' ? title : ''].filter(Boolean).join(' ');
  }
  return '';
}

// Mode client : lignes ajoutées à chaque fois qu'on atteint le bas du tableau.
const TRANCHE_CLIENT = 50;

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
  rowKey        = null,   // champ identifiant imposé (sinon : premier champ unique trouvé)
}) {
  const { t, toast } = useApp();
  const [search,     setSearch]     = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [editItem,   setEditItem]   = useState(null);
  const [delItem,    setDelItem]    = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [selected,   setSelected]   = useState(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  // Mode client : nombre de lignes affichées, augmenté au fil du défilement.
  const [visibleCount, setVisibleCount] = useState(TRANCHE_CLIENT);
  const wrapRef        = useRef(null);
  const attenteRef     = useRef(false); // tranche serveur demandée, pas encore reçue
  const prevPageRef    = useRef(serverPage);
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

  const needle   = sansAccents(search.trim());

  const colVal = (col, row) => {
    if (col.searchValue) return col.searchValue(row);
    if (col.accessor)    return row[col.accessor];
    if (col.render) {
      try {
        // Le texte affiché, même quand la cellule est du JSX (badge, lien, montant…).
        const v = texteAffiche(col.render(row));
        if (v) return v;
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
          return val !== null && sansAccents(String(val ?? '')).includes(needle);
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

  // Lignes affichées : tout ce que le serveur a envoyé, ou les premières lignes en mode client.
  const paginated = serverSide ? sorted : sorted.slice(0, visibleCount);
  const resteAAfficher = serverSide ? serverPage < serverPages : visibleCount < sorted.length;

  // Nouvelle recherche côté client : on repart du haut.
  useEffect(() => {
    if (serverSide) return;
    setVisibleCount(TRANCHE_CLIENT);
    if (wrapRef.current) wrapRef.current.scrollTop = 0;
  }, [search, serverSide]);

  // Mode serveur : retour à la première tranche (filtre, recherche) → on repart du haut.
  useEffect(() => {
    if (serverSide && serverPage === 1 && prevPageRef.current > 1 && wrapRef.current) wrapRef.current.scrollTop = 0;
    prevPageRef.current = serverPage;
  }, [serverSide, serverPage]);

  const chargerSuite = useCallback(() => {
    if (loading || !resteAAfficher) return;
    if (serverSide) {
      if (attenteRef.current) return;
      attenteRef.current = true;
      onServerPage?.(serverPage + 1);
    } else {
      setVisibleCount(n => n + TRANCHE_CLIENT);
    }
  }, [loading, resteAAfficher, serverSide, serverPage, onServerPage]);

  // Une nouvelle tranche est arrivée : on autorise la demande suivante.
  useEffect(() => { attenteRef.current = false; }, [data]);

  const surDefilement = e => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) chargerSuite();
  };

  // Si les lignes affichées ne remplissent pas le cadre, il n'y a pas de barre de
  // défilement : on charge la suite tout de suite.
  useEffect(() => {
    const el = wrapRef.current;
    if (el && !loading && resteAAfficher && el.scrollHeight <= el.clientHeight + 4) chargerSuite();
  }, [paginated.length, loading, resteAAfficher, chargerSuite]);

  const openAdd  = () => { setEditItem(null); setShowModal(true); };
  const openEdit = (item) => { setEditItem(item); setShowModal(true); };
  const close    = () => { setShowModal(false); setEditItem(null); };

  // Identifiant de ligne : le premier champ candidat présent sur toutes les lignes ET unique
  // parmi elles. Un champ partagé (code_classe des fiches d'une même classe, mle_etudiant des
  // paiements d'un même élève) donnerait des clés React en double : des lignes périmées
  // restent alors affichées après une recherche, et la sélection multiple se trompe.
  const champPk = useMemo(() => {
    const lignes = data || [];
    if (!lignes.length) return null;
    const presents = Object.keys(lignes[0]);
    const candidats = [rowKey, 'id', 'mle_etudiant', 'mle_ens', 'login',
                       ...presents.filter(k => /^code_/.test(k) && k !== 'code_classe'), 'code_classe']
      .filter(Boolean);
    return candidats.find(k => {
      const vus = new Set();
      return lignes.every(r => {
        const v = r[k];
        if (v === null || v === undefined || typeof v === 'object' || vus.has(v)) return false;
        vus.add(v);
        return true;
      });
    }) || null;
  }, [data, rowKey]);
  const getPk = (row) => (champPk ? row[champPk] : JSON.stringify(row));

  const toggleSelect = (row) => {
    const pk = getPk(row);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk); else next.add(pk);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === sorted.length) setSelected(new Set());
    else setSelected(new Set(sorted.map(getPk)));
  };

  const allSelected = sorted.length > 0 && selected.size === sorted.length;

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
                  if (!serverSide) return;
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
        <div className="sms-table-wrap" ref={wrapRef} onScroll={surDefilement}
          style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', maxHeight: 'none' }}>
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
              {!loading && resteAAfficher && paginated.length > 0 && (
                <tr>
                  <td colSpan={colCount} style={{ textAlign: 'center', padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>
                    <div className="sms-spinner" style={{ width: 12, height: 12, display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }}></div>
                    {t.common.loadingMore}
                  </td>
                </tr>
              )}
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
                ? `${data.length} ${t.common.of} ${totalCount ?? data.length} ${t.common.elements}`
                : `${paginated.length} ${t.common.of} ${sorted.length} ${sorted.length !== 1 ? t.common.elements : t.common.element}`
              }
            </span>
          </div>
          {resteAAfficher && !loading && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              <i className="fas fa-arrow-down" style={{ marginRight: 5 }}></i>
              {t.common.scrollForMore}
            </span>
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
