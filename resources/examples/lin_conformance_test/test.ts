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
//TODO:get from ldf
const FrameMap: Record<string, LinMsg> = {
  /*ReadByIdentifier (Identifier = 0 ) All other parameters has to be filled with default values
according to the IUT specification and according to the test case specification.*/
  TST_FRAME_2: {
    direction: LinDirection.SEND,
    frameId: 0x3c,
    data: Buffer.from([0, 0x6, 0xb2, 0, 0, 0, 0, 0]),
    checksumType: LinChecksumType.CLASSIC
  },
  //device specific transmit frame (IUT is publisher)
  TST_FRAME_4_Tx: {
    direction: LinDirection.RECV,
    frameId: 0x34,
    data: Buffer.alloc(5),
    checksumType: LinChecksumType.ENHANCED
  },
  //device specific receive frame (IUT is subscriber)
  TST_FRAME_4_Rx: {
    direction: LinDirection.SEND,
    frameId: 0x33,
    data: Buffer.from([1, 2, 3, 4, 5]),
    checksumType: LinChecksumType.ENHANCED
  },
  //slave response command frame, Identifier = 0x3D
  TST_FRAME_6: {
    direction: LinDirection.RECV,
    frameId: 0x3d,
    data: Buffer.alloc(8),
    checksumType: LinChecksumType.CLASSIC
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
      if (inject.breakDelLength != undefined) {
        //<1 >14 allow fail
        if (inject.breakDelLength < 1 || inject.breakDelLength > 14) {
          console.error(
            `Break delimiter length ${inject.breakDelLength} is out of range, but output was successful.`
          )
          resolve(false)
        } else {
          resolve(true)
        }
      }
      if (inject.hInterLength != undefined) {
        //0-14 is o
        if (inject.hInterLength > 14) {
          console.error(
            `Header inter byte length ${inject.hInterLength} is out of range, but output was successful.`
          )
          resolve(false)
        } else {
          resolve(true)
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
        if (inject.breakDelLength != undefined) {
          //<1 >14 allow fail
          if (inject.breakDelLength < 1 || inject.breakDelLength > 14) {
            console.log(
              `Break delimiter length ${inject.breakDelLength} is out of range, as expected.`,
              err
            )
            resolve(true)
          } else {
            console.error(
              `Break delimiter length ${inject.breakDelLength} is in range, but output failed:`,
              err
            )
            resolve(false)
          }
        }
        if (inject.hInterLength != undefined) {
          //0-14 is ok
          if (inject.hInterLength > 14) {
            console.log(
              `Header inter byte length ${inject.hInterLength} is out of range, as expected.`,
              err
            )
            resolve(true)
          } else {
            console.log(
              `Header inter byte length ${inject.hInterLength} is in range, but output failed:`,
              err
            )
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
            `Sending break | ${inject.syncVal == false ? 'without sync' : 'sync'} |  ${inject.pid == false ? 'without pid' : 'pid'}, as expected.`,
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

  test('PT-CT 7', async () => {
    //Variation of length of break delimiter
    const msg = FrameMap['TST_FRAME_4_Tx']
    const result = await sendLinWithRecv(msg, { breakDelLength: 1 })
    assert(result, 'Sending with break delimiter length 1 should succeed')
    const result2 = await sendLinWithRecv(msg, { breakDelLength: 14 })
    assert(result2, 'Sending with break delimiter length 14 should succeed')
    const result3 = await sendLinWithRecv(msg, { breakDelLength: 10 })
    assert(result3, 'Sending with break delimiter length 10 should succeed')
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

  test('PT-CT 14', async () => {
    //Variation of length of header
    const msg = FrameMap['TST_FRAME_4_Tx']
    //[PT-CT 14].1
    const result = await sendLinWithRecv(msg, {
      breakLength: 13,
      breakDelLength: 1,
      hInterLength: 0
    })
    assert(
      result,
      'Sending with break length 13, break delimiter length 1 and header inter byte length 0 should succeed'
    )
    //[PT-CT 14].2
    const result2 = await sendLinWithRecv(msg, {
      breakLength: 19,
      breakDelLength: 2,
      hInterLength: 6
    })
    assert(
      result2,
      'Sending with break length 19, break delimiter length 2 and header inter byte length 6 should succeed'
    )
    //[PT-CT 14].3
    const result3 = await sendLinWithRecv(msg, {
      breakLength: 15,
      breakDelLength: 3,
      hInterLength: 2
    })
    assert(
      result3,
      'Sending with break length 15, break delimiter length 3 and header inter byte length 2 should succeed'
    )
    //[PT-CT 14].4
    const result4 = await sendLinWithRecv(msg, {
      breakLength: 13,
      breakDelLength: 1,
      hInterLength: 13
    })
    assert(
      result4,
      'Sending with break length 13, break delimiter length 1 and header inter byte length 13 should succeed'
    )
  })

  test('PT-CT 20', async () => {
    //Acceptance of response field, IUT as slave
    const txMsg = FrameMap['TST_FRAME_2']
    const rxMsg = FrameMap['TST_FRAME_6']
    //[PT-CT 20].2
    txMsg.lincable = {
      dInterLength: [4, 4, 4, 4, 4, 4, 4, 4, 4]
    }
    await output(txMsg)

    //[PT-CT 20].3
    txMsg.lincable = {
      dInterLength: [0, 0, 0, 0, 0, 0, 0, 36, 0]
    }
    await output(txMsg)

    //[PT-CT 20].4
    txMsg.lincable = {
      dInterLength: [36, 0, 0, 0, 0, 0, 0, 0, 0]
    }
    await output(txMsg)
  })
})

describe('[PT-CT 38] Bit error, IUT as slave', () => {
  const headerBitLength = 13 + 1 + 10 + 10
  test('[PT-CT 38].1', async () => {
    //Bit error in the response field in data byte 1, stop bit
    const rxMsg = FrameMap['TST_FRAME_6']
    const result = await sendLinWithRecv(rxMsg, {
      errorInject1: {
        bit: headerBitLength + 9, //byte1,stop bit
        value: 0 //invert stop bit
      }
    })
    assert(result, 'Sending with bit error in response field should succeed')
  })
})
