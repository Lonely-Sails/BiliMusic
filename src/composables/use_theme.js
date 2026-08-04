/**
 * use_theme — 主题模式（亮色 / 深色 / 跟随系统）
 *
 * 职责：管理应用主题模式，持久化到 localStorage，并同步到 <html> 的 data-theme 属性。
 * 其中「跟随系统」模式会监听 OS 的 prefers-color-scheme 变化并实时切换。
 * 通过 CSS 变量切换，无需重新加载。
 */

import { ref, computed, watch, onUnmounted } from 'vue';

const THEME_KEY = 'bilimusic:theme';
export const THEME_MODES = ['light', 'dark', 'system']; // 亮色 | 深色 | 跟随系统

/** 系统主题媒体查询 */
const SYSTEM_QUERY = window.matchMedia('(prefers-color-scheme: light)');

/** 读取本地存储的主题模式，默认跟随系统 */
function loadStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (THEME_MODES.includes(stored)) return stored;
  } catch {
    /* ignore */
  }
  return 'system';
}

/** 将系统主题偏好解析为实际应用的亮色 / 深色 */
function resolveMode(mode) {
  if (mode === 'system') return SYSTEM_QUERY.matches ? 'light' : 'dark';
  return mode;
}

/** 将主题应用到 <html> 元素 */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    root.removeAttribute('data-theme');
  }
  // 开启过渡动画（过渡完成后移除，避免持续监听）
  root.classList.add('theme-transition');
  window.setTimeout(() => root.classList.remove('theme-transition'), 400);
}

export function useTheme() {
  const theme = ref(loadStoredTheme());
  // 实际应用到 <html> 的主题（system 模式下随系统变化）
  const resolvedTheme = computed(() => resolveMode(theme.value));

  function apply() {
    applyTheme(resolvedTheme.value);
  }

  // 初始化时应用
  apply();

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  }

  function setTheme(mode) {
    if (THEME_MODES.includes(mode)) theme.value = mode;
  }

  // 持久化 + 应用
  watch(
    theme,
    (val) => {
      try {
        localStorage.setItem(THEME_KEY, val);
      } catch {
        /* ignore */
      }
      apply();
    },
    { immediate: false }
  );

  // 跟随系统：监听系统主题变化，仅当处于 system 模式时重新应用
  const handleSystemChange = () => {
    if (theme.value === 'system') apply();
  };
  SYSTEM_QUERY.addEventListener('change', handleSystemChange);

  onUnmounted(() => SYSTEM_QUERY.removeEventListener('change', handleSystemChange));

  return { theme, resolvedTheme, toggleTheme, setTheme };
}
