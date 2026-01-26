import {
  test,
  before,
  linBaudRateCtrl,
  assert,
  LinCableErrorInject,
  LinDirection,
  LinMsg,
  LinChecksumType,
  output
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

test('lin baudrate gradually stress test', async () => {
  console.log('test start')
  await sendWakeUp(5)
  // Variables for baudrate stress test
  let fCommBaudrateChangeStep = 0.5 // 波特率变化步长
  let bChangeBaudrateDirection = 0 // 0-波特率递增 1-波特率递减
  let currentBaudrateValue = 19200 // 当前波特率
  const nodeId = 0x36

  // Initialize LIN
  await linBaudRateCtrl(currentBaudrateValue)

  // Helper function to gradually change baudrate
  const baudchangegradually = async () => {
    if (bChangeBaudrateDirection === 0) {
      // 波特率递增
      currentBaudrateValue += (fCommBaudrateChangeStep * currentBaudrateValue) / 100
      if (currentBaudrateValue > 23000) {
        bChangeBaudrateDirection = 1
        console.log(`Change Baudrate Step with ${fCommBaudrateChangeStep.toFixed(1)}%`)
        fCommBaudrateChangeStep += 0.5
      }
    } else {
      // 波特率递减
      currentBaudrateValue -= (fCommBaudrateChangeStep * currentBaudrateValue) / 100
      if (currentBaudrateValue < 9600) {
        bChangeBaudrateDirection = 0
      }
    }
    const realBaud = await linBaudRateCtrl(currentBaudrateValue)
    console.log(
      `Change Baudrate at (Hope:${Math.round(currentBaudrateValue)}/Real:${realBaud}) BPS`
    )
  }

  // Main stress test loop
  while (fCommBaudrateChangeStep <= 50) {
    // Change baudrate gradually
    await baudchangegradually()

    // Create and send LIN header frame
    const frame: LinMsg = {
      frameId: nodeId,
      direction: LinDirection.RECV,
      data: Buffer.alloc(8, 0),
      checksumType: LinChecksumType.CLASSIC
    }

    // Send the header
    const result = await sendLinWithRecv(frame, null)

    if (result.result) {
      console.log(`[${nodeId.toString(16).toUpperCase()}] Frame recv successfully`)
    } else {
      console.log(`[${nodeId.toString(16).toUpperCase()}] Frame recv failed`)
    }

    // Wait 20ms before next iteration
    await new Promise((resolve) => setTimeout(resolve, 20))
  }

  console.log('test completed - baudrate stress test finished')
})
