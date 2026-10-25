import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'dexie', 'dexie-react-hooks', 'date-fns'],
          pdf: ['jspdf', 'jspdf-autotable'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});

