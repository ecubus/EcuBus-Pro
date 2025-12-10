import { ipcMain, app, safeStorage } from 'electron'
import axios from 'axios'
import Store from 'electron-store'
import log from 'electron-log/main'
import url from 'url'

const store = new Store()
const protocol = 'ecubuspro'
const ProtocolRegExp = new RegExp(`^${protocol}://`)

// Casdoor integration config
const serverUrl = 'https://door.whyengineer.com'
const authCodeUrl = `${serverUrl}/api/login/oauth/access_token`
const refreshTokenUrl = `${serverUrl}/api/login/oauth/refresh_token`
const getUserInfoUrl = `${serverUrl}/api/get-account`

// Load OAuth credentials from environment variables (set during build)
const clientId = (import.meta.env as any).MAIN_VITE_CLIENT_ID || ''
const clientSecret = (import.meta.env as any).MAIN_VITE_CLIENT_SECRET || ''

// Token management in main process
let currentAccessToken: string | null = null
let tokenRefreshTimer: NodeJS.Timeout | null = null
function encryptToken(token: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(token).toString('base64')
  }
  return token // Fallback if encryption unavailable (e.g. Linux without keyring) - ideally warn or handle differently
}

function decryptToken(encryptedToken: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(encryptedToken, 'base64'))
    } catch (e) {
      log.error('Failed to decrypt token:', e)
      return ''
    }
  }
  return encryptedToken
}

// Setup auto-refresh timer for access token
function setupTokenAutoRefresh(expiresIn: number) {
  // Clear existing timer
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer)
  }

  // Refresh 5 minutes before expiry (default 1 hour = 3600s, refresh after 55min)
  const refreshBeforeExpiry = 300 // 5 minutes in seconds
  const refreshInSeconds = Math.max(expiresIn - refreshBeforeExpiry, 60) // At least 1 minute

  log.info(
    `Access token auto-refresh scheduled in ${Math.floor(refreshInSeconds / 60)} minutes (${refreshInSeconds}s)`
  )

  tokenRefreshTimer = setTimeout(async () => {
    log.info('Auto-refreshing access token...')
    try {
      const storedRefreshToken = store.get('refresh_token') as string
      if (!storedRefreshToken) {
        log.warn('No refresh token available for auto-refresh')
        return
      }

      const refreshToken = decryptToken(storedRefreshToken)
      const newTokens = await refreshAccessToken(refreshToken)

      currentAccessToken = newTokens.token
      log.info('Access token auto-refreshed successfully')

      // Setup next refresh
      if (newTokens.expiresIn) {
        setupTokenAutoRefresh(newTokens.expiresIn)
      }
    } catch (error) {
      log.error('Auto-refresh failed:', error)
      currentAccessToken = null
    }
  }, refreshInSeconds * 1000)
}

function clearTokenAutoRefresh() {
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer)
    tokenRefreshTimer = null
    log.info('Token auto-refresh timer cleared')
  }
}

// Get current valid access token
export function getCurrentAccessToken(): string | null {
  return currentAccessToken
}

async function fetchUserProfile(accessToken: string) {
  const resp = await axios({
    method: 'get',
    url: `${getUserInfoUrl}?accessToken=${accessToken}`
  })
  return resp.data
}

async function getUserInfo(code: string) {
  try {
    const { data } = await axios({
      method: 'post',
      url: authCodeUrl,
      headers: {
        'content-type': 'application/json'
      },
      data: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code
      })
    })

    if (data.access_token) {
      const userProfile = await fetchUserProfile(data.access_token)

      // Store access token in main process memory
      currentAccessToken = data.access_token

      // Only store refresh token (encrypted on disk)
      store.set('refresh_token', encryptToken(data.refresh_token))

      // Setup auto-refresh timer
      if (data.expires_in) {
        setupTokenAutoRefresh(data.expires_in)
      }

      return {
        ...userProfile
        // Don't return token to renderer - main process handles all authenticated requests
      }
    } else {
      throw new Error('Failed to get access token')
    }
  } catch (error) {
    log.error('Casdoor auth error:', error)
    throw error
  }
}

async function refreshAccessToken(refreshToken: string) {
  try {
    const { data } = await axios({
      method: 'post',
      url: refreshTokenUrl,
      headers: {
        'content-type': 'application/json'
      },
      data: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        scope: 'profile'
      })
    })

    if (data.access_token) {
      // Update access token in memory
      currentAccessToken = data.access_token

      // Update refresh token if new one provided (Token Rotation)
      if (data.refresh_token) {
        store.set('refresh_token', encryptToken(data.refresh_token))
      }

      // Setup auto-refresh timer
      if (data.expires_in) {
        setupTokenAutoRefresh(data.expires_in)
      }

      return {
        token: data.access_token,
        expiresIn: data.expires_in
      }
    } else {
      throw new Error('Failed to refresh access token')
    }
  } catch (error) {
    log.error('Casdoor refresh token error:', error)
    throw error
  }
}

ipcMain.handle('ipc-auto-login', async () => {
  const storedRefreshToken = store.get('refresh_token') as string
  if (!storedRefreshToken) {
    log.info('No stored refresh token found')
    return null
  }

  const refreshToken = decryptToken(storedRefreshToken)

  try {
    // Use refresh token to get new access token
    log.info('Auto-login: Using refresh token to get new access token')
    const newTokens = await refreshAccessToken(refreshToken)

    // Fetch user profile with new access token
    const user = await fetchUserProfile(currentAccessToken!)

    return {
      ...user
      // Don't return token to renderer
    }
  } catch (error: any) {
    log.error('Auto login failed:', error.message)
    // Clear invalid refresh token and token
    store.delete('refresh_token')
    currentAccessToken = null
    clearTokenAutoRefresh()
    return null
  }
})

ipcMain.handle('ipc-get-user-info', async (event, code) => {
  if (!code) {
    throw new Error('No authorization code provided')
  }
  const userInfo = await getUserInfo(code)
  return userInfo
})

ipcMain.handle('refreshToken', async (event, refreshToken) => {
  // Use passed refreshToken or fallback to stored secure token
  let tokenToUse = refreshToken
  if (!tokenToUse) {
    const storedRefreshToken = store.get('refresh_token') as string
    if (storedRefreshToken) {
      tokenToUse = decryptToken(storedRefreshToken)
    }
  }

  if (!tokenToUse) {
    throw new Error('No refresh token provided')
  }

  const newTokens = await refreshAccessToken(tokenToUse)

  return newTokens
})

ipcMain.handle('ipc-logout', () => {
  store.delete('refresh_token')
  currentAccessToken = null
  clearTokenAutoRefresh()
  log.info('User logged out, tokens cleared')
})

// Provide client configuration for frontend (excluding secret) sendSync
ipcMain.on('ipc-get-casdoor-config', (event) => {
  event.returnValue = {
    serverUrl,
    clientId,
    protocol
  }
})

// Handler for making authenticated API calls from renderer
// Renderer calls this, main process adds token automatically
ipcMain.handle('ipc-authenticated-request', async (event, url: string, options: any = {}) => {
  if (!currentAccessToken) {
    throw new Error('Not authenticated')
  }

  try {
    const response = await axios({
      url,
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${currentAccessToken}`
      }
    })
    return response.data
  } catch (error: any) {
    // If 401, try to refresh token once and retry
    if (error.response?.status === 401) {
      log.info('Access token expired, attempting refresh...')
      const storedRefreshToken = store.get('refresh_token') as string
      if (storedRefreshToken) {
        try {
          const refreshToken = decryptToken(storedRefreshToken)
          await refreshAccessToken(refreshToken)

          // Retry original request with new token
          const retryResponse = await axios({
            url,
            ...options,
            headers: {
              ...options.headers,
              Authorization: `Bearer ${currentAccessToken}`
            }
          })
          return retryResponse.data
        } catch (refreshError) {
          log.error('Token refresh failed:', refreshError)
          throw refreshError
        }
      }
    }
    throw error
  }
})

export function handleProtocolUrl(protocolUrl: string) {
  try {
    const params = url.parse(protocolUrl, true).query
    if (params && params.code) {
      // Send code directly to renderer, no need to store
      if (global.mainWindow) {
        global.mainWindow.webContents.send('receiveCode', params.code, params.state)
      }
    }
  } catch (e) {
    log.error('Error handling protocol URL:', e)
  }
}

export function setupCasdoor() {
  /* single instance */
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    app.quit()
  } else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // Someone tried to run a second instance, we should focus our window.
      if (global.mainWindow) {
        if (global.mainWindow.isMinimized()) global.mainWindow.restore()
        global.mainWindow.focus()
      }
      // Protocol handler for second instance
      commandLine.forEach((str) => {
        if (ProtocolRegExp.test(str)) {
          handleProtocolUrl(str)
        }
      })
    })
  }

  /* login */
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(protocol, process.execPath, [path.resolve(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient(protocol)
  }

  // Handle open-url event (macOS)
  app.on('open-url', (event, openUrl) => {
    const isProtocol = ProtocolRegExp.test(openUrl)
    if (isProtocol) {
      event.preventDefault()
      handleProtocolUrl(openUrl)
    }
  })
}

import path from 'path'
