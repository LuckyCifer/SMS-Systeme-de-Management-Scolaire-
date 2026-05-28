/**
 * components/StatCard.jsx
 * Carte de statistique avec animation du compteur.
 */
import { useEffect, useState } from 'react';

function useCountUp(target, duration = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!target || isNaN(target)) return;
    const num = parseInt(target);
    const step = Math.ceil(num / (duration / 16));
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, num);
      setCount(current);
      if (current >= num) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

export default function StatCard({ label, value, icon, color, change, up, loading }) {
  const animated = useCountUp(loading ? 0 : value);

  return (
    <div className={`stat-card ${color}`}>
      <div className={`stat-icon ${color}`}>
        <i className={icon}></i>
      </div>
      <div>
        <div className="stat-value">
          {loading
            ? <div className="sms-spinner" style={{ width: 20, height: 20 }}></div>
            : isNaN(value) ? value : animated.toLocaleString()
          }
        </div>
        <div className="stat-label">{label}</div>
        {change && !loading && (
          <div className={`stat-trend ${up ? 'up' : 'down'}`}>
            <i className={`fas fa-arrow-${up ? 'up' : 'down'}`}></i> {change}
          </div>
        )}
      </div>
    </div>
  );
}
