/**
 * components/NotificationPanel.jsx
 * Panneau de notifications déroulant dans la navbar.
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';

const TYPE_STYLE = {
  warning: { bg: 'rgba(255,167,38,.1)',  border: 'rgba(255,167,38,.2)',  color: '#ffcc80' },
  info:    { bg: 'rgba(66,165,245,.1)',  border: 'rgba(66,165,245,.2)',  color: '#90caf9' },
  success: { bg: 'rgba(76,175,80,.1)',   border: 'rgba(76,175,80,.2)',   color: 'var(--green-light)' },
  danger:  { bg: 'rgba(239,83,80,.1)',   border: 'rgba(239,83,80,.2)',   color: '#ef9a9a' },
};

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)   return 'À l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400)return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const navigate = useNavigate();
  const { notifications, unread, loading, markAllRead, markRead, dismiss, refresh } = useNotifications();

  // Ferme le panneau si clic à l'extérieur
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = (notif) => {
    markRead(notif.id);
    setOpen(false);
    if (notif.link) navigate(notif.link);
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bouton cloche */}
      <button
        className="sms-hbtn"
        onClick={() => { setOpen(o => !o); if (!open) refresh(); }}
        title="Notifications"
        style={{ position: 'relative' }}
      >
        <i className="fas fa-bell"></i>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--danger)', color: '#fff',
            fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-header)',
            animation: 'pulse-dot 2s infinite',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Panneau déroulant */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0,
          width: 340, maxHeight: 460,
          background: 'var(--bg-card)', border: '1px solid var(--border-light)',
          borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,.4)',
          zIndex: 2000, overflow: 'hidden',
          animation: 'slideUp .2s ease',
        }}>
          {/* Header panneau */}
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
              <i className="fas fa-bell" style={{ color: 'var(--green)', marginRight: 8 }}></i>
              Notifications
              {unread > 0 && (
                <span style={{ marginLeft: 8, background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10 }}>
                  {unread}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {unread > 0 && (
                <button onClick={markAllRead} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--green)', fontSize:11, fontWeight:600 }}>
                  Tout lire
                </button>
              )}
              <button onClick={() => { refresh(); }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:12 }} title="Rafraîchir">
                <i className={`fas fa-sync-alt${loading ? ' fa-spin' : ''}`}></i>
              </button>
            </div>
          </div>

          {/* Liste des notifications */}
          <div style={{ overflowY: 'auto', maxHeight: 360 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <i className="fas fa-bell-slash" style={{ fontSize: 24, marginBottom: 8, display: 'block', opacity: .3 }}></i>
                Aucune notification
              </div>
            ) : notifications.map(notif => {
              const style = TYPE_STYLE[notif.type] || TYPE_STYLE.info;
              return (
                <div
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    background: notif.read ? 'transparent' : 'rgba(76,175,80,.03)',
                    transition: 'background .15s',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = notif.read ? 'transparent' : 'rgba(76,175,80,.03)'}
                >
                  {/* Icône */}
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: style.bg, border: `1px solid ${style.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <i className={notif.icon} style={{ color: style.color, fontSize: 13 }}></i>
                  </div>

                  {/* Contenu */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {!notif.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', marginRight: 6 }}></span>}
                        {notif.title}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); dismiss(notif.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, flexShrink: 0, padding: 2 }}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 4px', lineHeight: 1.5 }}>
                      {notif.message}
                    </p>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      <i className="fas fa-clock" style={{ marginRight: 4 }}></i>
                      {timeAgo(notif.time)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
