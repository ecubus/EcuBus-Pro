import { DiagResponse, describe, runUdsSeq, stopUdsSeq } from 'ECB'

Util.Init(() => {})

Util.On('Tester.RequestDownload520.send', async (req) => {
  const resp = DiagResponse.fromDiagRequest(req)
  resp.diagSetRaw(Buffer.from([0x74, 0x40, 0, 0, 0, 0x81]))
  await resp.outputDiag()
})
Util.On('Tester.TransferData540.send', async (req) => {
  const resp = DiagResponse.fromDiagRequest(req)
  resp.diagSetRaw(Buffer.from([0x76, Number(req.diagGetParameter('blockSequenceCounter'))]))
  await resp.outputDiag()
})
Util.On('Tester.RequestTransferExit550.send', async (req) => {
  const resp = DiagResponse.fromDiagRequest(req)
  resp.diagSetRaw(Buffer.from([0x77]))
  await resp.outputDiag()
})

Util.OnVar('UDS.start', (val) => {
  console.log('var', val)
  if (val.value) {
    //start
    runUdsSeq('Tester.Seq0')
  } else {
    //stop
    stopUdsSeq('Tester.Seq0')
  }
})
