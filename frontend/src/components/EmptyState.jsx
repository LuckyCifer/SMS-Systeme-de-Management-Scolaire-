/**
 * components/EmptyState.jsx
 * État vide illustré avec SVG inline (P5)
 */
import { useApp } from '../context/AppContext';

// SVG illustrations légères par type
const SVG_ILLUSTRATIONS = {
  students: (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="30" width="100" height="42" rx="6" fill="currentColor" opacity=".06"/>
      <circle cx="35" cy="28" r="14" fill="currentColor" opacity=".12"/>
      <circle cx="35" cy="22" r="6" fill="currentColor" opacity=".25"/>
      <path d="M22 42c0-7.18 5.82-13 13-13s13 5.82 13 13" fill="currentColor" opacity=".18"/>
      <rect x="56" y="33" width="44" height="5" rx="2.5" fill="currentColor" opacity=".12"/>
      <rect x="56" y="43" width="32" height="5" rx="2.5" fill="currentColor" opacity=".08"/>
      <rect x="56" y="53" width="38" height="5" rx="2.5" fill="currentColor" opacity=".08"/>
      <circle cx="85" cy="18" r="10" fill="currentColor" opacity=".08"/>
      <path d="M78 34a7 7 0 0114 0" fill="currentColor" opacity=".08"/>
    </svg>
  ),
  teachers: (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="15" width="85" height="55" rx="5" fill="currentColor" opacity=".06"/>
      <rect x="5" y="15" width="85" height="12" rx="5" fill="currentColor" opacity=".10"/>
      <rect x="14" y="35" width="30" height="3" rx="1.5" fill="currentColor" opacity=".15"/>
      <rect x="14" y="42" width="50" height="3" rx="1.5" fill="currentColor" opacity=".10"/>
      <rect x="14" y="49" width="40" height="3" rx="1.5" fill="currentColor" opacity=".10"/>
      <circle cx="95" cy="30" r="16" fill="currentColor" opacity=".08"/>
      <circle cx="95" cy="24" r="7" fill="currentColor" opacity=".20"/>
      <path d="M80 46c0-8.28 6.72-15 15-15s15 6.72 15 15" fill="currentColor" opacity=".12"/>
    </svg>
  ),
  default: (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="20" width="90" height="50" rx="6" fill="currentColor" opacity=".06"/>
      <rect x="15" y="20" width="90" height="14" rx="6" fill="currentColor" opacity=".10"/>
      <rect x="25" y="42" width="55" height="4" rx="2" fill="currentColor" opacity=".12"/>
      <rect x="25" y="52" width="40" height="4" rx="2" fill="currentColor" opacity=".08"/>
      <circle cx="93" cy="27" r="4" fill="currentColor" opacity=".20"/>
      <path d="M55 36l5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".20"/>
      <path d="M60 31v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".20"/>
    </svg>
  ),
  payments: (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="22" width="100" height="42" rx="8" fill="currentColor" opacity=".06"/>
      <rect x="10" y="22" width="100" height="16" rx="8" fill="currentColor" opacity=".10"/>
      <rect x="18" y="47" width="24" height="8" rx="3" fill="currentColor" opacity=".15"/>
      <rect x="50" y="47" width="16" height="8" rx="3" fill="currentColor" opacity=".10"/>
      <rect x="74" y="47" width="28" height="8" rx="3" fill="currentColor" opacity=".10"/>
      <circle cx="60" cy="30" r="5" fill="currentColor" opacity=".22"/>
    </svg>
  ),
  audit: (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="12" width="64" height="60" rx="5" fill="currentColor" opacity=".06"/>
      <rect x="28" y="24" width="48" height="3" rx="1.5" fill="currentColor" opacity=".15"/>
      <rect x="28" y="32" width="36" height="3" rx="1.5" fill="currentColor" opacity=".10"/>
      <rect x="28" y="40" width="42" height="3" rx="1.5" fill="currentColor" opacity=".10"/>
      <rect x="28" y="48" width="30" height="3" rx="1.5" fill="currentColor" opacity=".08"/>
      <circle cx="28" cy="25.5" r="2" fill="currentColor" opacity=".30"/>
      <circle cx="28" cy="33.5" r="2" fill="currentColor" opacity=".22"/>
      <circle cx="28" cy="41.5" r="2" fill="currentColor" opacity=".18"/>
      <circle cx="28" cy="49.5" r="2" fill="currentColor" opacity=".14"/>
      <circle cx="88" cy="52" r="16" fill="currentColor" opacity=".08"/>
      <path d="M82 52l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".25"/>
    </svg>
  ),
  search: (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="38" r="22" fill="currentColor" opacity=".07"/>
      <circle cx="50" cy="38" r="14" fill="currentColor" opacity=".10"/>
      <line x1="64" y1="52" x2="80" y2="68" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity=".14"/>
      <circle cx="50" cy="38" r="8" fill="none" stroke="currentColor" strokeWidth="2" opacity=".20"/>
    </svg>
  ),
};

const TYPE_SVG = {
  students:  'students',
  teachers:  'teachers',
  payments:  'payments',
  invoices:  'payments',
  audit:     'audit',
  search:    'search',
};

export default function EmptyState({
  icon, title, subtitle, action, onAction, actionIcon = 'fas fa-plus', compact = false,
  // Compat API
  type = 'default', message, onAdd, addLabel,
  svgType,
}) {
  const { t } = useApp();

  const resolvedTitle    = title    || message  || t.common.noResult;
  const resolvedSubtitle = subtitle;
  const resolvedAction   = action   || addLabel;
  const resolvedOnAction = onAction || onAdd;
  const resolvedSvgType  = svgType || TYPE_SVG[type] || 'default';

  const illustration = SVG_ILLUSTRATIONS[resolvedSvgType] || SVG_ILLUSTRATIONS.default;

  if (compact) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '28px 16px', textAlign: 'center', gap: 8,
      }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--bg-darkest)', border: '1.5px dashed var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <i className={icon || 'fas fa-inbox'} style={{ fontSize: 20, color: 'var(--text-muted)', opacity: .5 }} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{resolvedTitle}</div>
        {resolvedSubtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 300, lineHeight: 1.5 }}>{resolvedSubtitle}</div>}
        {resolvedAction && resolvedOnAction && (
          <button className="sms-btn sms-btn-primary sms-btn-sm" style={{ marginTop: 6 }} onClick={resolvedOnAction}>
            <i className={actionIcon} /> {resolvedAction}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '52px 24px', textAlign: 'center', gap: 16,
    }}>
      {/* Illustration SVG */}
      <div style={{
        width: 180, height: 120,
        color: 'var(--accent)',
        opacity: .75,
        marginBottom: 4,
      }}>
        {illustration}
      </div>

      {/* Titre */}
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '.2px' }}>
        {resolvedTitle}
      </div>

      {/* Sous-texte */}
      <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 340, lineHeight: 1.6 }}>
        {resolvedSubtitle || t.common.noData}
      </div>

      {/* Bouton action */}
      {resolvedAction && resolvedOnAction && (
        <button className="sms-btn sms-btn-primary" style={{ marginTop: 4 }} onClick={resolvedOnAction}>
          <i className={actionIcon} /> {resolvedAction}
        </button>
      )}
    </div>
  );
}
