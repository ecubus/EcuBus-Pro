import { setSignal, output, CanMessage, CAN_ID_TYPE, getSignal } from 'ECB'
let val = 0

Util.OnCan(0x142, async (data) => {
  await setSignal('Model3CAN.VCLEFT_liftgateLatchRequest', val++ % 5)
  const { rawValue } = getSignal('Model3CAN.VCLEFT_liftgateLatchRequest')
  console.log(`Raw Value: ${rawValue},${val - 1}`)
})

setInterval(() => {
  const canMsg: CanMessage = {
    id: 0x111,
    data: Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]),
    dir: 'OUT',
    msgType: {
      idType: CAN_ID_TYPE.STANDARD,
      remote: false,
      brs: false,
      canfd: false
    }
  }
  output(canMsg)
}, 1000)

Util.OnSignal('Model3CAN.VCLEFT_liftgateLatchRequest', ({ rawValue, physValue }) => {
  console.log(`Raw Value: ${rawValue}, Physical Value: ${physValue}`)
})
