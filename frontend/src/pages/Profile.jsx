/**
 * pages/Profile.jsx
 */
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getUser } from '../utils/Auth';

export default function Profile() {
  const { t, toast, theme, toggleTheme, lang, toggleLang } = useApp();
  const user = getUser();

  const ROLE_LABELS = {
    ADMIN:      { label: t.roles.admin,      color: 'badge-danger' },
    SCOLARITE:  { label: t.roles.scolarite,  color: 'badge-info' },
    ENSEIGNANT: { label: t.roles.enseignant, color: 'badge-success' },
    ETUDIANT:   { label: t.roles.etudiant,   color: 'badge-secondary' },
    COMPTABLE:  { label: t.roles.comptable,  color: 'badge-warning' },
  };

  const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError]     = useState('');

  const roleInfo = ROLE_LABELS[user?.role] || { label: user?.role || '—', color: 'badge-secondary' };
  const initials = (user?.nom_user || user?.login || 'AD').slice(0, 2).toUpperCase();
  const isDark   = theme === 'dark';

  const handlePwd = async (e) => {
    e.preventDefault();
    setPwdError('');
    if (pwdForm.newPwd !== pwdForm.confirm) {
      setPwdError(t.pages.profile.pwdMismatch);
      return;
    }
    if (pwdForm.newPwd.length < 4) {
      setPwdError(t.pages.profile.pwdTooShort);
      return;
    }
    setPwdLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setPwdLoading(false);
    toast.success(t.pages.profile.pwdSuccess);
    setPwdForm({ current: '', newPwd: '', confirm: '' });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-user-circle text-green" style={{ marginRight: 10, fontSize: 22 }}></i>
            {t.pages.profile.title}
          </h1>
          <p className="page-subtitle">{t.pages.profile.subtitle}</p>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>

        {/* ── Infos utilisateur ───────────────────────────── */}
        <div className="sms-card">
          <div className="sms-card-header">
            <div className="sms-card-title"><i className="fas fa-id-card"></i> {t.pages.profile.infoTitle}</div>
          </div>
          <div className="sms-card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 28 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--green-dark), var(--green))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 700, color: '#fff',
              boxShadow: 'var(--shadow-green)',
            }}>
              {initials}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                {user?.nom_user || user?.login}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{user?.login}</div>
              <div style={{ marginTop: 8 }}>
                <span className={`sms-badge ${roleInfo.color}`}>{roleInfo.label}</span>
              </div>
            </div>

            <hr className="sms-divider" style={{ width: '100%' }} />

            {[
              { icon: 'fas fa-user',      label: t.fields.identifiant, value: user?.login },
              { icon: 'fas fa-shield-alt',label: t.fields.role,        value: roleInfo.label },
              { icon: 'fas fa-circle',    label: t.fields.statut,      value: t.pages.profile.connected, color: 'var(--green)' },
            ].map(row => (
              <div key={row.label} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--green-glow)', border: '1px solid rgba(76,175,80,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={row.icon} style={{ color: 'var(--green)', fontSize: 12 }}></i>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{row.label}</div>
                  <div style={{ fontSize: 13, color: row.color || 'var(--text-primary)', fontWeight: 500 }}>{row.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Préférences ──────────────────────────────── */}
          <div className="sms-card">
            <div className="sms-card-header">
              <div className="sms-card-title"><i className="fas fa-sliders-h"></i> {t.pages.profile.prefsTitle}</div>
            </div>
            <div className="sms-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Thème */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <i className={`fas ${isDark ? 'fa-moon' : 'fa-sun'}`} style={{ color: 'var(--green)', width: 16 }}></i>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {isDark ? t.theme.dark : t.theme.light}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.pages.profile.appearance}</div>
                  </div>
                </div>
                <button onClick={toggleTheme} style={{
                  width: 46, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', padding: 0, position: 'relative',
                  background: isDark ? 'linear-gradient(135deg,#1a237e,#283593)' : 'linear-gradient(135deg,#ffd54f,#ffb300)',
                }}>
                  <span style={{
                    position: 'absolute', top: 3, left: isDark ? 3 : 23, width: 18, height: 18,
                    borderRadius: '50%', background: isDark ? '#e8eaf6' : '#fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,.3)', transition: 'left .3s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9,
                  }}>
                    {isDark ? '🌙' : '☀️'}
                  </span>
                </button>
              </div>

              {/* Langue */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <i className="fas fa-globe" style={{ color: 'var(--green)', width: 16 }}></i>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {lang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.pages.profile.langLabel}</div>
                  </div>
                </div>
                <button onClick={toggleLang} style={{
                  padding: '5px 14px', borderRadius: 20, border: '1px solid var(--border)',
                  background: 'var(--bg-darkest)', color: 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                  {lang === 'fr' ? 'FR → EN' : 'EN → FR'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Changer le mot de passe ───────────────────── */}
          <div className="sms-card">
            <div className="sms-card-header">
              <div className="sms-card-title"><i className="fas fa-lock"></i> {t.pages.profile.changePwd}</div>
            </div>
            <div className="sms-card-body">
              {pwdError && (
                <div style={{ background:'rgba(239,83,80,.1)', border:'1px solid rgba(239,83,80,.3)', borderRadius:8, padding:'10px 14px', marginBottom:14, color:'#ef9a9a', fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
                  <i className="fas fa-exclamation-triangle"></i> {pwdError}
                </div>
              )}
              <form onSubmit={handlePwd}>
                <div className="sms-form-group">
                  <label className="sms-label">{t.pages.profile.currentPwd}</label>
                  <input className="sms-input" type="password" value={pwdForm.current}
                    onChange={e => setPwdForm({...pwdForm, current: e.target.value})}
                    placeholder="••••••••" required />
                </div>
                <div className="sms-form-row">
                  <div className="sms-form-group">
                    <label className="sms-label">{t.pages.profile.newPwd}</label>
                    <input className="sms-input" type="password" value={pwdForm.newPwd}
                      onChange={e => setPwdForm({...pwdForm, newPwd: e.target.value})}
                      placeholder="••••••••" required />
                  </div>
                  <div className="sms-form-group">
                    <label className="sms-label">{t.pages.profile.confirmPwd}</label>
                    <input className="sms-input" type="password" value={pwdForm.confirm}
                      onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})}
                      placeholder="••••••••" required />
                  </div>
                </div>
                <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm" disabled={pwdLoading}>
                  {pwdLoading
                    ? <><div className="sms-spinner" style={{ width:14,height:14 }}></div> {t.common.loading}</>
                    : <><i className="fas fa-save"></i> {t.common.save}</>
                  }
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
