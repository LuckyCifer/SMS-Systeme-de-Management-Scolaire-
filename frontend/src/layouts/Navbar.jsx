import { useNavigate } from 'react-router-dom';
import { logout, getUser } from '../utils/Auth';
import { useApp } from '../context/AppContext';
import Breadcrumb from '../components/Breadcrumb';
import NotificationPanel from '../components/NotificationPanel';

export default function Navbar({ collapsed, onToggle }) {
  const navigate = useNavigate();
  const { theme, toggleTheme, lang, toggleLang, t } = useApp();
  const user   = getUser();
  const isDark = theme === 'dark';
  const initials = (user?.nom_user || user?.login || 'AD').slice(0, 2).toUpperCase();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <header className={`sms-header${collapsed ? ' collapsed' : ''}`}>
      <button className="sms-toggle" onClick={onToggle} title="Menu">
        <i className="fas fa-bars"></i>
      </button>

      <Breadcrumb />

      <div className="sms-header-right">

        {/* Langue */}
        <button className="sms-hbtn" onClick={toggleLang}
          style={{ padding:'4px 8px', borderRadius:20, fontSize:12, fontWeight:700,
            display:'flex', alignItems:'center', gap:5,
            background:'var(--bg-darkest)', border:'1px solid var(--border)',
            color:'var(--text-secondary)', minWidth:62 }}>
          <span style={{ fontSize:14 }}>{lang==='fr' ? '🇫🇷' : '🇬🇧'}</span>
          <span>{lang==='fr' ? 'FR' : 'EN'}</span>
          <i className="fas fa-chevron-right" style={{ fontSize:9, opacity:.5 }}></i>
          <span style={{ color:'var(--text-muted)' }}>{lang==='fr' ? 'EN' : 'FR'}</span>
        </button>

        {/* Thème */}
        <button onClick={toggleTheme} title={isDark ? t.theme.light : t.theme.dark}
          style={{ position:'relative', width:46, height:24, borderRadius:12, border:'none', cursor:'pointer', padding:0, flexShrink:0,
            background: isDark ? 'linear-gradient(135deg,#1a237e,#283593)' : 'linear-gradient(135deg,#ffd54f,#ffb300)',
            transition:'background .3s' }}>
          {isDark && <>
            <span style={{ position:'absolute', top:4, left:6, fontSize:5, color:'#fff', opacity:.8 }}>★</span>
            <span style={{ position:'absolute', top:8, left:10, fontSize:4, color:'#fff', opacity:.6 }}>★</span>
          </>}
          <span style={{
            position:'absolute', top:3, left: isDark ? 3 : 23, width:18, height:18, borderRadius:'50%',
            background: isDark ? '#e8eaf6' : '#fff', boxShadow:'0 1px 4px rgba(0,0,0,.3)',
            transition:'left .3s cubic-bezier(.4,0,.2,1)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:9,
          }}>
            {isDark ? '🌙' : '☀️'}
          </span>
        </button>

        {/* Panneau notifications */}
        <NotificationPanel />

        {/* Avatar / Profil */}
        <button onClick={() => navigate('/profile')} title={user?.nom_user || user?.login}
          style={{ width:32, height:32, borderRadius:'50%',
            background:'linear-gradient(135deg,var(--green-dark),var(--green))',
            border:'2px solid var(--border)', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:11, fontWeight:700, color:'#fff', transition:'var(--transition)' }}
          onMouseEnter={e => e.currentTarget.style.borderColor='var(--green)'}
          onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
          {initials}
        </button>

        {/* Déconnexion */}
        <button onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 8,
            background: 'rgba(239,83,80,.12)', border: '1px solid rgba(239,83,80,.3)',
            color: '#ef9a9a', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            transition: 'var(--transition)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(239,83,80,.22)'; e.currentTarget.style.borderColor='rgba(239,83,80,.6)'; }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(239,83,80,.12)'; e.currentTarget.style.borderColor='rgba(239,83,80,.3)'; }}>
          <i className="fas fa-sign-out-alt" style={{ fontSize: 13 }}></i>
          <span>{t.nav.logout}</span>
        </button>
      </div>
    </header>
  );
}
