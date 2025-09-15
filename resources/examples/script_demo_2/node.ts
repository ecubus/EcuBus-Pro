import { LinChecksumType, LinDirection, LinMsg, output } from 'ECB'

Util.OnVar('EnvChecksumError', async ({ value }) => {
  if (value == 1) {
    console.log('Checksum err')
    const msg: LinMsg = {
      frameId: 0x3c,
      direction: LinDirection.SEND,
      data: Buffer.from([0x60, 0x01, 0xb5, 0xff, 0xff, 0xff, 0xff, 0xff]),
      checksumType: LinChecksumType.CLASSIC,
      lincable: {
        checkSum: 3 //错误的校验和
      }
    }
    try {
      output(msg)
    } catch (e) {
      null
    }
  }
})
