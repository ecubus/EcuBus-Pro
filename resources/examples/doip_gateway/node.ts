import { DiagResponse, output } from 'ECB'

let requestAddrName: string | undefined

Util.On('Tester_eth_1.*.send', async (req) => {
  requestAddrName = req.getUdsAddress()?.ethAddr?.name
  console.log('Received DOIP Diag request', req.getUdsAddress().ethAddr?.name)
  req.testerName = 'Tester_can_0'
  await req.outputDiag('SIMULATE_1', requestAddrName)
})
Util.On('Tester_can_0.*.recv', async (resp) => {
  console.log('Received CANTP Diag response')
  resp.testerName = 'Tester_eth_1'
  await resp.outputDiag('SIMULATE_0', requestAddrName)
})
