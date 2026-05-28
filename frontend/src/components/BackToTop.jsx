/**
 * components/BackToTop.jsx
 * Bouton "retour en haut" qui apparaît après défilement.
 */
import { useState, useEffect } from 'react';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const content = document.querySelector('.sms-content');
    if (!content) return;
    const handler = () => setVisible(content.scrollTop > 300);
    content.addEventListener('scroll', handler);
    return () => content.removeEventListener('scroll', handler);
  }, []);

  const scrollTop = () => {
    document.querySelector('.sms-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollTop}
      title="Retour en haut"
      style={{
        position: 'fixed', bottom: 80, right: 24,
        width: 40, height: 40, borderRadius: '50%',
        background: 'var(--green-dark)', border: 'none',
        color: '#fff', fontSize: 14, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--shadow-green)', zIndex: 900,
        transition: 'var(--transition)',
        animation: 'fadeIn .2s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--green)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--green-dark)'}
    >
      <i className="fas fa-arrow-up"></i>
    </button>
  );
}
