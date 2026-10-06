import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  // Pré-compile toutes les dépendances au démarrage : évite que Vite les découvre
  // page par page (cause de "Cannot read properties of null (reading 'useState')"
  // au premier chargement, corrigé seulement par un rechargement).
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'axios',
      'chart.js',
      'react-chartjs-2',
      'html2pdf.js',
    ],
  },
})
