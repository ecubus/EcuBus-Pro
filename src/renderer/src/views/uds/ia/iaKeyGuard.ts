/**
 * Decides whether an interaction-window shortcut should see a keydown.
 *
 * CAN / SOME/IP interaction views register window-level key handlers. Those
 * must not call preventDefault, copy frames, or transmit when the user is
 * typing in another panel — or in an editor inside the interaction view itself.
 */

interface KeyTargetNode {
  nodeType?: number
  parentElement?: unknown
  tagName?: string
  className?: string
  classList?: { contains?: (token: string) => boolean }
  isContentEditable?: boolean
  getAttribute?: (name: string) => string | null
}

export interface IaKeyEvent {
  target: unknown
  composedPath?: () => readonly unknown[]
}

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])
const EDITABLE_CLASSES = new Set([
  'monaco-editor',
  'el-select',
  'el-input',
  'el-textarea',
  'el-input-number'
])
const EDITABLE_ROLES = new Set(['textbox', 'searchbox', 'combobox'])
const EDITABLE_CONTENT_EDITABLE = new Set(['', 'true', 'plaintext-only'])
const FOCUSABLE_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'SUMMARY'])
const FOCUSABLE_CLASSES = new Set(['el-select', 'el-checkbox', 'el-radio', 'el-switch'])
const FOCUSABLE_ROLES = new Set([
  'button',
  'checkbox',
  'radio',
  'switch',
  'combobox',
  'listbox',
  'menuitem',
  'textbox',
  'searchbox'
])

function asNode(value: unknown): KeyTargetNode | null {
  if (!value || typeof value !== 'object') return null
  return value as KeyTargetNode
}

function tagNameOf(node: KeyTargetNode): string {
  return typeof node.tagName === 'string' ? node.tagName.toUpperCase() : ''
}

function hasClass(node: KeyTargetNode, token: string): boolean {
  if (typeof node.classList?.contains === 'function') return node.classList.contains(token)
  if (typeof node.className === 'string') return node.className.split(/\s+/).includes(token)
  return false
}

function attribute(node: KeyTargetNode, name: string): string | null {
  if (typeof node.getAttribute !== 'function') return null
  const value = node.getAttribute(name)
  return typeof value === 'string' ? value : null
}

function isEditableElement(node: KeyTargetNode): boolean {
  if (EDITABLE_TAGS.has(tagNameOf(node))) return true
  if (node.isContentEditable === true) return true
  const contentEditable = attribute(node, 'contenteditable')
  if (contentEditable != null && EDITABLE_CONTENT_EDITABLE.has(contentEditable.toLowerCase())) {
    return true
  }
  for (const token of EDITABLE_CLASSES) {
    if (hasClass(node, token)) return true
  }
  const role = attribute(node, 'role')
  return role != null && EDITABLE_ROLES.has(role.toLowerCase())
}

function isFocusableControl(node: KeyTargetNode): boolean {
  if (FOCUSABLE_TAGS.has(tagNameOf(node))) return true
  for (const token of FOCUSABLE_CLASSES) {
    if (hasClass(node, token)) return true
  }
  const role = attribute(node, 'role')
  if (role != null && FOCUSABLE_ROLES.has(role.toLowerCase())) return true
  const tabIndex = attribute(node, 'tabindex')
  return tabIndex != null && tabIndex !== '-1'
}

function walk(start: unknown, visit: (node: KeyTargetNode) => boolean): boolean {
  let node = asNode(start)
  const seen = new Set<unknown>()
  while (node && !seen.has(node)) {
    seen.add(node)
    if (node.nodeType === 3) {
      node = asNode(node.parentElement)
      continue
    }
    if (visit(node)) return true
    node = asNode(node.parentElement)
  }
  return false
}

/** True when `target` is an input, textarea, select, contenteditable, or Monaco editor. */
export function isEditableKeyboardTarget(target: unknown): boolean {
  return walk(target, isEditableElement)
}

/** True when the event target or any shadow-inclusive ancestor is an editable field. */
export function isEditableKeyEvent(event: IaKeyEvent): boolean {
  if (isEditableKeyboardTarget(event.target)) return true
  for (const entry of event.composedPath?.() ?? []) {
    const node = asNode(entry)
    if (node && node.nodeType !== 3 && isEditableElement(node)) return true
  }
  return false
}

function nodeContains(root: unknown, target: unknown): boolean {
  if (target == null || root == null) return false
  if (target === root) return true
  const contains = (root as { contains?: (node: unknown) => boolean }).contains
  if (typeof contains === 'function') {
    try {
      if (contains.call(root, target)) return true
    } catch {
      // contains() throws when the argument is not a Node. Fall through to the parent walk.
    }
  }
  return walk(target, (node) => node === root)
}

/** True when the event was fired inside `root` (including shadow-DOM targets). */
export function isEventInsideRoot(event: IaKeyEvent, root: unknown): boolean {
  if (root == null) return false
  if ((event.composedPath?.() ?? []).includes(root)) return true
  return nodeContains(root, event.target)
}

/**
 * Frame copy/paste, row navigation, and delete belong to this interaction
 * window only when focus is inside its root and not in a text field.
 */
export function shouldHandleIaShortcut(event: IaKeyEvent, root: unknown): boolean {
  if (root == null) return false
  if (isEditableKeyEvent(event)) return false
  return isEventInsideRoot(event, root)
}

/**
 * Pointer-down on a non-focusable cell should move focus to the interaction
 * root so the next keydown targets this window. Clicks on inputs, selects,
 * and buttons keep the control the browser focused.
 */
export function shouldFocusIaRoot(target: unknown, root: unknown): boolean {
  if (root == null || target == null || target === root) return false
  if (!nodeContains(root, target)) return false
  let node = asNode(target)
  const seen = new Set<unknown>()
  while (node && node !== root && !seen.has(node)) {
    seen.add(node)
    if (node.nodeType === 3) {
      node = asNode(node.parentElement)
      continue
    }
    if (isEditableElement(node) || isFocusableControl(node)) return false
    node = asNode(node.parentElement)
  }
  return true
}
