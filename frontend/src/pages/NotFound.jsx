/**
 * pages/NotFound.jsx
 * Page 404 stylisée.
 */
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function NotFound() {
  const { t } = useApp();
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-darkest)', flexDirection: 'column', gap: 20, padding: 24, textAlign: 'center',
    }}>
      {/* Numéro 404 animé */}
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 'clamp(80px,15vw,140px)',
        fontWeight: 700, lineHeight: 1, letterSpacing: -4,
        background: 'linear-gradient(135deg, var(--green-dark), var(--green-light))',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        404
      </div>

      <div style={{ maxWidth: 380 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          Page introuvable
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7 }}>
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
        <Link to="/" className="sms-btn sms-btn-primary">
          <i className="fas fa-home"></i> {t.nav.dashboard}
        </Link>
        <button className="sms-btn sms-btn-outline" onClick={() => window.history.back()}>
          <i className="fas fa-arrow-left"></i> Retour
        </button>
      </div>
    </div>
  );
}
