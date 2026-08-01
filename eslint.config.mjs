/**
 * ESLint 扁平配置（Flat Config，ESLint 10+）
 *
 * 结构：
 * 1. 全局忽略目录（构建产物、依赖等）
 * 2. 核心 JS 推荐规则（@eslint/js）
 * 3. 按目录区分运行环境（Electron 主进程 → Node，渲染进程 → Browser）
 * 4. Vue 3 推荐规则（eslint-plugin-vue）
 * 5. 项目级自定义规则
 */
import js from '@eslint/js';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  // ── 忽略目录 ──
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-electron/**',
      'release/**',
      '.git/**',
      '.dist/**',
      '.docs/**',
      '.vscode/**',
      'bun.lock',
    ],
  },

  // ── 核心 JS 推荐规则 ──
  js.configs.recommended,

  // ── 全局语言选项（JS 文件） ──
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },

  // ── Node 环境：Electron 主进程 / preload / 构建配置 ──
  {
    files: ['electron/**/*.js', 'vite.config.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // ── 浏览器环境：渲染进程（src / pages） ──
  {
    files: ['src/**/*.{js,vue}', 'pages/**/*.{js,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  // ── Vue 3 推荐规则 ──
  ...pluginVue.configs['flat/recommended'],

  // ── 关闭与 Prettier 冲突的排版规则 ──
  eslintConfigPrettier,

  // ── 项目级自定义规则 ──
  {
    rules: {
      // 未使用变量降级为警告（避免阻塞开发），允许 `_` 前缀的占位参数
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // 空 catch/if 块是常见防御写法，降级为警告
      'no-empty': 'warn',
      // `clearTimeout(undefined)` 是合法防御写法，此规则误报，降级为警告
      'no-unassigned-vars': 'warn',
      // 项目内存在 Toolbar、SongCard 等常见单词组件名，关闭该限制
      'vue/multi-word-component-names': 'off',
    },
  },
];
