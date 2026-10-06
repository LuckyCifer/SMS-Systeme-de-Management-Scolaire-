import { Component } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { NotificationProvider } from './context/NotificationContext';
import { PdfPreviewProvider } from './context/PdfPreviewContext';
import AppRoutes from './routes/AppRoutes';
import './App.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Une erreur inattendue s'est produite.</h2>
          <p style={{ color: '#666' }}>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
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
