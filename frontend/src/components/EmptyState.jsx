/**
 * components/EmptyState.jsx
 * État vide enrichi avec illustration SVG et action.
 */
import { useApp } from '../context/AppContext';

const ILLUSTRATIONS = {
  students: (
    <svg viewBox="0 0 120 100" width="110" height="90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="35" r="20" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" opacity=".3"/>
      <circle cx="60" cy="30" r="10" fill="currentColor" opacity=".15"/>
      <rect x="30" y="58" width="60" height="30" rx="6" fill="currentColor" opacity=".08" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2"/>
      <line x1="42" y1="70" x2="78" y2="70" stroke="currentColor" strokeWidth="1.5" opacity=".3"/>
      <line x1="42" y1="78" x2="65" y2="78" stroke="currentColor" strokeWidth="1.5" opacity=".2"/>
    </svg>
  ),
  default: (
    <svg viewBox="0 0 120 100" width="110" height="90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="20" width="80" height="60" rx="8" stroke="currentColor" strokeWidth="2" strokeDasharray="5 3" opacity=".25"/>
      <line x1="35" y1="40" x2="85" y2="40" stroke="currentColor" strokeWidth="1.5" opacity=".2"/>
      <line x1="35" y1="52" x2="70" y2="52" stroke="currentColor" strokeWidth="1.5" opacity=".15"/>
      <line x1="35" y1="64" x2="60" y2="64" stroke="currentColor" strokeWidth="1.5" opacity=".1"/>
      <circle cx="60" cy="50" r="18" fill="currentColor" opacity=".04"/>
    </svg>
  ),
};

export default function EmptyState({ type = 'default', message, onAdd, addLabel }) {
  const { t } = useApp();
  const illus = ILLUSTRATIONS[type] || ILLUSTRATIONS.default;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '52px 24px', gap: 14, textAlign: 'center',
    }}>
      <div style={{ color: 'var(--green)', opacity: .5 }}>
        {illus}
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>
        {message || t.common.noResult}
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: 12, maxWidth: 280 }}>
        Aucun élément à afficher pour le moment.
      </p>
      {onAdd && (
        <button className="sms-btn sms-btn-primary sms-btn-sm" onClick={onAdd} style={{ marginTop: 6 }}>
          <i className="fas fa-plus"></i> {addLabel || t.common.add}
        </button>
      )}
    </div>
  );
}
