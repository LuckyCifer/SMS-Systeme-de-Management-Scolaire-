import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'admin-lte/dist/css/adminlte.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import 'admin-lte/dist/js/adminlte.min.js'
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@fontsource/exo-2/400.css';
import '@fontsource/exo-2/500.css';
import '@fontsource/exo-2/600.css';
import '@fontsource/exo-2/700.css';
import '@fontsource/rajdhani/400.css';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
