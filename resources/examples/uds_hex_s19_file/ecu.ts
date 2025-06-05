import { CAN_ID_TYPE, CanMessage, DiagResponse, output } from 'ECB'

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
Util.OnKey('b', async () => {
  const pl = []
  const start = Date.now()
  for (let i = 0; i < 5000; i++) {
    const msg: CanMessage = {
      dir: 'OUT',
      data: Buffer.alloc(8).fill(i % 255),
      id: 1,
      msgType: {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: false,
        remote: false
      }
    }
    pl.push(output(msg))
  }
  await Promise.any(pl)
  const end = Date.now()
  console.log(`send ${pl.length} messages cost ${end - start}ms`)
})
