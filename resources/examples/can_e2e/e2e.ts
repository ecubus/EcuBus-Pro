import { CRC } from 'ECB'

let cnt = 0
const crc8 = CRC.buildInCrc('CRC8')!
Util.setTxPending((msg) => {
  if (msg.id == 1 && msg.data.length == 8) {
    msg.data[6] = cnt++ % 256
    msg.data[7] = crc8.compute(msg.data.subarray(0, 7))
    return msg.data
  } else {
    return msg.data
  }
})
