import { ref } from 'vue'

const toasts = ref([])
let toastId = 0

export function useToast() {
  function showToast(message, type = 'success') {
    const id = ++toastId
    toasts.value.push({ id, message, type })
    // Toast 组件自带自动关闭，但这里做个安全清理
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, 5000)
  }

  return { toasts, showToast }
}
