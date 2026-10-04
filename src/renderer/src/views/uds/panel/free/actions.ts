import type { PanelControl } from 'src/preload/panel'

export function isActionButton(control: PanelControl) {
  return (
    control.type === 'startStop' ||
    (control.type === 'button' && !!control.buttonAction && control.buttonAction !== 'write')
  )
}

export function actionAvailable(
  control: PanelControl,
  running: boolean,
  panelExists: (id: string) => boolean
) {
  if (control.readOnly || !isActionButton(control)) return false
  if (control.type === 'startStop') return true
  switch (control.buttonAction) {
    case 'openFile':
      return !!control.actionPath?.trim()
    case 'openPanel':
      return !!control.actionPanelId && panelExists(control.actionPanelId)
    case 'start':
      return !running
    case 'stop':
      return running
    default:
      return false
  }
}

export async function selectPath(
  mode: PanelControl['pathMode'],
  current: string,
  invoke: (channel: string, options: Record<string, unknown>) => Promise<any>
): Promise<string | undefined> {
  const result = await invoke(mode === 'save' ? 'ipc-show-save-dialog' : 'ipc-show-open-dialog', {
    ...(current ? { defaultPath: current } : {}),
    ...(mode === 'save'
      ? {}
      : { properties: [mode === 'directory' ? 'openDirectory' : 'openFile'] })
  })
  if (result.canceled) return undefined
  return mode === 'save' ? result.filePath : result.filePaths?.[0]
}
