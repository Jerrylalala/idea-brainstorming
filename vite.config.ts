import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import devServer from '@hono/vite-dev-server';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    devServer({
      entry: 'server/app.ts',
      exclude: [/^(?!\/api\/).*/],  // 只让 /api/* 走 Hono
      injectClientScript: false,
    }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
