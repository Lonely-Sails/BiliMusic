<template>
  <div class="login-panel">
    <div v-if="user.loggedIn" class="user-info">
      <Avatar :src="user.avatar + '@96w_96h.webp'" :alt="user.nickname" root-class="user-avatar-root" image-class="user-avatar" fallback-class="user-avatar-fallback" />
      <span class="user-name">{{ user.nickname }}</span>
      <button class="logout-btn" @click="handleLogout">
        <Icon icon="mdi:logout" />
      </button>
    </div>

    <button v-else class="login-btn" @click="dialogOpen = true">
      <Icon icon="mdi:account-circle-outline" class="login-icon" />
      <span>登录B站</span>
    </button>

    <Dialog v-model="dialogOpen" title="扫码登录" description="使用B站App扫描二维码登录">
      <div class="qr-status-wrap">
        <template v-if="qrStatus === 'loading'">
          <div class="spinner" />
          <p class="qr-status-text">获取二维码中...</p>
        </template>
        <template v-else-if="qrStatus === 'pending'">
          <img :src="qrDataURL" alt="QR Code" class="qr-image" />
          <p class="qr-status-text active">请用B站App扫码</p>
        </template>
        <template v-else-if="qrStatus === 'scanning'">
          <div class="spinner" />
          <p class="qr-status-text highlight">已扫码，请在手机上确认</p>
        </template>
        <template v-else-if="qrStatus === 'success'">
          <Icon icon="mdi:check-circle" class="qr-success-icon" />
          <p class="qr-status-text success">登录成功！</p>
        </template>
        <template v-else-if="qrStatus === 'expired'">
          <Icon icon="mdi:alert-circle-outline" class="qr-error-icon" />
          <p class="qr-status-text error">二维码已过期</p>
          <button @click="startQRLogin" class="retry-btn">重新获取</button>
        </template>
        <template v-else-if="qrStatus === 'error'">
          <Icon icon="mdi:alert-circle-outline" class="qr-error-icon" />
          <p class="qr-status-text error">{{ qrError }}</p>
          <button @click="startQRLogin" class="retry-btn">重试</button>
        </template>
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useUserStore } from '../stores/user'
import QRCode from 'qrcode'
import { Icon } from '@iconify/vue'
import Dialog from './ui/Dialog.vue'
import Avatar from './ui/Avatar.vue'

const user = useUserStore()
const dialogOpen = ref(false)
const qrStatus = ref('idle')
const qrDataURL = ref('')
const qrKey = ref('')
const qrError = ref('')
let pollTimer = null

onMounted(() => user.checkLogin())
onBeforeUnmount(() => stopPolling())

watch(dialogOpen, async (val) => {
  if (val) {
    await user.checkLogin()
    if (user.loggedIn) { dialogOpen.value = false; return }
    startQRLogin()
  } else { stopPolling(); qrStatus.value = 'idle' }
})

async function startQRLogin() {
  await window.electronAPI.clearAuth()
  qrStatus.value = 'loading'; qrError.value = ''
  try {
    const result = await window.electronAPI.getQrcode()
    if (result.error) { qrStatus.value = 'error'; qrError.value = result.error; return }
    qrKey.value = result.qrcodeKey
    qrDataURL.value = await QRCode.toDataURL(result.url, { width: 200, margin: 2, color: { dark: '#fb7299', light: '#16213e' } })
    qrStatus.value = 'pending'
    startPolling()
  } catch (e) { qrStatus.value = 'error'; qrError.value = e.message }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    try {
      const result = await window.electronAPI.pollLogin(qrKey.value)
      console.log('[BiliMusic] QR Poll:', JSON.stringify(result))
      if (result.status === 'scanning') qrStatus.value = 'scanning'
      else if (result.status === 'success') {
        const verified = await user.checkLogin()
        if (verified.loggedIn) {
          qrStatus.value = 'success'
          stopPolling()
          setTimeout(() => dialogOpen.value = false, 1500)
        } else qrStatus.value = 'pending'
      } else if (result.status === 'expired') { qrStatus.value = 'expired'; stopPolling() }
      else if (result.status === 'error') { qrStatus.value = 'error'; qrError.value = result.message; stopPolling() }
    } catch (e) { qrStatus.value = 'error'; qrError.value = e.message; stopPolling() }
  }, 2000)
}

function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null } }
async function handleLogout() { await user.logout() }
</script>

<style scoped>
.login-panel {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar-root {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.user-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  color: var(--text-muted);
  font-size: 16px;
}

.user-name {
  font-size: 13px;
  color: var(--text-secondary);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  display: flex;
  transition: color var(--transition);
  border-radius: 4px;
}

.logout-btn:hover {
  color: var(--danger);
  background: rgba(255, 71, 87, 0.1);
}

.login-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 6px 14px;
  border-radius: var(--radius-xl);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
}

.login-btn:hover {
  border-color: var(--accent-dim);
  color: var(--accent);
}

.login-icon {
  font-size: 18px;
}

.qr-status-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
}

.qr-image {
  width: 200px;
  height: 200px;
  border-radius: var(--radius-md);
}

.qr-status-text {
  font-size: 14px;
  color: var(--text-muted);
}

.qr-status-text.active {
  color: var(--accent);
}

.qr-status-text.highlight {
  color: var(--accent);
  font-weight: 600;
}

.qr-status-text.success {
  color: #4ade80;
  font-weight: 600;
}

.qr-status-text.error {
  color: var(--danger);
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.qr-success-icon {
  font-size: 48px;
  color: #4ade80;
}

.qr-error-icon {
  font-size: 48px;
  color: var(--danger);
}

.retry-btn {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 8px 20px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
}

.retry-btn:hover {
  border-color: var(--accent-dim);
  color: var(--accent);
}
</style>
