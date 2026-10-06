/**
 * pages/Audit.jsx
 * Journal d'audit — historique de toutes les actions.
 * Stats côté serveur + liste scrollable (pas de pagination numérotée).
 */
import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { LoadingState, ErrorState } from '../components/ApiState';
import EmptyState from '../components/EmptyState';
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
  const [search,       setSearch]       = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [statsData,    setStatsData]    = useState(null);

  // Stats globales côté serveur
  useEffect(() => {
    api.get('/api/audit/stats/').then(r => setStatsData(r.data)).catch(() => {});
  }, []);

  const { data, loading, error, reload } = useApi(
    () => api.get('/api/audit/', { params: { page_size: 500, ordering: '-date_action' } })
  );

  const logs = data || [];

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.utilisateur?.toLowerCase().includes(search.toLowerCase()) ||
      l.modele?.toLowerCase().includes(search.toLowerCase()) ||
      l.detail?.toLowerCase().includes(search.toLowerCase()) ||
      l.objet_id?.toLowerCase?.().includes(search.toLowerCase());
    const matchFilter = !actionFilter || l.action === actionFilter;
    return matchSearch && matchFilter;
  });

  const handleExport = () => {
    const token = localStorage.getItem('sms_access');
    fetch('http://localhost:8000/api/audit/export-csv/', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'audit_log.csv';
        a.click();
        toast.success(t.toast.exported);
      })
      .catch(() => toast.error(t.toast.error));
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
          <button className="sms-btn sms-btn-primary sms-btn-sm" onClick={handleExport}>
            <i className="fas fa-download"></i> {t.common.exportCsv}
          </button>
        </div>
      </div>

      {/* Cartes stats (totaux serveur) */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginBottom: 20 }}>
        {[
          { label: ta.stats.logins,  count: statsData?.nb_logins  ?? logs.filter(l => l.action === 'LOGIN_SUCCESS').length,               color: 'c-green',  icon: 'fas fa-sign-in-alt' },
          { label: ta.stats.creates, count: statsData?.nb_creates ?? logs.filter(l => l.action === 'CREATE').length,                      color: 'c-blue',   icon: 'fas fa-plus' },
          { label: ta.stats.updates, count: statsData?.nb_updates ?? logs.filter(l => l.action === 'UPDATE').length,                      color: 'c-orange', icon: 'fas fa-edit' },
          { label: ta.stats.deletes, count: statsData?.nb_deletes ?? logs.filter(l => ['DELETE', 'BULK_DELETE'].includes(l.action)).length, color: 'c-red',    icon: 'fas fa-trash' },
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

      <div className="sms-card" style={{ display:'flex', flexDirection:'column', maxHeight:'calc(100vh - 260px)', overflow:'hidden' }}>
        <div className="sms-card-header" style={{ flexShrink:0 }}>
          <div className="sms-card-title">
            <i className="fas fa-list"></i> {ta.entries.replace('{n}', filtered.length)}
          </div>
          <div className="flex gap-2">
            <select
              className="sms-input"
              style={{ height: 36, minWidth: 160, fontSize: 12 }}
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
            >
              <option value="">{ta.allActions}</option>
              {Object.keys(ACTION_BADGE_COLOR).map(key => (
                <option key={key} value={key}>{actionLabel(key)}</option>
              ))}
            </select>
            <div className="sms-search">
              <i className="fas fa-search"></i>
              <input
                type="text"
                placeholder={t.common.search}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="sms-table-wrap" style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
          <table className="sms-table">
            <thead>
              <tr>
                <th style={{ position:'sticky', top:0, zIndex:3, background:'var(--bg-card)' }}>{ta.cols.datetime}</th>
                <th style={{ position:'sticky', top:0, zIndex:3, background:'var(--bg-card)' }}>{ta.cols.user}</th>
                <th style={{ position:'sticky', top:0, zIndex:3, background:'var(--bg-card)' }}>{ta.cols.action}</th>
                <th style={{ position:'sticky', top:0, zIndex:3, background:'var(--bg-card)' }}>{ta.cols.module}</th>
                <th style={{ position:'sticky', top:0, zIndex:3, background:'var(--bg-card)' }}>{ta.cols.objectId}</th>
                <th style={{ position:'sticky', top:0, zIndex:3, background:'var(--bg-card)' }}>{ta.cols.detail}</th>
                <th style={{ position:'sticky', top:0, zIndex:3, background:'var(--bg-card)' }}>{ta.cols.ip}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 0 }}>
                    <EmptyState
                      icon="fas fa-history"
                      title={ta.noEntries}
                      subtitle={search || actionFilter ? "Essayez d'affiner votre recherche ou vos filtres." : undefined}
                      compact
                    />
                  </td>
                </tr>
              ) : filtered.map((log, i) => {
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

        {/* Footer — compteur sticky */}
        <div style={{ flexShrink:0, padding:'8px 16px', borderTop:'1px solid var(--border)', boxShadow:'0 -4px 16px rgba(0,0,0,.10)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg-card)', zIndex:2, position:'relative' }}>
          <span style={{ fontSize:12, color:'var(--text-muted)' }}>
            {filtered.length} {filtered.length !== 1 ? t.common.elements : t.common.element}
          </span>
          <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={reload}>
            <i className="fas fa-sync-alt"></i> {t.common.refresh}
          </button>
        </div>
      </div>
    </div>
  );
}
