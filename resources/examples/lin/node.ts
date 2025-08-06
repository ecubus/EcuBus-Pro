import { linStartScheduler } from 'ECB'

Util.Init(async () => {
  await linStartScheduler('NormalTable', 0)
  console.log('start')
})

