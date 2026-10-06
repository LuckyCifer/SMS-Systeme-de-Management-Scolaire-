/**
 * components/ImportRapport.jsx — Affiche le rapport d'un import CSV.
 * Props:
 *   result : objet retourné par /api/import-csv/<entity>/
 *   t      : t.pages.importCsv (i18n)
 */
import { useState } from 'react';

export default function ImportRapport({ result, t }) {
  const [tab, setTab] = useState('errors');
  if (!result) return null;

  const { total = 0, success = 0, created = 0, updated = 0, errors = [], warnings = [], dry_run } = result;
  const hasErrors   = errors.length   > 0;
  const hasWarnings = warnings.length > 0;

  const statItems = [
    { label: t.total,    value: total,    bg: '#E3F2FD', fg: '#1F3864', icon: 'fas fa-list' },
    { label: t.created,  value: created,  bg: '#E8F5E9', fg: '#1A6B3C', icon: 'fas fa-plus-circle' },
    { label: t.updated,  value: updated,  bg: '#FFF8E1', fg: '#E65100', icon: 'fas fa-pencil-alt' },
    { label: t.errors,   value: errors.length,   bg: errors.length   ? '#FFEBEE' : '#E8F5E9', fg: errors.length   ? '#C62828' : '#1A6B3C', icon: 'fas fa-times-circle' },
    { label: t.warnings, value: warnings.length, bg: warnings.length ? '#FFF3E0' : '#E8F5E9', fg: warnings.length ? '#E65100' : '#1A6B3C', icon: 'fas fa-exclamation-triangle' },
  ];

  return (
    <div>
      {/* Bandeau statut */}
      {dry_run ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 8, background: '#E3F2FD', border: '1px solid #90CAF9', marginBottom: 20 }}>
          <i className="fas fa-flask" style={{ color: '#1F3864', fontSize: 18 }}></i>
          <span style={{ fontWeight: 700, color: '#1F3864', fontSize: 14 }}>{t.successDry}</span>
        </div>
      ) : !hasErrors ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 8, background: '#E8F5E9', border: '1px solid #A5D6A7', marginBottom: 20 }}>
          <i className="fas fa-check-circle" style={{ color: '#1A6B3C', fontSize: 18 }}></i>
          <span style={{ fontWeight: 700, color: '#1A6B3C', fontSize: 14 }}>{t.successImport}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 8, background: '#FFEBEE', border: '1px solid #EF9A9A', marginBottom: 20 }}>
          <i className="fas fa-exclamation-circle" style={{ color: '#C62828', fontSize: 18 }}></i>
          <span style={{ fontWeight: 700, color: '#C62828', fontSize: 14 }}>
            {errors.length} erreur(s) — {success > 0 ? `${success} ligne(s) valide(s)` : 'aucune donnée importée'}
          </span>
        </div>
      )}

      {/* Compteurs */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {statItems.map(s => (
          <div key={s.label} style={{ flex: '1 1 100px', minWidth: 100, padding: '12px 14px', borderRadius: 8, background: s.bg, textAlign: 'center' }}>
            <i className={s.icon} style={{ color: s.fg, fontSize: 18, display: 'block', marginBottom: 4 }}></i>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.fg, lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: s.fg, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Onglets erreurs / avertissements */}
      {(hasErrors || hasWarnings) && (
        <div>
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 12 }}>
            {hasErrors && (
              <button
                onClick={() => setTab('errors')}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  padding: '8px 18px', fontSize: 13, fontWeight: 600,
                  color: tab === 'errors' ? '#C62828' : 'var(--text-muted)',
                  borderBottom: `2px solid ${tab === 'errors' ? '#C62828' : 'transparent'}`,
                  marginBottom: -2,
                }}
              >
                <i className="fas fa-times-circle" style={{ marginRight: 6 }}></i>
                {t.tabErrors} ({errors.length})
              </button>
            )}
            {hasWarnings && (
              <button
                onClick={() => setTab('warnings')}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  padding: '8px 18px', fontSize: 13, fontWeight: 600,
                  color: tab === 'warnings' ? '#E65100' : 'var(--text-muted)',
                  borderBottom: `2px solid ${tab === 'warnings' ? '#E65100' : 'transparent'}`,
                  marginBottom: -2,
                }}
              >
                <i className="fas fa-exclamation-triangle" style={{ marginRight: 6 }}></i>
                {t.tabWarnings} ({warnings.length})
              </button>
            )}
          </div>

          {tab === 'errors' && (
            <div className="sms-table-wrap" style={{ maxHeight: 340, overflowY: 'auto' }}>
              <table className="sms-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', width: 70 }}>{t.colLine}</th>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', width: 200 }}>{t.colData}</th>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--bg-card)' }}>{t.colMessage}</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.length === 0 ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: '#1A6B3C', padding: 16 }}>
                      <i className="fas fa-check-circle" style={{ marginRight: 6 }}></i>{t.noErrors}
                    </td></tr>
                  ) : errors.map((e, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: e.line === 0 ? 'var(--text-muted)' : '#C62828' }}>
                        {e.line === 0 ? '—' : e.line}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.data || '—'}
                      </td>
                      <td style={{ color: '#C62828' }}>{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'warnings' && (
            <div className="sms-table-wrap" style={{ maxHeight: 340, overflowY: 'auto' }}>
              <table className="sms-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', width: 70 }}>{t.colLine}</th>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--bg-card)' }}>{t.colMessage}</th>
                  </tr>
                </thead>
                <tbody>
                  {warnings.length === 0 ? (
                    <tr><td colSpan={2} style={{ textAlign: 'center', color: '#1A6B3C', padding: 16 }}>
                      <i className="fas fa-check-circle" style={{ marginRight: 6 }}></i>{t.noWarnings}
                    </td></tr>
                  ) : warnings.map((w, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#E65100' }}>
                        {w.line || '—'}
                      </td>
                      <td style={{ color: '#E65100' }}>{w.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
