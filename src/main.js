/**
 * Vue 应用入口
 *
 * 初始化顺序：
 * 1. 注册 Pinia（全局状态管理）
 * 2. 注册 Vue Router
 * 3. 加载全局样式（CSS 变量、Reset）和 Reka UI 样式
 * 4. 注册 @iconify 本地图标集合
 * 5. 设置全局错误处理器
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './styles/main.css';
import './styles/ui.css';
import './utils/icon-init';

// ── 全局错误捕获（用于调试） ──
window.onerror = (msg, url, line, col, err) => {
	console.error('[BiliMusic] GLOBAL ERROR:', msg, err?.stack);
	return true;
};
window.addEventListener('unhandledrejection', (e) => {
	console.error(
		'[BiliMusic] UNHANDLED REJECTION:',
		e.reason?.stack || e.reason,
	);
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.config.errorHandler = (err, _instance, info) => {
	console.error('[BiliMusic] VUE ERROR:', err, info);
};
app.mount('#app');
