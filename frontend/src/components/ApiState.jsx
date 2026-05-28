/**
 * components/ApiState.jsx
 * Composants réutilisables pour les états de chargement,
 * d'erreur et de liste vide.
 */
import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

// ── Spinner de chargement ─────────────────────────────────────────────────────
export function LoadingState({ message }) {
  const { t } = useApp();
  return (
    <div className="sms-loading" style={{ flexDirection: 'column', gap: 14, padding: 60 }}>
      <div className="sms-spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></div>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{message ?? t.common.loading}</span>
    </div>
  );
}

// ── Affichage d'erreur ────────────────────────────────────────────────────────
export function ErrorState({ message, onRetry }) {
  const { t } = useApp();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 48, gap: 14, textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'rgba(239,83,80,.1)', border: '1px solid rgba(239,83,80,.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, color: 'var(--danger)',
      }}>
        <i className="fas fa-exclamation-triangle"></i>
      </div>
      <div>
        <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>
          {t.errors.loadingTitle}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 360 }}>{message}</p>
      </div>
      {onRetry && (
        <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={onRetry}>
          <i className="fas fa-redo"></i> {t.common.retry}
        </button>
      )}
    </div>
  );
}

// ── Liste vide ────────────────────────────────────────────────────────────────
export function EmptyState({ message, icon = 'fas fa-inbox' }) {
  const { t } = useApp();
  return (
    <div className="sms-empty" style={{ padding: 52 }}>
      <i className={icon} style={{ fontSize: 40, marginBottom: 12, display: 'block', opacity: .25 }}></i>
      <p style={{ fontSize: 13 }}>{message ?? t.common.noData}</p>
    </div>
  );
}

// ── Toast de notification ─────────────────────────────────────────────────────

const TOAST_STYLES = {
  success: { bg: 'rgba(76,175,80,.15)',  border: 'rgba(76,175,80,.3)',  color: 'var(--green-light)', icon: 'fas fa-check-circle' },
  error:   { bg: 'rgba(239,83,80,.15)',  border: 'rgba(239,83,80,.3)',  color: '#ef9a9a',            icon: 'fas fa-times-circle' },
  warning: { bg: 'rgba(255,167,38,.15)', border: 'rgba(255,167,38,.3)', color: '#ffcc80',            icon: 'fas fa-exclamation-circle' },
  info:    { bg: 'rgba(66,165,245,.15)', border: 'rgba(66,165,245,.3)', color: '#90caf9',            icon: 'fas fa-info-circle' },
};

export function Toast({ message, type = 'success', onClose, duration = 3500 }) {
  const s = TOAST_STYLES[type] || TOAST_STYLES.info;

  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 16px',
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 10, color: s.color,
      fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 20px rgba(0,0,0,.3)',
      animation: 'slideUp .25s ease',
      minWidth: 280, maxWidth: 400,
    }}>
      <i className={s.icon} style={{ fontSize: 15, flexShrink: 0 }}></i>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'inherit', fontSize:14, padding:2, opacity:.6 }}>
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
}

// ── Conteneur de toasts (à placer dans Layout) ────────────────────────────────
export function ToastContainer({ toasts, removeToast }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      display: 'flex', flexDirection: 'column', gap: 10,
      zIndex: 9999,
    }}>
      {toasts.map(t => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}
