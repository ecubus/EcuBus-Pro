import { app, ipcMain, net } from 'electron'
import { exec } from 'child_process'
import { readFile } from 'fs'
import { hostname, release } from 'os'
import log from 'electron-log'

export type AptabaseOptions = {
  host?: string
}

const SDK_VERSION = 'ecubus-analytics@1.0.0'

const _hosts: Record<string, string> = {
  US: 'https://us.aptabase.com',
  EU: 'https://eu.aptabase.com',
  DEV: 'http://localhost:3000',
  SH: ''
}

type EnvironmentInfo = {
  appVersion: string
  isDebug: boolean
  locale: string
  osName: string
  osVersion: string
  engineName: string
  engineVersion: string
  sdkVersion: string
}

const _sessionId = newSessionId()
let _appKey = ''
let _apiUrl = ''
let _env: EnvironmentInfo | undefined

function newSessionId(): string {
  return (process.env.COMPUTERNAME ?? hostname()).trim()
}

async function getOsVersion(): Promise<[string, string]> {
  switch (process.platform) {
    case 'win32':
      return ['Windows', release()]
    case 'darwin':
      try {
        const v = await new Promise<string>((resolve, reject) => {
          exec('/usr/bin/sw_vers -productVersion', (err, stdout) => {
            if (err) reject(err)
            else resolve(stdout.trim())
          })
        })
        return ['macOS', v]
      } catch {
        return ['macOS', '']
      }
    default: {
      try {
        const text = await new Promise<string>((resolve, reject) => {
          readFile('/etc/os-release', 'utf8', (err, data) => {
            if (err) reject(err)
            else resolve(data)
          })
        })
        const lines = text.split('\n')
        const map: Record<string, string> = {}
        for (const line of lines) {
          const [k, ...rest] = line.split('=')
          if (k && rest.length) {
            map[k] = rest.join('=').replace(/"/g, '')
          }
        }
        const name = map.NAME ?? 'Linux'
        const ver = map.VERSION_ID ?? ''
        return [name, ver]
      } catch {
        return ['Linux', '']
      }
    }
  }
}

async function getEnvironmentInfo(): Promise<EnvironmentInfo> {
  const [osName, osVersion] = await getOsVersion()
  return {
    appVersion: app.getVersion(),
    isDebug: !app.isPackaged,
    locale: app.getLocale(),
    osName,
    osVersion,
    engineName: 'Chromium',
    engineVersion: process.versions.chrome ?? '',
    sdkVersion: SDK_VERSION
  }
}

function getBaseUrl(region: string, options?: AptabaseOptions): string | undefined {
  if (region === 'SH') {
    if (!options?.host) {
      log.warn('Aptabase: Host parameter must be defined when using Self-Hosted App Key.')
      return undefined
    }
    return options.host
  }
  return _hosts[region]
}

function registerEventHandler(): void {
  ipcMain.on(
    'aptabase-track-event',
    (
      _event,
      payload: {
        eventName?: string
        name?: string
        props?: Record<string, string | number | boolean>
        properties?: Record<string, string | number | boolean>
      }
    ) => {
      const eventName = payload.eventName ?? payload.name
      if (!eventName) return
      const props = payload.props ?? payload.properties
      void trackEvent(eventName, props)
    }
  )
}

export async function initialize(appKey: string, options?: AptabaseOptions): Promise<void> {
  const parts = appKey.split('-')
  if (parts.length !== 3 || _hosts[parts[1]] === undefined) {
    log.warn(`Analytics: App Key "${appKey}" is invalid. Tracking will be disabled.`)
    return
  }

  const baseUrl = getBaseUrl(parts[1], options)
  if (!baseUrl) return

  _apiUrl = `${baseUrl}/api/v0/event`
  _env = await getEnvironmentInfo()
  _appKey = appKey

  registerEventHandler()
}

export function trackEvent(
  eventName: string,
  props?: Record<string, string | number | boolean>
): Promise<void> {
  if (!_appKey || !_env) {
    return Promise.resolve()
  }

  const now = new Date()

  const body = {
    timestamp: now.toISOString(),
    sessionId: _sessionId,
    eventName,
    systemProps: {
      isDebug: _env.isDebug,
      locale: _env.locale,
      osName: _env.osName,
      osVersion: _env.osVersion,
      engineName: _env.engineName,
      engineVersion: _env.engineVersion,
      appVersion: _env.appVersion,
      sdkVersion: _env.sdkVersion
    },
    props
  }

  return new Promise((resolve) => {
    const onReject = (err: Error) => {
      log.error('Analytics: Failed to send event', err)
      resolve()
    }

    const req = net.request({
      method: 'POST',
      url: _apiUrl,
      credentials: 'omit'
    })

    req.setHeader('Content-Type', 'application/json')
    req.setHeader('App-Key', _appKey)

    req.on('error', onReject)
    req.on('response', (res) => {
      if (res.statusCode && res.statusCode >= 300) {
        log.warn(
          `Analytics: Failed to send event "${eventName}": ${res.statusCode} ${res.statusMessage}`
        )
      }
      resolve()
    })

    req.write(JSON.stringify(body))
    req.end()
  })
}
