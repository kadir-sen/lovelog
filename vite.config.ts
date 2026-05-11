import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API anahtarı artık burada yok. Gemini çağrıları services/apiClient.ts üzerinden
// VITE_API_BASE_URL'e (default: /api) yapılır. Backend için: server/.env.
export default defineConfig(() => ({
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
}));
