import { SerialPortClient } from 'ECB'

const sp = new SerialPortClient({
  path: 'COM22',
  baudRate: 115200
})

sp.on('data', (data: Buffer) => {
  console.log('data received:', data)
})
Util.Init(async () => {
  console.log(await SerialPortClient.list())
  await sp.open()
  console.log('serial port opened')
  await sp.write(Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xc4, 0x0b]))
  console.log('data written')
})

Util.End(async () => {
  await sp.close()
})
