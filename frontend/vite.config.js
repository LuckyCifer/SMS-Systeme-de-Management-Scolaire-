import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Dans Docker, le cache est placé dans un volume nommé (voir docker-compose.yml)
  // pour survivre à la recréation du conteneur au lieu de repartir à froid.
  cacheDir: process.env.SMS_VITE_CACHE_DIR || 'node_modules/.vite',
  server: {
    port: 5173,
    // Transforme toutes les pages dès le démarrage, avant la première visite :
    // les pages sont chargées à la demande (lazy) et sinon analysées seulement
    // au premier clic, pendant que le navigateur exécute déjà l'application.
    warmup: {
      clientFiles: [
        './src/main.jsx',
        './src/pages/**/*.jsx',
        './src/layouts/**/*.jsx',
        './src/components/**/*.jsx',
      ],
    },
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts':       ['chart.js', 'react-chartjs-2'],
        },
      },
    },
  },
})
