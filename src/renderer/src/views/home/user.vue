<template>
  <div class="user-profile">
    <div v-if="!userStore.user" class="login-container">
      <div class="login-card">
        <Icon :icon="userIcon" class="user-avatar-placeholder" />
        <h2>{{ $t('user.welcome') }}</h2>
        <p>{{ $t('user.signInPrompt') }}</p>

        <div class="benefits-section">
          <h4>{{ $t('user.whyRegister') }}</h4>
          <div class="benefit-item">
            <Icon :icon="supportIcon" class="benefit-icon" />
            <div class="benefit-content">
              <span class="benefit-title">{{ $t('user.benefits.prioritySupport.title') }}</span>
              <span class="benefit-desc">{{
                $t('user.benefits.prioritySupport.description')
              }}</span>
            </div>
          </div>
          <div class="benefit-item">
            <Icon :icon="pluginIcon" class="benefit-icon" />
            <div class="benefit-content">
              <span class="benefit-title">{{ $t('user.benefits.pluginDevelopment.title') }}</span>
              <span class="benefit-desc">{{
                $t('user.benefits.pluginDevelopment.description')
              }}</span>
            </div>
          </div>
          <div class="benefit-item">
            <Icon :icon="moreIcon" class="benefit-icon" />
            <div class="benefit-content">
              <span class="benefit-title">{{ $t('user.benefits.moreFeatures.title') }}</span>
              <span class="benefit-desc">{{ $t('user.benefits.moreFeatures.description') }}</span>
            </div>
          </div>
        </div>

        <div class="actions">
          <el-button type="primary" size="large" :loading="loading" @click="openLogin">
            {{ $t('user.signIn') }}
          </el-button>
          <el-button size="large" @click="openSignup"> {{ $t('user.createAccount') }} </el-button>
        </div>
      </div>
    </div>

    <div v-else class="user-info">
      <div class="profile-header">
        <el-avatar :size="80" :src="userStore.user.avatar || ''">
          <Icon v-if="!userStore.user.avatar" :icon="userIcon" />
        </el-avatar>
        <div class="user-details">
          <h3>{{ userStore.user.displayName || $t('user.userFallback') }}</h3>
          <p class="email">{{ userStore.user.email }}</p>
        </div>
        <el-button type="danger" plain @click="handleLogout">{{ $t('user.signOut') }}</el-button>
      </div>

      <el-divider />

      <!-- <div class="license-info">
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
      </div> -->

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
import supportIcon from '@iconify/icons-material-symbols/support-agent'
import pluginIcon from '@iconify/icons-material-symbols/extension'
import moreIcon from '@iconify/icons-material-symbols/stars-outline'
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { v4 as uuidv4 } from 'uuid'
import i18next from 'i18next'

const userStore = useUserStore()
const loading = ref(false)
const loginTimer = ref<ReturnType<typeof setTimeout> | null>(null)

// Casdoor config - will be loaded from backend
const casdoorConfig: {
  serverUrl: string
  clientId: string
  protocol: string
} = window.electron.ipcRenderer.sendSync('ipc-get-casdoor-config')

async function openLogin() {
  if (loading.value) return

  loading.value = true

  // Generate and store random state for CSRF protection
  const state = uuidv4()
  sessionStorage.setItem('auth_state', state)

  // Clear existing timer if any
  if (loginTimer.value) clearTimeout(loginTimer.value)

  // Set timeout for 60 seconds
  loginTimer.value = setTimeout(() => {
    if (loading.value) {
      loading.value = false
      ElMessageBox.alert(
        i18next.t('user.messages.loginTimeout'),
        i18next.t('user.messages.warning'),
        {
          confirmButtonText: i18next.t('user.messages.ok'),
          type: 'warning'
        }
      )
    }
  }, 60000)

  // Construct deep link redirect URL
  const redirectUrl = `${casdoorConfig.protocol}://callback`

  const signinUrl = `${casdoorConfig.serverUrl}/login/oauth/authorize?client_id=${casdoorConfig.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=profile&state=${state}&noRedirect=true`

  window.electron.ipcRenderer.send('ipc-open-link', signinUrl)
}

async function openSignup() {
  // Ensure config is loaded

  window.electron.ipcRenderer.send('ipc-open-link', `${casdoorConfig.serverUrl}/signup`)
}

function handleLogout() {
  userStore.logout()
}

// Listen for auth code from main process
const handleReceiveCode = async (_event, code, returnedState) => {
  // Clear timer when code is received
  if (loginTimer.value) {
    clearTimeout(loginTimer.value)
    loginTimer.value = null
  }

  // Validate state
  const storedState = sessionStorage.getItem('auth_state')
  if (!storedState || storedState !== returnedState) {
    loading.value = false
    ElMessage.error(i18next.t('user.messages.securityVerificationFailed'))
    sessionStorage.removeItem('auth_state')
    return
  }

  // Clear state after successful validation
  sessionStorage.removeItem('auth_state')

  try {
    loading.value = true
    // Call main process to exchange code for user info
    // clientId and clientSecret are managed securely in the main process
    const userInfo = await window.electron.ipcRenderer.invoke('ipc-get-user-info', code)

    if (userInfo) {
      userStore.setUser(userInfo)
      // ElMessage.success('Login successful')
    }
  } catch (e) {
    console.error(e)
    ElMessage.error(i18next.t('user.messages.loginFailed'))
  } finally {
    loading.value = false
  }
}

let v
onMounted(async () => {
  userStore.loadFromStorage()
  v = window.electron.ipcRenderer.on('receiveCode', handleReceiveCode)
})

onUnmounted(() => {
  v()
  if (loginTimer.value) {
    clearTimeout(loginTimer.value)
  }
})
</script>

<style scoped lang="scss">
.user-profile {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
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
  max-width: 480px;
  width: 100%;

  h2 {
    margin: 20px 0 10px;
  }

  > p {
    color: var(--el-text-color-secondary);
    margin-bottom: 20px;
  }
}

.benefits-section {
  text-align: left;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;

  h4 {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--el-text-color-primary);
    text-align: center;
  }
}

.benefit-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;

  &:not(:last-child) {
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .benefit-icon {
    font-size: 24px;
    color: var(--el-color-primary);
    flex-shrink: 0;
    margin-top: 2px;
  }

  .benefit-content {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .benefit-title {
      font-weight: 600;
      font-size: 14px;
      color: var(--el-text-color-primary);
    }

    .benefit-desc {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      line-height: 1.4;
    }
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
  display: flex;
  flex-direction: column;
  justify-content: center;
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
