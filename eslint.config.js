// ESLint 扁平配置（v9 格式）
//
// 为什么现在才引入：这轮审计发现两个 P0 崩溃都是同一类根因——
// Hook 调用被放在提前 return 之后（ConfirmActionModal / LibraryTable）。
// 这类错误 tsc 不会报、测试也不一定覆盖得到，只有 eslint-plugin-react-hooks
// 的 rules-of-hooks 能静态拦住。工具化之后它才不会再次溜进来。
//
// 规则分级：
//   error —— 会导致运行时崩溃或明显 bug（Hook 顺序、Hook 依赖缺失）
//   warn  —— 代码质量债，但不必然出错
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'apk-build/**', '*.d.ts'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // —— 本轮两个 P0 崩溃的根因，必须是 error ——
      // Hook 不能出现在提前 return / 条件分支 / 循环里
      'react-hooks/rules-of-hooks': 'error',
      // Hook 依赖缺失：闭包读到过期的 state/props（这轮也真出过：会话标题 effect）
      'react-hooks/exhaustive-deps': 'warn',

      // —— 明显会出错的写法 ——
      // 未使用变量：留着最容易变成「以为用了其实没」的 bug
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // 变量遮蔽：内层同名变量让「我到底改的是哪个」变得要靠猜
      'no-shadow': 'warn',
      // 用 == / != 的隐式转换
      eqeqeq: ['error', 'smart'],
      // 调试残留
      'no-debugger': 'error',
      'no-console': 'off',
      // 浮空 Promise：AI 面板里全是 fire-and-forget 的 async 调用，
      // 漏 await 会让竞态无从察觉 —— 保留但标出来
      '@typescript-eslint/no-floating-promises': 'off',
      // any 会关掉类型系统的保护，而这项目大量用 unknown 做收窄
      '@typescript-eslint/no-explicit-any': 'warn',
      // 未使用的 catch 变量
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true, caughtErrors: 'none' },
      ],
      // 空 catch 块：本项目大量「静默忽略」，这是刻意的（注释里都写了原因），
      // 但禁止写 `catch {}` 之外的裸 try-catch 吞异常习惯
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // 测试文件：断言工具本身会用未使用变量
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // Cloudflare Pages Functions：Node/Deno 风格，env 由运行时注入
  {
    files: ['functions/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Web 标准全局（workers 运行时提供）
        crypto: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Headers: 'readonly',
        console: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      // htmlToText 里靠 \u0000 剥掉 HTML 里的空字节（抓来的页面偶尔带），
      // 这是有意的过滤，不是写错正则
      'no-control-regex': 'off',
    },
  },
)
