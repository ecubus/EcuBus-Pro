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

async function getUserInfo(clientId: string, clientSecret: string, code: string) {
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
      const resp = await axios({
        method: 'get',
        url: `${getUserInfoUrl}?accessToken=${data.access_token}`
      })

      // Store encrypted tokens in electron-store on main process
      const tokens = {
        accessToken: encryptToken(data.access_token),
        refreshToken: encryptToken(data.refresh_token),
        expiresIn: data.expires_in
      }
      store.set('auth_tokens', tokens)

      return {
        ...resp.data,
        token: data.access_token, // Return plain token to renderer for immediate use (in memory)
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in
      }
    } else {
      throw new Error('Failed to get access token')
    }
  } catch (error) {
    log.error('Casdoor auth error:', error)
    throw error
  }
}

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
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
      // Update encrypted storage
      const storedTokens = (store.get('auth_tokens') as any) || {}
      const newTokens = {
        accessToken: encryptToken(data.access_token),
        refreshToken: data.refresh_token
          ? encryptToken(data.refresh_token)
          : storedTokens.refreshToken,
        expiresIn: data.expires_in
      }
      store.set('auth_tokens', newTokens)

      return {
        token: data.access_token,
        refreshToken: data.refresh_token,
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

ipcMain.handle('getUserInfo', async (event, clientId, clientSecret, code) => {
  // If code is not passed, try to get from store or waiting for it
  const authCode = code || store.get('casdoor_code')
  if (!authCode) {
    throw new Error('No authorization code found')
  }
  const userInfo = await getUserInfo(clientId, clientSecret, authCode)
  store.set('userInfo', userInfo)
  return userInfo
})

ipcMain.handle('refreshToken', async (event, clientId, clientSecret, refreshToken) => {
  // Use passed refreshToken or fallback to stored secure token
  let tokenToUse = refreshToken
  if (!tokenToUse) {
    const storedTokens = store.get('auth_tokens') as any
    if (storedTokens && storedTokens.refreshToken) {
      tokenToUse = decryptToken(storedTokens.refreshToken)
    }
  }

  if (!tokenToUse) {
    throw new Error('No refresh token provided')
  }

  const newTokens = await refreshAccessToken(clientId, clientSecret, tokenToUse)

  // Update stored user info with new tokens if available
  const currentUserInfo = store.get('userInfo') as any
  if (currentUserInfo) {
    store.set('userInfo', {
      ...currentUserInfo,
      token: newTokens.token,
      refreshToken: newTokens.refreshToken || currentUserInfo.refreshToken
    })
  }

  return newTokens
})

// Add handler to retrieve tokens securely if renderer needs them (e.g. reload)
ipcMain.handle('getStoredTokens', () => {
  const storedTokens = store.get('auth_tokens') as any
  if (storedTokens) {
    return {
      token: decryptToken(storedTokens.accessToken),
      refreshToken: decryptToken(storedTokens.refreshToken),
      expiresIn: storedTokens.expiresIn
    }
  }
  return null
})

ipcMain.handle('logout', () => {
  store.delete('auth_tokens')
  store.delete('userInfo')
  store.delete('casdoor_code')
})

export function handleProtocolUrl(protocolUrl: string) {
  try {
    const params = url.parse(protocolUrl, true).query
    if (params && params.code) {
      store.set('casdoor_code', params.code)
      if (global.mainWindow) {
        global.mainWindow.webContents.send('receiveCode', params.code)
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
