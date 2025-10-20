import { getSignal, linStartScheduler } from 'ECB'

Util.Init(async () => {
  await linStartScheduler('NormalTable', 0)
  console.log('start')
})

Util.OnLin('2_2.MotorControl', () => {
  const val = getSignal('2_2.MotorDirection')
  console.log(val)
})
