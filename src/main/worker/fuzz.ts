/**
 * **CAN fuzzing** utilities — build compact **fingerprints** of observed traffic and replay **mutated** frames.
 *
 * @remarks
 * - **Fingerprint format** follows the can-hax convention: template characters describe each nibble (`H`=hex wild,
 *   `N`=decimal digit, `0`=never seen) so you can diff ECU families quickly.
 * - **Fuzzing** reuses the worker `output()` bridge so frames go through the same scheduling / logging path as normal scripts.
 * - This module is intentionally self-contained (no native deps) so it is safe to import from sandboxed snippets.
 *
 * CLI-oriented tools such as can-hax use similar flags (`--fuzz`, `--canid`, …); this module mirrors those concepts
 * for in-app scripting.
 *
 * @category CAN
 * @module fuzz
 */

import { output } from './uds'
import type { CanMessage } from '../share/can'
import { CAN_ID_TYPE } from '../share/can'

const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
const QUICK_NUMBERS = ['0', '1', '5', '9']
const SUPER_QUICK_NUMBERS = ['0', '9']
const HEXES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F']
const QUICK_HEXES = ['0', '1', '9', 'A', 'B', 'F']
const SUPER_QUICK_HEXES = ['0', 'F']

export interface CanFingerprint {
  description?: string
  date: string
  version: string
  fingerprints: Record<string, string>
}

/**
 * Options for fuzz(). Based on can-hax (--fuzz mode).
 */
export interface FuzzOptions {
  /**
   * Fingerprint data. From fingerprintFromCanMessages() or loaded JSON.
   * Corresponds to --input / -i (fingerprint file) in can-hax.
   */
  fingerprint: CanFingerprint | Record<string, string>

  /**
   * Only fuzz this CAN ID. Optional.
   * Corresponds to --canid / -I in can-hax.
   */
  canId?: string

  /**
   * Time delay in milliseconds between each frame. Default 20.
   * Corresponds to --timing / -t in can-hax (can-hax uses seconds).
   */
  timing?: number

  /**
   * Use restricted value set for quicker fuzzing:
   * - N (decimal): 0, 1, 5, 9
   * - H (hex): 0, 1, 9, A, B, F
   * Corresponds to --quick / -q in can-hax.
   */
  quick?: boolean

  /**
   * Use minimal value set for fastest fuzzing:
   * - N (decimal): 0, 9
   * - H (hex): 0, F
   * Corresponds to --superquick / -s in can-hax.
   */
  superQuick?: boolean

  /**
   * Adaptive quickness per CAN ID. For complex templates (more N/H chars),
   * automatically use reduced sets: complexity > 9 → superquick, > 5 → quick.
   * Corresponds to --adaptive / -a in can-hax.
   */
  adaptive?: boolean

  /**
   * Called before each frame is sent. Return false to skip this frame (don't send).
   * Use for pre-send checks or filtering.
   */
  onBeforeSend?: (ctx: FuzzContext) => boolean | void | Promise<boolean | void>

  /**
   * Called after each frame is sent. Use to verify ECU health (e.g. UDS TesterPresent).
   * Return false to stop fuzzing (e.g. ECU no longer responding).
   */
  onAfterSend?: (ctx: FuzzContext) => boolean | void | Promise<boolean | void>

  /**
   * Called when starting to fuzz a new CAN ID.
   */
  onCanIdStart?: (canId: string, template: string) => void | Promise<void>

  /**
   * Called when finished fuzzing a CAN ID.
   */
  onCanIdEnd?: (canId: string, frameCount: number) => void | Promise<void>
}

export interface FuzzContext {
  canId: string
  payload: string
  frame: CanMessage
  /** Frame index within current CAN ID (0-based). */
  frameIndex: number
  /** Total frames to send for current CAN ID. */
  totalFramesInCanId: number
  /** Current CAN ID index (0-based). */
  canIdIndex: number
  /** Total number of CAN IDs being fuzzed. */
  totalCanIds: number
}

/**
 * Generate fingerprint from CanMessage array (e.g. from OnCan / attachCanMessage).
 *
 * @param messages - CAN messages from capture
 * @param description - Optional description
 * @returns Fingerprint { fingerprints: { canId: template } }
 */
export function fingerprintFromCanMessages(
  messages: CanMessage[],
  description?: string
): CanFingerprint {
  const fingerprints: Record<string, string> = {}

  for (const msg of messages) {
    if (!msg.data || (Array.isArray(msg.data) && msg.data.length === 0)) continue
    const isExtended = msg.msgType?.idType === CAN_ID_TYPE.EXTENDED
    const canid = isExtended
      ? msg.id.toString(16).toUpperCase().padStart(8, '0')
      : msg.id.toString(16).toUpperCase().padStart(3, '0')
    const payload = (Buffer.isBuffer(msg.data) ? msg.data : Buffer.from(msg.data))
      .toString('hex')
      .toUpperCase()
    if (payload.length < 2) continue

    if (!(canid in fingerprints)) {
      fingerprints[canid] = ''.padStart(payload.length, '0')
    } else if (fingerprints[canid].length < payload.length) {
      fingerprints[canid] = ''.padStart(payload.length, '0')
    }
  }

  for (const msg of messages) {
    if (!msg.data || (Array.isArray(msg.data) && msg.data.length === 0)) continue
    const isExtended = msg.msgType?.idType === CAN_ID_TYPE.EXTENDED
    const canid = isExtended
      ? msg.id.toString(16).toUpperCase().padStart(8, '0')
      : msg.id.toString(16).toUpperCase().padStart(3, '0')
    const payload = (Buffer.isBuffer(msg.data) ? msg.data : Buffer.from(msg.data))
      .toString('hex')
      .toUpperCase()
    if (payload.length < 2) continue

    const t = fingerprints[canid]
    const template = [...t]
    for (let i = 0; i < payload.length; i++) {
      const ch = payload[i]
      if (ch !== '0') {
        if (!NUMBERS.includes(ch)) template[i] = 'H'
        else if (template[i] !== 'H') template[i] = 'N'
      }
    }
    fingerprints[canid] = template.join('')
  }

  return {
    description,
    date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    version: '2',
    fingerprints
  }
}

function getFingerprintsMap(
  input: CanFingerprint | Record<string, string>
): Record<string, string> {
  if ('fingerprints' in input && typeof input.fingerprints === 'object') {
    return input.fingerprints
  }
  return input as Record<string, string>
}

function payloadHexToBuffer(hex: string): Buffer {
  const bytes: number[] = []
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16))
  }
  return Buffer.from(bytes)
}

function buildFuzzMatrix(
  template: string,
  opts: { quick?: boolean; superQuick?: boolean; adaptive?: boolean }
): string[][] {
  let complexity = 0
  for (const ch of template) {
    if (ch === 'H') complexity += 2
    else if (ch === 'N') complexity += 1
  }

  const matrix: string[][] = []
  for (const ch of template) {
    if (ch === '0') matrix.push(['0'])
    else if (ch === 'N') {
      if (opts.adaptive && complexity > 9) matrix.push(SUPER_QUICK_NUMBERS)
      else if (opts.adaptive && complexity > 5) matrix.push(QUICK_NUMBERS)
      else if (opts.quick) matrix.push(QUICK_NUMBERS)
      else if (opts.superQuick) matrix.push(SUPER_QUICK_NUMBERS)
      else matrix.push(NUMBERS)
    } else if (ch === 'H') {
      if (opts.adaptive && complexity > 9) matrix.push(SUPER_QUICK_HEXES)
      else if (opts.adaptive && complexity > 5) matrix.push(QUICK_HEXES)
      else if (opts.quick) matrix.push(QUICK_HEXES)
      else if (opts.superQuick) matrix.push(SUPER_QUICK_HEXES)
      else matrix.push(HEXES)
    } else {
      throw new Error(`Unknown template char: ${ch}`)
    }
  }
  return matrix
}

function cartesianProductSize(matrix: string[][]): number {
  return matrix.reduce((acc, row) => acc * row.length, 1)
}

function* cartesianProductIter(matrix: string[][]): Generator<string> {
  const n = matrix.length
  const indices = new Array(n).fill(0)
  while (true) {
    yield matrix.map((row, i) => row[indices[i]]).join('')
    let i = n - 1
    while (i >= 0) {
      indices[i]++
      if (indices[i] < matrix[i].length) break
      indices[i] = 0
      i--
    }
    if (i < 0) break
  }
}

/**
 * Fuzz CAN bus based on fingerprint. Sends frames via output().
 *
 * @param options - fingerprint, callbacks (onBeforeSend, onAfterSend, onCanIdStart, onCanIdEnd)
 * @returns Async generator yielding { canId, payload, frame }
 */
export async function* fuzz(options: FuzzOptions): AsyncGenerator<{
  canId: string
  payload: string
  frame: CanMessage
}> {
  const fps = getFingerprintsMap(options.fingerprint)
  let targetFps = fps
  if (options.canId) {
    if (!(options.canId in fps)) throw new Error(`CAN ID ${options.canId} not in fingerprint`)
    targetFps = { [options.canId]: fps[options.canId] }
  }

  const timing = options.timing ?? 20
  const canIdList = Object.entries(targetFps)
  let shouldStop = false

  for (let canIdIndex = 0; canIdIndex < canIdList.length && !shouldStop; canIdIndex++) {
    const [canId, template] = canIdList[canIdIndex]
    const matrix = buildFuzzMatrix(template, {
      quick: options.quick,
      superQuick: options.superQuick,
      adaptive: options.adaptive
    })
    const totalFramesInCanId = cartesianProductSize(matrix)

    await options.onCanIdStart?.(canId, template)

    let frameIndex = 0
    for (const payload of cartesianProductIter(matrix)) {
      if (shouldStop) break

      const data = payloadHexToBuffer(payload)
      const idNum = parseInt(canId, 16)
      const isExtended = canId.length === 8

      const frame: CanMessage = {
        id: idNum,
        dir: 'OUT',
        data,
        msgType: {
          idType: isExtended ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
          brs: false,
          canfd: false,
          remote: false
        }
      }

      const ctx: FuzzContext = {
        canId,
        payload,
        frame,
        frameIndex,
        totalFramesInCanId,
        canIdIndex,
        totalCanIds: canIdList.length
      }

      const beforeResult = await options.onBeforeSend?.(ctx)
      if (beforeResult === false) {
        frameIndex++
        continue
      }

      await output(frame)
      await new Promise((r) => setTimeout(r, timing))

      const afterResult = await options.onAfterSend?.(ctx)
      if (afterResult === false) {
        shouldStop = true
      }

      frameIndex++
      yield { canId, payload, frame }
    }

    await options.onCanIdEnd?.(canId, frameIndex)
  }
}
