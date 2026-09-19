import type {
  PanelControl,
  PanelControlType,
  PanelDocument,
  PanelLabelPosition
} from 'src/preload/panel'

export const controlTypes: PanelControlType[] = [
  'text',
  'display',
  'number',
  'input',
  'path',
  'checkbox',
  'radio',
  'button',
  'startStop',
  'switch',
  'led',
  'slider',
  'select',
  'progress',
  'gauge',
  'html',
  'image',
  'group',
  'tabs'
]

export function createDocument(): PanelDocument {
  return { schemaVersion: 2, width: 800, height: 480, controls: [] }
}

export function createControl(
  type: PanelControlType,
  id: string,
  label: string,
  x = 32,
  y = 32
): PanelControl {
  return {
    id,
    type,
    label,
    x,
    y,
    width: ['group', 'tabs'].includes(type)
      ? 320
      : ['switch', 'led'].includes(type)
        ? 128
        : ['slider', 'progress', 'path', 'radio'].includes(type)
          ? 240
          : 160,
    height: ['group', 'tabs'].includes(type)
      ? 200
      : ['text', 'switch', 'led'].includes(type)
        ? 32
        : type === 'progress'
          ? 48
          : ['gauge', 'image'].includes(type)
            ? 128
            : type === 'html'
              ? 320
              : 64,
    ...(type === 'input' ? { width: 320, height: 140, editorMode: 'both' as const } : {}),
    ...(type === 'html'
      ? {
          width: 320,
          height: 200,
          htmlContent: '<div style="padding: 12px; font-family: sans-serif">HTML Panel</div>',
          scriptContent: ''
        }
      : {}),
    ...(type === 'led' ? { width: 48, height: 48 } : {}),
    ...(type === 'startStop' ? { width: 220, height: 48 } : {}),
    ...(type === 'progress'
      ? { labelPosition: 'left' as const, progressValuePosition: 'hidden' as const }
      : {}),
    locked: false,
    fontSize: 14,
    color: '',
    unit: '',
    min: 0,
    max: 100,
    step: 1,
    initialValue: 0,
    pressValue: 1,
    releaseValue: 0,
    toggle: false,
    readOnly: false,
    options:
      type === 'radio'
        ? [
            { label: '0', value: 0 },
            { label: '1', value: 1 }
          ]
        : [],
    ...(type === 'tabs'
      ? {
          tabs: [
            { id: `${id}-1`, label: '1' },
            { id: `${id}-2`, label: '2' }
          ],
          defaultTabId: `${id}-1`
        }
      : {})
  }
}

export function rangeFraction(value: number | string | undefined, min: number, max: number) {
  if (value == null || (typeof value === 'string' && !value.trim())) return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min)
    return null
  return Math.max(0, Math.min(1, (numeric - min) / (max - min)))
}

export function cloneDocument(document: PanelDocument): PanelDocument {
  return JSON.parse(JSON.stringify(document))
}

export function resizeCanvas(document: PanelDocument, width: number, height: number) {
  const roots = document.controls.filter((control) => !control.parentId)
  document.width = Math.max(
    160,
    ...roots.map((c) => c.x + c.width),
    Math.min(4096, Math.round(width))
  )
  document.height = Math.max(
    160,
    ...roots.map((c) => c.y + c.height),
    Math.min(4096, Math.round(height))
  )
}

export function boundControl(control: PanelControl, document: PanelDocument) {
  const parent = document.controls.find((c) => c.id === control.parentId)
  const width = parent?.width ?? document.width
  const height = parent ? parent.height - containerHeader : document.height
  const minimum = minimumSize(control, document)
  control.width = Math.max(minimum.width, Math.min(width, control.width))
  control.height = Math.max(minimum.height, Math.min(height, control.height))
  control.x = Math.round(Math.max(0, Math.min(width - control.width, control.x)))
  control.y = Math.round(Math.max(0, Math.min(height - control.height, control.y)))
}

export function minimumSize(control: PanelControl, document: PanelDocument) {
  if (control.type === 'progress' && control.progressShowLimits) return { width: 80, height: 56 }
  const children = document.controls.filter((c) => c.parentId === control.id)
  return isContainer(control)
    ? {
        width: Math.max(96, ...children.map((c) => c.x + c.width)),
        height: Math.max(80, ...children.map((c) => c.y + c.height + containerHeader))
      }
    : { width: 32, height: 24 }
}

export const containerHeader = 28
export function isContainer(control: PanelControl) {
  return control.type === 'group' || control.type === 'tabs'
}
export function ancestors(document: PanelDocument, control: PanelControl): PanelControl[] {
  const result: PanelControl[] = []
  const seen = new Set([control.id])
  let parent = document.controls.find((c) => c.id === control.parentId)
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id)
    result.push(parent)
    parent = document.controls.find((c) => c.id === parent!.parentId)
  }
  return result
}
export function isLocked(document: PanelDocument, control: PanelControl) {
  return control.locked || ancestors(document, control).some((c) => c.locked)
}
export function selectionRoots(document: PanelDocument, ids: string[]) {
  return ids.filter((id) => {
    const c = document.controls.find((item) => item.id === id)
    return c && !ancestors(document, c).some((parent) => ids.includes(parent.id))
  })
}
export function sameScope(controls: PanelControl[]) {
  return (
    controls.length > 0 &&
    controls.every((c) => c.parentId === controls[0].parentId && c.tabId === controls[0].tabId)
  )
}
export function activePage(control: PanelControl, pages: Record<string, string>) {
  return (
    control.tabs?.find((tab) => tab.id === pages[control.id])?.id ||
    control.tabs?.find((tab) => tab.id === control.defaultTabId)?.id ||
    control.tabs?.[0]?.id
  )
}
export function worldPosition(document: PanelDocument, control: PanelControl) {
  return ancestors(document, control).reduce(
    (pos, parent) => ({ x: pos.x + parent.x, y: pos.y + parent.y + containerHeader }),
    { x: control.x, y: control.y }
  )
}
export function reparentControl(
  document: PanelDocument,
  id: string,
  parentId?: string,
  tabId?: string
) {
  const control = document.controls.find((c) => c.id === id)
  const parent = document.controls.find((c) => c.id === parentId)
  if (!control || isLocked(document, control)) return false
  if (
    parentId &&
    (!parent ||
      !isContainer(parent) ||
      isLocked(document, parent) ||
      parent.id === id ||
      ancestors(document, parent).some((c) => c.id === id))
  )
    return false
  const minimum = minimumSize(control, document)
  if (
    minimum.width > (parent?.width ?? document.width) ||
    minimum.height > (parent ? parent.height - containerHeader : document.height)
  )
    return false
  const position = worldPosition(document, control)
  const origin = parent ? worldPosition(document, parent) : { x: 0, y: -containerHeader }
  control.parentId = parent?.id
  control.tabId =
    parent?.type === 'tabs' ? activePage(parent, { [parent.id]: tabId || '' }) : undefined
  control.x = position.x - origin.x
  control.y = position.y - origin.y - containerHeader
  boundControl(control, document)
  return true
}
export function removeControls(document: PanelDocument, ids: string[]) {
  const roots = selectionRoots(document, ids).filter(
    (id) => !isLocked(document, document.controls.find((c) => c.id === id)!)
  )
  document.controls = document.controls.filter(
    (c) =>
      !roots.includes(c.id) && !ancestors(document, c).some((parent) => roots.includes(parent.id))
  )
}
export function groupControls(document: PanelDocument, ids: string[], id: string, label: string) {
  const selected = selectionRoots(document, ids)
    .map((id) => document.controls.find((c) => c.id === id)!)
    .filter((c) => !isLocked(document, c))
  if (selected.length < 2 || !sameScope(selected)) return undefined
  const x = Math.min(...selected.map((c) => c.x))
  const top = Math.min(...selected.map((c) => c.y))
  const y = Math.max(0, top - containerHeader)
  const group = createControl('group', id, label, x, y)
  group.parentId = selected[0].parentId
  group.tabId = selected[0].tabId
  group.width = Math.max(...selected.map((c) => c.x + c.width)) - x
  group.height = Math.max(...selected.map((c) => c.y + c.height)) - top + containerHeader
  const parent = document.controls.find((c) => c.id === group.parentId)
  if (group.height > (parent ? parent.height - containerHeader : document.height)) return undefined
  document.controls.push(group)
  boundControl(group, document)
  selected.forEach((c) => {
    c.x -= x
    c.y -= top
    c.parentId = group.id
    c.tabId = undefined
  })
  return group.id
}
export function ungroupControl(document: PanelDocument, id: string) {
  const group = document.controls.find((c) => c.id === id)
  if (!group || group.type !== 'group' || isLocked(document, group)) return []
  const children = document.controls.filter((c) => c.parentId === id)
  children.forEach((c) => {
    c.x += group.x
    c.y += group.y + containerHeader
    c.parentId = group.parentId
    c.tabId = group.tabId
  })
  document.controls = document.controls.filter((c) => c.id !== id)
  return children.map((c) => c.id)
}

export function duplicateControls(
  document: PanelDocument,
  ids: string[],
  newId: () => string
): string[] {
  const roots = selectionRoots(document, ids)
  const source = document.controls.filter(
    (c) => roots.includes(c.id) || ancestors(document, c).some((p) => roots.includes(p.id))
  )
  const mapping = new Map(source.map((c) => [c.id, newId()]))
  const tabs = new Map(
    source.flatMap((c) => c.tabs?.map((tab) => [tab.id, newId()] as const) || [])
  )
  const copies = source.map((c) => {
    const copy = JSON.parse(JSON.stringify(c)) as PanelControl
    copy.id = mapping.get(c.id)!
    copy.parentId = mapping.get(c.parentId || '') || c.parentId
    copy.tabId = tabs.get(c.tabId || '') || c.tabId
    copy.tabs = c.tabs?.map((tab) => ({ ...tab, id: tabs.get(tab.id)! }))
    copy.defaultTabId = tabs.get(c.defaultTabId || '') || c.defaultTabId
    if (roots.includes(c.id)) {
      copy.x += 16
      copy.y += 16
      copy.locked = false
    }
    return copy
  })
  document.controls.push(...copies)
  const copiedRoots = roots.map((id) => mapping.get(id)!)
  copiedRoots.forEach((id) => boundControl(document.controls.find((c) => c.id === id)!, document))
  return copiedRoots
}

export type Arrangement = 'left' | 'top' | 'width' | 'height' | 'horizontal' | 'vertical'
export function arrangeControls(document: PanelDocument, ids: string[], mode: Arrangement) {
  const controls = ids
    .map((id) => document.controls.find((c) => c.id === id))
    .filter((c): c is PanelControl => !!c && !isLocked(document, c))
  if (controls.length < 2 || !sameScope(controls)) return
  const first = controls[0]
  if (mode === 'horizontal' || mode === 'vertical') {
    if (controls.length < 3) return
    const pos = mode === 'horizontal' ? 'x' : 'y'
    const size = mode === 'horizontal' ? 'width' : 'height'
    controls.sort((a, b) => a[pos] - b[pos])
    const last = controls[controls.length - 1]
    const gap =
      (last[pos] + last[size] - controls[0][pos] - controls.reduce((sum, c) => sum + c[size], 0)) /
      (controls.length - 1)
    let cursor = controls[0][pos]
    controls.forEach((c) => {
      c[pos] = Math.round(cursor)
      cursor += c[size] + gap
    })
  } else {
    controls.slice(1).forEach((c) => {
      if (mode === 'left') c.x = first.x
      else if (mode === 'top') c.y = first.y
      else c[mode] = first[mode]
      boundControl(c, document)
    })
  }
}

export class PanelHistory {
  private entries: string[]
  private index = 0
  constructor(document: PanelDocument) {
    this.entries = [JSON.stringify(document)]
  }
  get canUndo() {
    return this.index > 0
  }
  get canRedo() {
    return this.index < this.entries.length - 1
  }
  record(document: PanelDocument) {
    const value = JSON.stringify(document)
    if (this.entries[this.index] === value) return
    this.entries = this.entries.slice(0, this.index + 1)
    this.entries.push(value)
    if (this.entries.length > 100) this.entries.shift()
    this.index = this.entries.length - 1
  }
  undo(): PanelDocument {
    if (this.canUndo) this.index--
    return JSON.parse(this.entries[this.index])
  }
  redo(): PanelDocument {
    if (this.canRedo) this.index++
    return JSON.parse(this.entries[this.index])
  }
}

export const labelPositions: PanelLabelPosition[] = [
  'top',
  'bottom',
  'left',
  'right',
  'center',
  'hidden'
]

export function supportsLabelPosition(control: PanelControl): boolean {
  return [
    'display',
    'number',
    'input',
    'path',
    'checkbox',
    'radio',
    'switch',
    'led',
    'slider',
    'select',
    'progress',
    'gauge'
  ].includes(control.type)
}

export function labelPosition(control: PanelControl): PanelLabelPosition {
  return control.labelPosition ?? (control.type === 'led' ? 'hidden' : 'left')
}
