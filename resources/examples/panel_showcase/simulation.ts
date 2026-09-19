import { CAN_ID_TYPE, getVar, output, setVar, setVars } from 'ECB'

let ticks = 0
let busy = false
let lastTarget: number | undefined

Util.OnCan(0x101, (message) => {
  const target = message.data.readUInt16LE(0) / 10
  if (target !== lastTarget && Number(getVar('DemoAuto')) === 0) setVar('DemoLevel', target)
  lastTarget = target
})

Util.OnVar('DemoPulse', ({ value }) => {
  if (value === 1) setVar('DemoCounter', Number(getVar('DemoCounter')) + 1)
})

Util.OnVar('DemoFill', ({ value }) => {
  setVar('DemoFillHigh', Number(value) >= 80 ? 1 : 0)
})

Util.Init(() => {
  setVars({
    DemoAuto: 1,
    DemoEnabled: 1,
    DemoLevel: 40,
    DemoMode: 1,
    DemoPulse: 0,
    DemoToggle: 0,
    DemoCounter: 0,
    DemoProgress: 0,
    DemoAlarm: 0,
    DemoTemperature: 25,
    DemoHex: 42,
    DemoDirection: 0,
    DemoText: 'Hello Panel',
    DemoBytes: [72, 101, 108, 108, 111, 33],
    DemoPath: '',
    DemoDirectory: '',
    DemoSavePath: '',
    DemoFill: 50,
    DemoFillHigh: 0,
    DemoSpeed: 0
  })
  setVar('DemoStatus', 'Simulation running')
  setInterval(async () => {
    if (busy) return
    busy = true
    try {
      ticks++
      const automatic = Number(getVar('DemoAuto')) === 1
      const enabled = Number(getVar('DemoEnabled')) === 1
      const mode = Number(getVar('DemoMode'))
      const direction = Number(getVar('DemoDirection'))
      const load = automatic
        ? Math.round((Math.sin(ticks / 18) + 1) * 50)
        : Number(getVar('DemoLevel'))
      const speed = enabled && direction !== 1 ? load * [1.2, 1.8, 2.4][mode] : 0
      const temperature = Math.round(20 + load * 0.7)
      setVar('DemoSpeed', speed)
      setVar('DemoProgress', ticks % 101)
      setVar('DemoTemperature', temperature)
      setVar('DemoAlarm', temperature > 70 ? 1 : 0)
      setVar(
        'DemoStatus',
        enabled
          ? `${['Eco', 'Normal', 'Sport'][mode]} / ${['Forward', 'Neutral', 'Reverse'][direction]}`
          : 'Disabled'
      )
      const data = Buffer.alloc(8)
      data.writeUInt16LE(Math.round(speed * 10), 0)
      data[2] = temperature + 40
      data[3] = load
      data[4] = mode
      data.writeUInt16LE(ticks % 65536, 5)
      await output({
        id: 0x100,
        data,
        dir: 'OUT',
        device: 'SIM_ECU',
        database: 'panel-demo-db',
        name: 'Status',
        msgType: { idType: CAN_ID_TYPE.STANDARD, canfd: false, brs: false, remote: false }
      })
    } catch (error) {
      console.error(error)
    } finally {
      busy = false
    }
  }, 100)
})
