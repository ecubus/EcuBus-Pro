/**
 * Analytics (Aptabase-compatible API via main process). Tracks app usage, features, and screens.
 * Props are sent as JSON; only string, number, and boolean values are supported server-side.
 */

export type TrackProps = Record<string, string | number | boolean>

export function trackEvent(eventName: string, props?: TrackProps) {
  window.electron.ipcRenderer.send('aptabase-track-event', { eventName, props })
}
