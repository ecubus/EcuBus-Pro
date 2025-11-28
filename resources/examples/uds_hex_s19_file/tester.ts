import { DiagRequest, HexMemoryMap } from 'ECB'
import fsP from 'fs/promises'
import path from 'path'

const pendingBlocks: { addr: number; data: Buffer }[] = []
let currentBlock: { addr: number; data: Buffer } | undefined = undefined
let maxChunkSize: number | undefined
Util.Init(async () => {
  const hexFile = path.join(process.env.PROJECT_ROOT, 'Hello_World.hex')
  const hexStr = await fsP.readFile(hexFile, 'utf8')
  const map = HexMemoryMap.fromHex(hexStr)
  for (const [addr, data] of map) {
    pendingBlocks.push({ addr, data })
  }
})

Util.Register('Tester.JobFunction0', () => {
  const req: DiagRequest[] = []
  currentBlock = pendingBlocks.shift()
  if (currentBlock) {
    console.log('JobFunction0', currentBlock.addr)
    const r34 = DiagRequest.from('Tester.RequestDownload520')
    const memoryAddress = Buffer.alloc(4)
    memoryAddress.writeUInt32BE(currentBlock.addr)
    r34.diagSetParameterRaw('memoryAddress', memoryAddress)

    r34.diagSetParameter('memorySize', currentBlock.data.length)
    r34.On('recv', (resp) => {
      //read the maxNumberOfBlockLength, 4 bytes (static)
      maxChunkSize = resp.diagGetParameterRaw('maxNumberOfBlockLength').readUint32BE(0)
    })
    return [r34]
  }

  return req
})

Util.Register('Tester.JobFunction1', () => {
  console.log('JobFunction1')
  if (maxChunkSize == undefined || maxChunkSize <= 2) {
    throw new Error('maxNumberOfBlockLength is undefined or too small')
  }
  if (currentBlock) {
    maxChunkSize -= 2
    if (maxChunkSize & 0x07) {
      maxChunkSize -= maxChunkSize & 0x07
    }
    const numChunks = Math.ceil(currentBlock.data.length / maxChunkSize)
    const list = []
    for (let i = 0; i < numChunks; i++) {
      const start = i * maxChunkSize
      const end = Math.min(start + maxChunkSize, currentBlock.data.length)
      const chunk = currentBlock.data.subarray(start, end)

      const transferRequest = DiagRequest.from('Tester.TransferData540')
      transferRequest.diagSetParameterSize('transferRequestParameterRecord', chunk.length * 8)
      transferRequest.diagSetParameterRaw('transferRequestParameterRecord', chunk)

      // 计算块序号 (从1开始)
      const blockSequenceCounter = Buffer.alloc(1)
      blockSequenceCounter.writeUInt8((i + 1) & 0xff) // 使用循环计数 1-255
      transferRequest.diagSetParameterRaw('blockSequenceCounter', blockSequenceCounter)

      list.push(transferRequest)
    }
    //37
    const r37 = DiagRequest.from('Tester.RequestTransferExit550')
    r37.diagSetParameterSize('transferRequestParameterRecord', 0)
    list.push(r37)
    if (pendingBlocks.length > 0) {
      //restart job0,job1
      const job0 = DiagRequest.from('Tester.JobFunction0')
      const job1 = DiagRequest.from('Tester.JobFunction1')
      list.push(job0, job1)
    }

    currentBlock = undefined
    maxChunkSize = undefined
    return list
  } else {
    return []
  }
})
