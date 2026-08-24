import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
    // 开发时把 /api 转发给本地 Cloudflare Pages Functions（npx wrangler pages dev）
    proxy: {
      '/api': 'http://127.0.0.1:8788',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  // @ts-expect-error - vitest config is merged via vite plugin
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
