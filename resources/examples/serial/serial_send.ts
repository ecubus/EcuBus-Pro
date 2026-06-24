import { Util } from 'ECB'

const SERIAL_DEVICE = 'ECUBUS_Serial_0'
const PERIOD_MS = 500
const TX_FRAME = Buffer.from([
  0x00, 0x00, 0x07, 0xaa, 0x08, 0x03, 0x22, 0xf1, 0x90, 0xcc, 0xcc, 0xcc, 0xcc
])

function hex(data: Buffer): string {
  return Array.from(data)
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(' ')
}

Util.Init(() => {
  console.log(`serial sender started: ${SERIAL_DEVICE}`)
  console.log(`tx period: ${PERIOD_MS} ms, data: ${hex(TX_FRAME)}`)

  let sending = false
  setInterval(async () => {
    if (sending) return
    sending = true
    try {
      await Util.writeSerial(SERIAL_DEVICE, TX_FRAME)
      // Serial TX is written to the Trace window by the serial hardware logger.
    } catch (error: any) {
      console.error(`serial tx failed: ${error?.message ?? error}`)
    } finally {
      sending = false
    }
  }, PERIOD_MS)
})

Util.OnSerial(SERIAL_DEVICE, (msg) => {
  // Serial RX is written to the Trace window by the serial hardware logger.
  console.log(`serial ${msg.dir}: ${hex(msg.data)}`)
})
