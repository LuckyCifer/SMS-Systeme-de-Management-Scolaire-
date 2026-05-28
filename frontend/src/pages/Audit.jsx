/**
 * pages/Audit.jsx
 * Journal d'audit — historique de toutes les actions.
 */
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { LoadingState, ErrorState } from '../components/ApiState';
import api from '../services/api';

const ACTION_BADGE_COLOR = {
  LOGIN_SUCCESS: 'badge-success',
  LOGIN_FAILED:  'badge-danger',
  CREATE:        'badge-info',
  UPDATE:        'badge-warning',
  DELETE:        'badge-danger',
  BULK_DELETE:   'badge-danger',
  EXPORT_CSV:    'badge-secondary',
  LOGOUT:        'badge-secondary',
};

export default function Audit() {
  const { t, lang, toast } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page,   setPage]   = useState(1);
  const PER_PAGE = 15;

  const { data, loading, error, reload } = useApi(
    () => api.get('/api/audit/', { params: { page_size: 200, ordering: '-date_action' } })
  );

  const logs = data || [];

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.utilisateur?.toLowerCase().includes(search.toLowerCase()) ||
      l.modele?.toLowerCase().includes(search.toLowerCase()) ||
      l.detail?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = !filter || l.action === filter;
    return matchSearch && matchFilter;
  });

  const pages     = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleExport = () => {
    window.open('/api/audit/export-csv/', '_blank');
    toast.info(t.toast.exported);
  };

  const actionLabel = (action) => t.dashboard.actions[action] || action;
  const modelLabel  = (model)  => t.dashboard.models[model]   || model;

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  const ta = t.pages.audit;

  return (
    <div>
      {/* En-tête de page */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-history text-green" style={{ marginRight: 10, fontSize: 22 }}></i>
            {ta.title}
          </h1>
          <p className="page-subtitle">
            {ta.subtitleFull.replace('{n}', filtered.length)}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={reload}>
            <i className="fas fa-sync-alt"></i> {t.common.refresh}
          </button>
          <button className="sms-btn sms-btn-primary sms-btn-sm" onClick={handleExport}>
            <i className="fas fa-download"></i> {t.common.exportCsv}
          </button>
        </div>
      </div>

      {/* Cartes stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginBottom: 20 }}>
        {[
          { label: ta.stats.logins,  count: logs.filter(l => l.action === 'LOGIN_SUCCESS').length,                              color: 'c-green',  icon: 'fas fa-sign-in-alt' },
          { label: ta.stats.creates, count: logs.filter(l => l.action === 'CREATE').length,                                     color: 'c-blue',   icon: 'fas fa-plus' },
          { label: ta.stats.updates, count: logs.filter(l => l.action === 'UPDATE').length,                                     color: 'c-orange', icon: 'fas fa-edit' },
          { label: ta.stats.deletes, count: logs.filter(l => ['DELETE', 'BULK_DELETE'].includes(l.action)).length,              color: 'c-red',    icon: 'fas fa-trash' },
        ].map(s => (
          <div className={`stat-card ${s.color}`} key={s.label}>
            <div className={`stat-icon ${s.color}`}><i className={s.icon}></i></div>
            <div>
              <div className="stat-value">{s.count}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="sms-card">
        <div className="sms-card-header">
          <div className="sms-card-title">
            <i className="fas fa-list"></i> {ta.entries.replace('{n}', filtered.length)}
          </div>
          <div className="flex gap-2">
            {/* Filtre par action */}
            <select
              className="sms-input"
              style={{ height: 36, minWidth: 160, fontSize: 12 }}
              value={filter}
              onChange={e => { setFilter(e.target.value); setPage(1); }}
            >
              <option value="">{ta.allActions}</option>
              {Object.keys(ACTION_BADGE_COLOR).map(key => (
                <option key={key} value={key}>{actionLabel(key)}</option>
              ))}
            </select>
            {/* Recherche */}
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
        </div>

        <div className="sms-table-wrap">
          <table className="sms-table">
            <thead>
              <tr>
                <th>{ta.cols.datetime}</th>
                <th>{ta.cols.user}</th>
                <th>{ta.cols.action}</th>
                <th>{ta.cols.module}</th>
                <th>{ta.cols.objectId}</th>
                <th>{ta.cols.detail}</th>
                <th>{ta.cols.ip}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    {ta.noEntries}
                  </td>
                </tr>
              ) : paginated.map((log, i) => {
                const badgeColor = ACTION_BADGE_COLOR[log.action] || 'badge-secondary';
                return (
                  <tr key={log.id || i}>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {log.date_action
                        ? new Date(log.date_action).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')
                        : '—'}
                    </td>
                    <td><strong>{log.utilisateur || '—'}</strong></td>
                    <td>
                      <span className={`sms-badge ${badgeColor}`}>{actionLabel(log.action)}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{modelLabel(log.modele) || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {log.objet_id || '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.detail || '—'}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {log.ip_address || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} / {filtered.length}
            </span>
            <div className="sms-pagination">
              <button className="sms-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <i className="fas fa-chevron-left"></i>
              </button>
              {Array.from({ length: Math.min(5, pages) }, (_, i) => i + 1).map(p => (
                <button key={p} className={`sms-page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="sms-page-btn" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
