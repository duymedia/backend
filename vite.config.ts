import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Đọc .env.local và .env để lấy URL backend cho proxy
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.APP_URL || env.VITE_APP_URL || 'http://localhost:3000';

  return {
    // The production admin portal is published through the main site at /admin/.
    // Keep the development server at the root for a simple local workflow.
    base: mode === 'production' ? (env.ADMIN_BASE_PATH || '/admin/') : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Proxy /api và /webhook sang Express backend
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/webhook': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/exceljs')) return 'vendor-excel';
            if (id.includes('node_modules/recharts')) return 'vendor-charts';
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor-react';
            if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
          },
        },
      },
    },
  };
});
