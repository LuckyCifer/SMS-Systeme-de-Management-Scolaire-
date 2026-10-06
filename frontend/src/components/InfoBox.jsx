/**
 * components/InfoBox.jsx
 * Widget KPI compact : icône flottante dans un cercle coloré,
 * valeur + label à droite, mini barre de progression optionnelle.
 *
 * Props :
 *   icon     — classe FontAwesome (ex: 'fas fa-percent')
 *   label    — texte descriptif
 *   value    — valeur affichée (string ou number)
 *   color    — variable CSS ou code hex (ex: 'var(--green)', '#ef5350')
 *   progress — 0-100 (optionnel) — affiche la barre si présent
 *   suffix   — unité affichée après la valeur (ex: '%', 'FCFA')
 *   loading  — affiche un spinner si true
 *   to       — si défini, wrap dans un <a> cliquable
 */
import { Link } from 'react-router-dom';

export default function InfoBox({
  icon  = 'fas fa-info-circle',
  label = '',
  value,
  color = 'var(--green)',
  progress,
  suffix = '',
  loading = false,
  to,
}) {
  const hasProgress = progress !== undefined && progress !== null;
  const pct         = Math.min(100, Math.max(0, Number(progress) || 0));

  const content = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px',
      background: 'var(--bg-card)',
      border: `1px solid ${color}30`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 'var(--radius-lg)',
      transition: 'var(--transition)',
      cursor: to ? 'pointer' : 'default',
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Cercle icône flottant */}
      <div style={{
        width: 48, height: 48, flexShrink: 0,
        borderRadius: '50%',
        background: `${color}1a`,
        border: `2px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {loading
          ? <div className="sms-spinner" style={{ width: 18, height: 18 }} />
          : <i className={icon} style={{ fontSize: 18, color }} />
        }
      </div>

      {/* Valeur + label + barre */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 22, fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: loading ? 'var(--text-muted)' : color,
          lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {loading ? '—' : (value !== undefined && value !== null ? `${value}${suffix}` : '—')}
        </div>
        <div style={{
          fontSize: 11, fontWeight: 500,
          color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '.5px',
          marginTop: 2, marginBottom: hasProgress ? 8 : 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {label}
        </div>

        {/* Barre de progression */}
        {hasProgress && !loading && (
          <div style={{
            height: 4, background: `${color}20`,
            borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: color,
              borderRadius: 2,
              transition: 'width .6s cubic-bezier(.4,0,.2,1)',
            }} />
          </div>
        )}
      </div>

      {/* Glow décoratif en fond */}
      <div style={{
        position: 'absolute', right: -20, top: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: `${color}08`, pointerEvents: 'none',
      }} />
    </div>
  );

  return to
    ? <Link to={to} style={{ textDecoration: 'none' }}>{content}</Link>
    : content;
}
