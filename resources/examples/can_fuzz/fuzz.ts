/**
 * ECB CAN Fuzz Script
 * Uses ICSIM fingerprint to fuzz CAN bus. Based on can-hax fingerprint format:
 * - 0: fixed 0x00
 * - H: fixed 0xFF
 * - N: variable byte (fuzz target)
 *
 * ECU health check: ecu.ts sends CAN ID 0x7FF when it "crashes" (receives 0x133).
 * Fuzz listens for 0x7FF and stops when received.
 */
import { fuzz, Util } from 'ECB'
import * as fs from 'fs'
import * as path from 'path'

// CAN ID for ECU crash signal (must match ecu.ts)
const ECU_CRASH_SIGNAL_ID = 0x7ff

// Load ICSIM fingerprint
const fingerprintPath = path.join(process.env.PROJECT_ROOT!, 'icsim_fingerprint.json')
const fingerprint = JSON.parse(fs.readFileSync(fingerprintPath, 'utf-8')) as {
  description?: string
  date: string
  version: string
  fingerprints: Record<string, string>
}

// Device name from can_fuzz.ecb (SIMULATE_0)
const DEVICE = 'SIMULATE_0'

// Fuzz options (see FuzzOptions in ECB types)
const FUZZ_OPTIONS = {
  /** Delay between frames (ms) */
  timing: 20,
  /** Use quick value set for faster fuzzing */
  quick: false,
  /** Use minimal value set for fastest fuzzing */
  superQuick: false,
  /** Adaptive complexity per CAN ID */
  adaptive: true
  /** Optional: fuzz only this CAN ID. Use '133' to quickly test ECU crash detection. */
  // canId: '133',
}

Util.Init(() => {
  console.log('=== CAN Fuzz Test (ICSIM Fingerprint) ===')
  console.log('Fingerprint:', fingerprint.description || 'ICSIM Vehicle Simulator')
  console.log('CAN IDs:', Object.keys(fingerprint.fingerprints).length)
  console.log('Options:', FUZZ_OPTIONS)
  console.log('----------------------------------------')

  let ecuCrashed = false
  const onCrashSignal = () => {
    ecuCrashed = true
  }
  Util.OnCan(ECU_CRASH_SIGNAL_ID, onCrashSignal)

  // Run fuzz in background - do NOT await, so Init returns immediately
  ;(async () => {
    let totalFrames = 0
    let stoppedByEcuCrash = false
    for await (const { canId, payload, frame } of fuzz({
      fingerprint,
      ...FUZZ_OPTIONS,
      onBeforeSend: (ctx) => {
        ctx.frame.device = DEVICE
        return true
      },
      onAfterSend: () => {
        if (ecuCrashed) {
          console.log('[Fuzz] ECU crash signal received! Stopping fuzz.')
          stoppedByEcuCrash = true
          return false // Stop fuzzing
        }
      },
      onCanIdStart: (canId, template) => {
        console.log(`[Start] 0x${canId} (${template.length} bytes)`)
      },
      onCanIdEnd: (canId, frameCount) => {
        totalFrames += frameCount
        console.log(`[End] 0x${canId} - ${frameCount} frames sent`)
      }
    })) {
      // Generator yields after each frame sent; consume to run fuzz
    }
    Util.OffCan(ECU_CRASH_SIGNAL_ID, onCrashSignal)
    console.log('----------------------------------------')
    console.log('Fuzz test completed. Total frames:', totalFrames)
    if (stoppedByEcuCrash) {
      console.log('*** Stopped because ECU crash signal received (CAN ID 0x7FF) ***')
    }
  })()
})
