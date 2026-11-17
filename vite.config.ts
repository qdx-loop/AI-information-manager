import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * Markdown 渲染链的包名（react-markdown 的传递依赖）。
 * 按前缀匹配：这些包只在 AIPanel 的 markdown 渲染里用，不该进首屏 vendor。
 */
const MARKDOWN_PKGS = [
  'react-markdown', 'remark-', 'rehype-', 'micromark', 'mdast-', 'hast-', 'unist-',
  'unified', 'vfile', 'property-information', 'space-separated-tokens', 'comma-separated-tokens',
  'html-url-attributes', 'style-to-object', 'character-entities', 'decode-named-character-reference',
  'parse-entities', 'devlop', 'zwitch', 'longest-streak', 'markdown-table', 'bail', 'trough',
  'is-plain-obj', 'ccount', 'web-namespaces', 'html-void-elements', 'trim-lines', 'estree-',
]

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
          // 只有「只在特定交互才用到」的大包才单独拆（echarts / xlsx / supabase）；
          // 其余进 vendor，React 与 @fluentui 之间不做再拆分，避免 Rollup 循环依赖
          // 导致的 `Cannot access ... before initialization`（历史上踩过）。
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('echarts') || id.includes('zrender')) return 'vendor-echarts'
          if (id.includes('xlsx')) return 'vendor-xlsx'
          // 拆成稳定 chunk：React / Fluent 组件 / 图标 / Markdown 的升级节奏互不相干，
          // 合在一起会让「只改 React」也把几百 kB 的 Fluent 一起失效。
          // 注意带尾斜杠：`node_modules/react` 前缀会误吞 react-dom / react-markdown /
          // react-router-dom，把 markdown 与 React 拆成互相依赖的循环 chunk
          // （Rollup 会报 Circular chunk，运行时表现为 Cannot access before initialization）
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) return 'vendor-react'
          if (id.includes('@fluentui/react-icons')) return 'vendor-icons'
          if (id.includes('@fluentui')) return 'vendor-fluent'
          // Markdown 渲染链只有 AIPanel（懒加载）用；强行指定 chunk 会与 vendor 互成
          // 循环（Rollup: Circular chunk → 运行时 Cannot access before initialization），
          // 所以交给 Rollup 按导入者归位：它会被并进懒加载的 AIPanel 里。
          if (MARKDOWN_PKGS.some((pkg) => id.includes(`/node_modules/${pkg}`))) return undefined
          return 'vendor'
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
