import { describe, test, expect } from 'vitest'
import { UARTCAN_CAN } from '../../src/main/docan/uartcan'
import { CAN_ID_TYPE, CanMessage, CanMsgType } from '../../src/main/share/can'

const stdType: CanMsgType = {
  idType: CAN_ID_TYPE.STANDARD,
  canfd: false,
  brs: false,
  remote: false
}
const extType: CanMsgType = { ...stdType, idType: CAN_ID_TYPE.EXTENDED }

// Build a client without opening a real serial port: allocate the prototype
// and stub the members the framing logic touches.
function fakeClient() {
  const client = Object.create(UARTCAN_CAN.prototype) as any
  const written: Buffer[] = []
  const logged: CanMessage[] = []
  const serialLogged: any[] = []
  const emitted: { key: string; msg: CanMessage }[] = []
  client.info = {
    id: 'test',
    handle: 'COM-TEST',
    name: 'test',
    vendor: 'uartcan',
    canfd: false,
    bitrate: { sjw: 1, timeSeg1: 13, timeSeg2: 2, preScaler: 10, freq: 115200 }
  }
  client.startTime = 0
  client.lastRxMs = 0
  client.closed = false
  client.rxBuffer = Buffer.alloc(0)
  client.log = {
    canBase: (msg: CanMessage) => logged.push(msg),
    error: () => null
  }
  client.serialLog = {
    serialBase: (msg: any) => serialLogged.push(msg)
  }
  client.event = {
    emit: (key: string, msg: CanMessage) => emitted.push({ key, msg })
  }
  client.serialPort = {
    write: (buf: Buffer, cb: (err?: Error | null) => void) => {
      written.push(Buffer.from(buf))
      cb(null)
    }
  }
  return { client, written, logged, serialLogged, emitted }
}

describe('uartcan framing', () => {
  test('encode standard frame', async () => {
    const { client, written } = fakeClient()
    await client.writeBase(0x7aa, stdType, Buffer.from([0x03, 0x22, 0xf1, 0x90]))
    expect(written.length).toBe(1)
    expect(written[0].toString('hex')).toBe('000007aa040322f19000000000')
  })

  test('encode extended frame sets EFF flag', async () => {
    const { client, written } = fakeClient()
    await client.writeBase(0x18da10f1, extType, Buffer.from([0x01]))
    expect(written[0].toString('hex')).toBe('98da10f1010100000000000000')
  })

  test('reject canfd frame', () => {
    const { client } = fakeClient()
    expect(() => client.writeBase(0x7aa, { ...stdType, canfd: true }, Buffer.alloc(12))).toThrow()
  })

  test('decode a received frame', () => {
    const { client, emitted } = fakeClient()
    client.rxBuffer = Buffer.from('000007ab0762f1901234567800', 'hex')
    client.processRxBuffer()
    expect(emitted.length).toBe(1)
    expect(emitted[0].key).toBe(`readBase-${0x7ab}-0`)
    expect(emitted[0].msg.id).toBe(0x7ab)
    expect(emitted[0].msg.data.toString('hex')).toBe('62f19012345678')
    expect(emitted[0].msg.msgType.idType).toBe(CAN_ID_TYPE.STANDARD)
  })

  test('resync after garbage bytes', () => {
    const { client, emitted } = fakeClient()
    client.rxBuffer = Buffer.concat([
      Buffer.from([0x12, 0x34, 0x56]),
      Buffer.from('000007ab040322f19000000000', 'hex')
    ])
    client.processRxBuffer()
    expect(emitted.length).toBe(1)
    expect(emitted[0].msg.id).toBe(0x7ab)
    expect(emitted[0].msg.data.toString('hex')).toBe('0322f190')
  })

  test('partial frame kept until remaining bytes arrive', () => {
    const { client, emitted } = fakeClient()
    const frame = Buffer.from('000007ab020102000000000000', 'hex')
    client.rxBuffer = frame.subarray(0, 6)
    client.processRxBuffer()
    expect(emitted.length).toBe(0)
    client.rxBuffer = Buffer.concat([client.rxBuffer, frame.subarray(6)])
    client.processRxBuffer()
    expect(emitted.length).toBe(1)
    expect(emitted[0].msg.data.toString('hex')).toBe('0102')
  })

  test('writeRaw sends bytes unchanged and logs raw serial OUT', async () => {
    const { client, written, serialLogged } = fakeClient()
    const frame = Buffer.from('000007aa040322f19000000000', 'hex')
    await client.writeRaw(frame)
    expect(written[0].equals(frame)).toBe(true)
    expect(serialLogged.length).toBe(1)
    expect(serialLogged[0].dir).toBe('OUT')
    expect(serialLogged[0].data.equals(frame)).toBe(true)
  })

  test('writeRaw logs arbitrary bytes too', async () => {
    const { client, written, serialLogged } = fakeClient()
    await client.writeRaw(Buffer.from([0x01, 0x02]))
    expect(written[0].toString('hex')).toBe('0102')
    expect(serialLogged.length).toBe(1)
    expect(serialLogged[0].data.toString('hex')).toBe('0102')
  })

  test('decode extended frame', () => {
    const { client, emitted } = fakeClient()
    client.rxBuffer = Buffer.from('98da10f1010100000000000000', 'hex')
    client.processRxBuffer()
    expect(emitted.length).toBe(1)
    expect(emitted[0].msg.id).toBe(0x18da10f1)
    expect(emitted[0].msg.msgType.idType).toBe(CAN_ID_TYPE.EXTENDED)
  })
})
