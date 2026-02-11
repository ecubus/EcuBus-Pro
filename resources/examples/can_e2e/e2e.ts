import { output, CAN_ID_TYPE, Util, LinDirection, LinChecksumType, getLinCheckSum } from 'ECB'
import type { CanMessage, LinMsg } from 'ECB'

const CAN_ID = 0x200
const PERIOD_MS = 100

const canFdMsg: CanMessage = {
  id: CAN_ID,
  dir: 'OUT',
  data: Buffer.alloc(64, 0),
  msgType: {
    idType: CAN_ID_TYPE.STANDARD,
    remote: false,
    brs: true,
    canfd: true
  }
}

let seq = 0

function sendCanFd(): void {
  // optional: fill payload (e.g. sequence + timestamp)
  canFdMsg.data.writeUInt32LE(seq++, 0)
  canFdMsg.data.writeUInt32LE(Date.now() & 0xffffffff, 4)
  output(canFdMsg).catch((e) => console.error('CAN-FD send error:', e))
}

// LIN: send one frame when key 's' is pressed
const LIN_FRAME_ID = 0x20
const linMsg: LinMsg = {
  frameId: LIN_FRAME_ID,
  data: Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
  direction: LinDirection.SEND,
  checksumType: LinChecksumType.CLASSIC
}

function sendLinMessage(): void {
  linMsg.checksum = getLinCheckSum(linMsg.data, linMsg.checksumType, LIN_FRAME_ID)
  output(linMsg).catch((e) => console.error('LIN send error:', e))
}

Util.OnKey('s', () => sendLinMessage())

// start periodic send
const timer = setInterval(sendCanFd, PERIOD_MS)

// optional: stop after some time or on condition
// setTimeout(() => clearInterval(timer), 60_000)
