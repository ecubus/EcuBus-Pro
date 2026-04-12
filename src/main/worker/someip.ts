/**
 * SOME/IP helpers for **user scripts** that run inside the EcuBus-Pro worker thread.
 *
 * @remarks
 * This module has two layers:
 *
 * 1. **Message wrappers** ({@link SomeipMessageBase}, {@link SomeipMessageRequest}, {@link SomeipMessageResponse})
 *    — lightweight types used when frames are delivered into the worker (see {@link UtilClass.OnSomeipMessage}).
 *
 * 2. **Script RPC helpers** (`someipRequest`, `someipNotify`, `someipSubscribe`, …) — these do **not** talk to
 *    vSomeIP directly. They call {@link emitWorkerEventWithReply} with event `someipApi`, and the **main process**
 *    (`NodeClass.someipApi` in `src/main/nodeItem.ts`) performs `request_service`, `send`, `subscribe`, etc. on
 *    `VSomeIP_Client` (`src/main/vsomeip/index.ts`).
 *
 * **Listening** for incoming frames (notifications, responses, errors) is done with
 * {@link UtilClass.OnSomeipMessage} / {@link UtilClass.OnSomeipMessageOnce} / {@link UtilClass.OffSomeipMessage}
 * using wildcard keys `service.instance.method` in **lowercase hex** (same convention as the trace UI).
 *
 * @packageDocumentation
 * @module someip
 * @category SOME/IP
 */

import { SomeipMessage, SomeipMessageType, VsomeipEventType } from '../share/someip'
import { emitWorkerEventWithReply } from './uds'

export { SomeipMessageType, VsomeipEventType }
export type { SomeipMessage }

/**
 * Base wrapper around a {@link SomeipMessage} for script-side handling.
 *
 * @remarks
 * Used for message types that are not strictly “request” or “response” in the AUTOSAR sense
 * (for example {@link SomeipMessageType.NOTIFICATION}, {@link SomeipMessageType.ERROR}).
 *
 * @category SOME/IP
 */
class SomeipMessageBase {
  /**
   * @param msg - Full SOME/IP message as received from the stack (payload should be a `Buffer` after normalization).
   */
  constructor(public msg: SomeipMessage) {}

  /**
   * Replace the SOME/IP payload on the wrapped message.
   *
   * @param payload - Raw SOME/IP payload bytes.
   */
  setPayload(payload: Buffer) {
    this.msg.payload = payload
  }
}

/**
 * Wrapper that **only** accepts request-like {@link SomeipMessageType} values.
 *
 * @throws {Error} If `msg.messageType` is not {@link SomeipMessageType.REQUEST} or {@link SomeipMessageType.REQUEST_NO_RETURN}.
 *
 * @category SOME/IP
 */
class SomeipMessageRequest extends SomeipMessageBase {
  /**
   * @param msg - SOME/IP message; must be a request type.
   */
  constructor(public msg: SomeipMessage) {
    if (
      msg.messageType != SomeipMessageType.REQUEST &&
      msg.messageType != SomeipMessageType.REQUEST_NO_RETURN
    ) {
      throw new Error(
        'SomeipMessageRequest must be SomeipMessageType.REQUEST or SomeipMessageType.REQUEST_NO_RETURN'
      )
    }
    super(msg)
  }
}

/**
 * Wrapper for a SOME/IP **positive response** frame.
 *
 * @throws {Error} If `msg.messageType` is not {@link SomeipMessageType.RESPONSE}.
 *
 * @category SOME/IP
 */
class SomeipMessageResponse extends SomeipMessageBase {
  /**
   * @param msg - SOME/IP message; must be {@link SomeipMessageType.RESPONSE}.
   */
  constructor(public msg: SomeipMessage) {
    if (msg.messageType != SomeipMessageType.RESPONSE) {
      throw new Error('SomeipMessageResponse must be SomeipMessageType.RESPONSE')
    }
    super(msg)
  }

  /**
   * Build a response message from an outgoing {@link SomeipMessageRequest} (same service/instance/session context).
   *
   * @param request - Original request; must be {@link SomeipMessageType.REQUEST} (not no-return).
   * @param payload - Response payload; default empty.
   * @returns A new {@link SomeipMessageResponse} with `messageType` set to {@link SomeipMessageType.RESPONSE}.
   *
   * @throws {Error} If `request` is not a `REQUEST` message.
   *
   * @example
   * ```ts
   * const resp = SomeipMessageResponse.fromSomeipRequest(req, Buffer.from([0x00]))
   * ```
   */
  static fromSomeipRequest(request: SomeipMessageRequest, payload: Buffer = Buffer.from([])) {
    if (request.msg.messageType !== SomeipMessageType.REQUEST) {
      throw new Error('fromSomeipRequest requires SomeipMessageType.REQUEST')
    }
    const response = new SomeipMessageResponse({
      ...request.msg,
      messageType: SomeipMessageType.RESPONSE
    })
    response.setPayload(payload)
    return response
  }
}

export { SomeipMessageBase, SomeipMessageRequest, SomeipMessageResponse }

// ---------------------------------------------------------------------------
// Script API — main process performs vSomeIP I/O
// ---------------------------------------------------------------------------

/**
 * Raw payload accepted by {@link SomeipScriptSendBase} helpers before it is normalized to a `Buffer` on the wire.
 */
export type SomeipScriptPayload = Buffer | Uint8Array | number[] | undefined

/**
 * Common fields for building outbound SOME/IP messages from scripts.
 *
 * @remarks
 * - **`channel`**: key of the SOME/IP device in the project `devices` map (same id used internally for `someipMap`).
 *   If your **node** has exactly one SOME/IP channel attached, you may omit `channel` and the runtime picks it.
 * - **`service` / `instance` / `method`**: numeric IDs (typically parsed from hex in ARXML / FIDL; pass as numbers).
 * - **`major` / `minor`**: used by `request_service` for request-style operations on the main side.
 *
 * @see {@link someipRequest}
 * @see {@link someipNotify}
 */
export interface SomeipScriptSendBase {
  /** SOME/IP device id when multiple SOME/IP stacks are available to the script node. */
  channel?: string
  /** SOME/IP service identifier. */
  service: number
  /** Service instance identifier. */
  instance: number
  /** Method or event id (SOME/IP “Method ID” field). */
  method: number
  /** Optional payload; normalized with {@link toPayloadBuffer} before send. */
  payload?: SomeipScriptPayload
  /** SOME/IP protocol version byte; default `1`. */
  protocolVersion?: number
  /** Interface major version byte; default `0` unless your service defines otherwise. */
  interfaceVersion?: number
  /** Prefer reliable (TCP) vs unreliable (UDP) when the stack supports both. */
  reliable?: boolean
  /** Service major version for `request_service` (request / request-no-return paths). */
  major?: number
  /** Service minor version for `request_service`. */
  minor?: number
  /** Return code field on the SOME/IP header when applicable. */
  returnCode?: number
}

/**
 * Forward a structured SOME/IP RPC to the main thread (`someipApi` handler).
 *
 * @param data - Discriminated payload consumed by {@link NodeClass.someipApi}.
 * @returns Promise resolved by the main process (shape depends on `op`).
 *
 * @internal
 */
async function emitMain(data: unknown): Promise<any> {
  // Dynamic import avoids circular static initialization: `uds.ts` imports this file for message classes.

  return emitWorkerEventWithReply('someipApi', data)
}

/**
 * Normalize script payload input to a `Buffer` for {@link SomeipMessage.payload}.
 *
 * @param p - `undefined` / `null` yields an empty buffer.
 */
function toPayloadBuffer(p?: SomeipScriptPayload): Buffer {
  if (p === undefined || p === null) return Buffer.alloc(0)
  if (Buffer.isBuffer(p)) return p
  if (p instanceof Uint8Array) return Buffer.from(p)
  return Buffer.from(p)
}

/**
 * Re-hydrate a structured-cloned SOME/IP message coming back from the main process into a proper `Buffer` payload.
 *
 * @param raw - Plain object after `postMessage` / structured clone.
 */
function reviveSomeipMessage(raw: any): SomeipMessage {
  if (!raw || typeof raw !== 'object') {
    return raw as SomeipMessage
  }
  const pl = raw.payload
  const payload = Buffer.isBuffer(pl)
    ? pl
    : Buffer.from(pl?.data !== undefined ? pl.data : (pl ?? []))
  return { ...raw, payload } as SomeipMessage
}

/**
 * Build a {@link SomeipMessage} suitable for sending (`sending: true`) with the given message type.
 */
function baseMessage(
  opts: SomeipScriptSendBase,
  messageType: SomeipMessageType,
  sending: boolean
): SomeipMessage {
  return {
    service: Number(opts.service),
    instance: Number(opts.instance),
    method: Number(opts.method),
    payload: toPayloadBuffer(opts.payload),
    messageType,
    client: 0,
    session: 0,
    returnCode: opts.returnCode != null ? Number(opts.returnCode) : 0,
    protocolVersion: opts.protocolVersion != null ? Number(opts.protocolVersion) : 1,
    interfaceVersion: opts.interfaceVersion != null ? Number(opts.interfaceVersion) : 0,
    ts: 0,
    reliable: opts.reliable,
    sending
  }
}

/**
 * Send a **REQUEST** and await the matching **RESPONSE** or **ERROR** from the vSomeIP client in the main process.
 *
 * @param opts - Service / instance / method / payload and optional `channel`, versions, and `request_service` major/minor.
 * @param timeoutMs - Maximum wait time in milliseconds for the response (default `1000`).
 *
 * @returns The decoded {@link SomeipMessage} for the response (payload as `Buffer`).
 *
 * @throws {Error} When the device is unknown, the service is unavailable, or the stack times out waiting for a reply.
 *
 * @remarks
 * Mirrors the UI / IPC path `ipc-send-someip` for `REQUEST`: performs `request_service` then `sendRequestAndWaitResponse`.
 *
 * @example
 * ```ts
 * const resp = await someipRequest(
 *   { service: 0x1234, instance: 1, method: 0x6001, payload: [0x01] },
 *   2000
 * )
 * console.log(resp.returnCode, resp.payload)
 * ```
 *
 * @category SOME/IP
 */
export async function someipRequest(
  opts: SomeipScriptSendBase,
  timeoutMs: number = 1000
): Promise<SomeipMessage> {
  const res = await emitMain({
    op: 'request',
    channel: opts.channel,
    msg: baseMessage(opts, SomeipMessageType.REQUEST, true),
    major: opts.major ?? 0,
    minor: opts.minor ?? 0,
    timeout: timeoutMs
  })
  return reviveSomeipMessage(res)
}

/**
 * Send **REQUEST_NO_RETURN** after `request_service` on the main side (no response is expected on the SOME/IP layer).
 *
 * @param opts - Same addressing fields as {@link someipRequest}; `major` / `minor` passed to `request_service`.
 *
 * @returns Resolves when the main process has finished enqueueing the send (not necessarily when it left the ECU).
 *
 * @throws {Error} When the SOME/IP client cannot be resolved or `request_service` fails.
 *
 * @category SOME/IP
 */
export async function someipRequestNoReturn(opts: SomeipScriptSendBase): Promise<void> {
  await emitMain({
    op: 'requestNoReturn',
    channel: opts.channel,
    msg: baseMessage(opts, SomeipMessageType.REQUEST_NO_RETURN, true),
    major: opts.major ?? 0,
    minor: opts.minor ?? 0
  })
}

/**
 * Send a **NOTIFICATION** (event) frame without calling `request_service` first — same semantics as notification send in the UI.
 *
 * @param opts - Target service / instance / method (event id) and optional payload.
 *
 * @remarks
 * Use this when your application acts as a **publisher** or when the stack does not require an explicit service request
 * for this notification path.
 *
 * @category SOME/IP
 */
export async function someipNotify(opts: SomeipScriptSendBase): Promise<void> {
  await emitMain({
    op: 'notify',
    channel: opts.channel,
    msg: baseMessage(opts, SomeipMessageType.NOTIFICATION, true)
  })
}

/**
 * Options for {@link someipSubscribe} — client-side subscription to an event group / event.
 */
export interface SomeipSubscribeOpts {
  /** SOME/IP device id when multiple stacks are attached (same as {@link SomeipScriptSendBase.channel}). */
  channel?: string
  /** Service id to subscribe to. */
  service: number
  /** Instance id. */
  instance: number
  /** Event group id (SOME/IP-SD / vSomeIP eventgroup). */
  eventgroup: number
  /** Event id (method id field for that event). */
  event: number
  /** Major version passed to `request_service` / subscribe (default `0`). */
  major?: number
  /** Timeout for service discovery / request phases in ms (default `1000`). */
  timeoutMs?: number
  /**
   * vSomeIP `event_type_e` for `request_event` (default {@link VsomeipEventType.ET_FIELD} = `2`, matching common AUTOSAR field semantics).
   *
   * @see {@link VsomeipEventType}
   */
  eventType?: number
}

/**
 * Client subscription: `request_service` → `request_event` (single group) → `subscribe` on the main vSomeIP client.
 *
 * @param opts - Service, instance, event group, event id, and optional channel / timing / event type.
 *
 * @returns Resolves when subscription commands have been accepted by the main process (delivery still depends on SD / network).
 *
 * @throws {Error} When the SOME/IP device is missing or vSomeIP returns an error.
 *
 * @remarks
 * After subscribing, listen for payloads with {@link UtilClass.OnSomeipMessage} on the appropriate `service.instance.method` key.
 *
 * @category SOME/IP
 */
export async function someipSubscribe(opts: SomeipSubscribeOpts): Promise<void> {
  await emitMain({
    op: 'subscribe',
    channel: opts.channel,
    service: Number(opts.service),
    instance: Number(opts.instance),
    eventgroup: Number(opts.eventgroup),
    event: Number(opts.event),
    major: opts.major ?? 0,
    timeout: opts.timeoutMs ?? 1000,
    eventType:
      opts.eventType != null && Number.isFinite(Number(opts.eventType))
        ? Number(opts.eventType)
        : VsomeipEventType.ET_FIELD
  })
}

/**
 * Options for {@link someipUnsubscribe}.
 */
export interface SomeipUnsubscribeOpts {
  /** SOME/IP device id when multiple stacks are attached (same as {@link SomeipScriptSendBase.channel}). */
  channel?: string
  service: number
  instance: number
  eventgroup: number
  /**
   * When provided, targets that specific event and triggers `release_event` after unsubscribe on the main side.
   * When omitted, only the event group unsubscribe path is used.
   */
  event?: number
  major?: number
  timeoutMs?: number
}

/**
 * Unsubscribe (and optionally `release_event`) for a previously subscribed event / group.
 *
 * @param opts - Service, instance, event group, optional specific `event`, and timing.
 *
 * @category SOME/IP
 */
export async function someipUnsubscribe(opts: SomeipUnsubscribeOpts): Promise<void> {
  await emitMain({
    op: 'unsubscribe',
    channel: opts.channel,
    service: Number(opts.service),
    instance: Number(opts.instance),
    eventgroup: Number(opts.eventgroup),
    event: opts.event !== undefined ? Number(opts.event) : undefined,
    major: opts.major ?? 0,
    timeout: opts.timeoutMs ?? 1000
  })
}
