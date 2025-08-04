import {
  describe,
  LinChecksumType,
  LinDirection,
  LinMsg,
  output,
  test,
  assert,
  LinCableErrorInject,
  getFrameFromDB,
  getVar,
  getLinCheckSum
} from 'ECB'
const headerBitLength = 13 + 1 + 10 + 10
const FrameMap: Record<string, LinMsg> = {}
let ConfiguredNAD = 0
let StatusSignalOffset = 0

function cloneMsg(msg: LinMsg) {
  return {
    ...msg,
    data: Buffer.from(msg.data)
  }
}
Util.Init(async () => {
  const InitNad = await getVar('lin_conformance_test.InitialNAD')
  ConfiguredNAD = await getVar('lin_conformance_test.ConfiguredNAD')
  const SupplierId = await getVar('lin_conformance_test.SupplierID')
  const FunctionId = await getVar('lin_conformance_test.FunctionID')

  const SupplierIdBuf = Buffer.alloc(2)
  SupplierIdBuf.writeUint16LE(SupplierId, 0)
  const FunctionIdBuf = Buffer.alloc(2)
  FunctionIdBuf.writeUint16LE(FunctionId, 0)
  const TxFrameName = await getVar('lin_conformance_test.TxFrameName')
  const RxFrameName = await getVar('lin_conformance_test.RxFrameName')
  const EventFrameName = await getVar('lin_conformance_test.EventFrameName')
  const StatusFrameName = await getVar('lin_conformance_test.StatusFrameName')
  StatusSignalOffset = await getVar('lin_conformance_test.StatusSignalOffset')

  const unknownId = await getVar('lin_conformance_test.UnknownId')

  //AssignFrameIdRage
  FrameMap['TST_FRAME_1'] = {
    direction: LinDirection.SEND,
    frameId: 0x3c,
    data: Buffer.from([ConfiguredNAD, 0x6, 0xb7, 0xff, 0xff, 0xff, 0xff, 0xff]),
    checksumType: LinChecksumType.CLASSIC
  }

  /*ReadByIdentifier (Identifier = 0 ) All other parameters has to be filled with default values
  according to the IUT specification and according to the test case specification.*/
  FrameMap['TST_FRAME_2'] = {
    direction: LinDirection.SEND,
    frameId: 0x3c,
    data: Buffer.from([
      ConfiguredNAD,
      0x6,
      0xb2,
      0,
      SupplierIdBuf[0],
      SupplierIdBuf[1],
      FunctionIdBuf[0],
      FunctionIdBuf[1]
    ]),
    checksumType: LinChecksumType.CLASSIC
  }

  /*ReadByIdentifier (Identifier != 0 ) All other parameters has to be filled with default values
  according to the IUT specification and according to the test case specification.*/
  FrameMap['TST_FRAME_3'] = {
    direction: LinDirection.SEND,
    frameId: 0x3c,
    data: Buffer.from([
      ConfiguredNAD,
      0x6,
      0xb2,
      1,
      SupplierIdBuf[0],
      SupplierIdBuf[1],
      FunctionIdBuf[0],
      FunctionIdBuf[1]
    ]),
    checksumType: LinChecksumType.CLASSIC
  }
  console.log(FrameMap['TST_FRAME_3'])

  /*device specific transmit frame (IUT is publisher)*/
  const TST_FRAME_4_Tx = await getFrameFromDB('lin', 'LINdb', TxFrameName)
  FrameMap['TST_FRAME_4_Tx'] = TST_FRAME_4_Tx

  /*device specific receive frame (IUT is subscriber)*/
  const TST_FRAME_4_Rx = await getFrameFromDB('lin', 'LINdb', RxFrameName)
  FrameMap['TST_FRAME_4_Rx'] = TST_FRAME_4_Rx

  /*request for event triggered frame*/
  const TST_FRAME_5 = await getFrameFromDB('lin', 'LINdb', EventFrameName)
  FrameMap['TST_FRAME_5'] = TST_FRAME_5

  //slave response command frame, Identifier = 0x3D
  FrameMap['TST_FRAME_6'] = {
    direction: LinDirection.RECV,
    frameId: 0x3d,
    data: Buffer.alloc(8),
    checksumType: LinChecksumType.CLASSIC
  }

  /*read response error bit*/
  const TST_FRAME_7 = await getFrameFromDB('lin', 'LINdb', StatusFrameName)
  FrameMap['TST_FRAME_7'] = TST_FRAME_7

  //go to sleep command frame
  FrameMap['TST_FRAME_9'] = {
    direction: LinDirection.SEND,
    frameId: 0x3c,
    data: Buffer.from([0, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
    checksumType: LinChecksumType.CLASSIC
  }

  FrameMap['TST_FRAME_8'] = {
    direction: LinDirection.RECV,
    frameId: 0x3f,
    data: Buffer.from([0, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
    checksumType: LinChecksumType.CLASSIC
  }

  /* conditional change NAD */
  FrameMap['TST_FRAME_10'] = {
    frameId: 0x3c,
    data: Buffer.from([ConfiguredNAD, 0x06, 0xb3, 0, 0, 0, 0, 0]),
    direction: LinDirection.SEND,
    checksumType: LinChecksumType.CLASSIC
  }

  /* functional request with NAD = 0x7E */
  FrameMap['TST_FRAME_11'] = {
    frameId: 0x3c,
    data: Buffer.from([0x7e, 0x06, 0xb2, 0, 0, 0, 0, 0]),
    direction: LinDirection.SEND,
    checksumType: LinChecksumType.CLASSIC
  }

  /* ReadByIdentifier (Identifier = 0) with different NAD */
  const TST_FRAME_12: LinMsg = cloneMsg(FrameMap['TST_FRAME_3'])

  TST_FRAME_12.data[0] = ConfiguredNAD + 1 //different NAD
  FrameMap['TST_FRAME_12'] = TST_FRAME_12

  /* AssignNAD*/
  const TST_FRAME_13 = {
    direction: LinDirection.SEND,
    frameId: 0x3c,
    data: Buffer.from([
      InitNad,
      0x06,
      0xb0,
      SupplierIdBuf[0],
      SupplierIdBuf[1],
      FunctionIdBuf[0],
      FunctionIdBuf[1],
      ConfiguredNAD
    ]),
    checksumType: LinChecksumType.CLASSIC
  }
  FrameMap['TST_FRAME_13'] = TST_FRAME_13

  /*This is a master request message (0x3C) which can carry any kind of diagnostic message,
except messages of configuration and identification. XX can be SF (SingleFrame), CF
(ConsecutiveFrame) or FF (FirstFrame).*/
  FrameMap['TST_FRAME_14_XX'] = {
    direction: LinDirection.SEND,
    frameId: 0x3c,
    data: Buffer.alloc(8),
    checksumType: LinChecksumType.CLASSIC
  }
  /*this is a slave response message (0x3D) which can carry any kind of diagnostic message,
except messages of configuration and identification. XX can be SF (SingleFrame), CF
(ConsecutiveFrame) or FF (FirstFrame).*/
  FrameMap['TST_FRAME_15_XX'] = {
    direction: LinDirection.RECV,
    frameId: 0x3d,
    data: Buffer.alloc(8),
    checksumType: LinChecksumType.CLASSIC
  }
  /*all not defined (not configured in the IUTs LDF, NCF) frame IDs from 0d – 59d with all
combination of parity bits and all known frame IDs with possible incorrect parity bits
Number of data bytes 8, data bytes 1 to 8 shall be filled with 0x00, 0x01, 0x02, 0x03, 0x04,
0x05, 0x06, 0x07*/
  FrameMap['TST_FRAME_UNKNOWN'] = {
    name: 'UNKNOWN_FRAME',
    direction: LinDirection.SEND,
    frameId: unknownId,
    data: Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
    checksumType: LinChecksumType.CLASSIC
  }
})

const sendLinWithRecv = (
  frame: LinMsg,
  inject: LinCableErrorInject
): Promise<{
  result: boolean
  msg?: LinMsg
}> => {
  return new Promise<{
    result: boolean
    msg?: LinMsg
  }>((resolve, reject) => {
    frame.lincable = inject
    let timer: NodeJS.Timeout
    if (frame.direction !== LinDirection.RECV) {
      reject(new Error('Frame direction must be RECV for sendLinWithRecv'))
      return
    }
    const cb = (msg: LinMsg) => {
      Util.OffLin(msg.frameId, cb)
      clearTimeout(timer)
      if (inject.breakLength != undefined) {
        if (inject.breakLength >= 13) {
          //ok here

          if (Buffer.compare(msg.data, Buffer.from([0x33, 0x33, 0x33, 0x33, 0x33])) === 0) {
            resolve({ result: true, msg })
          } else {
            resolve({ result: true, msg })
          }
        } else {
          //error here
          console.error(
            `Break length ${inject.breakLength} is too short, but output was successful.`
          )
          resolve({ result: false, msg })
        }
      } else if (inject.breakDelLength != undefined) {
        //<1 >14 allow fail
        if (inject.breakDelLength < 1 || inject.breakDelLength > 14) {
          console.error(
            `Break delimiter length ${inject.breakDelLength} is out of range, but output was successful.`
          )
          resolve({ result: false, msg })
        } else {
          resolve({ result: true, msg })
        }
      } else if (inject.hInterLength != undefined) {
        //0-14 is o
        if (inject.hInterLength > 14) {
          console.error(
            `Header inter byte length ${inject.hInterLength} is out of range, but output was successful.`
          )
          resolve({ result: false, msg })
        } else {
          resolve({ result: true, msg })
        }
      } else if (inject.syncVal != undefined && inject.syncVal !== false) {
        if (inject.syncVal != 0x55) {
          console.error(`Sync value ${inject.syncVal} is not 0x55, but output was successful.`)
          resolve({ result: false, msg })
        } else {
          if (Buffer.compare(msg.data, Buffer.from([0x33, 0x33, 0x33, 0x33, 0x33])) === 0) {
            resolve({ result: true, msg })
          } else {
            resolve({ result: true, msg })
          }
          resolve({ result: true, msg })
        }
      } else if (inject.pid == false || inject.syncVal == false) {
        //error here
        console.error(
          `Sending break | ${inject.syncVal == false ? 'without sync' : ' sync'} |  ${inject.pid == false ? 'without pid' : ' pid'}, but output was successful.`
        )
        resolve({ result: false, msg })
      } else if (inject.errorInject != undefined) {
        console.error(
          `Error inject: ${inject.errorInject.bit} ${inject.errorInject.value}, but output was successful.`
        )
        resolve({ result: false, msg })
      } else {
        resolve({ result: true, msg }) //resolve true if output was successful
      }
    }
    Util.OnLin(frame.frameId, cb)
    output(frame)
      .then(() => {
        timer = setTimeout(() => {
          Util.OffLin(frame.frameId, cb)
          console.log('timeout internal error')
          resolve({ result: false }) //resolve false if no response received
        }, 1000)
      })
      .catch((err) => {
        Util.OffLin(frame.frameId, cb)
        if (inject.breakLength != undefined) {
          console.log(err)
          if (inject.breakLength < 13 && err.toString().includes('no response')) {
            //ok here
            console.log(`Break length ${inject.breakLength} is too short, as expected.`, err)
            resolve({ result: true })
          } else {
            //error here
            console.error(`Break length ${inject.breakLength} is ok, but output failed:`, err)
            resolve({ result: false })
          }
        } else if (inject.breakDelLength != undefined) {
          //<1 >14 allow fail
          if (inject.breakDelLength < 1 || inject.breakDelLength > 14) {
            console.log(
              `Break delimiter length ${inject.breakDelLength} is out of range, as expected.`,
              err
            )
            resolve({ result: true })
          } else {
            console.error(
              `Break delimiter length ${inject.breakDelLength} is in range, but output failed:`,
              err
            )
            resolve({ result: false })
          }
        } else if (inject.hInterLength != undefined) {
          //0-14 is ok
          if (inject.hInterLength > 14) {
            console.log(
              `Header inter byte length ${inject.hInterLength} is out of range, as expected.`,
              err
            )
            resolve({ result: true })
          } else {
            console.log(
              `Header inter byte length ${inject.hInterLength} is in range, but output failed:`,
              err
            )
            resolve({ result: false })
          }
        } else if (inject.syncVal != undefined && inject.syncVal !== false) {
          if (inject.syncVal == 0x55) {
            console.error(`Sync value ${inject.syncVal} is 0x55, but output failed:`, err)
            resolve({ result: false })
          } else {
            console.log(`Sync value ${inject.syncVal} isn't 0x55, as expected.`, err)
            resolve({ result: true })
          }
        } else if (inject.pid == false || inject.syncVal == false) {
          console.log(
            `Sending break | ${inject.syncVal == false ? 'without sync' : 'sync'} |  ${inject.pid == false ? 'without pid' : 'pid'}, as expected.`,
            err
          )
          resolve({ result: true })
        } else if (inject.errorInject != undefined) {
          console.log(
            `Error inject: ${inject.errorInject.bit} ${inject.errorInject.value}, as expected.`,
            err
          )
          resolve({ result: true })
        } else {
          resolve({ result: false })
        }
      })
  })
}

const sendLinWithSend = (msg: LinMsg, inject: LinCableErrorInject): Promise<boolean> => {
  return new Promise<boolean>((resolve, reject) => {
    msg.lincable = inject
    if (msg.direction !== LinDirection.SEND) {
      reject(new Error('Frame direction must be SEND for sendLinWithSend'))
      return
    }
    output(msg)
      .then(() => {
        resolve(true) //resolve true if output was successful
      })
      .catch((err) => {
        if (inject.errorInject != undefined) {
          console.log(
            `Error inject: ${inject.errorInject.bit} ${inject.errorInject.value}, as expected.`,
            err
          )
          resolve(true)
        } else if (inject.checkSum != undefined) {
          console.log(`Checksum: ${inject.checkSum}, as expected.`, err)
          resolve(true)
        } else if (inject.breakLength < 13) {
          console.log(`Break length ${inject.breakLength} is less than 13, as expected.`, err)
          resolve(true)
        } else {
          resolve(false)
        }
      })
  })
}

const getErrorFlag = (data: Buffer): boolean => {
  const offsetByte = Math.floor(StatusSignalOffset / 8)
  const errorByte = data[offsetByte]
  //LSB
  const errorBit = StatusSignalOffset % 8
  return (errorByte & (1 << errorBit)) !== 0
}

describe('7: L2: Essential test cases before test start', () => {
  test("[PT-CT 1] Diagnostic frame 'Master Request'", async () => {
    /*Test The test system sends TST_FRAME_1 and then TST_FRAME_7.
Verification IUT shall answer
    */
    const msg1 = FrameMap['TST_FRAME_1']
    const result = await sendLinWithSend(msg1, {})
    assert(result == false)
    const msg7 = FrameMap['TST_FRAME_7']
    await sendLinWithRecv(msg7, {})
  })
  test("[PT-CT 2] Command Frame 'Slave Response Frame'", async () => {
    const msg2 = FrameMap['TST_FRAME_2']
    await sendLinWithSend(msg2, {})
    const msg6 = FrameMap['TST_FRAME_6']
    await sendLinWithRecv(msg6, {})
  })
  test('[PT-CT 3] Error in Received Frame', async () => {
    const msg7 = FrameMap['TST_FRAME_7']
    assert(msg7.direction == LinDirection.RECV)
    const result0 = await sendLinWithRecv(msg7, {})
    assert(result0.result)
    assert(result0.msg != undefined)
    assert(getErrorFlag(result0.msg.data) == false)
    const result1 = await sendLinWithRecv(msg7, {})
    assert(result1.result)
    assert(result1.msg != undefined)
    assert(getErrorFlag(result1.msg.data) == false)
    const msg2 = FrameMap['TST_FRAME_2']
    const normalCheckSum = getLinCheckSum(msg2.data, LinChecksumType.CLASSIC)
    //invert checksum
    const invertCheckSum = (normalCheckSum ^ 0xff) & 0xff

    const result = await sendLinWithSend(msg2, {
      checkSum: invertCheckSum
    })
    assert(result)
    const result2 = await sendLinWithRecv(msg7, {})
    assert(result2.result)
    assert(result2.msg != undefined)
    console.log(result2.msg.data)
    assert(getErrorFlag(result2.msg.data) == true)
  })
})

describe('8: L2: Timing Parameters', () => {
  test('[PT-CT 5] Variation of Length of break field low phase', async () => {
    //Variation of length of break field low phase
    const msg = FrameMap['TST_FRAME_4_Tx']
    let result = await sendLinWithRecv(msg, { breakLength: 3 })
    assert(result.result, 'Sending with break length 3 should fail')
    result = await sendLinWithRecv(msg, { breakLength: 10 })
    assert(result.result, 'Sending with break length 10 should fail')
    result = await sendLinWithRecv(msg, { breakLength: 13 })
    assert(result.result, 'Sending with break length 13 should succeed')
    result = await sendLinWithRecv(msg, { breakLength: 26 })
    assert(result.result, 'Sending with break length 26 should succeed')
  })
  test('[PT-CT 7.1] Variation of Length of break delimiter. Sync Break = 13 bit (min), Sync Delimiter = 1 bit (min), Interbyte = 0 bit (min)', async () => {
    const msg = FrameMap['TST_FRAME_4_Tx']
    const result = await sendLinWithRecv(msg, { breakDelLength: 1 })
    assert(result.result, 'Sending with break delimiter length 1 should succeed')
  })
  test('[PT-CT 7.2] Variation of Length of break delimiter. Sync Break = 13 bit (min), Sync Delimiter = 14 bit (max), Interbyte = 0 bit (min)', async () => {
    const msg = FrameMap['TST_FRAME_4_Tx']
    const result = await sendLinWithRecv(msg, { breakDelLength: 14 })
    assert(result.result, 'Sending with break delimiter length 14 should succeed')
  })
  test('[PT-CT 7.3] Variation of Length of break delimiter. Sync Break = 13 bit (min), Sync Delimiter = 10 bit, Interbyte = 0 bit (min)', async () => {
    const msg = FrameMap['TST_FRAME_4_Tx']
    const result = await sendLinWithRecv(msg, { breakDelLength: 10 })
    assert(result.result, 'Sending with break delimiter length 10 should succeed')
  })
  test('[PT-CT 8] Inconsistent break field error', async () => {
    const msg2 = FrameMap['TST_FRAME_2']
    const msg6 = FrameMap['TST_FRAME_6']

    // First test: Send TST_FRAME_2 with 13-bit break field (valid) followed by TST_FRAME_6
    // The IUT should respond to this first master request

    const result1 = await sendLinWithSend(msg2, { breakLength: 13 })
    assert(result1, 'IUT should send to TST_FRAME_2 with valid 13-bit break field')

    // Send TST_FRAME_6 after successful TST_FRAME_2
    const result1_response = await sendLinWithRecv(msg6, {})
    assert(result1_response.result, 'IUT should respond to TST_FRAME_6 after valid master request')

    const result2 = await sendLinWithSend(msg2, { breakLength: 9 })
    assert(result2, 'Break field error should be detected for 9-bit break field')

    // Send TST_FRAME_6 after invalid TST_FRAME_2 - should not get response
    const result2_response = await sendLinWithRecv(msg6, {})
    assert(
      !result2_response.result,
      'IUT should not respond to TST_FRAME_6 after detecting inconsistent break field error'
    )
  })
  test('[PT-CT 9.1] Inconsistent Sync Byte Field error. Sync Byte Field = 0x54', async () => {
    const msg = FrameMap['TST_FRAME_7']
    const result = await sendLinWithRecv(msg, { syncVal: 0x54 })
    assert(result, 'Sending with sync value 0x54 should fail')
  })
  test('[PT-CT 9.2] Inconsistent Sync Byte Field error. Sync Byte Field = 0x5D', async () => {
    const msg = FrameMap['TST_FRAME_7']
    const result = await sendLinWithRecv(msg, { syncVal: 0x5d })
    assert(result, 'Sending with sync value 0x5D should fail')
  })
  test('[PT-CT 11.1] [PT-CT 11.1] Incomplete frame reception. Break field only', async () => {
    const msg7 = FrameMap['TST_FRAME_7']
    const msg4Rx = FrameMap['TST_FRAME_4_Rx']

    // 第一次发送TST_FRAME_7 - 可能包含错误位
    const result1 = await sendLinWithRecv(msg7, {})
    assert(result1.result, 'First TST_FRAME_7 should receive response')
    assert(result1.msg != undefined, 'First response should contain data')

    // 检查第一次响应中的错误位状态（可能为true或false）
    const firstErrorFlag = getErrorFlag(result1.msg.data)

    // 第二次发送TST_FRAME_7 - 确保response_error_bit被清除
    const result2 = await sendLinWithRecv(msg7, {})
    assert(result2.result, 'Second TST_FRAME_7 should receive response')
    assert(result2.msg != undefined, 'Second response should contain data')

    // 验证第二次响应中的错误位必须被清除（errorBit:FALSE）
    const secondErrorFlag = getErrorFlag(result2.msg.data)
    assert(
      secondErrorFlag === false,
      'Response error bit should be cleared after second TST_FRAME_7'
    )

    // 发送只包含break field的测试（errorBit:FALSE）
    const result3 = await sendLinWithSend(msg4Rx, { pid: false, syncVal: false })
    // 这个测试应该失败，因为只发送break field而没有完整帧
    assert(!result3, 'Sending only break field should not receive valid response')

    // 验证第三次响应中的错误位状态
    const result4 = await sendLinWithRecv(msg7, {})
    assert(result4.result, 'Third TST_FRAME_7 should receive response')
    assert(result4.msg != undefined, 'Third response should contain data')
    const thirdErrorFlag = getErrorFlag(result4.msg.data)
    assert(thirdErrorFlag === false, 'Response error bit should be cleared after third TST_FRAME_7')
  })
  test('[PT-CT 11.2] Incomplete frame reception. Break and Sync Byte fields only', async () => {
    const msg7 = FrameMap['TST_FRAME_7']
    const msg4Rx = FrameMap['TST_FRAME_4_Rx']

    // 第一次发送TST_FRAME_7 - 可能包含错误位
    const result1 = await sendLinWithRecv(msg7, {})
    assert(result1.result, 'First TST_FRAME_7 should receive response')
    assert(result1.msg != undefined, 'First response should contain data')

    // 检查第一次响应中的错误位状态（可能为true或false）
    const firstErrorFlag = getErrorFlag(result1.msg.data)

    // 第二次发送TST_FRAME_7 - 确保response_error_bit被清除
    const result2 = await sendLinWithRecv(msg7, {})
    assert(result2.result, 'Second TST_FRAME_7 should receive response')
    assert(result2.msg != undefined, 'Second response should contain data')

    // 验证第二次响应中的错误位必须被清除（errorBit:FALSE）
    const secondErrorFlag = getErrorFlag(result2.msg.data)
    assert(
      secondErrorFlag === false,
      'Response error bit should be cleared after second TST_FRAME_7'
    )

    // 发送只包含break field的测试（errorBit:FALSE）
    const result3 = await sendLinWithSend(msg4Rx, { pid: false })
    // 这个测试应该失败，因为只发送break field而没有完整帧
    assert(!result3, 'Sending only break field should not receive valid response')

    // 验证第三次响应中的错误位状态
    const result4 = await sendLinWithRecv(msg7, {})
    assert(result4.result, 'Third TST_FRAME_7 should receive response')
    assert(result4.msg != undefined, 'Third response should contain data')
    const thirdErrorFlag = getErrorFlag(result4.msg.data)
    assert(thirdErrorFlag === false, 'Response error bit should be cleared after third TST_FRAME_7')
  })
  test('[PT-CT 11.3] Incomplete frame reception. Header of Rx-frame only', async () => {
    const msg7 = FrameMap['TST_FRAME_7']
    const msg4Rx = FrameMap['TST_FRAME_4_Rx']

    // 第一次发送TST_FRAME_7 - 可能包含错误位
    const result1 = await sendLinWithRecv(msg7, {})
    assert(result1.result, 'First TST_FRAME_7 should receive response')
    assert(result1.msg != undefined, 'First response should contain data')

    // 检查第一次响应中的错误位状态（可能为true或false）
    const firstErrorFlag = getErrorFlag(result1.msg.data)

    // 第二次发送TST_FRAME_7 - 确保response_error_bit被清除
    const result2 = await sendLinWithRecv(msg7, {})
    assert(result2.result, 'Second TST_FRAME_7 should receive response')
    assert(result2.msg != undefined, 'Second response should contain data')

    // 验证第二次响应中的错误位必须被清除（errorBit:FALSE）
    const secondErrorFlag = getErrorFlag(result2.msg.data)
    assert(
      secondErrorFlag === false,
      'Response error bit should be cleared after second TST_FRAME_7'
    )

    // 发送只包含break field的测试（errorBit:FALSE）
    const cloneM4Rx = cloneMsg(msg4Rx)
    cloneM4Rx.direction = LinDirection.RECV
    const result3 = await sendLinWithRecv(cloneM4Rx, {})
    // 这个测试应该失败，因为只发送break field而没有完整帧
    assert(!result3.result, 'Sending only break field should not receive valid response')

    // 验证第三次响应中的错误位状态
    const result4 = await sendLinWithRecv(msg7, {})
    assert(result4.result, 'Third TST_FRAME_7 should receive response')
    assert(result4.msg != undefined, 'Third response should contain data')
    const thirdErrorFlag = getErrorFlag(result4.msg.data)
    assert(thirdErrorFlag === false, 'Response error bit should be cleared after third TST_FRAME_7')
  })
  test('[PT-CT 11.4] Incomplete frame reception. Header of Rx-frame with the first data byte only', async () => {
    const msg7 = FrameMap['TST_FRAME_7']
    const msg4Rx = FrameMap['TST_FRAME_4_Rx']

    // 第一次发送TST_FRAME_7 - 可能包含错误位
    const result1 = await sendLinWithRecv(msg7, {})
    assert(result1.result, 'First TST_FRAME_7 should receive response')
    assert(result1.msg != undefined, 'First response should contain data')

    // 检查第一次响应中的错误位状态（可能为true或false）
    const firstErrorFlag = getErrorFlag(result1.msg.data)

    // 第二次发送TST_FRAME_7 - 确保response_error_bit被清除
    const result2 = await sendLinWithRecv(msg7, {})
    assert(result2.result, 'Second TST_FRAME_7 should receive response')
    assert(result2.msg != undefined, 'Second response should contain data')

    // 验证第二次响应中的错误位必须被清除（errorBit:FALSE）
    const secondErrorFlag = getErrorFlag(result2.msg.data)
    assert(
      secondErrorFlag === false,
      'Response error bit should be cleared after second TST_FRAME_7'
    )

    // 发送只包含break field的测试（errorBit:FALSE）
    const cloneM4Rx = cloneMsg(msg4Rx)
    cloneM4Rx.data = Buffer.alloc(1, 0)
    const result3 = await sendLinWithSend(cloneM4Rx, {})
    // 这个测试应该失败，因为只发送break field而没有完整帧
    assert(result3, 'Sending only break field should not receive valid response')

    // 验证第三次响应中的错误位状态
    const result4 = await sendLinWithRecv(msg7, {})
    assert(result4.result, 'Third TST_FRAME_7 should receive response')
    assert(result4.msg != undefined, 'Third response should contain data')
    const thirdErrorFlag = getErrorFlag(result4.msg.data)
    assert(thirdErrorFlag === true, 'Response error bit should be set')
  })
  test('[PT-CT 12.1] Unknown frame reception. Header of unknown frame only', async () => {
    const msg7 = FrameMap['TST_FRAME_7']
    const unknownMsg = FrameMap['TST_FRAME_UNKNOWN']

    // 第一次发送TST_FRAME_7 - 可能包含错误位
    const result1 = await sendLinWithRecv(msg7, {})
    assert(result1.result, 'First TST_FRAME_7 should receive response')
    assert(result1.msg != undefined, 'First response should contain data')

    // 检查第一次响应中的错误位状态（可能为true或false）
    const firstErrorFlag = getErrorFlag(result1.msg.data)

    // 第二次发送TST_FRAME_7 - 确保response_error_bit被清除
    const result2 = await sendLinWithRecv(msg7, {})
    assert(result2.result, 'Second TST_FRAME_7 should receive response')
    assert(result2.msg != undefined, 'Second response should contain data')

    const cloneUnknownMsg = cloneMsg(unknownMsg)
    cloneUnknownMsg.direction = LinDirection.RECV

    console.log(cloneUnknownMsg)

    // 发送只包含未知帧头的测试（errorBit:FALSE）
    const result3 = await sendLinWithRecv(cloneUnknownMsg, {})
    // 这个测试应该失败，因为只发送未知帧头而没有完整帧
    assert(!result3.result, 'Sending only unknown frame header should not receive valid response')
    // 验证第三次响应中的错误位状态
    const result4 = await sendLinWithRecv(msg7, {})
    assert(result4.result, 'Third TST_FRAME_7 should receive response')
    assert(result4.msg != undefined, 'Third response should contain data')
    const thirdErrorFlag = getErrorFlag(result4.msg.data)
    assert(
      thirdErrorFlag === false,
      'Response error bit should not be set because the frame is unknown'
    )
  })
  test('[PT-CT 12.2] Unknown frame reception. Header of unknown frame with the first data byte only', async () => {
    const msg7 = FrameMap['TST_FRAME_7']
    const unknownMsg = FrameMap['TST_FRAME_UNKNOWN']

    // 第一次发送TST_FRAME_7 - 可能包含错误位
    const result1 = await sendLinWithRecv(msg7, {})
    assert(result1.result, 'First TST_FRAME_7 should receive response')
    assert(result1.msg != undefined, 'First response should contain data')

    // 检查第一次响应中的错误位状态（可能为true或false）
    const firstErrorFlag = getErrorFlag(result1.msg.data)

    // 第二次发送TST_FRAME_7 - 确保response_error_bit被清除
    const result2 = await sendLinWithRecv(msg7, {})
    assert(result2.result, 'Second TST_FRAME_7 should receive response')
    assert(result2.msg != undefined, 'Second response should contain data')

    const cloneUnknownMsg = cloneMsg(unknownMsg)
    cloneUnknownMsg.data = cloneUnknownMsg.data.subarray(0, 1) // 只发送第一个数据字节

    // 发送只包含未知帧头的测试（errorBit:FALSE）
    const result3 = await sendLinWithSend(cloneUnknownMsg, {})
    // 这个测试应该失败，因为只发送未知帧头而没有完整帧
    assert(result3, 'Send only 1st data byte of unknown frame')
    // 验证第三次响应中的错误位状态
    const result4 = await sendLinWithRecv(msg7, {})
    assert(result4.result, 'Third TST_FRAME_7 should receive response')
    assert(result4.msg != undefined, 'Third response should contain data')
    const thirdErrorFlag = getErrorFlag(result4.msg.data)
    assert(
      thirdErrorFlag === false,
      'Response error bit should not be set because the frame is unknown'
    )
  })
  test('[PT-CT 12.3] Unknown frame reception. Unknown frame with wrong checksum', async () => {
    const msg7 = FrameMap['TST_FRAME_7']
    const unknownMsg = FrameMap['TST_FRAME_UNKNOWN']

    // 第一次发送TST_FRAME_7 - 可能包含错误位
    const result1 = await sendLinWithRecv(msg7, {})
    assert(result1.result, 'First TST_FRAME_7 should receive response')
    assert(result1.msg != undefined, 'First response should contain data')

    // 检查第一次响应中的错误位状态（可能为true或false）
    const firstErrorFlag = getErrorFlag(result1.msg.data)

    // 第二次发送TST_FRAME_7 - 确保response_error_bit被清除
    const result2 = await sendLinWithRecv(msg7, {})
    assert(result2.result, 'Second TST_FRAME_7 should receive response')
    assert(result2.msg != undefined, 'Second response should contain data')

    const cloneUnknownMsg = cloneMsg(unknownMsg)
    const checkSum = getLinCheckSum(cloneUnknownMsg.data, LinChecksumType.CLASSIC)

    // 发送只包含未知帧头的测试（errorBit:FALSE）
    const result3 = await sendLinWithSend(cloneUnknownMsg, {
      checkSum: (checkSum ^ 0xff) & 0xff // 发送错误的校验和
    })
    // 这个测试应该失败，因为只发送未知帧头而没有完整帧
    assert(result3, 'Sending unknown frame with wrong checksum should fail')
    // 验证第三次响应中的错误位状态
    const result4 = await sendLinWithRecv(msg7, {})
    assert(result4.result, 'Third TST_FRAME_7 should receive response')
    assert(result4.msg != undefined, 'Third response should contain data')
    const thirdErrorFlag = getErrorFlag(result4.msg.data)
    assert(
      thirdErrorFlag === false,
      'Response error bit should not be set because the frame is unknown'
    )
  })
  test('[PT-CT 14.1] Variation of header length. Header = 34 bit; Sync Break = 13 bit (min), Sync Del = 1 bit (min), Interbyte = 0 bit, minimum bit time', async () => {
    const msg2 = FrameMap['TST_FRAME_2']
    const msg6 = FrameMap['TST_FRAME_6']
    const result = await sendLinWithSend(msg2, {
      breakLength: 13,
      breakDelLength: 1
    })
    assert(result, 'Sending with break length 13 and delimiter length 1 should succeed')
    const result2 = await sendLinWithRecv(msg6, {
      breakLength: 13,
      breakDelLength: 1
    })
    assert(result2.result)
    assert(result2.msg != undefined)
  })
  test('[PT-CT 14.2] Variation of header length. Header = 47 bit; Sync Break = 19 bit, Sync Del = 2 bit, Interbyte = 6 bit, maximum bit time', async () => {
    const msg2 = FrameMap['TST_FRAME_2']
    const msg6 = FrameMap['TST_FRAME_6']
    const result = await sendLinWithSend(msg2, {
      breakLength: 19,
      breakDelLength: 2,
      hInterLength: 6
    })
    assert(result, 'Sending with break length 19 and delimiter length 2 should succeed')
    const result2 = await sendLinWithRecv(msg6, {
      breakLength: 19,
      breakDelLength: 2,
      hInterLength: 6
    })
    assert(result2.result)
    assert(result2.msg != undefined)
  })
  test('[PT-CT 14.3] Variation of header length. Header = 40 bit; Sync Break = 15 bit, Sync Del = 3 bit, Interbyte = 2 bit, nominal bit time', async () => {
    const msg2 = FrameMap['TST_FRAME_2']
    const msg6 = FrameMap['TST_FRAME_6']
    const result = await sendLinWithSend(msg2, {
      breakLength: 15,
      breakDelLength: 3,
      hInterLength: 2
    })
    assert(result, 'Sending with break length 19 and delimiter length 2 should succeed')
    const result2 = await sendLinWithRecv(msg6, {
      breakLength: 15,
      breakDelLength: 3,
      hInterLength: 2
    })
    assert(result2.result)
    assert(result2.msg != undefined)
  })
  test('[PT-CT 14.4] Variation of header length. Header = 47 bit; Sync Break = 13 bit (min), Sync Del = 1 bit (min), Interbyte = 13 bit, maximum bit time', async () => {
    const msg2 = FrameMap['TST_FRAME_2']
    const msg6 = FrameMap['TST_FRAME_6']
    const result = await sendLinWithSend(msg2, {
      breakLength: 13,
      breakDelLength: 1,
      hInterLength: 13
    })
    assert(result, 'Sending with break length 13 and delimiter length 1 should succeed')
    const result2 = await sendLinWithRecv(msg6, {
      breakLength: 13,
      breakDelLength: 1,
      hInterLength: 13
    })
    assert(result2.result)
    assert(result2.msg != undefined)
  })
  test.skip('[PT-CT 16.1] Bit rate tolerance, IUT without making use of synchronization. Master deviation from nominal bit rate = + 0.5%', async () => {})
  test.skip('[PT-CT 16.2] Bit rate tolerance, IUT without making use of synchronization. Master deviation from nominal bit rate = - 0.5%', async () => {})
  test.skip('[PT-CT 17.1] Bit rate tolerance, IUT with making use of synchronization. Master deviation from nominal bit rate = + 0.5%', async () => {})
  test.skip('[PT-CT 17.2] Bit rate tolerance, IUT with making use of synchronization. Master deviation from nominal bit rate = - 0.5%', async () => {})
  test('[PT-CT 18] Length of response', async () => {
    const msg2 = FrameMap['TST_FRAME_2']
    const msg6 = FrameMap['TST_FRAME_6']
    const result = await sendLinWithSend(msg2, {
      breakLength: 19,
      breakDelLength: 9,
      hInterLength: 0
    })
    assert(result, 'Sending with break length 19 and delimiter length 9 should succeed')
    const result2 = await sendLinWithRecv(msg6, {
      breakLength: 19,
      breakDelLength: 9,
      hInterLength: 0
    })
    assert(result2.result)
    assert(result2.msg != undefined)
  })
  test('[PT-CT 20.1] Acceptance of response field. Response space = 0 bits, each inter-byte space = 0 bits', async () => {
    const msg2 = FrameMap['TST_FRAME_2']
    const msg6 = FrameMap['TST_FRAME_6']
    const result = await sendLinWithSend(msg2, {})
    assert(result)
    const result2 = await sendLinWithRecv(msg6, {})
    assert(result2.result)
    assert(result2.msg != undefined)
  })
  test('[PT-CT 20.2] Acceptance of response field. Response space = 4 bits, each inter-byte space = 4 bits', async () => {
    const msg2 = FrameMap['TST_FRAME_2']
    const msg6 = FrameMap['TST_FRAME_6']
    const result = await sendLinWithSend(msg2, {
      dInterLength: [4, 4, 4, 4, 4, 4, 4, 4, 4]
    })
    assert(result)
    const result2 = await sendLinWithRecv(msg6, {})
    assert(result2.result)
    assert(result2.msg != undefined)
  })
  test('[PT-CT 20.3] Acceptance of response field. Response space = 0 bits, inter-byte space between data bytes 7 and 8 = 36 bits', async () => {
    const msg2 = FrameMap['TST_FRAME_2']
    const msg6 = FrameMap['TST_FRAME_6']
    const result = await sendLinWithSend(msg2, {
      dInterLength: [0, 0, 0, 0, 0, 0, 0, 36, 0]
    })
    assert(result)
    const result2 = await sendLinWithRecv(msg6, {})
    assert(result2.result)
    assert(result2.msg != undefined)
  })
  test('[PT-CT 20.4] Acceptance of response field. Response space = 36 bits, each inter-byte space = 0 bits', async () => {
    const msg2 = FrameMap['TST_FRAME_2']
    const msg6 = FrameMap['TST_FRAME_6']
    const result = await sendLinWithSend(msg2, {
      dInterLength: [36, 0, 0, 0, 0, 0, 0, 0, 0]
    })
    assert(result)
    const result2 = await sendLinWithRecv(msg6, {})
    assert(result2.result)
    assert(result2.msg != undefined)
  })
  test.skip('[PT-CT 23] Sample Point Test', async () => {})
})

describe('9: L2: Communication without Failure', () => {
  test('[PT-CT 25] Variation of LIN Identifier of subscribed frames', async () => {
    const msg1 = FrameMap['TST_FRAME_1']
    const msg2 = FrameMap['TST_FRAME_4_Rx']
    const msg3 = FrameMap['TST_FRAME_7']
    const result = await sendLinWithSend(msg1, {})
    assert(result)
    const normalCheckSum = getLinCheckSum(msg2.data, LinChecksumType.CLASSIC)
    //invert 4th bit
    const errorCheckSum = normalCheckSum ^ (1 << 4)
    const result2 = await sendLinWithSend(msg2, {
      checkSum: errorCheckSum
    })
    assert(result2)
    const result3 = await sendLinWithRecv(msg3, {
      checkSum: errorCheckSum
    })
    assert(result3.result)
    assert(result3.msg != undefined)
    const errorFlag = getErrorFlag(result3.msg.data)
    assert(errorFlag === true, 'Error flag should be set because the checksum is incorrect')
  })
  test('[PT-CT 26] Variation of LIN Identifier of published frames', async () => {
    const msg1 = FrameMap['TST_FRAME_1']
    const msg2 = FrameMap['TST_FRAME_4_Tx']
    const result = await sendLinWithSend(msg1, {})
    assert(result)
    const result2 = await sendLinWithRecv(msg2, {})
    assert(result2.result)
    assert(result2.msg != undefined)
  })
  test('[PT-CT 27] Transmission of the Checksum Byte classic checksum', async () => {
    const msg2 = FrameMap['TST_FRAME_2']
    const msg6 = FrameMap['TST_FRAME_6']
    const result = await sendLinWithSend(msg2, {})
    assert(result, 'Sending with break length 13 and delimiter length 1 should succeed')
    const result2 = await sendLinWithRecv(msg6, {})
    assert(result2.result)
    assert(result2.msg != undefined)
  })
  test('[PT-CT 28] Transmission of the Checksum Byte enhanced checksum', async () => {
    const msg = FrameMap['TST_FRAME_4_Tx']
    const result2 = await sendLinWithRecv(msg, {})
    assert(result2.result)
    assert(result2.msg != undefined)
  })
  test('[PT-CT 32] Unused bits', async () => {
    const msg = FrameMap['TST_FRAME_4_Tx']
    const result2 = await sendLinWithRecv(msg, {})
    assert(result2.result)
    assert(result2.msg != undefined)
  })
  test('[PT-CT 33] Reserved frame', async () => {
    const msg = FrameMap['TST_FRAME_8']
    const result2 = await sendLinWithRecv(msg, {})
    assert(!result2.result)
    assert(result2.msg == undefined)
    const cloneMsg1 = cloneMsg(msg)
    cloneMsg1.frameId = 0x3e
    const result3 = await sendLinWithRecv(cloneMsg1, {})
    assert(!result3.result)
    assert(result3.msg == undefined)
  })
  test('[PT-CT 34] Reserved frame with error', async () => {
    const msg = FrameMap['TST_FRAME_8']
    const msg1 = FrameMap['TST_FRAME_7']
    const cloneMsg1 = cloneMsg(msg)
    cloneMsg1.frameId = 0x3f
    cloneMsg1.direction = LinDirection.SEND
    cloneMsg1.data = Buffer.alloc(1, 0xff)
    const result2 = await sendLinWithSend(cloneMsg1, {
      errorInject: {
        bit: headerBitLength + 9,
        value: 0
      }
    })
    assert(result2)
    const result3 = await sendLinWithRecv(msg1, {})
    assert(result3.result)
    assert(result3.msg != undefined)
    const errorFlag = getErrorFlag(result3.msg.data)
    assert(errorFlag === false)

    //0x3e
    const cloneMsg2 = cloneMsg(msg)
    cloneMsg2.frameId = 0x3e
    cloneMsg2.direction = LinDirection.SEND
    cloneMsg2.data = Buffer.alloc(1, 0xff)
    const result4 = await sendLinWithSend(cloneMsg2, {
      errorInject: {
        bit: headerBitLength + 9,
        value: 0
      }
    })
    assert(result4)
    const result5 = await sendLinWithRecv(msg1, {})
    assert(result5.result)
  })
  test('[PT-CT 36] Supported Tx Frames according to the IUT specification', async () => {
    const msg1 = FrameMap['TST_FRAME_1']
    const msg2 = FrameMap['TST_FRAME_4_Tx']
    const result = await sendLinWithSend(msg1, {})
    assert(result)
    const result2 = await sendLinWithRecv(msg2, {})
    assert(result2.result)
    assert(result2.msg != undefined)
  })
  test('[PT-CT 37] Supported Rx Frames according to the IUT specification', async () => {
    const msg7 = FrameMap['TST_FRAME_7']
    const msg4Rx = FrameMap['TST_FRAME_4_Rx']

    // 第一次发送TST_FRAME_7 - 可能包含错误位
    const result1 = await sendLinWithRecv(msg7, {})
    assert(result1.result, 'First TST_FRAME_7 should receive response')
    assert(result1.msg != undefined, 'First response should contain data')

    // 检查第一次响应中的错误位状态（可能为true或false）
    const firstErrorFlag = getErrorFlag(result1.msg.data)

    // 第二次发送TST_FRAME_7 - 确保response_error_bit被清除
    const result2 = await sendLinWithRecv(msg7, {})
    assert(result2.result, 'Second TST_FRAME_7 should receive response')
    assert(result2.msg != undefined, 'Second response should contain data')

    // 验证第二次响应中的错误位必须被清除（errorBit:FALSE）
    const secondErrorFlag = getErrorFlag(result2.msg.data)
    assert(
      secondErrorFlag === false,
      'Response error bit should be cleared after second TST_FRAME_7'
    )

    //send failed msg4Rx
    const checkSum = getLinCheckSum(msg4Rx.data, LinChecksumType.CLASSIC)
    const errorCheckSum = checkSum ^ (1 << 4)
    const result3 = await sendLinWithSend(msg4Rx, {
      checkSum: errorCheckSum
    })
    assert(result3)
    const result4 = await sendLinWithRecv(msg7, {})
    assert(result4.result)
    const errorFlag = getErrorFlag(result4.msg.data)
    assert(errorFlag === true)
    //send msg7 again
    const result5 = await sendLinWithRecv(msg7, {})
    assert(result5.result)
    assert(result5.msg != undefined)
    const errorFlag2 = getErrorFlag(result5.msg.data)
    assert(errorFlag2 === false)
  })
})

describe('10: L2: Communication with Failure', () => {
  test('[PT-CT 38.1] Bit error. Byte 1, Stop bit', async () => {
    const msg7 = FrameMap['TST_FRAME_7']
    const msg3 = FrameMap['TST_FRAME_3']
    const msg6 = FrameMap['TST_FRAME_6']

    // 第一次发送TST_FRAME_7 - 可能包含错误位
    // const result1 = await sendLinWithRecv(msg7, {})
    // assert(result1.result, 'First TST_FRAME_7 should receive response')
    // assert(result1.msg != undefined, 'First response should contain data')

    // // 检查第一次响应中的错误位状态（可能为true或false）
    // const firstErrorFlag = getErrorFlag(result1.msg.data)

    // // 第二次发送TST_FRAME_7 - 确保response_error_bit被清除
    // const result2 = await sendLinWithRecv(msg7, {})
    // assert(result2.result, 'Second TST_FRAME_7 should receive response')
    // assert(result2.msg != undefined, 'Second response should contain data')

    // // 验证第二次响应中的错误位必须被清除（errorBit:FALSE）
    // const secondErrorFlag = getErrorFlag(result2.msg.data)
    // assert(
    //   secondErrorFlag === false,
    //   'Response error bit should be cleared after second TST_FRAME_7'
    // )
    const clonemsg3 = cloneMsg(msg3)
    //identify  = 2
    clonemsg3.data[3] = 2
    const result3 = await sendLinWithSend(clonemsg3, {})
    assert(result3)
    const result4 = await sendLinWithRecv(msg6, {
      errorInject: {
        bit: headerBitLength + 9,
        value: 0
      }
    })
    // assert(result4.result)

    // //send msg7 again
    // const result5 = await sendLinWithRecv(msg7, {})
    // assert(result5.result)
    // assert(result5.msg != undefined)
    // const errorFlag2 = getErrorFlag(result5.msg.data)
    // assert(errorFlag2 === true)
  })
  test('[PT-CT 38.2] Bit error. Byte 1, Bit 1', async () => {
    // Test: Bit error. Byte 1, Bit 1
    // Test case ID: PT-CT 38.2
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.2
    //   byteIndex (int): 1
    //   bitIndex (int): 0
    //TODO: Implementation pending
  })
  test('[PT-CT 38.3] Bit error. Interbyte Data 1-2, Bit 1', async () => {
    // Test: Bit error. Interbyte Data 1-2, Bit 1
    // Test case ID: PT-CT 38.3
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.3
    //   byteIndex (int): 1
    //   bitIndex (int): 9
    //TODO: Implementation pending
  })
  test('[PT-CT 38.4] Bit error. Byte 2, Stop bit', async () => {
    // Test: Bit error. Byte 2, Stop bit
    // Test case ID: PT-CT 38.4
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.4
    //   byteIndex (int): 2
    //   bitIndex (int): 8
    //TODO: Implementation pending
  })
  test('[PT-CT 38.5] Bit error. Byte 2, Bit 2', async () => {
    // Test: Bit error. Byte 2, Bit 2
    // Test case ID: PT-CT 38.5
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.5
    //   byteIndex (int): 2
    //   bitIndex (int): 1
    //TODO: Implementation pending
  })
  test('[PT-CT 38.6] Bit error. Interbyte Data 2-3, Bit 1', async () => {
    // Test: Bit error. Interbyte Data 2-3, Bit 1
    // Test case ID: PT-CT 38.6
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.6
    //   byteIndex (int): 2
    //   bitIndex (int): 9
    //TODO: Implementation pending
  })
  test('[PT-CT 38.7] Bit error. Byte 3, Stop bit', async () => {
    // Test: Bit error. Byte 3, Stop bit
    // Test case ID: PT-CT 38.7
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.7
    //   byteIndex (int): 3
    //   bitIndex (int): 8
    //TODO: Implementation pending
  })
  test('[PT-CT 38.8] Bit error. Byte 3, Bit 3', async () => {
    // Test: Bit error. Byte 3, Bit 3
    // Test case ID: PT-CT 38.8
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.8
    //   byteIndex (int): 3
    //   bitIndex (int): 2
    //TODO: Implementation pending
  })
  test('[PT-CT 38.9] Bit error. Interbyte Data 3-4, Bit 1', async () => {
    // Test: Bit error. Interbyte Data 3-4, Bit 1
    // Test case ID: PT-CT 38.9
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.9
    //   byteIndex (int): 3
    //   bitIndex (int): 9
    //TODO: Implementation pending
  })
  test('[PT-CT 38.10] Bit error. Byte 4, Stop bit', async () => {
    // Test: Bit error. Byte 4, Stop bit
    // Test case ID: PT-CT 38.10
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.10
    //   byteIndex (int): 4
    //   bitIndex (int): 8
    //TODO: Implementation pending
  })
  test('[PT-CT 38.11] Bit error. Byte 4, Bit 6', async () => {
    // Test: Bit error. Byte 4, Bit 6
    // Test case ID: PT-CT 38.11
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.11
    //   byteIndex (int): 4
    //   bitIndex (int): 5
    //TODO: Implementation pending
  })
  test('[PT-CT 38.12] Bit error. Interbyte Data 4-5, Bit 1', async () => {
    // Test: Bit error. Interbyte Data 4-5, Bit 1
    // Test case ID: PT-CT 38.12
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.12
    //   byteIndex (int): 4
    //   bitIndex (int): 9
    //TODO: Implementation pending
  })
  test('[PT-CT 38.13] Bit error. Byte 5, Stop bit', async () => {
    // Test: Bit error. Byte 5, Stop bit
    // Test case ID: PT-CT 38.13
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.13
    //   byteIndex (int): 5
    //   bitIndex (int): 8
    //TODO: Implementation pending
  })
  test('[PT-CT 38.14] Bit error. Byte 5, Bit 5', async () => {
    // Test: Bit error. Byte 5, Bit 5
    // Test case ID: PT-CT 38.14
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.14
    //   byteIndex (int): 5
    //   bitIndex (int): 4
    //TODO: Implementation pending
  })
  test('[PT-CT 38.15] Bit error. Interbyte Data 5-6, Bit 1', async () => {
    // Test: Bit error. Interbyte Data 5-6, Bit 1
    // Test case ID: PT-CT 38.15
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.15
    //   byteIndex (int): 5
    //   bitIndex (int): 9
    //TODO: Implementation pending
  })
  test('[PT-CT 38.16] Bit error. Byte 6, Stop bit', async () => {
    // Test: Bit error. Byte 6, Stop bit
    // Test case ID: PT-CT 38.16
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.16
    //   byteIndex (int): 6
    //   bitIndex (int): 8
    //TODO: Implementation pending
  })
  test('[PT-CT 38.17] Bit error. Byte 6, Bit 4', async () => {
    // Test: Bit error. Byte 6, Bit 4
    // Test case ID: PT-CT 38.17
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.17
    //   byteIndex (int): 6
    //   bitIndex (int): 3
    //TODO: Implementation pending
  })
  test('[PT-CT 38.18] Bit error. Interbyte Data 6-7, Bit 1', async () => {
    // Test: Bit error. Interbyte Data 6-7, Bit 1
    // Test case ID: PT-CT 38.18
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.18
    //   byteIndex (int): 6
    //   bitIndex (int): 9
    //TODO: Implementation pending
  })
  test('[PT-CT 38.19] Bit error. Byte 7, Stop bit', async () => {
    // Test: Bit error. Byte 7, Stop bit
    // Test case ID: PT-CT 38.19
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.19
    //   byteIndex (int): 7
    //   bitIndex (int): 8
    //TODO: Implementation pending
  })
  test('[PT-CT 38.20] Bit error. Byte 7, Bit 7', async () => {
    // Test: Bit error. Byte 7, Bit 7
    // Test case ID: PT-CT 38.20
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.20
    //   byteIndex (int): 7
    //   bitIndex (int): 6
    //TODO: Implementation pending
  })
  test('[PT-CT 38.21] Bit error. Interbyte Data 7-8, Bit 1', async () => {
    // Test: Bit error. Interbyte Data 7-8, Bit 1
    // Test case ID: PT-CT 38.21
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.21
    //   byteIndex (int): 7
    //   bitIndex (int): 9
    //TODO: Implementation pending
  })
  test('[PT-CT 38.22] Bit error. Byte 8, Stop bit', async () => {
    // Test: Bit error. Byte 8, Stop bit
    // Test case ID: PT-CT 38.22
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.22
    //   byteIndex (int): 8
    //   bitIndex (int): 8
    //TODO: Implementation pending
  })
  test('[PT-CT 38.23] Bit error. Byte 8, Bit 8', async () => {
    // Test: Bit error. Byte 8, Bit 8
    // Test case ID: PT-CT 38.23
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.23
    //   byteIndex (int): 8
    //   bitIndex (int): 7
    //TODO: Implementation pending
  })
  test('[PT-CT 38.24] Bit error. Interbyte Data 8-Checksum, Bit 1', async () => {
    // Test: Bit error. Interbyte Data 8-Checksum, Bit 1
    // Test case ID: PT-CT 38.24
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.24
    //   byteIndex (int): 8
    //   bitIndex (int): 9
    //TODO: Implementation pending
  })
  test('[PT-CT 38.25] Bit error. Checksum field, Stop bit', async () => {
    // Test: Bit error. Checksum field, Stop bit
    // Test case ID: PT-CT 38.25
    // Function name: LCT21_TestCase_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 38.25
    //   byteIndex (int): 9
    //   bitIndex (int): 8
    //TODO: Implementation pending
  })
  test('[PT-CT 39] Framing error in header of published frame', async () => {
    // Test: Framing error in header of published frame
    // Test case ID: PT-CT 39
    // Function name: LCT21_TestCase_5_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 39
    //TODO: Implementation pending
  })
  test('[PT-CT 40] Framing error in response field of subscribed frame', async () => {
    // Test: Framing error in response field of subscribed frame
    // Test case ID: PT-CT 40
    // Function name: LCT21_TestCase_5_3
    // Parameters:
    //   TestcaseNr (string): PT-CT 40
    //TODO: Implementation pending
  })
  test('[PT-CT 41] Checksum error by inversion', async () => {
    // Test: Checksum error by inversion
    // Test case ID: PT-CT 41
    // Function name: LCT21_TestCase_5_4
    // Parameters:
    //   TestcaseNr (string): PT-CT 41
    //TODO: Implementation pending
  })
  test('[PT-CT 42] Checksum error by carry', async () => {
    // Test: Checksum error by carry
    // Test case ID: PT-CT 42
    // Function name: LCT21_TestCase_5_5
    // Parameters:
    //   TestcaseNr (string): PT-CT 42
    //TODO: Implementation pending
  })
})

describe('11: L2: Event Triggered Frames', () => {
  test('[PT-CT 43] Event Triggered Frame', async () => {
    // Test: Event Triggered Frame
    // Test case ID: PT-CT 43
    // Function name: LCT21_TestCase_6_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 43
    //TODO: Implementation pending
  })
  test('[PT-CT 44] Event Triggered Frame with collision resolving', async () => {
    // Test: Event Triggered Frame with collision resolving
    // Test case ID: PT-CT 44
    // Function name: LCT21_TestCase_6_2_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 44
    //TODO: Implementation pending
  })
  test('[PT-CT 45] Event Triggered Frame with errors in collision resolving', async () => {
    // Test: Event Triggered Frame with errors in collision resolving
    // Test case ID: PT-CT 45
    // Function name: LCT21_TestCase_6_2_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 45
    //TODO: Implementation pending
  })
  test('[PT-CT 47] Error in Transmitted Frame with Collision', async () => {
    // Test: Error in Transmitted Frame with Collision
    // Test case ID: PT-CT 47
    // Function name: LCT21_TestCase_6_4
    // Parameters:
    //   TestcaseNr (string): PT-CT 47
    //TODO: Implementation pending
  })
})

describe('12: NCNM: Status Management', () => {
  test('[PT-CT 48] Error in Received Frame', async () => {
    // Test: Error in Received Frame
    // Test case ID: PT-CT 48
    // Function name: LCT21_TestCase_7_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 48
    //TODO: Implementation pending
  })
  test('[PT-CT 49.1] Error in Transmitted Frame. Inverted checksum', async () => {
    // Test: Error in Transmitted Frame. Inverted checksum
    // Test case ID: PT-CT 49.1
    // Function name: LCT21_TestCase_7_2_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 49.1
    //TODO: Implementation pending
  })
  test('[PT-CT 49.2] Error in Transmitted Frame. Inverted stop bit of Byte 1', async () => {
    // Test: Error in Transmitted Frame. Inverted stop bit of Byte 1
    // Test case ID: PT-CT 49.2
    // Function name: LCT21_TestCase_7_2_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 49.2
    //TODO: Implementation pending
  })
  test('[PT-CT 50] Response error bit handling', async () => {
    // Test: Response error bit handling
    // Test case ID: PT-CT 50
    // Function name: LCT21_TestCase_7_3
    // Parameters:
    //   TestcaseNr (string): PT-CT 50
    //TODO: Implementation pending
  })
})

describe('13: NCNM: Sleep/Wakeup tests', () => {
  test("[PT-CT 52.1] Receive 'Goto Sleep Command' with data bytes 2 to 8 filled with 0xFF", async () => {
    // Test: Receive \'Goto Sleep Command\' with data bytes 2 to 8 filled with 0xFF
    // Test case ID: PT-CT 52.1
    // Function name: LCT21_TestCase_8_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 52.1
    //   SubTestCaseNr (int): 1
    //TODO: Implementation pending
  })
  test("[PT-CT 52.2] Receive 'Goto Sleep Command' with data bytes 2 to 8 not filled with 0xFF", async () => {
    // Test: Receive \'Goto Sleep Command\' with data bytes 2 to 8 not filled with 0xFF
    // Test case ID: PT-CT 52.2
    // Function name: LCT21_TestCase_8_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 52.2
    //   SubTestCaseNr (int): 2
    //TODO: Implementation pending
  })
  test('[PT-CT 54.1] Receive a Wake up signal - 250us', async () => {
    // Test: Receive a Wake up signal - 250us
    // Test case ID: PT-CT 54.1
    // Function name: LCT21_TestCase_8_4
    // Parameters:
    //   TestcaseNr (string): PT-CT 54.1
    //   SubTestCaseNr (int): 1
    //TODO: Implementation pending
  })
  test('[PT-CT 54.2] Receive a Wake up signal - 5ms', async () => {
    // Test: Receive a Wake up signal - 5ms
    // Test case ID: PT-CT 54.2
    // Function name: LCT21_TestCase_8_4
    // Parameters:
    //   TestcaseNr (string): PT-CT 54.2
    //   SubTestCaseNr (int): 2
    //TODO: Implementation pending
  })
  test('[PT-CT 54.3] Receive a Wake up signal - 5 nominal bit times', async () => {
    // Test: Receive a Wake up signal - 5 nominal bit times
    // Test case ID: PT-CT 54.3
    // Function name: LCT21_TestCase_8_4
    // Parameters:
    //   TestcaseNr (string): PT-CT 54.3
    //   SubTestCaseNr (int): 3
    //TODO: Implementation pending
  })
  test('[PT-CT 55] Send a Wake up signal', async () => {
    // Test: Send a Wake up signal
    // Test case ID: PT-CT 55
    // Function name: LCT21_TestCase_8_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 55
    //TODO: Implementation pending
  })
  test('[PT-CT 56] Send a block of wake up signals', async () => {
    // Test: Send a block of wake up signals
    // Test case ID: PT-CT 56
    // Function name: LCT21_TestCase_8_5_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 56
    //TODO: Implementation pending
  })
  test('[PT-CT 57] Wait after one block of wakeup signals', async () => {
    // Test: Wait after one block of wakeup signals
    // Test case ID: PT-CT 57
    // Function name: LCT21_TestCase_8_5_3
    // Parameters:
    //   TestcaseNr (string): PT-CT 57
    //TODO: Implementation pending
  })
  test('[PT-CT 58] Send a Wake up signal, Frame header from a Master following', async () => {
    // Test: Send a Wake up signal, Frame header from a Master following
    // Test case ID: PT-CT 58
    // Function name: LCT21_TestCase_8_5_4
    // Parameters:
    //   TestcaseNr (string): PT-CT 58
    //TODO: Implementation pending
  })
  test('[PT-CT 59.1] Sleep Mode after Bus Idle, recessive level after Slave Response', async () => {
    // Test: Sleep Mode after Bus Idle, recessive level after Slave Response
    // Test case ID: PT-CT 59.1
    // Function name: LCT21_TestCase_8_6_1_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 59.1
    //TODO: Implementation pending
  })
  test('[PT-CT 59.2] Sleep Mode after Bus Idle, recessive level after wake up', async () => {
    // Test: Sleep Mode after Bus Idle, recessive level after wake up
    // Test case ID: PT-CT 59.2
    // Function name: LCT21_TestCase_8_6_1_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 59.2
    //TODO: Implementation pending
  })
  test('[PT-CT 59.3] Sleep Mode after Bus Idle, dominant level after wake up', async () => {
    // Test: Sleep Mode after Bus Idle, dominant level after wake up
    // Test case ID: PT-CT 59.3
    // Function name: LCT21_TestCase_8_6_1_3
    // Parameters:
    //   TestcaseNr (string): PT-CT 59.3
    //TODO: Implementation pending
  })
  test('[PT-CT 59.4] Sleep Mode after Bus Idle, recessive level after Break and Sync fields', async () => {
    // Test: Sleep Mode after Bus Idle, recessive level after Break and Sync fields
    // Test case ID: PT-CT 59.4
    // Function name: LCT21_TestCase_8_6_1_4
    // Parameters:
    //   TestcaseNr (string): PT-CT 59.4
    //TODO: Implementation pending
  })
  test('[PT-CT 59.5] Sleep Mode after Bus Idle, dominant level after Break and Sync fields', async () => {
    // Test: Sleep Mode after Bus Idle, dominant level after Break and Sync fields
    // Test case ID: PT-CT 59.5
    // Function name: LCT21_TestCase_8_6_1_5
    // Parameters:
    //   TestcaseNr (string): PT-CT 59.5
    //TODO: Implementation pending
  })
  test('[PT-CT 59.6] Sleep Mode after Bus Idle, recessive level after response error in master request', async () => {
    // Test: Sleep Mode after Bus Idle, recessive level after response error in master request
    // Test case ID: PT-CT 59.6
    // Function name: LCT21_TestCase_8_6_1_6
    // Parameters:
    //   TestcaseNr (string): PT-CT 59.6
    //TODO: Implementation pending
  })
  test('[PT-CT 59.7] Sleep Mode after Bus Idle, dominant level after response error in master request', async () => {
    // Test: Sleep Mode after Bus Idle, dominant level after response error in master request
    // Test case ID: PT-CT 59.7
    // Function name: LCT21_TestCase_8_6_1_7
    // Parameters:
    //   TestcaseNr (string): PT-CT 59.7
    //TODO: Implementation pending
  })
  test('[PT-CT 60] Sleep Mode after Bus Idle, recessive level after power up wake up', async () => {
    // Test: Sleep Mode after Bus Idle, recessive level after power up wake up
    // Test case ID: PT-CT 60
    // Function name: LCT21_TestCase_8_6_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 60
    //TODO: Implementation pending
  })
  test('[PT-CT 61] Timeout after Bus Idle', async () => {
    // Test: Timeout after Bus Idle
    // Test case ID: PT-CT 61
    // Function name: LCT21_TestCase_8_7
    // Parameters:
    //   TestcaseNr (string): PT-CT 61
    //TODO: Implementation pending
  })
})

describe('14: NCNM: Sleep mode after bus idle', () => {})

describe('15: NCNM: Node Configuration', () => {
  test('[PT-CT 62] Frame ID range assignment with indirect response', async () => {
    // Test: Frame ID range assignment with indirect response
    // Test case ID: PT-CT 62
    // Function name: LCT21_TestCase_9_1_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 62
    //TODO: Implementation pending
  })
  test('[PT-CT 63] Frame ID range unassignment with indirect response', async () => {
    // Test: Frame ID range unassignment with indirect response
    // Test case ID: PT-CT 63
    // Function name: LCT21_TestCase_9_1_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 63
    //TODO: Implementation pending
  })
  test('[PT-CT 64] LIN Product ID with direct response', async () => {
    // Test: LIN Product ID with direct response
    // Test case ID: PT-CT 64
    // Function name: LCT21_TestCase_9_2_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 64
    //TODO: Implementation pending
  })
  test('[PT-CT 65] LIN Product ID with delayed response', async () => {
    // Test: LIN Product ID with delayed response
    // Test case ID: PT-CT 65
    // Function name: LCT21_TestCase_9_2_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 65
    //TODO: Implementation pending
  })
})

describe('16: NCNM: Wildcards', () => {
  test('[PT-CT 66.1] Request with NAD as wildcard', async () => {
    // Test: Request with NAD as wildcard
    // Test case ID: PT-CT 66.1
    // Function name: LCT21_TestCase_10_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 66.1
    //   SubTestCaseNr (int): 1
    //TODO: Implementation pending
  })
  test('[PT-CT 66.2] Request with Supplier ID as wildcard', async () => {
    // Test: Request with Supplier ID as wildcard
    // Test case ID: PT-CT 66.2
    // Function name: LCT21_TestCase_10_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 66.2
    //   SubTestCaseNr (int): 2
    //TODO: Implementation pending
  })
  test('[PT-CT 66.3] Request with Function ID as wildcard', async () => {
    // Test: Request with Function ID as wildcard
    // Test case ID: PT-CT 66.3
    // Function name: LCT21_TestCase_10_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 66.3
    //   SubTestCaseNr (int): 3
    //TODO: Implementation pending
  })
  test('[PT-CT 66.4] Request with Supplier ID and Function ID as wildcard', async () => {
    // Test: Request with Supplier ID and Function ID as wildcard
    // Test case ID: PT-CT 66.4
    // Function name: LCT21_TestCase_10_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 66.4
    //   SubTestCaseNr (int): 4
    //TODO: Implementation pending
  })
})

describe('17: NCNM: Read by Identifier command', () => {
  test('[PT-CT 67] Correct addressing. All Identifiers', async () => {
    // Test: Correct addressing. All Identifiers
    // Test case ID: PT-CT 67
    // Function name: LCT21_TestCase_11_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 67
    //TODO: Implementation pending
  })
  test('[PT-CT 68.1] Incorrect addressing; Incorrect NAD', async () => {
    // Test: Incorrect addressing; Incorrect NAD
    // Test case ID: PT-CT 68.1
    // Function name: LCT21_TestCase_11_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 68.1
    //   SubTestCaseNr (int): 1
    //TODO: Implementation pending
  })
  test('[PT-CT 68.2] Incorrect addressing; Incorrect Supplier ID MSB', async () => {
    // Test: Incorrect addressing; Incorrect Supplier ID MSB
    // Test case ID: PT-CT 68.2
    // Function name: LCT21_TestCase_11_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 68.2
    //   SubTestCaseNr (int): 2
    //TODO: Implementation pending
  })
  test('[PT-CT 68.3] Incorrect addressing; Incorrect Supplier ID LSB', async () => {
    // Test: Incorrect addressing; Incorrect Supplier ID LSB
    // Test case ID: PT-CT 68.3
    // Function name: LCT21_TestCase_11_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 68.3
    //   SubTestCaseNr (int): 3
    //TODO: Implementation pending
  })
  test('[PT-CT 68.4] Incorrect addressing; Incorrect Function ID MSB', async () => {
    // Test: Incorrect addressing; Incorrect Function ID MSB
    // Test case ID: PT-CT 68.4
    // Function name: LCT21_TestCase_11_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 68.4
    //   SubTestCaseNr (int): 4
    //TODO: Implementation pending
  })
  test('[PT-CT 68.5] Incorrect addressing; Incorrect Function ID LSB', async () => {
    // Test: Incorrect addressing; Incorrect Function ID LSB
    // Test case ID: PT-CT 68.5
    // Function name: LCT21_TestCase_11_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 68.5
    //   SubTestCaseNr (int): 5
    //TODO: Implementation pending
  })
})

describe('18: NCNM: NAD Assignment', () => {
  test('[PT-CT 69] NAD Assignment - followed by Read by Identifier command', async () => {
    // Test: NAD Assignment - followed by Read by Identifier command
    // Test case ID: PT-CT 69
    // Function name: LCT21_TestCase_12_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 69
    //TODO: Implementation pending
  })
  test('[PT-CT 70] NAD Assignment - with positive response', async () => {
    // Test: NAD Assignment - with positive response
    // Test case ID: PT-CT 70
    // Function name: LCT21_TestCase_12_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 70
    //TODO: Implementation pending
  })
  test('[PT-CT 71] Conditional change NAD', async () => {
    // Test: Conditional change NAD
    // Test case ID: PT-CT 71
    // Function name: LCT21_TestCase_12_3
    // Parameters:
    //   TestcaseNr (string): PT-CT 71
    //TODO: Implementation pending
  })
})

describe('19: NCNM: Transport Layer', () => {
  test('[PT-CT 72] Transport layer Functional Request', async () => {
    // Test: Transport layer Functional Request
    // Test case ID: PT-CT 72
    // Function name: LCT21_TestCase_13_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 72
    //TODO: Implementation pending
  })
  test('[PT-CT 73] Aborting diagnostic communication with new diagnostic request', async () => {
    // Test: Aborting diagnostic communication with new diagnostic request
    // Test case ID: PT-CT 73
    // Function name: LCT21_TestCase_13_2_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 73
    //TODO: Implementation pending
  })
  test('[PT-CT 74] Receiving segmented request as specified', async () => {
    // Test: Receiving segmented request as specified
    // Test case ID: PT-CT 74
    // Function name: LCT21_TestCase_13_3
    // Parameters:
    //   TestcaseNr (string): PT-CT 74
    //TODO: Implementation pending
  })
  test('[PT-CT 75] Receiving segmented request if user frames between request parts', async () => {
    // Test: Receiving segmented request if user frames between request parts
    // Test case ID: PT-CT 75
    // Function name: LCT21_TestCase_13_4_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 75
    //TODO: Implementation pending
  })
  test('[PT-CT 76] Receiving segmented request with functional request between request parts', async () => {
    // Test: Receiving segmented request with functional request between request parts
    // Test case ID: PT-CT 76
    // Function name: LCT21_TestCase_13_4_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 76
    //TODO: Implementation pending
  })
  test('[PT-CT 77] Ignoring segmented requests after timeout', async () => {
    // Test: Ignoring segmented requests after timeout
    // Test case ID: PT-CT 77
    // Function name: LCT21_TestCase_13_5_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 77
    //TODO: Implementation pending
  })
  test('[PT-CT 78] Observing Transport Layer timeout', async () => {
    // Test: Observing Transport Layer timeout
    // Test case ID: PT-CT 78
    // Function name: LCT21_TestCase_13_5_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 78
    //TODO: Implementation pending
  })
  test('[PT-CT 79] Ignoring segmented requests with wrong sequence numbering', async () => {
    // Test: Ignoring segmented requests with wrong sequence numbering
    // Test case ID: PT-CT 79
    // Function name: LCT21_TestCase_13_6
    // Parameters:
    //   TestcaseNr (string): PT-CT 79
    //TODO: Implementation pending
  })
  test('[PT-CT 80] Responding with correct segmented response', async () => {
    // Test: Responding with correct segmented response
    // Test case ID: PT-CT 80
    // Function name: LCT21_TestCase_13_7
    // Parameters:
    //   TestcaseNr (string): PT-CT 80
    //TODO: Implementation pending
  })
  test('[PT-CT 81] Sending segmented response with user frames between response parts', async () => {
    // Test: Sending segmented response with user frames between response parts
    // Test case ID: PT-CT 81
    // Function name: LCT21_TestCase_13_8_1
    // Parameters:
    //   TestcaseNr (string): PT-CT 81
    //TODO: Implementation pending
  })
  test('[PT-CT 82] Sending segmented response with functional request between response parts', async () => {
    // Test: Sending segmented response with functional request between response parts
    // Test case ID: PT-CT 82
    // Function name: LCT21_TestCase_13_8_2
    // Parameters:
    //   TestcaseNr (string): PT-CT 82
    //TODO: Implementation pending
  })
  test('[PT-CT 83] Not responding to 0x3D if there is no request before', async () => {
    // Test: Not responding to 0x3D if there is no request before
    // Test case ID: PT-CT 83
    // Function name: LCT21_TestCase_13_9
    // Parameters:
    //   TestcaseNr (string): PT-CT 83
    //TODO: Implementation pending
  })
  test('[PT-CT 84] Not responding to 0x3D if the response is already sent', async () => {
    // Test: Not responding to 0x3D if the response is already sent
    // Test case ID: PT-CT 84
    // Function name: LCT21_TestCase_13_10
    // Parameters:
    //   TestcaseNr (string): PT-CT 84
    //TODO: Implementation pending
  })
  test('[PT-CT 85] Aborting segmented response after timeout', async () => {
    // Test: Aborting segmented response after timeout
    // Test case ID: PT-CT 85
    // Function name: LCT21_TestCase_13_11
    // Parameters:
    //   TestcaseNr (string): PT-CT 85
    //TODO: Implementation pending
  })
})

