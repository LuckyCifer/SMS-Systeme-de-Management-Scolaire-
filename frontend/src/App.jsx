import { Component } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { NotificationProvider } from './context/NotificationContext';
import { PdfPreviewProvider } from './context/PdfPreviewContext';
import AppRoutes from './routes/AppRoutes';
import './App.css';

// ── Modules périmés ──────────────────────────────────────────────────────────
// Erreurs typiques d'un navigateur qui exécute des modules de deux versions
// différentes : dépendances recompilées par Vite au démarrage du serveur de dev
// (deux copies de React → "reading 'useState'"), ou chunk supprimé par un
// nouveau déploiement en production. Un rechargement complet les corrige.
const STALE_MODULE_ERROR = /reading '(useState|useEffect|useContext|useRef|useMemo|useCallback|useReducer|useLayoutEffect)'|Invalid hook call|dynamically imported module|Importing a module script failed|error loading dynamically imported module|Outdated Optimize Dep/i;
const RELOAD_KEY = 'sms_stale_reload_at';

function shouldAutoReload(error) {
  if (!STALE_MODULE_ERROR.test(error?.message || '')) return false;
  // Un seul rechargement automatique par 30 s : évite une boucle infinie si
  // l'erreur a une autre cause (vrai bug dans le code).
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 30000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  return true;
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, reloading: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    if (shouldAutoReload(error)) {
      this.setState({ reloading: true });
      window.location.reload();
      return;
    }
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.reloading) return null;
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Une erreur inattendue s'est produite.</h2>
          <p style={{ color: '#666' }}>{this.state.error?.message}</p>
          {/* Rechargement complet : un simple reset du state ne suffit pas
              quand des modules périmés sont en mémoire. */}
          <button onClick={() => window.location.reload()}>
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppProvider>
          <NotificationProvider>
            <PdfPreviewProvider>
              <AppRoutes />
            </PdfPreviewProvider>
          </NotificationProvider>
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
