/**
 * **EcuBus-Pro worker script API** — modules re-exported here are bundled into `resources/lib/js/index.js`
 * and loaded inside a Node.js `worker_thread` for diagnostics, panels, and automation scripts.
 *
 * @remarks
 * ### Architecture
 * - **Worker thread**: user TypeScript/JavaScript runs here with a restricted API surface.
 * - **Main process**: hardware (CAN, LIN, DoIP, SOME/IP via vSomeIP, etc.) and IPC handlers live here.
 * - **Bridge**: RPC (`postMessage` with `type: 'rpc'`) and events (`type: 'event'`) connect the worker to
 *   `UdsTester` (`src/main/workerClient.ts`), which dispatches to `NodeClass` (`src/main/nodeItem.ts`).
 *
 * ### Primary entry points
 * | Export | Role |
 * |--------|------|
 * | {@link Util} / `UtilClass` | Lifecycle, variables, CAN/LIN/SOME/IP **listeners**, diagnostics hooks |
 * | `output`, `setSignal`, `setVar`, … | Send frames / signals / variables to the main side |
 * | {@link someipRequest}, {@link someipNotify}, {@link someipSubscribe} | SOME/IP operations (RPC to vSomeIP client) |
 * | {@link canopen} namespace | CANopen helpers (separate submodule) |
 *
 * ### Documentation tags
 * Throughout this folder, public APIs use **TSDoc** conventions (`@param`, `@returns`, `@throws`, `@example`,
 * `@remarks`, `@category`, `@module`) so they render cleanly in TypeDoc and IDE hovers.
 *
 * @packageDocumentation
 * @module worker
 *
 * @example Basic script shape
 * ```typescript
 * import { Util } from 'ecubus-worker' // bundled path depends on your project template
 *
 * Util.Init(async () => {
 *   // runs after worker is wired to the main process
 * })
 * ```
 */

export * from './uds'
export * from './someip'
export * from './secureAccess'
export * from './crc'
export * from './cryptoExt'
export * from './utli'
/**
 * CANopen API (nested namespace to avoid symbol collisions with the flat UDS worker surface).
 *
 * @remarks
 * Implemented under `worker/canopen/`; types may ship as `index.d.ts` next to the runtime `index.js`.
 *
 * @module canopen
 * @category canopen
 */
export * as canopen from './canopen'
