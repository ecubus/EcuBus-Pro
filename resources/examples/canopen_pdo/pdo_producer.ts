import { canopen, output, CanMessage, CAN_ID_TYPE, setVar } from 'ECB'

const device = new canopen.Device({ id: 0xb })

device.addListener('message', (message) => {
  const canMessage: CanMessage = {
    id: message.id,
    data: message.data,
    dir: 'OUT',
    msgType: {
      canfd: false,
      brs: false,
      idType: CAN_ID_TYPE.STANDARD,
      remote: false
    }
  }
  output(canMessage).catch(() => {
    console.error('Failed to output message')
  })
})

Util.OnCan(true, (msg) => {
  device.receive({
    id: msg.id,
    data: msg.data,
    len: msg.data.length
  })
})

let speed = 0
Util.OnVar('MotorSpeedPlus', async (value) => {
  if (value.value) {
    speed++
    if (speed > 100) {
      speed = 100
    }
    device.setValue(0x2001, speed)
  }
})
Util.OnVar('MotorSpeedMinus', async (value) => {
  if (value.value) {
    speed--
    if (speed < 0) {
      speed = 0
    }
    device.setValue(0x2001, speed)
  }
})

Util.Init(() => {
  const obj2000 = device.eds.addEntry(0x2000, {
    parameterName: 'Test object',
    dataType: canopen.DataType.UNSIGNED8
  })
  const obj2001 = device.eds.addEntry(0x2001, {
    parameterName: 'Motor speed (0-100)',
    dataType: canopen.DataType.UNSIGNED8
  })

  device.eds.addTransmitPdo({
    cobId: 0x180, // Send with ID 0x180
    transmissionType: 254, // Send on value change
    dataObjects: [obj2000, obj2001] // Map 0x2000 and motor speed 0x2001
  } as any)

  // Start the device and enter NmtState.OPERATIONAL.
  device.start()
  device.nmt.startNode()

  // Send the PDO
  let count = 0
  const timer = setInterval(() => {
    device.setValue(0x2000, ++count)

    if (count >= 3) {
      // Cleanup
      clearInterval(timer)
      // device.stop();
    }
  }, 100)
})
