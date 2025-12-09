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
    user.value = userData
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
    // Retrieve tokens from main process secure storage
    try {
      const tokens = await window.electron.ipcRenderer.invoke('getStoredTokens')
      if (tokens) {
        token.value = tokens.token
        refreshToken.value = tokens.refreshToken
      }
      // Also load user info if persisted (though tokens are more critical)
      // User info could be re-fetched using the token
    } catch (e) {
      console.error('Failed to load stored tokens', e)
    }
  }

  function logout() {
    user.value = null
    token.value = null
    refreshToken.value = null
    window.electron.ipcRenderer.invoke('logout')
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
