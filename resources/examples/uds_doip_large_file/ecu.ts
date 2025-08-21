import { CAN_ID_TYPE, CanMessage, DiagResponse, output } from 'ECB'

Util.Init(() => {})

Util.On('Tester.RequestDownload520.send', async (req) => {
  const resp = DiagResponse.fromDiagRequest(req)
  resp.diagSetRaw(Buffer.from([0x74, 0x40, 0, 0, 0x1f, 0x81]))
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
