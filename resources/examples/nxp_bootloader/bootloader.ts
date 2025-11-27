import crypto from 'crypto'
import { CRC, DiagRequest, DiagResponse } from 'ECB'
import path from 'path'
import fs from 'fs/promises'

const crc = new CRC('self', 16, 0x3d65, 0, 0xffff, true, true)
let maxChunkSize: number | undefined = undefined
let content: undefined | Buffer = undefined
const fileList: {
  addr: number
  file: string
}[] = [
  {
    addr: 0x20000010,
    file: path.join(process.env.PROJECT_ROOT, 'bin', 'S32K344_FlsDrvRTD100.bin')
  },
  {
    addr: 0x00440200,
    file: path.join(process.env.PROJECT_ROOT, 'bin', 'S32K344_CAN_App_RTD200.bin')
  }
]

Util.Init(async () => {
  //change routineControlType
  const req = DiagRequest.from('Tester_1.RoutineControl491')
  req.diagSetParameter('routineControlType', 1)
  await req.changeService()
  const resp = DiagResponse.from('Tester_1.RoutineControl491')
  resp.diagSetParameter('routineControlType', 1)
  await resp.changeService()
})

Util.On('Tester_1.SecurityAccess390.recv', async (v) => {
  const data = v.diagGetParameterRaw('securitySeed')
  const cipher = crypto.createCipheriv(
    'aes-128-cbc',
    Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
    Buffer.alloc(16, 0)
  )
  const encrypted = cipher.update(data)
  cipher.final()
  const req = DiagRequest.from('Tester_1.SecurityAccess391')
  req.diagSetParameterSize('data', 128)
  req.diagSetParameterRaw('data', encrypted)
  await req.changeService()
})

Util.Register('Tester_1.JobFunction0', async () => {
  const item = fileList.shift()
  if (item) {
    const r34 = DiagRequest.from('Tester_1.RequestDownload520')
    const memoryAddress = Buffer.alloc(4)
    memoryAddress.writeUInt32BE(item.addr)
    r34.diagSetParameterRaw('memoryAddress', memoryAddress)
    content = await fs.readFile(item.file)
    const crcResult = crc.compute(content)
    const crcReq = DiagRequest.from('Tester_1.RoutineControl490')
    const crcBuffer = Buffer.alloc(4)
    crcBuffer.writeUInt16BE(crcResult, 2)
    crcReq.diagSetParameterSize('routineControlOptionRecord', 4 * 8)
    crcReq.diagSetParameterRaw('routineControlOptionRecord', crcBuffer)
    await crcReq.changeService()
    r34.diagSetParameter('memorySize', content.length)
    r34.On('recv', (resp) => {
      maxChunkSize = resp.diagGetParameterRaw('maxNumberOfBlockLength').readUint8(0)
    })
    return [r34]
  } else {
    return []
  }
})
Util.Register('Tester_1.JobFunction1', () => {
  if (maxChunkSize == undefined || maxChunkSize <= 2) {
    throw new Error('maxNumberOfBlockLength is undefined or too small')
  }
  if (content) {
    maxChunkSize -= 2
    if (maxChunkSize & 0x07) {
      maxChunkSize -= maxChunkSize & 0x07
    }
    const numChunks = Math.ceil(content.length / maxChunkSize)
    const list = []
    for (let i = 0; i < numChunks; i++) {
      const start = i * maxChunkSize
      const end = Math.min(start + maxChunkSize, content.length)
      const chunk = content.subarray(start, end)

      const transferRequest = DiagRequest.from('Tester_1.TransferData540')
      transferRequest.diagSetParameterSize('transferRequestParameterRecord', chunk.length * 8)
      transferRequest.diagSetParameterRaw('transferRequestParameterRecord', chunk)

      // 计算块序号 (从1开始)
      const blockSequenceCounter = Buffer.alloc(1)
      blockSequenceCounter.writeUInt8((i + 1) & 0xff) // 使用循环计数 1-255
      transferRequest.diagSetParameterRaw('blockSequenceCounter', blockSequenceCounter)

      list.push(transferRequest)
    }
    //37
    const r37 = DiagRequest.from('Tester_1.RequestTransferExit550')
    r37.diagSetParameterSize('transferRequestParameterRecord', 0)
    list.push(r37)
    r37.On('recv', async () => {
      if (fileList.length == 0) {
        const req = DiagRequest.from('Tester_1.RoutineControl491')
        req.diagSetParameter('routineIdentifier', 0xff01)
        await req.changeService()
        const resp = DiagResponse.from('Tester_1.RoutineControl491')
        resp.diagSetParameter('routineIdentifier', 0xff01)
        await resp.changeService()
      }
    })
    content = undefined
    maxChunkSize = undefined
    return list
  } else {
    return []
  }
})
