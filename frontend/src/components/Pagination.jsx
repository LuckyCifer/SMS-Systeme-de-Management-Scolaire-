/**
 * components/Pagination.jsx
 * Pagination intelligente avec affichage adaptatif.
 */
import { useApp } from '../context/AppContext';

export default function Pagination({ page, pages, total, perPage, onChange }) {
  const { t } = useApp();
  if (pages <= 1) return null;

  // Calcul des pages à afficher (fenêtre glissante)
  const getPageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || (i >= page - delta && i <= page + delta)) {
        range.push(i);
      }
    }

    range.forEach(i => {
      if (l) {
        if (i - l === 2) rangeWithDots.push(l + 1);
        else if (i - l !== 1) rangeWithDots.push('...');
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  };

  const start = (page - 1) * perPage + 1;
  const end   = Math.min(page * perPage, total);

  return (
    <div style={{
      padding: '12px 20px', borderTop: '1px solid var(--border)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      flexWrap: 'wrap', gap: 10,
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {start}–{end} {t.common.of} {total}
      </span>
      <div className="sms-pagination">
        {/* Première page */}
        <button className="sms-page-btn" onClick={() => onChange(1)} disabled={page === 1} title="Première page">
          <i className="fas fa-angle-double-left" style={{ fontSize: 10 }}></i>
        </button>
        {/* Page précédente */}
        <button className="sms-page-btn" onClick={() => onChange(page - 1)} disabled={page === 1} title="Page précédente">
          <i className="fas fa-chevron-left" style={{ fontSize: 10 }}></i>
        </button>

        {/* Numéros de pages */}
        {getPageNumbers().map((p, i) =>
          p === '...'
            ? <span key={`dots-${i}`} style={{ padding: '0 4px', color: 'var(--text-muted)', fontSize: 12 }}>…</span>
            : <button key={p} className={`sms-page-btn ${p === page ? 'active' : ''}`} onClick={() => onChange(p)}>{p}</button>
        )}

        {/* Page suivante */}
        <button className="sms-page-btn" onClick={() => onChange(page + 1)} disabled={page === pages} title="Page suivante">
          <i className="fas fa-chevron-right" style={{ fontSize: 10 }}></i>
        </button>
        {/* Dernière page */}
        <button className="sms-page-btn" onClick={() => onChange(pages)} disabled={page === pages} title="Dernière page">
          <i className="fas fa-angle-double-right" style={{ fontSize: 10 }}></i>
        </button>
      </div>
    </div>
  );
}
