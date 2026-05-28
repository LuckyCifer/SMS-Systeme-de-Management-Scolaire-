import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar  from './Navbar';
import { useApp } from '../context/AppContext';
import { ToastContainer } from '../components/ApiState';
import BackToTop from '../components/BackToTop';
import PageTransition from '../components/PageTransition';

// Textes footer par défaut (si les clés i18n ne sont pas encore présentes)
const FOOTER_DEFAULTS = {
  fr: { desc: 'Système de Management Scolaire — Gestion académique et administrative.', nav: 'Navigation', manage: 'Gestion', admin: 'Administration', docs: 'Documentation', rights: 'Tous droits réservés.' },
  en: { desc: 'School Management System — Academic and administrative management.',     nav: 'Navigation', manage: 'Management', admin: 'Administration', docs: 'Documentation', rights: 'All rights reserved.' },
};

function Footer() {
  const { t, lang } = useApp();
  const year = new Date().getFullYear();
  // Utilise les clés i18n si présentes, sinon les valeurs par défaut
  const f = t.footer ?? FOOTER_DEFAULTS[lang] ?? FOOTER_DEFAULTS.fr;
  return (
    <footer className="sms-footer">
      <div className="sms-footer-main">
        <div>
          <div className="sms-footer-brand-name"><span>S</span>MS</div>
          <p className="sms-footer-desc">{f.desc}</p>
        </div>
        <div>
          <div className="sms-footer-col-title">{f.nav}</div>
          <ul className="sms-footer-links">
            <li><a href="/">{t.nav.dashboard}</a></li>
            <li><a href="/students">{t.nav.students}</a></li>
            <li><a href="/teachers">{t.nav.teachers}</a></li>
            <li><a href="/classes">{t.nav.classes}</a></li>
          </ul>
        </div>
        <div>
          <div className="sms-footer-col-title">{f.manage}</div>
          <ul className="sms-footer-links">
            <li><a href="/inscription">{t.nav.inscriptions}</a></li>
            <li><a href="/evaluation">{t.nav.evaluations}</a></li>
            <li><a href="/grades">{t.nav.grades}</a></li>
            <li><a href="/payments">{t.nav.payments}</a></li>
          </ul>
        </div>
        <div>
          <div className="sms-footer-col-title">{f.admin}</div>
          <ul className="sms-footer-links">
            <li><a href="/users">{t.nav.users}</a></li>
            <li><a href="/cours">{t.nav.courses}</a></li>
            <li><a href="/profile">{t.nav.profile ?? 'Profil'}</a></li>
            <li><a href="#">{f.docs}</a></li>
          </ul>
        </div>
      </div>
      <div className="sms-footer-bottom">
        <div className="sms-footer-copy">
          &copy; {year} <span>SMS</span> — {f.rights}
        </div>
        <div className="sms-footer-social">
          <a href="#"><i className="fab fa-github"></i></a>
          <a href="#"><i className="fab fa-linkedin"></i></a>
          <a href="#"><i className="fas fa-envelope"></i></a>
        </div>
        <div className="sms-footer-version">v2.0.0 — {year}</div>
      </div>
    </footer>
  );
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { toasts, removeToast } = useApp();

  return (
    <div className="sms-wrapper">
      <Sidebar collapsed={collapsed} />
      <div className={`sms-main${collapsed ? ' collapsed' : ''}`}>
        <Navbar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
        <main className="sms-content">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
        <Footer />
      </div>

      {/* Globaux */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <BackToTop />
    </div>
  );
}
