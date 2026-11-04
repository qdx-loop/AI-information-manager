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
    // 生产不产出 sourcemap——公开的 sourcemap 等于把完整源码暴露给任何人
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 第三方依赖拆 vendor 分包：浏览器长期缓存，业务更新时用户不必重下不变依赖。
          // 注意：react 与 antd/rc-* 必须同 chunk —— 拆开会出现 Rollup 循环依赖，
          // 运行时报 `Cannot access ... before initialization`（已实测踩过）。
          // 只有「只在特定交互才用到」的大包才单独拆。
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('echarts') || id.includes('zrender')) return 'vendor-echarts'
          if (id.includes('xlsx')) return 'vendor-xlsx'
          if (
            id.includes('react') || id.includes('scheduler') ||
            id.includes('antd') || id.includes('@ant-design') ||
            id.includes('rc-') || id.includes('@rc-component') || id.includes('dayjs')
          ) return 'vendor'
        },
      },
    },
  },
  // @ts-expect-error - vitest config is merged via vite plugin
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
