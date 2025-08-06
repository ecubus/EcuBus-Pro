import { DiagResponse } from 'ECB'

Util.On('Tester_eth_1.DiagnosticSessionControl160.send', async (req) => {
  console.log('Received Diag request')
  const resp = DiagResponse.fromDiagRequest(req)
  await resp.outputDiag()
})

