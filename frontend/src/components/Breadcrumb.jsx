/**
 * components/Breadcrumb.jsx
 * Fil d'Ariane dynamique basé sur la route actuelle.
 */
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function Breadcrumb() {
  const { t } = useApp();
  const location = useLocation();

  const ROUTE_MAP = {
    '/':             { label: t.nav.dashboard,    icon: 'fas fa-th-large' },
    '/students':     { label: t.nav.students,     icon: 'fas fa-user-graduate' },
    '/teachers':     { label: t.nav.teachers,     icon: 'fas fa-chalkboard-teacher' },
    '/classes':      { label: t.nav.classes,      icon: 'fas fa-door-open' },
    '/cours':        { label: t.nav.courses,      icon: 'fas fa-book-open' },
    '/inscription':  { label: t.nav.inscriptions, icon: 'fas fa-file-signature' },
    '/evaluation':   { label: t.nav.evaluations,  icon: 'fas fa-clipboard-check' },
    '/grades':       { label: t.nav.grades,       icon: 'fas fa-star-half-alt' },
    '/payments':     { label: t.nav.payments,     icon: 'fas fa-credit-card' },
    '/users':        { label: t.nav.users,        icon: 'fas fa-users-cog' },
    '/profile':      { label: t.nav.profile,      icon: 'fas fa-user-circle' },
    '/stages':       { label: t.nav.stages,       icon: 'fas fa-briefcase' },
    '/cartes':       { label: t.nav.cartes,       icon: 'fas fa-id-card' },
    '/seances':      { label: t.nav.seances,      icon: 'fas fa-calendar-check' },
    '/fiche-notes':  { label: t.nav.ficheNotes,   icon: 'fas fa-file-alt' },
    '/decisions':    { label: t.nav.decisions,    icon: 'fas fa-gavel' },
    '/examens':      { label: t.nav.examens,      icon: 'fas fa-pen-square' },
    '/factures':     { label: t.nav.factures,     icon: 'fas fa-file-invoice' },
    '/planning':     { label: t.nav.planning,     icon: 'fas fa-calendar-alt' },
    '/rapport-stat': { label: t.nav.rapportStat,  icon: 'fas fa-chart-bar' },
    '/audit':        { label: t.nav.audit,        icon: 'fas fa-history' },
    '/matieres':    { label: t.nav.matieres,    icon: 'fas fa-book' },
    '/parametrage': { label: t.nav.parametrage, icon: 'fas fa-cogs' },
    '/parametres':  { label: t.nav.parametres,  icon: 'fas fa-school' },
    '/bareme':      { label: t.nav.bareme,       icon: 'fas fa-coins' },
  };

  const current = ROUTE_MAP[location.pathname];
  if (!current) return null;

  return (
    <div className="sms-breadcrumb">
      <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 12 }}>
        <i className="fas fa-home"></i>
      </Link>
      {location.pathname !== '/' && (
        <>
          <span className="sms-breadcrumb-sep"><i className="fas fa-chevron-right"></i></span>
          <span className="sms-breadcrumb-cur" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className={current.icon} style={{ fontSize: 11 }}></i>
            {current.label}
          </span>
        </>
      )}
    </div>
  );
}
