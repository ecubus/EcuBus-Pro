import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const user = ref<null | {
    id: string
    email: string
    displayName: string
    avatar?: string
    license?: string
  }>(null)

  const token = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)

  function setUser(userData: any) {
    // Check if userData has the structure from Casdoor response
    if (userData?.data) {
      user.value = userData.data
    } else {
      user.value = userData
    }
  }

  function setToken(t: string, rt?: string) {
    token.value = t
    // Ideally, keep tokens only in memory in renderer.
    // If persistence is needed across reloads, rely on main process to provide them on startup.
    // For now, we still keep them in memory.
    if (rt) {
      refreshToken.value = rt
    }
  }

  async function loadFromStorage() {
    // Try auto-login via main process
    // clientId and clientSecret are managed securely in the main process
    try {
      const userInfo = await window.electron.ipcRenderer.invoke('ipc-auto-login')
      console.log('userInfo', userInfo)
      if (userInfo) {
        setUser(userInfo)
        setToken(userInfo.token, userInfo.refreshToken)
      } else {
        // If auto-login failed (e.g. no tokens or invalid), ensure state is cleared
        token.value = null
        refreshToken.value = null
        user.value = null
      }
    } catch (e) {
      console.error('Failed to load stored tokens/auto-login', e)
    }
  }

  function logout() {
    user.value = null
    token.value = null
    refreshToken.value = null
    window.electron.ipcRenderer.invoke('ipc-logout')
  }

  return {
    user,
    token,
    refreshToken,
    setUser,
    setToken,
    loadFromStorage,
    logout
  }
})
