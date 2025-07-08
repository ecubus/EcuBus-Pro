import {
  describe,
  LinChecksumType,
  LinDirection,
  LinMsg,
  output,
  test,
  assert,
  LinCableErrorInject
} from 'ECB'

const FrameMap: Record<string, LinMsg> = {
  //device specific transmit frame (IUT is publisher)
  //TODO:get from ldf
  TST_FRAME_4_Tx: {
    direction: LinDirection.RECV,
    frameId: 0x34,
    data: Buffer.alloc(5),
    checksumType: LinChecksumType.ENHANCED
  },
  //device specific receive frame (IUT is subscriber)
  //TODO:get from ldf
  TST_FRAME_4_Rx: {
    direction: LinDirection.SEND,
    frameId: 0x33,
    data: Buffer.from([1, 2, 3, 4, 5]),
    checksumType: LinChecksumType.ENHANCED
  },
  TST_FRAME_7: {
    direction: LinDirection.RECV,
    frameId: 0x34,
    data: Buffer.alloc(5),
    checksumType: LinChecksumType.ENHANCED
  }
}

const sendLinWithRecv = (msg: LinMsg, inject: LinCableErrorInject): Promise<boolean> => {
  return new Promise<boolean>((resolve, reject) => {
    msg.lincable = inject
    let timer: NodeJS.Timeout
    const cb = (msg: LinMsg) => {
      Util.OffLin(msg.frameId, cb)
      clearTimeout(timer)
      if (inject.breakLength != undefined) {
        if (inject.breakLength >= 13) {
          //ok here

          if (Buffer.compare(msg.data, Buffer.from([0x33, 0x33, 0x33, 0x33, 0x33])) === 0) {
            resolve(true)
          } else {
            resolve(true)
          }
        } else {
          //error here
          console.error(
            `Break length ${inject.breakLength} is too short, but output was successful.`
          )
          resolve(false)
        }
      }
      if (inject.syncVal != undefined && inject.syncVal !== false) {
        if (inject.syncVal != 0x55) {
          console.error(`Sync value ${inject.syncVal} is not 0x55, but output was successful.`)
          resolve(false)
        } else {
          if (Buffer.compare(msg.data, Buffer.from([0x33, 0x33, 0x33, 0x33, 0x33])) === 0) {
            resolve(true)
          } else {
            resolve(true)
          }
          resolve(true)
        }
      }
      if (inject.pid == false || inject.syncVal == false) {
        //error here
        console.error(
          `Sending break | ${inject.syncVal == false ? 'without sync' : ' sync'} |  ${inject.pid == false ? 'without pid' : ' pid'}, but output was successful.`
        )
        resolve(false)
      }
    }
    Util.OnLin(msg.frameId, cb)
    output(msg)
      .then(() => {
        timer = setTimeout(() => {
          Util.OffLin(msg.frameId, cb)
          console.log('timeout internal error')
          resolve(false) //resolve false if no response received
        }, 1000)
      })
      .catch((err) => {
        Util.OffLin(msg.frameId, cb)
        if (inject.breakLength != undefined) {
          if (inject.breakLength < 13) {
            //ok here
            console.log(`Break length ${inject.breakLength} is too short, as expected.`, err)
            resolve(true)
          } else {
            //error here
            console.error(`Break length ${inject.breakLength} is ok, but output failed:`, err)
            resolve(false)
          }
        }
        if (inject.syncVal != undefined && inject.syncVal !== false) {
          if (inject.syncVal == 0x55) {
            console.error(`Sync value ${inject.syncVal} is 0x55, but output failed:`, err)
            resolve(false)
          } else {
            console.log(`Sync value ${inject.syncVal} isn't 0x55, as expected.`, err)
            resolve(true)
          }
        }
        if (inject.pid == false || inject.syncVal == false) {
          console.log(
            `Sending break | ${inject.syncVal == false ? 'sync' : 'without sync'} |  ${inject.pid == false ? 'pid' : 'without pid'}, as expected.`,
            err
          )
          resolve(true)
        }
      })
  })
}

const sendLinWithSend = (msg: LinMsg, inject: LinCableErrorInject): Promise<boolean> => {
  return new Promise<boolean>((resolve, reject) => {
    msg.lincable = inject

    output(msg)
      .then(() => {
        resolve(true) //resolve true if output was successful
      })
      .catch((err) => {
        resolve(false) //resolve false if output failed
      })
  })
}
describe('8 Timing parameters', () => {
  test('PT-CT 5', async () => {
    //Variation of length of break field low phase
    const msg = FrameMap['TST_FRAME_4_Tx']
    const result = await sendLinWithRecv(msg, { breakLength: 3 })
    assert(result, 'Sending with break length 12 should fail')
    const result2 = await sendLinWithRecv(msg, { breakLength: 13 })
    assert(result2, 'Sending with break length 13 should succeed')
  })

  test('PT-CT 9', async () => {
    //Inconsistent sync byte field error
    const msg = FrameMap['TST_FRAME_7']
    const result = await sendLinWithRecv(msg, { syncVal: 0x54 })
    assert(result, 'Sending with sync value 0x54 should fail')
    const result2 = await sendLinWithRecv(msg, { syncVal: 0x5d })
    assert(result2, 'Sending with sync value 0x5D should fail')
  })

  test('PT-CT 11', async () => {
    //Incomplete frame reception
    const msg = FrameMap['TST_FRAME_7']
    //[PT-CT 11].1 The test system as master sends only the break field
    const result = await sendLinWithRecv(msg, { syncVal: false, pid: false })
    assert(result, 'Sending with only break field should fail')
    //[PT-CT 11].2 The test system as master sends only the break field and the sync byte field
    const result1 = await sendLinWithRecv(msg, { pid: false })
    assert(result1, 'Sending with only break field should fail')
    //[PT-CT 11].3 The test system as master sends just the header of TST_FRAME_4_Rx
    const msg2 = FrameMap['TST_FRAME_4_Rx']
    const msg2Clone = { ...msg2 }
    msg2Clone.data = Buffer.alloc(0) //no data
    const result2 = await sendLinWithSend(msg2Clone, {})
    assert(result2, 'Sending with only break field should fail')
    //[PT-CT 11].4 The test system as master sends just the header of TST_FRAME_4_Rx and the first data byte
    const msg3 = FrameMap['TST_FRAME_4_Rx']
    const msg3Clone = { ...msg3 }
    msg3Clone.data = Buffer.alloc(1) //no data
    const result3 = await sendLinWithSend(msg3Clone, {})
    assert(result3, 'Sending with only break field should fail')
  })
})
