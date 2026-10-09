import { describe, expect, it } from 'vitest'
import {
  isEditableKeyEvent,
  isEditableKeyboardTarget,
  isEventInsideRoot,
  shouldFocusIaRoot,
  shouldHandleIaShortcut,
  type IaKeyEvent
} from '../../src/renderer/src/views/uds/ia/iaKeyGuard'

type FakeNode = {
  nodeType?: number
  tagName?: string
  className?: string
  classList?: { contains: (token: string) => boolean }
  isContentEditable?: boolean
  parentElement?: FakeNode | null
  getAttribute?: (name: string) => string | null
  contains?: (node: unknown) => boolean
}

function attrs(values: Record<string, string>): (name: string) => string | null {
  return (name) => (Object.prototype.hasOwnProperty.call(values, name) ? values[name] : null)
}

function classes(...tokens: string[]): FakeNode['classList'] {
  return { contains: (token) => tokens.includes(token) }
}

function node(partial: FakeNode): FakeNode {
  return partial
}

function event(target: unknown, path?: readonly unknown[]): IaKeyEvent {
  return path ? { target, composedPath: () => path } : { target }
}

describe('isEditableKeyboardTarget', () => {
  it('treats native text fields as editable', () => {
    expect(isEditableKeyboardTarget(node({ tagName: 'INPUT' }))).toBe(true)
    expect(isEditableKeyboardTarget(node({ tagName: 'textarea' }))).toBe(true)
    expect(isEditableKeyboardTarget(node({ tagName: 'SeLeCt' }))).toBe(true)
  })

  it('ignores non-editing elements', () => {
    expect(isEditableKeyboardTarget(null)).toBe(false)
    expect(isEditableKeyboardTarget(undefined)).toBe(false)
    expect(isEditableKeyboardTarget('c')).toBe(false)
    expect(isEditableKeyboardTarget(node({ tagName: 'DIV' }))).toBe(false)
    expect(isEditableKeyboardTarget(node({ tagName: 'BUTTON' }))).toBe(false)
  })

  it('detects contenteditable, including descendants and plaintext-only', () => {
    expect(
      isEditableKeyboardTarget(
        node({ tagName: 'DIV', getAttribute: attrs({ contenteditable: 'true' }) })
      )
    ).toBe(true)
    expect(
      isEditableKeyboardTarget(
        node({ tagName: 'DIV', getAttribute: attrs({ contenteditable: '' }) })
      )
    ).toBe(true)
    expect(
      isEditableKeyboardTarget(
        node({ tagName: 'DIV', getAttribute: attrs({ contenteditable: 'PlainText-Only' }) })
      )
    ).toBe(true)
    expect(
      isEditableKeyboardTarget(
        node({ tagName: 'DIV', getAttribute: attrs({ contenteditable: 'false' }) })
      )
    ).toBe(false)

    const editor = node({ tagName: 'DIV', isContentEditable: true })
    const text = node({ nodeType: 3, parentElement: editor })
    expect(isEditableKeyboardTarget(text)).toBe(true)

    const host = node({ tagName: 'DIV', getAttribute: attrs({ contenteditable: 'true' }) })
    const child = node({ tagName: 'SPAN', parentElement: host })
    expect(isEditableKeyboardTarget(child)).toBe(true)
  })

  it('detects Monaco and Element Plus editors via an ancestor class', () => {
    const monaco = node({ tagName: 'DIV', classList: classes('monaco-editor') })
    const view = node({ tagName: 'DIV', parentElement: monaco })
    expect(isEditableKeyboardTarget(view)).toBe(true)

    const select = node({ tagName: 'DIV', className: 'el-select el-select--small' })
    const wrapper = node({ tagName: 'DIV', className: 'el-select__wrapper', parentElement: select })
    expect(isEditableKeyboardTarget(wrapper)).toBe(true)

    const input = node({ tagName: 'DIV', classList: classes('el-input') })
    expect(isEditableKeyboardTarget(node({ tagName: 'SPAN', parentElement: input }))).toBe(true)
    expect(
      isEditableKeyboardTarget(node({ tagName: 'DIV', classList: classes('el-textarea') }))
    ).toBe(true)
    expect(
      isEditableKeyboardTarget(node({ tagName: 'DIV', classList: classes('el-input-number') }))
    ).toBe(true)
  })

  it('detects ARIA text boxes', () => {
    for (const role of ['textbox', 'searchbox', 'combobox']) {
      expect(
        isEditableKeyboardTarget(node({ tagName: 'DIV', getAttribute: attrs({ role }) }))
      ).toBe(true)
    }
  })
})

describe('shouldHandleIaShortcut', () => {
  const root = node({ tagName: 'DIV' })
  const other = node({ tagName: 'DIV' })
  const cell = node({ tagName: 'TD', parentElement: root })
  const input = node({ tagName: 'INPUT', parentElement: cell })

  it('accepts a non-editable target inside this root, including the root itself', () => {
    expect(shouldHandleIaShortcut(event(cell), root)).toBe(true)
    expect(shouldHandleIaShortcut(event(root), root)).toBe(true)
  })

  it('rejects editable targets inside the root', () => {
    expect(shouldHandleIaShortcut(event(input), root)).toBe(false)
    const editor = node({
      tagName: 'DIV',
      classList: classes('monaco-editor'),
      parentElement: root
    })
    expect(
      shouldHandleIaShortcut(event(node({ tagName: 'DIV', parentElement: editor })), root)
    ).toBe(false)
  })

  it('rejects targets that belong to another window', () => {
    const foreign = node({ tagName: 'TD', parentElement: other })
    expect(shouldHandleIaShortcut(event(foreign), root)).toBe(false)
    expect(shouldHandleIaShortcut(event(cell), other)).toBe(false)
    expect(shouldHandleIaShortcut(event(cell), null)).toBe(false)
  })

  it('uses the composed path when the target is inside a shadow tree', () => {
    const shadowCell = node({ tagName: 'DIV' })
    const shadowInput = node({ tagName: 'TEXTAREA' })
    expect(shouldHandleIaShortcut(event(shadowCell, [shadowCell, root]), root)).toBe(true)
    expect(shouldHandleIaShortcut(event(shadowInput, [shadowInput, root]), root)).toBe(false)
    expect(shouldHandleIaShortcut(event(shadowCell, [shadowCell, other]), root)).toBe(false)

    const text = node({ nodeType: 3 })
    const editable = node({ tagName: 'DIV', isContentEditable: true })
    expect(isEditableKeyEvent(event(text, [text, editable, root]))).toBe(true)
    expect(isEventInsideRoot(event(shadowCell, [shadowCell, root]), root)).toBe(true)
  })

  it('falls back to the parent chain when contains() rejects the target', () => {
    const picky = node({
      tagName: 'DIV',
      contains: () => {
        throw new TypeError('not a Node')
      }
    })
    const inside = node({ tagName: 'TD', parentElement: picky })
    expect(isEventInsideRoot(event(inside), picky)).toBe(true)
    expect(shouldHandleIaShortcut(event(inside), picky)).toBe(true)
  })
})

describe('shouldFocusIaRoot', () => {
  const root = node({ tagName: 'DIV', getAttribute: attrs({ tabindex: '-1' }) })
  const cell = node({ tagName: 'TD', parentElement: root })
  const label = node({ tagName: 'SPAN', parentElement: cell })

  it('focuses the root when the pointer hits a non-focusable cell', () => {
    expect(shouldFocusIaRoot(label, root)).toBe(true)
    expect(shouldFocusIaRoot(cell, root)).toBe(true)
  })

  it('leaves focus on text fields, selects, and buttons', () => {
    expect(shouldFocusIaRoot(node({ tagName: 'INPUT', parentElement: cell }), root)).toBe(false)
    expect(shouldFocusIaRoot(node({ tagName: 'TEXTAREA', parentElement: root }), root)).toBe(false)
    const button = node({ tagName: 'BUTTON', parentElement: root })
    expect(shouldFocusIaRoot(button, root)).toBe(false)
    expect(shouldFocusIaRoot(node({ tagName: 'SPAN', parentElement: button }), root)).toBe(false)
    const select = node({ tagName: 'DIV', classList: classes('el-select'), parentElement: root })
    expect(shouldFocusIaRoot(node({ tagName: 'DIV', parentElement: select }), root)).toBe(false)
    expect(
      shouldFocusIaRoot(
        node({ tagName: 'DIV', getAttribute: attrs({ tabindex: '0' }), parentElement: root }),
        root
      )
    ).toBe(false)
  })

  it('does not move focus for clicks outside this window or on the root itself', () => {
    const outside = node({ tagName: 'TD' })
    expect(shouldFocusIaRoot(outside, root)).toBe(false)
    expect(shouldFocusIaRoot(root, root)).toBe(false)
    expect(shouldFocusIaRoot(null, root)).toBe(false)
    expect(shouldFocusIaRoot(label, null)).toBe(false)
  })
})
