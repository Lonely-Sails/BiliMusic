/**
 * use_theme — 主题切换（亮色 / 深色）
 *
 * 职责：管理应用主题，持久化到 localStorage，并同步到 <html> 的 data-theme 属性。
 * 通过 CSS 变量切换，无需重新加载。
 */

import { ref, watch } from 'vue';

const THEME_KEY = 'bilimusic:theme';
export const THEME_MODES = ['dark', 'light']; // 深色 | 亮色

/** 读取本地存储的主题，默认深色 */
function loadStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (THEME_MODES.includes(stored)) return stored;
  } catch {
    /* ignore */
  }
  return 'dark';
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

  // 初始化时应用
  applyTheme(theme.value);

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
      applyTheme(val);
    },
    { immediate: false }
  );

  return { theme, toggleTheme, setTheme };
}
