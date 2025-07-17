import { DiagResponse, describe, runUdsSeq, stopUdsSeq } from 'ECB'

Util.Init(() => {})

Util.On('Tester.SecurityAccess390.send', async (req) => {
  const resp = DiagResponse.fromDiagRequest(req)
  const randomSeed = Buffer.alloc(8)
  for (let i = 0; i < randomSeed.length; i++) {
    randomSeed[i] = Math.floor(Math.random() * 256)
  }
  resp.diagSetRaw(Buffer.from([0x67, 0x1, ...randomSeed]))
  await resp.outputDiag()
})
Util.On('Tester.SecurityAccess391.send', async (req) => {
  const raw = req.diagGetRaw()
  console.log(`seed key ${raw.subarray(2).toString('hex')}`)
  const resp = DiagResponse.fromDiagRequest(req)
  resp.diagSetRaw(Buffer.from([0x67, 0x2]))
  await resp.outputDiag()
})
