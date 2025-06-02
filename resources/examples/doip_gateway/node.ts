import { DiagResponse, output, RegisterEthVirtualEntity } from 'ECB'

Util.Init(async () => {
  console.log('Registering virtual entity')
  await RegisterEthVirtualEntity(
    {
      vin: '123456789',
      eid: '00-00-00-00-00-00',
      gid: '00-00-00-00-00-00',
      logicalAddr: 100
    },
    '127.0.0.1'
  )
})

Util.On('Tester_eth_1.*.send', async (req) => {
  console.log('Received DOIP Diag request')
  req.testerName = 'Tester_can_0'
  await req.outputDiag('PEAK_1')
})
Util.On('Tester_can_0.*.recv', async (resp) => {
  console.log('Received CANTP Diag response')
  resp.testerName = 'Tester_eth_1'
  await resp.outputDiag('SIMULATE_0')
})
