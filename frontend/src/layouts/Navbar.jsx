import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, getUser } from '../utils/Auth';
import { useApp } from '../context/AppContext';
import { useEtablissement } from '../hooks/useEtablissement';
import Breadcrumb from '../components/Breadcrumb';
import NotificationPanel from '../components/NotificationPanel';

// ── Types d'établissement avec couleurs distinctes ────────────────────────────
const TYPE_ETAB_OPTIONS = [
  { value: 'SUPERIEUR',  labelFr: 'Supérieur',  labelEn: 'Higher',    icon: 'fas fa-university', color: 'var(--green)' },
  { value: 'SECONDAIRE', labelFr: 'Secondaire', labelEn: 'Secondary', icon: 'fas fa-school',     color: 'var(--info)' },
  { value: 'PRIMAIRE',   labelFr: 'Primaire',   labelEn: 'Primary',   icon: 'fas fa-child',      color: 'var(--warning)' },
];

function getTypeOption(value) {
  return TYPE_ETAB_OPTIONS.find(t => t.value === value) || null;
}

export default function Navbar({ collapsed, onToggle }) {
  const navigate = useNavigate();
  const {
    theme, toggleTheme, lang, toggleLang, t,
    anneeActive, setAnneeActive, annees,
    activeTypeEtab, setActiveTypeEtab,
  } = useApp();
  const user   = getUser();
  const isDark = theme === 'dark';
  const initials = (user?.nom_user || user?.login || 'AD').slice(0, 2).toUpperCase();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // ── Établissement actif (pour dériver le type en temps réel) ─────────────
  const { etab, isPinned } = useEtablissement();
  // Quand un étab est explicitement épinglé, son type prime sur le filtre manuel
  const effectiveType = (isPinned && etab?.type_etab) ? etab.type_etab : activeTypeEtab;

  // ── État du dropdown type ─────────────────────────────────────────────────
  const [typeOpen, setTypeOpen] = useState(false);
  const dropRef = useRef(null);

  // Fermer le dropdown si clic extérieur
  useEffect(() => {
    if (!typeOpen) return;
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setTypeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [typeOpen]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const activeOption = getTypeOption(effectiveType);

  const handleSelectType = (opt) => {
    setTypeOpen(false);
    if (opt.value === activeTypeEtab) return;
    setActiveTypeEtab(opt.value);
    window.location.href = '/dashboard';
  };

  const selectStyle = {
    height: 28, padding: '0 24px 0 8px', fontSize: 12, fontWeight: 600,
    background: 'var(--bg-darkest)', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text-secondary)',
    cursor: 'pointer', appearance: 'none',
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a0aec0' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', backgroundSize: 12,
  };

  return (
    <header className={`sms-header${collapsed ? ' collapsed' : ''}`}>
      <button className="sms-toggle" onClick={onToggle} title="Menu">
        <i className="fas fa-bars"></i>
      </button>

      <Breadcrumb />

      {/* ── Sélecteur type d'établissement — SUPER_ADMIN : dropdown custom ── */}
      {isSuperAdmin && (
        <div ref={dropRef} style={{ position: 'relative', marginLeft: 16 }}>
          <button
            onClick={() => setTypeOpen(v => !v)}
            title={t.nav.typeEtab || "Type d'établissement"}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '4px 10px 4px 8px',
              background: activeOption ? `${activeOption.color}15` : 'var(--bg-darkest)',
              border: `1px solid ${activeOption ? `${activeOption.color}50` : 'var(--border)'}`,
              borderRadius: 20, cursor: 'pointer',
              transition: 'var(--transition)',
            }}
          >
            <i
              className={activeOption ? activeOption.icon : 'fas fa-building'}
              style={{ fontSize: 11, color: activeOption ? activeOption.color : 'var(--text-muted)' }}
            />
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: activeOption ? activeOption.color : 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}>
              {activeOption
                ? (lang === 'fr' ? activeOption.labelFr : activeOption.labelEn)
                : (lang === 'fr' ? 'Tous types' : 'All types')}
            </span>
            <i
              className={`fas fa-chevron-${typeOpen ? 'up' : 'down'}`}
              style={{ fontSize: 9, color: activeOption ? activeOption.color : 'var(--text-muted)', opacity: .7 }}
            />
          </button>

          {/* Dropdown menu */}
          {typeOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: 'var(--shadow)',
              minWidth: 180, zIndex: 2000, overflow: 'hidden',
              animation: 'fadeIn .12s ease',
            }}>
              {/* Option "Tous types" */}
              <button
                onClick={() => { setTypeOpen(false); setActiveTypeEtab(null); window.location.href = '/dashboard'; }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', background: !effectiveType ? 'var(--bg-darkest)' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer', textAlign: 'left',
                  color: 'var(--text-muted)', fontSize: 12,
                  transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-darkest)'}
                onMouseLeave={e => e.currentTarget.style.background = !effectiveType ? 'var(--bg-darkest)' : 'transparent'}
              >
                <i className="fas fa-globe" style={{ fontSize: 12, width: 16, textAlign: 'center', color: 'var(--text-muted)' }} />
                <span style={{ fontWeight: !effectiveType ? 700 : 400 }}>
                  {lang === 'fr' ? 'Tous types' : 'All types'}
                </span>
                {!effectiveType && <i className="fas fa-check" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }} />}
              </button>

              {/* Options PRIMAIRE / SECONDAIRE / SUPERIEUR */}
              {TYPE_ETAB_OPTIONS.map(opt => {
                const isActive = effectiveType === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleSelectType(opt)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 14px',
                      background: isActive ? `${opt.color}12` : 'transparent',
                      border: 'none', borderBottom: opt.value !== 'PRIMAIRE' ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = `${opt.color}1a`}
                    onMouseLeave={e => e.currentTarget.style.background = isActive ? `${opt.color}12` : 'transparent'}
                  >
                    <i
                      className={opt.icon}
                      style={{ fontSize: 12, width: 16, textAlign: 'center', color: opt.color }}
                    />
                    <span style={{
                      fontSize: 12, fontWeight: isActive ? 700 : 500,
                      color: isActive ? opt.color : 'var(--text-secondary)',
                      flex: 1,
                    }}>
                      {lang === 'fr' ? opt.labelFr : opt.labelEn}
                    </span>
                    {isActive && (
                      <i className="fas fa-check" style={{ fontSize: 10, color: opt.color }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Badge lecture seule — utilisateurs non SUPER_ADMIN ─────────────── */}
      {!isSuperAdmin && activeTypeEtab && (() => {
        const opt = getTypeOption(activeTypeEtab);
        if (!opt) return null;
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, marginLeft: 16,
            padding: '3px 10px', borderRadius: 20,
            background: `${opt.color}12`, border: `1px solid ${opt.color}40`,
            fontSize: 11, fontWeight: 700, color: opt.color,
            userSelect: 'none',
          }}>
            <i className={opt.icon} style={{ fontSize: 10 }} />
            <span>{lang === 'fr' ? opt.labelFr : opt.labelEn}</span>
          </div>
        );
      })()}

      {/* ── Sélecteur d'année scolaire ──────────────────────────────────────── */}
      {anneeActive && annees.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 16 }}>
          <i className="fas fa-calendar-alt" style={{ fontSize: 12, color: 'var(--text-muted)' }}></i>
          <select
            value={anneeActive.code_annee}
            onChange={e => {
              const found = annees.find(a => a.code_annee === e.target.value);
              if (found) setAnneeActive(found);
            }}
            style={{
              ...selectStyle,
              color: anneeActive.statut === 'EN COURS' ? 'var(--green)' : 'var(--text-secondary)',
            }}>
            {annees.map(a => (
              <option key={a.code_annee} value={a.code_annee}>
                {a.lib_annee || a.code_annee}{a.statut === 'EN COURS' ? ' ✓' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="sms-header-right">

        {/* Langue */}
        <button className="sms-hbtn" onClick={toggleLang}
          style={{ padding:'4px 8px', borderRadius:20, fontSize:12, fontWeight:700,
            display:'flex', alignItems:'center', gap:5,
            background:'var(--bg-darkest)', border:'1px solid var(--border)',
            color:'var(--text-secondary)', minWidth:62 }}>
          <i className="fas fa-language" style={{ fontSize:12 }}></i>
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
            <i className={isDark ? 'fas fa-moon' : 'fas fa-sun'}></i>
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
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            transition: 'var(--transition)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(239,83,80,.12)'; e.currentTarget.style.borderColor='rgba(239,83,80,.4)'; e.currentTarget.style.color='#ef9a9a'; }}
          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text-secondary)'; }}>
          <i className="fas fa-sign-out-alt" style={{ fontSize: 13 }}></i>
          <span>{t.nav.logout}</span>
        </button>
      </div>
    </header>
  );
}
