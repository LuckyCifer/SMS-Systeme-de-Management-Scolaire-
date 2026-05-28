/**
 * components/PageTransition.jsx
 * Animation de transition entre les pages.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function PageTransition({ children }) {
  const location = useLocation();
  const [show, setShow] = useState(true);

  useEffect(() => {
    setShow(false);
    const t = setTimeout(() => setShow(true), 60);
    return () => clearTimeout(t);
  }, [location.pathname]);

  return (
    <div style={{
      opacity: show ? 1 : 0,
      transform: show ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity .25s ease, transform .25s ease',
    }}>
      {children}
    </div>
  );
}
