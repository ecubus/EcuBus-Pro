import { DiagResponse } from 'ECB'

// Simulated ECU (slave) side: answer ReadDataByIdentifier 0xF190 (VIN).
// The node is bound to the same UDS (uartcan) device as the tester, so the
// request/response exchange runs through the full ISO-TP stack — no external
// hardware is required.
Util.On('Tester.ReadVIN.send', async (req) => {
  const resp = DiagResponse.fromDiagRequest(req)
  // 0x62 = positive response of 0x22, followed by the DID and the VIN bytes
  resp.diagSetRaw(
    Buffer.concat([Buffer.from([0x62, 0xf1, 0x90]), Buffer.from('EcuBus-Pro-UDS-01')])
  )
  await resp.outputDiag()
})
