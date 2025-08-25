import {
  describe,
  LinChecksumType,
  LinDirection,
  LinMsg,
  output,
  test,
  assert,
  LinCableErrorInject,
  getFrameFromDB,
  getVar,
  getLinCheckSum
} from 'ECB'
const headerBitLength = 13 + 1 + 10 + 10
const FrameMap: Record<string, LinMsg> = {}
let StatusSignalOffset = 0

function cloneMsg(msg: LinMsg) {
  return {
    ...msg,
    data: Buffer.from(msg.data)
  }
}

async function sendWakeUp(breakLength: number) {
  const msg: LinMsg = {
    data: Buffer.alloc(0),
    direction: LinDirection.SEND,
    frameId: 0,
    checksumType: LinChecksumType.ENHANCED
  }
  await sendLinWithSend(msg, {
    syncVal: false,
    pid: false,
    breakLength: breakLength
  })
}

async function delay(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout))
}
Util.Init(async () => {
  FrameMap['Slave1_TxFrame1'] = {
    frameId: 0,
    direction: LinDirection.RECV,
    data: Buffer.alloc(1),
    checksumType: LinChecksumType.ENHANCED
  }
  FrameMap['3c'] = {
    frameId: 0x3c,
    direction: LinDirection.SEND,
    data: Buffer.from([0x60, 0x01, 0xb5, 0xff, 0xff, 0xff, 0xff, 0xff]),
    checksumType: LinChecksumType.CLASSIC
  }
  FrameMap['3a'] = {
    frameId: 0x3a,
    direction: LinDirection.SEND,
    data: Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
    checksumType: LinChecksumType.CLASSIC
  }
  FrameMap['3d'] = {
    frameId: 0x3d,
    direction: LinDirection.RECV,
    data: Buffer.alloc(8),
    checksumType: LinChecksumType.CLASSIC
  }
  StatusSignalOffset = 0
  await sendWakeUp(5)
})

const sendLinWithRecv = (
  frame: LinMsg,
  inject: LinCableErrorInject
): Promise<{
  result: boolean
  msg?: LinMsg
}> => {
  return new Promise<{
    result: boolean
    msg?: LinMsg
  }>((resolve, reject) => {
    frame.lincable = inject
    let timer: NodeJS.Timeout
    if (frame.direction !== LinDirection.RECV) {
      reject(new Error('Frame direction must be RECV for sendLinWithRecv'))
      return
    }
    const cb = (msg: LinMsg) => {
      Util.OffLin(msg.frameId, cb)
      clearTimeout(timer)

      resolve({ result: true, msg }) //resolve true if output was successful
    }
    Util.OnLin(frame.frameId, cb)
    output(frame)
      .then(() => {
        timer = setTimeout(() => {
          Util.OffLin(frame.frameId, cb)
          resolve({ result: false }) //resolve false if no response received
        }, 1000)
      })
      .catch((err) => {
        resolve({ result: false })
      })
  })
}

const sendLinWithSend = (msg: LinMsg, inject: LinCableErrorInject): Promise<boolean> => {
  return new Promise<boolean>((resolve, reject) => {
    msg.lincable = inject
    if (msg.direction !== LinDirection.SEND) {
      reject(new Error('Frame direction must be SEND for sendLinWithSend'))
      return
    }
    output(msg)
      .then(() => {
        resolve(true) //resolve true if output was successful
      })
      .catch((err) => {
        resolve(false)
      })
  })
}

const getErrorFlag = (data: Buffer, offset: number): number => {
  const val = data[StatusSignalOffset]
  return val >> offset
}
test('timeout', async () => {
  const t = FrameMap['3c']
  const ct = cloneMsg(t)
  ct.data = ct.data.subarray(0, 5)
  const result1 = await sendLinWithSend(ct, {})
  assert(result1)
})
describe('4.2', () => {
  test('4.2.1 Wrong Synch Field = 0x80 (one falling edge)', async () => {
    const msg = FrameMap['Slave1_TxFrame1']
    let result = await sendLinWithRecv(msg, {})
    assert(result.result)
    result = await sendLinWithRecv(msg, {
      syncVal: 0x80
    })
    assert(!result.result)
    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 4)
  })
  test('4.2.4.1 Data Bit Error of a 0x3D Slave Response(DataByte0, Bit0)', async () => {
    const msg = FrameMap['Slave1_TxFrame1']
    const t = FrameMap['3c']
    const r = FrameMap['3d']
    let result = await sendLinWithRecv(msg, {})
    assert(result.result)

    //send 3c
    const result1 = await sendLinWithSend(t, {})
    assert(result1)

    result = await sendLinWithRecv(r, {
      errorInject: {
        bit: headerBitLength + 6,
        value: 0
      }
    })
    assert(result.result == false)

    //get status
    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 4)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 1)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 0)
  })
  test('4.2.8.1 Byte Field Framing Error (Stop Bit Crush in a request message, DataByte0)', async () => {
    const msg = FrameMap['Slave1_TxFrame1']
    const t = FrameMap['3c']
    const r = FrameMap['3d']
    let result = await sendLinWithRecv(msg, {})
    assert(result.result)

    //send 3c
    const result1 = await sendLinWithSend(t, {})
    assert(result1)

    result = await sendLinWithRecv(r, {
      errorInject: {
        bit: headerBitLength + 9,
        value: 0
      }
    })
    assert(result.result == false)

    //get status
    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 6)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 1)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 0)
  })
  test('4.2.9.2 Error in the Checksum in a 0x3D Slave Response', async () => {
    const msg = FrameMap['Slave1_TxFrame1']
    const t = FrameMap['3c']
    const r = FrameMap['3d']
    let result = await sendLinWithRecv(msg, {})
    assert(result.result)

    //send 3c
    const result1 = await sendLinWithSend(t, {})
    assert(result1)

    result = await sendLinWithRecv(r, {
      errorInject: {
        bit: headerBitLength + 88,
        value: 0
      }
    })
    assert(result.result == false)

    //get status
    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 4)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 1)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 0)
  })
})

describe('4.3', () => {
  test('4.3.1 Checksum Error in a 0x3C Targeted Reset and Data Error in a request message', async () => {
    const msg = FrameMap['Slave1_TxFrame1']
    const t = FrameMap['3c']
    const r = FrameMap['3d']
    let result = await sendLinWithRecv(msg, {})
    assert(result.result)

    //send 3c
    const result1 = await sendLinWithSend(t, {
      checkSum: 0xff
    })
    assert(result1 == false)

    result = await sendLinWithRecv(r, {})
    assert(result.result == false)

    result = await sendLinWithRecv(msg, {
      errorInject: {
        bit: 6,
        value: 0
      }
    })
    assert(!result.result)

    //get status
    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 5)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 4)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 0)
  })
  test('4.3.2 Byte Field Framing Error and Data Error in request messages', async () => {
    const msg = FrameMap['Slave1_TxFrame1']
    const t = FrameMap['3c']
    const r = FrameMap['3d']
    let result = await sendLinWithRecv(msg, {})
    assert(result.result)

    //send 3c
    const result1 = await sendLinWithSend(t, {
      errorInject: {
        bit: headerBitLength + 9,
        value: 0
      }
    })
    assert(result1 == false)

    result = await sendLinWithRecv(r, {})
    assert(result.result == false)

    //get status
    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 6)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 0)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 0)
  })
  test('4.3.4 Status Byte after power-on reset of all messages', async () => {
    const msg = FrameMap['Slave1_TxFrame1']
    const t = FrameMap['3c']
    const r = FrameMap['3d']
    let result = await sendLinWithRecv(msg, {})
    assert(result.result)

    //send 3c
    const result1 = await sendLinWithSend(t, {
      errorInject: {
        bit: headerBitLength + 9,
        value: 0
      }
    })
    assert(result1 == false)

    result = await sendLinWithRecv(r, {})
    assert(result.result == false)

    //get status
    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 6)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 0)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 0)
  })
})

describe('5.4', () => {
  test('5.4.1.2 Frame error', async () => {
    const msg = FrameMap['Slave1_TxFrame1']
    const t = FrameMap['3a']

    let result = await sendLinWithRecv(msg, {})
    assert(result.result)

    //2. Send a $3C Targeted Reset to the DUT
    const result1 = await sendLinWithSend(t, {
      errorInject: {
        bit: headerBitLength + 89,
        value: 0
      }
    })
    assert(!result1)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)
    assert.equal(getErrorFlag(result.msg.data, 5), 6)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 0)
  })
  test('5.4.1.3 CheckSum error', async () => {
    const msg = FrameMap['Slave1_TxFrame1']
    const t = FrameMap['3c']

    let result = await sendLinWithRecv(msg, {})
    assert(result.result)

    //2. Send a $3C Targeted Reset to the DUT
    const result1 = await sendLinWithSend(t, {
      checkSum: 0xff
    })
    assert(!result1)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)
    assert.equal(getErrorFlag(result.msg.data, 5), 5)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 0)
  })
  test('5.4.1.6 Multiple Errors', async () => {
    const msg = FrameMap['Slave1_TxFrame1']
    const t = FrameMap['3c']
    const r = FrameMap['3d']
    let result = await sendLinWithRecv(msg, {})
    assert(result.result)

    //2. Send a $3C Targeted Reset to the DUT
    let result1 = await sendLinWithSend(t, {})
    assert(result1)
    //3. Send a $3D Response with the ID Parity bits corrupted, i.e. Protected ID of (0011 1101)
    result = await sendLinWithRecv(r, {
      pid: 0x3d
    })
    assert(result.result == false)

    //4. Send a $3C Targeted Reset with a corrupted checksum to the DUT

    result1 = await sendLinWithSend(t, {
      checkSum: 0xff
    })
    assert(!result1)

    result1 = await sendLinWithSend(t, {})
    assert(result1)
    //5. Send a $3D Response and corrupt bit 6 (send a dominant) of the NAD byte sent by the DUT.
    result = await sendLinWithRecv(r, {
      errorInject: {
        bit: headerBitLength + 6,
        value: 0
      }
    })
    assert(result.result == false)
    //1
    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 7)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 5)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 4)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 1)

    result = await sendLinWithRecv(msg, {})
    assert(result.result)
    assert(result.msg)

    assert.equal(getErrorFlag(result.msg.data, 5), 0)
  })
})

test('reset', async () => {
  const msg = FrameMap['Slave1_TxFrame1']
  const result = await sendLinWithRecv(msg, {})
  assert(result.result)
  assert(result.msg)

  assert.equal(getErrorFlag(result.msg.data, 5), 1)
})
