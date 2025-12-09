<template>
  <div class="user-profile">
    <div v-if="!userStore.user" class="login-container">
      <div class="login-card">
        <Icon :icon="userIcon" class="user-avatar-placeholder" />
        <h2>Welcome to Ecubus Pro</h2>
        <p>Please sign in to access your account and licenses.</p>

        <div class="actions">
          <el-button type="primary" size="large" :loading="loading" @click="openLogin">
            Sign In with Casdoor
          </el-button>
          <el-button size="large" @click="openSignup"> Create Account </el-button>
        </div>
      </div>
    </div>

    <div v-else class="user-info">
      <div class="profile-header">
        <el-avatar :size="80" :src="userStore.user.avatar || ''">
          <Icon v-if="!userStore.user.avatar" :icon="userIcon" />
        </el-avatar>
        <div class="user-details">
          <h3>{{ userStore.user.displayName || 'User' }}</h3>
          <p class="email">{{ userStore.user.email }}</p>
        </div>
        <el-button type="danger" plain size="small" @click="handleLogout">Sign Out</el-button>
      </div>

      <el-divider />

      <div class="license-info">
        <h4>License Information</h4>
        <div v-if="userStore.user.license" class="license-card active">
          <div class="license-status">
            <Icon :icon="checkCircle" class="status-icon" />
            <span>Active License</span>
          </div>
          <p class="license-key">{{ userStore.user.license }}</p>
        </div>
        <div v-else class="license-card inactive">
          <div class="license-status">
            <Icon :icon="alertCircle" class="status-icon" />
            <span>No Active License</span>
          </div>
          <p>Please purchase or activate a license to unlock full features.</p>
          <el-button type="primary" link>Activate License</el-button>
        </div>
      </div>

      <!-- Debug info for dev -->
      <!-- <div style="margin-top: 20px; word-break: break-all;">
        <pre>{{ userStore.user }}</pre>
      </div> -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from '@r/stores/user'
import { Icon } from '@iconify/vue'
import userIcon from '@iconify/icons-material-symbols/person-outline'
import checkCircle from '@iconify/icons-material-symbols/check-circle-outline'
import alertCircle from '@iconify/icons-material-symbols/error-outline'
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'

const userStore = useUserStore()
const loading = ref(false)

// Config - these should ideally be in env vars
const serverUrl = 'https://door.whyengineer.com'
const appName = 'ecubus-pro'
const clientId = 'b08218683e326231940a' // Replace with actual Client ID
const clientSecret = '1652150117d33d59e3595563a65217983c310c14' // Replace with actual Client Secret (Note: Handling secret in renderer is not ideal for security, usually handled in main or proxy)
// Ideally, the main process should hold the secret and handle the exchange, renderer just triggers it.
// For this example based on the query, we'll pass them to the main process via IPC.

const redirectPath = '/callback' // Not used directly in Electron deep link flow usually, but part of params
const protocol = 'ecubuspro'

function openLogin() {
  loading.value = true

  // Construct deep link redirect URL
  const redirectUrl = `${protocol}://callback`

  const signinUrl = `${serverUrl}/login/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=profile&state=${appName}&noRedirect=true`

  window.electron.ipcRenderer.send('ipc-open-link', signinUrl)
}

function openSignup() {
  window.electron.ipcRenderer.send('ipc-open-link', 'https://door.whyengineer.com/signup')
}

function handleLogout() {
  userStore.logout()
}

// Listen for auth code from main process
const handleReceiveCode = async (_event, code) => {
  try {
    loading.value = true
    // Call main process to exchange code for user info
    // Security Note: Storing clientSecret in frontend code is generally not recommended.
    // Better to have main process know the secret or use PKCE if supported.
    const userInfo = await window.electron.ipcRenderer.invoke(
      'getUserInfo',
      clientId,
      clientSecret,
      code
    )

    if (userInfo) {
      userStore.setUser(userInfo)
      userStore.setToken(userInfo.token, userInfo.refreshToken)
      ElMessage.success('Login successful')
    }
  } catch (e) {
    console.error(e)
    ElMessage.error('Login failed')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  window.electron.ipcRenderer.on('receiveCode', handleReceiveCode)
  await userStore.loadFromStorage()
})

onUnmounted(() => {
  window.electron.ipcRenderer.removeAllListeners('receiveCode')
})
</script>

<style scoped lang="scss">
.user-profile {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  box-sizing: border-box;
}

.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.login-card {
  text-align: center;
  padding: 40px;
  background: var(--el-bg-color-overlay);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  width: 100%;

  h2 {
    margin: 20px 0 10px;
  }

  p {
    color: var(--el-text-color-secondary);
    margin-bottom: 30px;
  }
}

.user-avatar-placeholder {
  font-size: 64px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  padding: 20px;
  border-radius: 50%;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 15px;

  .el-button {
    width: 100%;
    margin: 0;
  }
}

.user-info {
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
  background: var(--el-bg-color-overlay);
  border-radius: 8px;

  .user-details {
    flex: 1;

    h3 {
      margin: 0 0 5px;
      font-size: 24px;
    }

    .email {
      margin: 0;
      color: var(--el-text-color-secondary);
    }
  }
}

.license-info {
  h4 {
    margin-bottom: 15px;
  }
}

.license-card {
  padding: 20px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color-overlay);

  &.active {
    border-color: var(--el-color-success-light-5);
    background: var(--el-color-success-light-9);

    .status-icon {
      color: var(--el-color-success);
    }
  }

  &.inactive {
    border-color: var(--el-color-warning-light-5);
    background: var(--el-color-warning-light-9);

    .status-icon {
      color: var(--el-color-warning);
    }
  }

  .license-status {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: bold;
    margin-bottom: 10px;
    font-size: 16px;

    .status-icon {
      font-size: 20px;
    }
  }
}
</style>
