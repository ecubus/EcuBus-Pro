import {
  setSignal,
  output,
  CanMessage,
  CAN_ID_TYPE,
  getSignal,
  getFrameFromDB,
  ID111RCM_inertial2
} from 'ECB'
let val = 0

Util.OnCan(0x142, async (data) => {
  await setSignal('Model3CAN.VCLEFT_liftgateLatchRequest', val++ % 5)
  const s = getSignal('Model3CAN.VCLEFT_liftgateLatchRequest')
  console.log(`Raw Value: ${s.value}`)
})

let canMsg: CanMessage<ID111RCM_inertial2>
Util.Init(() => {
  canMsg = getFrameFromDB<ID111RCM_inertial2>('can', 'Model3CAN', 'ID111RCM_inertial2')
  console.log(`init value ${canMsg.signals.RCM_inertial2Checksum.value}`)
  canMsg.data = Buffer.from([0, 0, 0, 0, 0, 0, 0, 5])
  console.log(`changed value ${canMsg.signals.RCM_inertial2Checksum.value}`)
})

setInterval(() => {
  const rnd = Math.floor(Math.random() * 256)
  canMsg.signals.RCM_inertial2Checksum.value = rnd
  console.log(`Setting RCM_inertial2Checksum to ${rnd.toString(16)}`)
  output(canMsg)
}, 1000)

Util.OnSignal('Model3CAN.VCLEFT_liftgateLatchRequest', (v) => {
  console.log(`Raw Value: ${v.value}, Physical Value: ${v.physValueEnum ?? v.physValue}`)
})
