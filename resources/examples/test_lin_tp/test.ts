import {
  test,
  output,
  LinMsg,
  LinDirection,
  LinChecksumType,
  LinCableErrorInject,
  assert
} from 'ECB'
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
const NAD = 2

test('物理寻址', async () => {
  const msg1: LinMsg = {
    frameId: 0x3c,
    data: Buffer.from([NAD, 0x10, 0x11, 0x10, 0x01, 0x3, 0x4, 0x5]),
    direction: LinDirection.SEND,
    checksumType: LinChecksumType.CLASSIC
  }

  const msg3: LinMsg = {
    frameId: 0x3c,
    data: Buffer.from([NAD, 0x21, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]),
    direction: LinDirection.SEND,
    checksumType: LinChecksumType.CLASSIC
  }

  const msg5: LinMsg = {
    frameId: 0x3c,
    data: Buffer.from([NAD, 0x22, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11]),
    direction: LinDirection.SEND,
    checksumType: LinChecksumType.CLASSIC
  }
  const rx: LinMsg = {
    frameId: 0x3d,
    data: Buffer.alloc(8),
    direction: LinDirection.RECV,
    checksumType: LinChecksumType.CLASSIC
  }

  let resultTx = await sendLinWithSend(msg1, {})
  assert(resultTx)

  resultTx = await sendLinWithSend(msg3, {})
  assert(resultTx)

  resultTx = await sendLinWithSend(msg5, {})
  assert(resultTx)
  const resultRx = await sendLinWithRecv(rx, {})
  assert(resultRx.result)
  assert(resultRx.msg)
})

test('物理寻址处理中，功能寻址应该不执行和回复', async () => {
  const msg1: LinMsg = {
    frameId: 0x3c,
    data: Buffer.from([NAD, 0x10, 0x11, 0x10, 0x01, 0x3, 0x4, 0x5]),
    direction: LinDirection.SEND,
    checksumType: LinChecksumType.CLASSIC
  }
  const msg2: LinMsg = {
    frameId: 0x3c,
    data: Buffer.from([0x7e, 0x02, 0x3e, 0x80, 0xaa, 0xaa, 0xaa, 0xaa]),
    direction: LinDirection.SEND,
    checksumType: LinChecksumType.CLASSIC
  }
  const msg3: LinMsg = {
    frameId: 0x3c,
    data: Buffer.from([NAD, 0x21, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]),
    direction: LinDirection.SEND,
    checksumType: LinChecksumType.CLASSIC
  }
  const msg4: LinMsg = {
    frameId: 0x3c,
    data: Buffer.from([0x7e, 0x02, 0x3e, 0x80, 0xaa, 0xaa, 0xaa, 0xaa]),
    direction: LinDirection.SEND,
    checksumType: LinChecksumType.CLASSIC
  }
  const msg5: LinMsg = {
    frameId: 0x3c,
    data: Buffer.from([NAD, 0x22, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11]),
    direction: LinDirection.SEND,
    checksumType: LinChecksumType.CLASSIC
  }
  const rx: LinMsg = {
    frameId: 0x3d,
    data: Buffer.alloc(8),
    direction: LinDirection.RECV,
    checksumType: LinChecksumType.CLASSIC
  }

  let resultTx = await sendLinWithSend(msg1, {})
  assert(resultTx)
  resultTx = await sendLinWithSend(msg2, {})
  assert(resultTx)
  resultTx = await sendLinWithSend(msg3, {})
  assert(resultTx)
  resultTx = await sendLinWithSend(msg4, {})
  assert(resultTx)
  resultTx = await sendLinWithSend(msg5, {})
  assert(resultTx)
  const resultRx = await sendLinWithRecv(rx, {})
  assert(resultRx.result)
  assert(resultRx.msg)
})
