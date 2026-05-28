/**
 * layouts/Sidebar.jsx — Navigation complète SMS v3
 */
import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getUser } from '../utils/Auth';
import { canAccessPage } from '../utils/roles';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';

export default function Sidebar({ collapsed }) {
  const { t, lang } = useApp();
  const user = getUser();
  const role = user?.role || 'USER';
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);

  // hideFor : liste des typeEtab pour lesquels l'item est masqué
  // Ex: hideFor:['PRIMAIRE'] → visible pour SECONDAIRE et SUPERIEUR
  const NAV = [
    {
      section: t.sections.main,
      items: [
        { to:'/', page:'dashboard', label:t.nav.dashboard, icon:'fas fa-th-large', end:true },
      ],
    },
    {
      section: t.sections.academic,
      items: [
        { to:'/students',  page:'students',  label:labels.studentLabel, icon:'fas fa-user-graduate' },
        { to:'/teachers',  page:'teachers',  label:t.nav.teachers,      icon:'fas fa-chalkboard-teacher' },
        { to:'/classes',   page:'classes',   label:labels.classeLabel,  icon:'fas fa-door-open' },
        { to:'/cours',     page:'cours',     label:t.nav.courses,       icon:'fas fa-book-open' },
        { to:'/matieres',  page:'cours',     label:t.nav.matieres,      icon:'fas fa-book' },
        { to:'/stages',    page:'students',  label:t.nav.stages,        icon:'fas fa-briefcase',   hideFor:['PRIMAIRE', 'SECONDAIRE'] },
        { to:'/cartes',    page:'students',  label:t.nav.cartes,        icon:'fas fa-id-card',     hideFor:['PRIMAIRE'] },
      ],
    },
    {
      section: t.sections.manage,
      items: [
        { to:'/inscription',  page:'inscription', label:t.nav.inscriptions, icon:'fas fa-file-signature' },
        { to:'/evaluation',   page:'evaluation',  label:t.nav.evaluations,  icon:'fas fa-clipboard-check' },
        { to:'/seances',      page:'evaluation',  label:t.nav.seances,      icon:'fas fa-calendar-check' },
        { to:'/fiche-notes',  page:'evaluation',  label:t.nav.ficheNotes,   icon:'fas fa-file-alt' },
        { to:'/grades',       page:'grades',      label:t.nav.grades,       icon:'fas fa-star-half-alt' },
        { to:'/decisions',    page:'grades',      label:t.nav.decisions,    icon:'fas fa-gavel',       hideFor:['PRIMAIRE'] },
        { to:'/examens',      page:'evaluation',  label:t.nav.examens,      icon:'fas fa-pen-alt',     hideFor:['PRIMAIRE'] },
        { to:'/payments',     page:'payments',    label:t.nav.payments,     icon:'fas fa-credit-card' },
        { to:'/factures',     page:'payments',    label:t.nav.factures,     icon:'fas fa-file-invoice' },
        { to:'/bareme',       page:'payments',    label:t.nav.bareme,       icon:'fas fa-coins' },
        { to:'/planning',     page:'cours',       label:t.nav.planning,     icon:'fas fa-calendar-alt' },
      ],
    },
    {
      section: t.sections.admin,
      items: [
        { to:'/rapport-stat', page:'users', label:t.nav.rapportStat, icon:'fas fa-chart-bar' },
        { to:'/parametrage',  page:'users', label:t.nav.parametrage, icon:'fas fa-cogs' },
        { to:'/parametres',   page:'users', label:t.nav.parametres,  icon:'fas fa-school' },
        { to:'/users',        page:'users', label:t.nav.users,       icon:'fas fa-users-cog' },
        { to:'/audit',        page:'users', label:t.nav.audit,       icon:'fas fa-history' },
      ],
    },
  ];

  const filteredNav = NAV.map(s => ({
    ...s,
    items: s.items.filter(item =>
      canAccessPage(role, item.page) &&
      !(item.hideFor?.includes(typeEtab))
    ),
  })).filter(s => s.items.length > 0);

  return (
    <aside className={`sms-sidebar${collapsed ? ' collapsed' : ''}`}>
      <a className="sidebar-brand" href="/">
        <div className="sidebar-brand-icon"><i className="fas fa-graduation-cap"></i></div>
        {!collapsed && <div className="sidebar-brand-text"><span>S</span>MS</div>}
      </a>

      {!collapsed && (
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {(user?.nom_user || user?.login || 'AD').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="sidebar-user-name">{user?.nom_user || user?.login}</div>
            <div className="sidebar-user-role">{user?.role || 'USER'}</div>
          </div>
        </div>
      )}

      <nav style={{ flex: 1 }}>
        {filteredNav.map(section => (
          <div className="nav-section" key={section.section}>
            {!collapsed && <div className="nav-section-title">{section.section}</div>}
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link-sms${isActive ? ' active' : ''}`}
                title={collapsed ? item.label : ''}
              >
                <i className={item.icon}></i>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
