import { DiagRequest, HexMemoryMap } from 'ECB'
import fsP from 'fs/promises'
import path from 'path'

let maxChunkSize: number | undefined
let fHandle: fsP.FileHandle | undefined
let cnt = 1

const combine36 = 6

// Speed statistics variables
let totalBytesTransferred = 0
let transferStartTime: number | undefined
let lastReportedBytes = 0
let speedReportInterval: NodeJS.Timeout | undefined
Util.Init(async () => {
  const hexFile = path.join(process.env.PROJECT_ROOT, 'large.bin')

  fHandle = await fsP.open(hexFile, 'r')
})

Util.End(async () => {
  if (speedReportInterval) {
    clearInterval(speedReportInterval)
    speedReportInterval = undefined
  }
  if (fHandle) {
    await fHandle.close()
  }
})
Util.Register('Tester.JobFunction0', async () => {
  const req: DiagRequest[] = []

  if (fHandle) {
    const fileState = await fHandle.stat()
    console.log('File size:', fileState.size)
    const r34 = DiagRequest.from('Tester.RequestDownload520')
    const memoryAddress = Buffer.alloc(4)
    memoryAddress.writeUInt32BE(0)
    r34.diagSetParameterRaw('memoryAddress', memoryAddress)

    r34.diagSetParameter('memorySize', fileState.size)
    r34.On('recv', (resp) => {
      //read the maxNumberOfBlockLength, 4 bytes (static)
      maxChunkSize = resp.diagGetParameterRaw('maxNumberOfBlockLength').readUint32BE(0)
      maxChunkSize -= 2
      if (maxChunkSize & 0x07) {
        maxChunkSize -= maxChunkSize & 0x07
      }
      console.log(`used maxChunkSize: ${maxChunkSize}`)

      // Initialize speed tracking when download starts
      transferStartTime = Date.now()
      totalBytesTransferred = 0
      lastReportedBytes = 0
      console.log('Transfer speed tracking initialized')

      // Start speed reporting interval (every 10 seconds)
      speedReportInterval = setInterval(() => {
        const currentTime = Date.now()
        const timeDiff = 10 // 10 seconds
        const bytesDiff = totalBytesTransferred - lastReportedBytes
        const speedBps = bytesDiff / timeDiff // bytes per second
        const speedKBps = speedBps / 1024 // KB per second
        const speedMBps = speedKBps / 1024 // MB per second

        // Calculate overall average speed
        const overallTimeDiff = (currentTime - transferStartTime!) / 1000
        const overallSpeedBps = totalBytesTransferred / overallTimeDiff
        const overallSpeedKBps = overallSpeedBps / 1024
        const overallSpeedMBps = overallSpeedKBps / 1024

        console.log(
          `[Speed Report] Current: ${speedKBps.toFixed(2)} KB/s (${speedMBps.toFixed(2)} MB/s)`
        )
        console.log(
          `[Speed Report] Average: ${overallSpeedKBps.toFixed(2)} KB/s (${overallSpeedMBps.toFixed(2)} MB/s)`
        )
        console.log(
          `[Speed Report] Total transferred: ${(totalBytesTransferred / 1024 / 1024).toFixed(2)} MB`
        )

        // Update tracking variables
        lastReportedBytes = totalBytesTransferred
      }, 10000) // 10 seconds
    })
    return [r34]
  }

  return req
})

Util.Register('Tester.JobFunction1', async () => {
  if (maxChunkSize == undefined || maxChunkSize <= 2) {
    throw new Error('maxNumberOfBlockLength is undefined or too small')
  }
  if (fHandle) {
    const list = []
    const data = Buffer.alloc(maxChunkSize)

    for (let i = 0; i < combine36; i++) {
      const { bytesRead } = await fHandle.read(data)

      // Update transferred bytes counter
      totalBytesTransferred += bytesRead

      const transferRequest = DiagRequest.from('Tester.TransferData540')
      transferRequest.diagSetParameterSize('transferRequestParameterRecord', bytesRead * 8)
      transferRequest.diagSetParameterRaw(
        'transferRequestParameterRecord',
        data.subarray(0, bytesRead)
      )

      // 计算块序号 (从1开始)
      const blockSequenceCounter = Buffer.alloc(1)
      blockSequenceCounter.writeUInt8(cnt & 0xff) // 使用循环计数 1-255
      transferRequest.diagSetParameterRaw('blockSequenceCounter', blockSequenceCounter)
      cnt++

      list.push(transferRequest)

      if (bytesRead == maxChunkSize) {
        if (i == combine36 - 1) {
          //maybe still have data to read,
          list.push(DiagRequest.from('Tester.JobFunction1'))
        }
      } else {
        console.log(`Read ${bytesRead} bytes, no more data to read.`)

        //close the file
        if (fHandle) {
          await fHandle.close()
          fHandle = undefined
        }

        // Stop the speed reporting interval
        if (speedReportInterval) {
          clearInterval(speedReportInterval)
          speedReportInterval = undefined
        }

        // Final speed report
        if (transferStartTime) {
          const finalTime = Date.now()
          const totalTimeDiff = (finalTime - transferStartTime) / 1000
          const finalSpeedBps = totalBytesTransferred / totalTimeDiff
          const finalSpeedKBps = finalSpeedBps / 1024
          const finalSpeedMBps = finalSpeedKBps / 1024

          console.log(`[Final Speed Report] Transfer completed!`)
          console.log(`[Final Speed Report] Total time: ${totalTimeDiff.toFixed(2)} seconds`)
          console.log(
            `[Final Speed Report] Total transferred: ${(totalBytesTransferred / 1024 / 1024).toFixed(2)} MB`
          )
          console.log(
            `[Final Speed Report] Average speed: ${finalSpeedKBps.toFixed(2)} KB/s (${finalSpeedMBps.toFixed(2)} MB/s)`
          )
        }

        //push the exit request
        const r37 = DiagRequest.from('Tester.RequestTransferExit550')
        r37.diagSetParameterSize('transferRequestParameterRecord', 0)
        list.push(r37)
        maxChunkSize = undefined
        break
      }
    }
    return list
  } else {
    return []
  }
})
