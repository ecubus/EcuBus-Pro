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

Util.Init(() => {
  const obj2000 = device.eds.addEntry(0x2000, {
    parameterName: 'Test object',
    dataType: canopen.DataType.UNSIGNED8
  })
  const obj2001 = device.eds.addEntry(0x2001, {
    parameterName: 'Motor speed (0-100)',
    dataType: canopen.DataType.UNSIGNED8
  })

  device.eds.addReceivePdo({
    cobId: 0x180, // Send with ID 0x180
    dataObjects: [obj2000, obj2001] // Map 0x2000 and motor speed 0x2001
  })

  // Start the device and enter NmtState.OPERATIONAL.
  device.start()
  device.nmt.startNode()

  device.pdo.on('pdo', ({ cobId, dataObjects }) => {
    console.log('Received PDO 0x' + cobId.toString(16))
    for (const obj of dataObjects) {
      console.log(`Set ${obj} to ${obj.value}`)
      if (obj.index === 0x2001) {
        setVar('MotorSpeed', Number(obj.value))
      }
    }
  })
})
