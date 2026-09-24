import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Yönetici paneli: http://localhost:5173 (backend OAUTH_WEB_ORIGINS ile aynı olmalı)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
});
