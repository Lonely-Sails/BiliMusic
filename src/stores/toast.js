/**
 * Toast Store — 全局通知管理
 *
 * 配合 Reka UI Toast 组件使用。
 * toasts 是模块级 ref（单例），所有组件共享同一个通知队列。
 */

import { ref } from 'vue';

const toasts = ref([]);
let toastId = 0;

export function useToast() {
	/**
	 * 显示一条 Toast 通知
	 * @param {string} message - 通知内容
	 * @param {'success'|'error'} type - 通知类型
	 */
	function showToast(message, type = 'success') {
		const id = ++toastId;
		toasts.value.push({ id, message, type });
		// 安全清理（Reka UI Toast 自带自动关闭，此 timeout 作为后备）
		setTimeout(() => {
			toasts.value = toasts.value.filter((t) => t.id !== id);
		}, 5000);
	}

	return { toasts, showToast };
}
