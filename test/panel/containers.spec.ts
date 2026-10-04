import { describe, expect, it } from 'vitest'
import {
  activePage,
  boundControl,
  cloneDocument,
  createControl,
  createDocument,
  duplicateControls,
  groupControls,
  isLocked,
  minimumSize,
  PanelHistory,
  removeControls,
  reparentControl,
  selectionRoots,
  ungroupControl,
  worldPosition
} from '../../src/renderer/src/views/uds/panel/free/model'

function fixture() {
  const doc = createDocument()
  const tabs = createControl('tabs', 'tabs', 'Tabs', 32, 32)
  const group = {
    ...createControl('group', 'group', 'Group', 8, 8),
    width: 240,
    height: 140,
    parentId: tabs.id,
    tabId: tabs.tabs![0].id
  }
  const button = { ...createControl('button', 'button', 'Button', 8, 8), parentId: group.id }
  const reading = {
    ...createControl('display', 'reading', 'Reading', 8, 8),
    parentId: tabs.id,
    tabId: tabs.tabs![1].id
  }
  doc.controls = [tabs, group, button, reading]
  return { doc, tabs, group, button, reading }
}

describe('panel containers', () => {
  it('keeps child coordinates and dimensions while moving the complete container', () => {
    const { doc, tabs, button } = fixture()
    const before = { ...button }
    const position = worldPosition(doc, button)
    tabs.x += 64
    tabs.y += 32
    expect(worldPosition(doc, button)).toEqual({ x: position.x + 64, y: position.y + 32 })
    expect(button).toEqual(before)
    expect(selectionRoots(doc, ['button', 'tabs', 'group'])).toEqual(['tabs'])
  })
  it('preserves world coordinates on reparenting and refuses cycles or inherited locks', () => {
    const { doc, tabs, group, button } = fixture()
    const position = worldPosition(doc, button)
    expect(reparentControl(doc, button.id)).toBe(true)
    expect(worldPosition(doc, button)).toEqual(position)
    expect(reparentControl(doc, tabs.id, group.id)).toBe(false)
    expect(reparentControl(doc, button.id, group.id)).toBe(true)
    tabs.locked = true
    expect(isLocked(doc, button)).toBe(true)
    expect(reparentControl(doc, button.id)).toBe(false)
    removeControls(doc, [button.id, group.id])
    expect(doc.controls).toHaveLength(4)
  })
  it('copies all pages and nested descendants with remapped control and page ids', () => {
    const { doc, tabs, group, button } = fixture()
    let id = 0
    const roots = duplicateControls(doc, [tabs.id, button.id], () => `copy-${++id}`)
    expect(roots).toHaveLength(1)
    expect(doc.controls).toHaveLength(8)
    expect(new Set(doc.controls.map((c) => c.id)).size).toBe(8)
    const copy = doc.controls.find((c) => c.id === roots[0])!
    const copiedGroup = doc.controls.find((c) => c.parentId === copy.id && c.type === 'group')!
    expect(copiedGroup.id).not.toBe(group.id)
    expect(copiedGroup.tabId).toBe(copy.tabs![0].id)
    expect(copy.tabs![0].id).not.toBe(tabs.tabs![0].id)
    expect(copy.defaultTabId).toBe(copy.tabs![0].id)
    const copiedButton = doc.controls.find((c) => c.parentId === copiedGroup.id)!
    expect([copiedButton.x, copiedButton.y]).toEqual([button.x, button.y])
    copy.tabs![0].label = 'Changed'
    expect(tabs.tabs![0].label).toBe('1')
  })
  it('removes the entire container including hidden pages and restores it in one undo', () => {
    const { doc, tabs, button } = fixture()
    button.locked = true
    const original = cloneDocument(doc)
    const history = new PanelHistory(doc)
    removeControls(doc, [tabs.id])
    history.record(doc)
    expect(doc.controls).toEqual([])
    expect(history.undo()).toEqual(original)
    expect(history.redo()).toEqual(doc)
  })
  it('groups siblings and ungroups without changing their screen positions', () => {
    const doc = createDocument()
    doc.controls = [
      createControl('switch', 'a', 'A', 32, 64),
      createControl('led', 'b', 'B', 192, 64)
    ]
    const original = cloneDocument(doc)
    expect(groupControls(doc, ['a', 'b'], 'group', 'Group')).toBe('group')
    for (const control of original.controls)
      expect(worldPosition(doc, doc.controls.find((c) => c.id === control.id)!)).toEqual({
        x: control.x,
        y: control.y
      })
    expect(ungroupControl(doc, 'group')).toEqual(['a', 'b'])
    expect(cloneDocument(doc)).toEqual(original)
  })
  it('does not group selections across pages and preserves relative spacing near the top edge', () => {
    const { doc, group, reading } = fixture()
    expect(groupControls(doc, [group.id, reading.id], 'invalid', 'Group')).toBeUndefined()
    const plain = createDocument()
    plain.controls = [
      createControl('switch', 'a', 'A', 0, 0),
      createControl('led', 'b', 'B', 160, 8)
    ]
    groupControls(plain, ['a', 'b'], 'group', 'Group')
    expect(plain.controls[1].y - plain.controls[0].y).toBe(8)
  })
  it('keeps children intact when the container is resized smaller than its contents', () => {
    const { doc, tabs, button } = fixture()
    const original = { ...button }
    const minimum = minimumSize(tabs, doc)
    tabs.width = 1
    tabs.height = 1
    boundControl(tabs, doc)
    expect([tabs.width, tabs.height]).toEqual([minimum.width, minimum.height])
    expect(button).toEqual(original)
  })
  it('uses saved default pages and falls back when an ephemeral page was removed', () => {
    const { tabs } = fixture()
    const first = tabs.tabs![0].id
    const second = tabs.tabs![1].id
    tabs.defaultTabId = second
    expect(activePage(tabs, {})).toBe(second)
    expect(activePage(tabs, { tabs: first })).toBe(first)
    tabs.tabs = tabs.tabs!.filter((page) => page.id !== first)
    expect(activePage(tabs, { tabs: first })).toBe(second)
    expect(tabs.defaultTabId).toBe(second)
  })
})
