import type { DataSet, PanelItem } from 'src/preload/data'
import type { PanelBinding, PanelDocument } from 'src/preload/panel'
import { cloneDocument, controlTypes, createControl } from '../views/uds/panel/free/model'
import { panelSources } from '../views/uds/panel/free/sources'
import { getAllSysVar } from 'nodeCan/sysVar'

export function parsePanelFile(text: string): { name: string; document: PanelDocument } {
  const file = JSON.parse(text)
  const doc = file?.document
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
  if (
    file?.format !== 'ecubus-panel' ||
    file.version !== 1 ||
    typeof file.name !== 'string' ||
    !file.name.trim() ||
    doc?.schemaVersion !== 2 ||
    !finite(doc.width) ||
    !finite(doc.height) ||
    doc.width <= 0 ||
    doc.height <= 0 ||
    !Array.isArray(doc.controls)
  )
    throw new Error('Invalid Panel file')
  const ids = new Set<string>()
  for (const c of doc.controls) {
    if (
      !c ||
      typeof c.id !== 'string' ||
      !c.id ||
      ids.has(c.id) ||
      !controlTypes.includes(c.type) ||
      typeof c.label !== 'string' ||
      !['x', 'y', 'width', 'height'].every((k) => finite(c[k])) ||
      c.width <= 0 ||
      c.height <= 0 ||
      c.x < 0 ||
      c.y < 0 ||
      [
        'min',
        'max',
        'step',
        'fontSize',
        'initialValue',
        'pressValue',
        'releaseValue',
        'numberDecimals',
        'alarmLower',
        'alarmUpper'
      ].some((k) => c[k] != null && !finite(c[k])) ||
      (c.options != null &&
        (!Array.isArray(c.options) ||
          c.options.some((o: any) => !o || typeof o.label !== 'string' || !finite(o.value)))) ||
      (c.tabs != null &&
        (!Array.isArray(c.tabs) ||
          c.tabs.some((t: any) => !t || typeof t.id !== 'string' || typeof t.label !== 'string')))
    )
      throw new Error('Invalid Panel control')
    if (c.binding) {
      const b = c.binding
      const target = b.node?.bindValue
      if (
        !['signal', 'variable'].includes(b.kind) ||
        !target ||
        typeof b.node.id !== 'string' ||
        (b.kind === 'signal'
          ? typeof target.dbName !== 'string' ||
            typeof target.signalName !== 'string' ||
            !finite(target.frameId)
          : typeof target.variableFullName !== 'string' || typeof target.variableId !== 'string')
      )
        throw new Error('Invalid Panel binding')
    }
    ids.add(c.id)
  }
  doc.controls = doc.controls.map((c: any) => ({ ...createControl(c.type, c.id, c.label), ...c }))
  for (const c of doc.controls) {
    const seen = new Set([c.id])
    let child = c
    while (child.parentId) {
      const parent = doc.controls.find((p: any) => p.id === child.parentId)
      if (
        !parent ||
        seen.has(parent.id) ||
        !['group', 'tabs'].includes(parent.type) ||
        (parent.type === 'tabs' && !parent.tabs?.some((t: any) => t.id === child.tabId))
      )
        throw new Error('Invalid Panel container')
      seen.add(parent.id)
      child = parent
    }
  }
  return { name: file.name.trim(), document: doc }
}

export function serializePanelFile(name: string, document: PanelDocument) {
  const text = JSON.stringify({ format: 'ecubus-panel', version: 1, name, document }, null, 2)
  parsePanelFile(text)
  return text
}

function sameSource(a: PanelBinding, b: PanelBinding) {
  if (a.kind === 'variable' && b.kind === 'variable')
    return (
      a.node.bindValue.variableFullName === b.node.bindValue.variableFullName &&
      a.node.bindValue.variableType === b.node.bindValue.variableType &&
      a.node.bindValue.variableValueType === b.node.bindValue.variableValueType
    )
  if (a.kind === 'signal' && b.kind === 'signal')
    return (
      a.node.id.split('.')[0] === b.node.id.split('.')[0] &&
      a.node.bindValue.dbName === b.node.bindValue.dbName &&
      a.node.bindValue.frameId === b.node.bindValue.frameId &&
      a.node.bindValue.signalName === b.node.bindValue.signalName
    )
  return false
}

export function bindPanelFile(document: PanelDocument, data: DataSet) {
  const result = cloneDocument(document)
  const sources = panelSources(data.database, {
    ...data.vars,
    ...getAllSysVar(data.devices, data.tester, data.database.orti)
  })
  for (const c of result.controls) {
    if (!c.binding) continue
    const matches = sources.filter((s) => sameSource(c.binding!, s.binding))
    if (matches.length === 1) c.binding = JSON.parse(JSON.stringify(matches[0].binding))
    else if (c.binding.kind === 'variable') c.binding.node.bindValue.variableId = ''
    else c.binding.node.bindValue.dbKey = ''
  }
  return result
}

export async function loadPanelFiles(data: DataSet, directory: string) {
  for (const panel of Object.values(data.panels)) {
    if (!panel.filePath) continue
    panel.filePath = window.path.isAbsolute(panel.filePath)
      ? panel.filePath
      : window.path.join(directory, panel.filePath)
    delete panel.document
    try {
      const file = parsePanelFile(
        await window.electron.ipcRenderer.invoke('ipc-fs-readFile', panel.filePath, 'utf-8')
      )
      panel.document = bindPanelFile(file.document, data)
      delete panel.fileError
    } catch {
      panel.fileError = panel.filePath
    }
  }
}

export function panelUsingFile(
  panels: Record<string, PanelItem>,
  filePath: string,
  exceptId?: string
) {
  return Object.values(panels).find(
    (panel) =>
      panel.id !== exceptId &&
      !!panel.filePath &&
      window.path.relative(panel.filePath, filePath) === ''
  )
}

export function panelReferences(
  panels: Record<string, PanelItem>,
  directory: string
): Record<string, PanelItem> {
  return Object.fromEntries(
    Object.entries(panels).map(([id, { document: _document, ...panel }]) => [
      id,
      panel.filePath
        ? {
            id: panel.id,
            name: panel.name,
            filePath: window.path.relative(directory, panel.filePath) || panel.filePath,
            rule: [],
            options: {}
          }
        : panel
    ])
  )
}
