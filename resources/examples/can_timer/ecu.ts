import { CAN_ID_TYPE, CanMessage, output, PrecisionTimer } from 'ECB'

const timer = new PrecisionTimer('can_timer')
timer.create()

Util.Init(() => {
  // Schedule a task to run every 50ms
  timer.addTask(50000, 50000, () => {
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
  })
})

Util.End(() => {
  timer.destroy()
})
