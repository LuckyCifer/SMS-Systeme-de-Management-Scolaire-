/**
 * components/RoleGuard.jsx
 * Protège les pages et les éléments UI selon le rôle de l'utilisateur.
 */
import { Navigate } from 'react-router-dom';
import { getUser } from '../utils/Auth';
import { canAccessPage, canEdit, canDelete, canCreate } from '../utils/roles';
import { useApp } from '../context/AppContext';

// ── Protection de page complète ───────────────────────────────────────────────
export function RoleGuard({ page, children }) {
  const user = getUser();
  const role = user?.role || 'USER';

  if (!canAccessPage(role, page)) {
    return <AccessDenied />;
  }

  return children;
}

// ── Masquer un élément UI selon le rôle ──────────────────────────────────────
export function CanDo({ action, children, fallback = null }) {
  const user = getUser();
  const role = user?.role || 'USER';

  const allowed = {
    edit:   canEdit(role),
    delete: canDelete(role),
    create: canCreate(role),
  };

  return allowed[action] ? children : fallback;
}

// ── Afficher seulement pour certains rôles ────────────────────────────────────
export function OnlyFor({ roles, children, fallback = null }) {
  const user = getUser();
  const role = user?.role || 'USER';
  const allowed = Array.isArray(roles) ? roles : [roles];
  return allowed.includes(role) || allowed.includes('*') ? children : fallback;
}

// ── Page accès refusé ─────────────────────────────────────────────────────────
export function AccessDenied() {
  const { t } = useApp();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '80px 24px', textAlign: 'center', gap: 16,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'rgba(239,83,80,.1)', border: '1px solid rgba(239,83,80,.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, color: 'var(--danger)',
      }}>
        <i className="fas fa-lock"></i>
      </div>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          Accès refusé
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 320 }}>
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
        </p>
      </div>
      <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => window.history.back()}>
        <i className="fas fa-arrow-left"></i> Retour
      </button>
    </div>
  );
}
