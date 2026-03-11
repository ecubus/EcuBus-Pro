/**
 * Simulated ECU for can_fuzz example.
 * When it receives CAN ID 0x133 (vulnerability trigger), it "crashes" and sends
 * a CAN message (ID 0x7FF) to signal the crash. Fuzz listens for this and stops.
 */
import { Util, output, CAN_ID_TYPE } from 'ECB'

// CAN ID that triggers the vulnerability (simulated crash)
const TRIGGER_CAN_ID = 0x133

// CAN ID for crash signal (0x7FF = max standard ID, must match fuzz.ts)
const ECU_CRASH_SIGNAL_ID = 0x7ff

Util.Init(() => {
  console.log('[ECU] Simulated ECU started. Listening for CAN frames...')
  console.log(`[ECU] Vulnerability trigger: CAN ID 0x${TRIGGER_CAN_ID.toString(16).toUpperCase()}`)
  console.log(`[ECU] Crash signal: CAN ID 0x${ECU_CRASH_SIGNAL_ID.toString(16).toUpperCase()}`)

  Util.OnCan(true, async (msg) => {
    if (msg.id === TRIGGER_CAN_ID) {
      console.log(
        `[ECU] *** VULNERABILITY TRIGGERED *** Received CAN ID 0x${TRIGGER_CAN_ID.toString(16).toUpperCase()}`
      )
      console.log(`[ECU] Sending crash signal...`)
      await output({
        id: ECU_CRASH_SIGNAL_ID,
        dir: 'OUT',
        data: Buffer.from([0xde, 0xad]),
        msgType: {
          idType: CAN_ID_TYPE.STANDARD,
          brs: false,
          canfd: false,
          remote: false
        }
      })
    }
  })
})
