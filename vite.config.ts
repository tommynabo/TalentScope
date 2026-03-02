import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: {
        // Prevent full page reload when HMR WebSocket reconnects after tab was backgrounded
        overlay: true,
        timeout: 120000, // 120s timeout — background tabs often lose WS connection
        protocol: 'ws', // Explicit WS protocol to avoid reconnect issues
      },
    },
    plugins: [react()],
    define: {
      'process.env.VITE_OPENAI_API_KEY': JSON.stringify(env.VITE_OPENAI_API_KEY || ''),
      'process.env.VITE_APIFY_API_KEY': JSON.stringify(env.VITE_APIFY_API_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
