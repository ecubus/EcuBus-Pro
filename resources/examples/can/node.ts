import { setSignal, output, CanMessage, CAN_ID_TYPE } from 'ECB'
let val = 0

Util.OnCan(0x142, (data) => {
  setSignal('Model3CAN.VCLEFT_liftgateLatchRequest', val++ % 5)
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

