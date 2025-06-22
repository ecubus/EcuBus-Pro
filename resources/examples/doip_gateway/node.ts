import { DiagResponse, output } from 'ECB'

Util.On('Tester_eth_1.*.send', async (req) => {
  console.log('Received DOIP Diag request', req.getUdsAddress().ethAddr?.name)
  req.testerName = 'Tester_can_0'
  await req.outputDiag('SIMULATE_1', req.getUdsAddress().ethAddr?.name)
})
Util.On('Tester_can_0.*.recv', async (resp) => {
  console.log('Received CANTP Diag response', resp.getUdsAddress().canAddr?.name)
  resp.testerName = 'Tester_eth_1'
  await resp.outputDiag('SIMULATE_0', resp.getUdsAddress().ethAddr?.name)
})
