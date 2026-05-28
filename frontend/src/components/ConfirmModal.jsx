/**
 * components/ConfirmModal.jsx
 * Modale de confirmation réutilisable avec animation.
 */
import { useApp } from '../context/AppContext';

export default function ConfirmModal({ title, message, onConfirm, onCancel, danger = true }) {
  const { t } = useApp();
  return (
    <div className="sms-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="sms-modal" style={{ maxWidth: 420 }}>
        <div className="sms-modal-header">
          <div className="sms-modal-title" style={{ color: danger ? 'var(--danger)' : 'var(--green)' }}>
            <i className={`fas ${danger ? 'fa-exclamation-triangle' : 'fa-question-circle'}`} style={{ marginRight: 8 }}></i>
            {title || t.common.confirm}
          </div>
          <button className="sms-btn-icon" onClick={onCancel}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="sms-modal-body">
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>
            {message || t.common.confirmMsg}
          </p>
        </div>
        <div className="sms-modal-footer">
          <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={onCancel}>
            <i className="fas fa-times"></i> {t.common.cancel}
          </button>
          <button
            className={`sms-btn sms-btn-sm ${danger ? 'sms-btn-danger' : 'sms-btn-primary'}`}
            onClick={onConfirm}
          >
            <i className={`fas ${danger ? 'fa-trash' : 'fa-check'}`}></i> {t.common.delete}
          </button>
        </div>
      </div>
    </div>
  );
}
