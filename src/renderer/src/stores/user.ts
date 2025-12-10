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

  const isLoggedIn = ref(false)

  function setUser(userData: any) {
    // Check if userData has the structure from Casdoor response
    if (userData?.data) {
      user.value = userData.data
    } else {
      user.value = userData
    }
    isLoggedIn.value = !!userData
  }

  async function loadFromStorage() {
    // Try auto-login via main process
    // Main process manages all tokens and auto-refresh
    try {
      const userInfo = await window.electron.ipcRenderer.invoke('ipc-auto-login')
      if (userInfo) {
        setUser(userInfo)
      } else {
        // If auto-login failed, clear state
        user.value = null
        isLoggedIn.value = false
      }
    } catch (e) {
      console.error('Failed to auto-login', e)
    }
  }

  function logout() {
    user.value = null
    isLoggedIn.value = false
    window.electron.ipcRenderer.invoke('ipc-logout')
  }

  return {
    user,
    isLoggedIn,
    setUser,
    loadFromStorage,
    logout
  }
})
