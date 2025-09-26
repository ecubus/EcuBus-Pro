import {
  output,
  LinMsg,
  LinDirection,
  LinChecksumType,
  LinCableErrorInject,
  assert,
  getVar
} from 'ECB'

console.log('lin_aa.ts script loaded!')

const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 十六进制输出函数
const hex = (value: number | string | number[]): string => {
  if (typeof value === 'number') {
    return '0x' + value.toString(16).toUpperCase().padStart(2, '0')
  } else if (typeof value === 'string') {
    return '0x' + Buffer.from(value, 'utf8').toString('hex').toUpperCase()
  } else if (Array.isArray(value)) {
    return '0x' + value.map((v) => v.toString(16).toUpperCase().padStart(2, '0')).join(' ')
  }
  return String(value)
}

const sendFrameWithInterval = async (
  msg: LinMsg,
  inject: LinCableErrorInject,
  nextDueTime: number,
  intervalMs: number
): Promise<number> => {
  const now = Number(process.hrtime.bigint() / 1_000_000n)
  const due = nextDueTime || now
  const waitTime = Math.max(0, due - now)
  if (waitTime > 0) {
    await delay(waitTime)
  }
  // 以“开始发送”的时刻为基准
  void sendLinWithSend(msg, inject).catch(() => {})
  // 下一次目标时刻 = 本次开始时刻 + 间隔
  return due + intervalMs
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

async function LinAutoAddressing() {
  /**
   * Compute SupplierID low/high bytes for AA init frame
   */
  const supplierRaw = getVar('LIN_AA.SupplierID' as any) as any
  const supplierId =
    typeof supplierRaw === 'string'
      ? parseInt(String(supplierRaw).trim().replace(/^0x/i, ''), 16)
      : Number(supplierRaw)
  const supplierLow = supplierId & 0xff
  const supplierHigh = (supplierId >> 8) & 0xff

  /**
   * Parse NadTable string to byte array (hex values separated by spaces)
   */
  const nadTableRaw = getVar('LIN_AA.NadTable' as any)
  const nadList: number[] =
    typeof nadTableRaw === 'string'
      ? nadTableRaw
          .trim()
          .split(/\s+/)
          .filter((s) => s.length > 0)
          .map((s) => s.toLowerCase().replace(/^0x/, ''))
          .map((s) => parseInt(s, 16))
          .filter((n) => Number.isFinite(n) && n >= 0 && n <= 0xff)
      : []

  const aaInitFrame: LinMsg = {
    frameId: 0x3c,
    data: Buffer.from([0x7f, 0x06, 0xb5, supplierLow, supplierHigh, 0x01, 0x02, 0xff]),
    direction: LinDirection.SEND,
    checksumType: LinChecksumType.CLASSIC
  }
  const aaSaveFrame: LinMsg = {
    frameId: 0x3c,
    data: Buffer.from([0x7f, 0x06, 0xb5, supplierLow, supplierHigh, 0x03, 0x02, 0xff]),
    direction: LinDirection.SEND,
    checksumType: LinChecksumType.CLASSIC
  }
  const aaFinishedFrame: LinMsg = {
    frameId: 0x3c,
    data: Buffer.from([0x7f, 0x06, 0xb5, supplierLow, supplierHigh, 0x04, 0x02, 0xff]),
    direction: LinDirection.SEND,
    checksumType: LinChecksumType.CLASSIC
  }
  // get current time
  let nextDueTime = Number(process.hrtime.bigint() / 1_000_000n)
  const frameInterval = 10 // 10ms间隔

  // 发送初始化帧
  console.log('Send auto addressing init frame')
  nextDueTime = await sendFrameWithInterval(aaInitFrame, {}, nextDueTime, frameInterval)

  // 依次发送设置NAD帧（按 NadTable 顺序）
  for (const nad of nadList) {
    const aaSetNadFrame: LinMsg = {
      frameId: 0x3c,
      data: Buffer.from([0x7f, 0x06, 0xb5, supplierLow, supplierHigh, 0x02, 0x02, nad]),
      direction: LinDirection.SEND,
      checksumType: LinChecksumType.CLASSIC
    }
    console.log('Send auto addressing set nad frame.NAD:', hex(nad))
    nextDueTime = await sendFrameWithInterval(aaSetNadFrame, {}, nextDueTime, frameInterval)
  }

  // 发送保存帧
  console.log('Send auto addressing save frame')
  nextDueTime = await sendFrameWithInterval(aaSaveFrame, {}, nextDueTime, frameInterval)

  // 发送完成帧
  console.log('Send auto addressing finished frame')
  nextDueTime = await sendFrameWithInterval(aaFinishedFrame, {}, nextDueTime, frameInterval)

  console.log('LIN Auto Addressing completed successfully')
}

// 监听变量变化
Util.OnVar('LIN_AA.StartAA' as any, async (args) => {
  if (args.value == 1) {
    try {
      await LinAutoAddressing()
    } catch (error) {
      console.error('LIN Auto Addressing failed:', error)
    }
  } else {
    console.log('LIN Auto Addressing stopped')
  }
})

Util.OnKey('c', async () => {
  try {
    // Get a variable value
    const supplierRaw = getVar('LIN_AA.SupplierID' as any) as any
    const supplierId =
      typeof supplierRaw === 'string'
        ? parseInt(String(supplierRaw).trim().replace(/^0x/i, ''), 16)
        : Number(supplierRaw)
    console.log('SupplierID:', hex(supplierId)) // Access the value

    const nadTableRaw = getVar('LIN_AA.NadTable' as any)
    const nadList: number[] =
      typeof nadTableRaw === 'string'
        ? nadTableRaw
            .trim()
            .split(/\s+/)
            .filter((s) => s.length > 0)
            .map((s) => s.toLowerCase().replace(/^0x/, ''))
            .map((s) => parseInt(s, 16))
            .filter((n) => Number.isFinite(n) && n >= 0 && n <= 0xff)
        : []
    console.log('NadTable (hex):', hex(nadList))
  } catch (error) {
    console.error('Error getting variables:', error)
  }
})
