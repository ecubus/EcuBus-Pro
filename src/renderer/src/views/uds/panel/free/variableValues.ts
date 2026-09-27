import type { VarItem } from 'src/preload/data'

export function readPanelVariables(
  project: { path: string; name: string },
  variables: Record<string, VarItem>,
  running: boolean
) {
  const request = Object.fromEntries(
    Object.entries(variables).map(([id, variable]) => [
      id,
      {
        type: variable.type,
        rememberValue: variable.rememberValue,
        value: variable.value ? { type: variable.value.type } : undefined
      }
    ])
  )
  return window.electron.ipcRenderer.invoke(
    'ipc-panel-var-values',
    { ...project },
    request,
    running
  )
}
