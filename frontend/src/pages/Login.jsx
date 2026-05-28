import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api from '../services/api';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Login() {
  const navigate = useNavigate();
  const { t, theme, toggleTheme, lang, toggleLang, login, toast, isAuthenticated, isLoading } = useApp();
  
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const isDark = theme === 'dark';

  // ── Si déjà connecté, rediriger SANS rechargement ───────────────────────
  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'var(--bg-body)'
      }}>
        <i className="fas fa-spinner fa-spin fa-3x" style={{ color: 'var(--green)' }}></i>
      </div>
    );
  }

  if (isAuthenticated) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Appel AU endpoint SMS login (retourne user + tokens JWT)
      const response = await api.post('/api/auth/sms-login/', {
        login: form.login,
        password: form.password,
      });

      // Stocker les infos utilisateur et tokens
      login(
        {
          login: response.data.login,
          nom_user: response.data.nom_user,
          role: response.data.role,
        },
        {
          access: response.data.access,
          refresh: response.data.refresh,
        }
      );

      toast.success(t.toast.loginOk);

      // ← CRITIQUE : Utiliser navigate AU LIEU de window.location.href
      navigate('/', { replace: true });

    } catch (err) {
      console.error('Erreur login:', err);

      if (err.response?.status === 401) {
        setError(t.auth.error);
      } else if (err.response?.status === 500) {
        setError(t.auth.serverError);
      } else {
        setError(t.errors.network);
      }

      toast.error(t.toast.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'var(--bg-body)',
      position: 'relative'
    }}>
      {/* Interrupteurs */}
      <div style={{ position:'fixed', top:16, right:16, display:'flex', gap:8, alignItems:'center', zIndex:10 }}>
        <button onClick={toggleLang} style={{
          padding:'5px 12px', borderRadius:20, border:'1px solid var(--border)',
          background:'var(--bg-card)', color:'var(--text-secondary)', 
          fontSize:12, fontWeight:700, cursor:'pointer',
          display:'flex', alignItems:'center', gap:6,
        }}>
          <span>{lang === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
          <span>{lang === 'fr' ? 'FR → EN' : 'EN → FR'}</span>
        </button>
        
        <button onClick={toggleTheme} style={{
          width:46, height:24, borderRadius:12, border:'none', cursor:'pointer', padding:0,
          background: isDark ? 'linear-gradient(135deg,#1a237e,#283593)' : 'linear-gradient(135deg,#ffd54f,#ffb300)',
          position:'relative', flexShrink:0,
        }}>
          <span style={{
            position:'absolute', top:3, left: isDark ? 3 : 23,
            width:18, height:18, borderRadius:'50%',
            background: isDark ? '#e8eaf6' : '#fff',
            boxShadow:'0 1px 4px rgba(0,0,0,.3)',
            transition:'left .3s',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:9,
          }}>
            {isDark ? '🌙' : '☀️'}
          </span>
        </button>
      </div>

      <div style={{ position:'relative', width:'100%', maxWidth:420 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{
            width:60, height:60,
            background:'linear-gradient(135deg,var(--green-dark),var(--green))',
            borderRadius:16, margin:'0 auto 14px',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:26, color:'#fff', boxShadow:'var(--shadow-green)',
          }}>
            <i className="fas fa-graduation-cap"></i>
          </div>
          
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:32, fontWeight:700, color:'var(--text-primary)', letterSpacing:2 }}>
            <span style={{ color:'var(--green)' }}>S</span>MS
          </h1>
          
          <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>
            Système de Management Scolaire
          </p>
        </div>

        {/* Box Login */}
        <div className="sms-login-box">
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>
            {t.auth?.title || 'Connexion'}
          </h2>
          
          <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:22 }}>
            {t.auth?.subtitle || 'Connectez-vous à votre compte'}
          </p>

          {/* Erreur */}
          {error && (
            <div style={{
              background:'rgba(239,83,80,.1)', border:'1px solid rgba(239,83,80,.3)',
              borderRadius:8, padding:'10px 14px', marginBottom:14,
              color:'#ef9a9a', fontSize:13, display:'flex', alignItems:'center', gap:8,
            }}>
              <i className="fas fa-exclamation-triangle"></i> {error}
            </div>
          )}

          {/* Formulaire */}
          <form onSubmit={handleSubmit}>
            <div className="sms-form-group">
              <label className="sms-label">{t.auth?.login || 'Identifiant'}</label>
              <div style={{ position:'relative' }}>
                <i className="fas fa-user" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:13 }} />
                <input className="sms-input" type="text" placeholder={t.auth?.login || 'Identifiant'}
                  value={form.login} onChange={e => setForm({...form, login:e.target.value})}
                  style={{ paddingLeft:34 }} required autoComplete="username" />
              </div>
            </div>
            
            <div className="sms-form-group">
              <label className="sms-label">{t.auth?.password || 'Mot de passe'}</label>
              <div style={{ position:'relative' }}>
                <i className="fas fa-lock" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:13 }} />
                <input className="sms-input" type="password" placeholder="••••••••"
                  value={form.password} onChange={e => setForm({...form, password:e.target.value})}
                  style={{ paddingLeft:34 }} required autoComplete="current-password" />
              </div>
            </div>
            
            <button type="submit" className="sms-btn sms-btn-primary"
              style={{ width:'100%', justifyContent:'center', padding:'11px', marginTop:6 }}
              disabled={loading}>
              {loading
                ? <><div className="sms-spinner" style={{ width:16, height:16 }}></div> {t.auth?.submitting || 'Connexion...'}</>
                : <><i className="fas fa-sign-in-alt"></i> {t.auth?.submit || 'Se connecter'}</>
              }
            </button>
          </form>

          {/* Info Serveur */}
          <div style={{ marginTop:18, padding:'10px 14px', background:'var(--bg-darkest)', borderRadius:8, border:'1px solid var(--border)' }}>
            <p style={{ fontSize:11, color:'var(--text-muted)', textAlign:'center' }}>
              <i className="fas fa-server" style={{ color:'var(--green)' }}></i> &nbsp;
              {t.auth?.serverInfo || 'Serveur :'} <strong style={{ color:'var(--text-secondary)' }}>{SERVER_URL.replace('http://', '').replace('https://', '')}</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}