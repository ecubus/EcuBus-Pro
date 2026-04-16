/**
 * Global symbols injected by the worker bundle / runtime for script authors.
 *
 * @remarks
 * These declarations exist so TypeScript understands globals that are assigned at runtime in `uds.ts`
 * (for example `global.Util = new UtilClass()`).
 *
 * @module worker/globals
 */

/* eslint-disable no-var */
import type { UtilClass } from './uds'

declare global {
  /**
   * Singleton façade for diagnostics hooks, bus listeners, variables, and lifecycle (`Init` / `End`).
   *
   * @remarks
   * Assigned in `src/main/worker/uds.ts` after {@link UtilClass} is constructed. User scripts should treat this
   * as the primary entry point for non-transport-specific automation.
   */
  var Util: UtilClass

  /**
   * Monotonically increasing correlation id for worker → main **async** requests (`emitMap` in `uds.ts`).
   *
   * @remarks
   * Reset semantics are defined by the worker bootstrap; always pair increments with `emitMap` registration.
   */
  var cmdId: number
}

export {}
