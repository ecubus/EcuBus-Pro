/**
 * XCP protocol / master tests.
 *
 * The byte-level expectations are ported from the test suite of the mature
 * open-source XCP master pyXCP (https://github.com/christoph2/pyxcp,
 * pyxcp/tests/test_master.py). pyXCP's `_mock_send` assertions include the
 * 4-byte XCP-on-Ethernet header (LEN[2] + CTR[2]); here we compare against the
 * raw XCP packet only (the header is a transport concern), so every expectation
 * below equals the pyXCP vector with its first 4 header bytes removed.
 */
import { describe, it, expect } from 'vitest'
import * as P from 'src/main/xcp/xcpProtocol'
import { ByteOrder, ChecksumType } from 'src/main/xcp/xcpProtocol'
import { XcpMaster, XcpTransport } from 'src/main/xcp/xcpMaster'

const hex = (s: string): Buffer => Buffer.from(s.replace(/\s+/g, ''), 'hex')
const bytes = (arr: number[]): Buffer => Buffer.from(arr)

/** In-memory transport: records requests and replays queued responses. */
class MockTransport implements XcpTransport {
  sent: Buffer[] = []
  private responses: Buffer[] = []

  pushResponse(packet: string | number[]): void {
    this.responses.push(typeof packet === 'string' ? hex(packet) : bytes(packet))
  }
  get last(): Buffer {
    return this.sent[this.sent.length - 1]
  }
  async request(request: Buffer): Promise<Buffer> {
    this.sent.push(request)
    const r = this.responses.shift()
    if (!r) throw new Error('MockTransport: no response queued')
    return r
  }
  async send(request: Buffer): Promise<void> {
    this.sent.push(request)
  }
  close(): void {}
}

/** Default CONNECT response used across pyXCP tests (INTEL byte order). */
const DEFAULT_CONNECT_RESPONSE = 'FF 1D C0 FF DC 05 01 01'

function connectedMaster(): { master: XcpMaster; mock: MockTransport } {
  const mock = new MockTransport()
  const master = new XcpMaster(mock)
  return { master, mock }
}

describe('XCP protocol codec — command builders', () => {
  it('CONNECT', () => {
    expect(P.buildConnect(0)).toEqual(bytes([0xff, 0x00]))
  })
  it('DISCONNECT', () => {
    expect(P.buildDisconnect()).toEqual(bytes([0xfe]))
  })
  it('GET_STATUS', () => {
    expect(P.buildGetStatus()).toEqual(bytes([0xfd]))
  })
  it('SYNCH', () => {
    expect(P.buildSynch()).toEqual(bytes([0xfc]))
  })
  it('GET_COMM_MODE_INFO', () => {
    expect(P.buildGetCommModeInfo()).toEqual(bytes([0xfb]))
  })
  it('GET_VERSION', () => {
    expect(P.buildGetVersion()).toEqual(bytes([0xc0, 0x00]))
  })
  it('GET_ID', () => {
    expect(P.buildGetId(0x01)).toEqual(bytes([0xfa, 0x01]))
  })
  it('SET_REQUEST (session id is MSB-first)', () => {
    expect(P.buildSetRequest(0x15, 0x1234)).toEqual(bytes([0xf9, 0x15, 0x12, 0x34]))
  })
  it('GET_SEED', () => {
    expect(P.buildGetSeed(0x00, 0x00)).toEqual(bytes([0xf8, 0x00, 0x00]))
  })
  it('UNLOCK', () => {
    expect(P.buildUnlock(0x04, [0x12, 0x34, 0x56, 0x78])).toEqual(
      bytes([0xf7, 0x04, 0x12, 0x34, 0x56, 0x78])
    )
  })
  it('SET_MTA', () => {
    expect(P.buildSetMta(0x12345678, 0x55)).toEqual(
      bytes([0xf6, 0x00, 0x00, 0x55, 0x78, 0x56, 0x34, 0x12])
    )
  })
  it('UPLOAD', () => {
    expect(P.buildUpload(8)).toEqual(bytes([0xf5, 0x08]))
  })
  it('SHORT_UPLOAD', () => {
    expect(P.buildShortUpload(8, 0xcafebabe, 1)).toEqual(
      bytes([0xf4, 0x08, 0x00, 0x01, 0xbe, 0xba, 0xfe, 0xca])
    )
  })
  it('BUILD_CHECKSUM', () => {
    expect(P.buildBuildChecksum(1024)).toEqual(
      bytes([0xf3, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00])
    )
  })
  it('USER_CMD', () => {
    expect(P.buildUserCmd(0x55, [0xbe, 0xef])).toEqual(bytes([0xf1, 0x55, 0xbe, 0xef]))
  })
  it('TRANSPORT_LAYER_CMD', () => {
    expect(P.buildTransportLayerCmd(0x55, [0xbe, 0xef])).toEqual(bytes([0xf2, 0x55, 0xbe, 0xef]))
  })

  it('DOWNLOAD', () => {
    expect(P.buildDownload([0xca, 0xfe, 0xba, 0xbe])).toEqual(
      bytes([0xf0, 0x04, 0xca, 0xfe, 0xba, 0xbe])
    )
  })
  it('DOWNLOAD_NEXT', () => {
    expect(P.buildDownloadNext(42, [0xca, 0xfe, 0xba, 0xbe])).toEqual(
      bytes([0xef, 42, 0xca, 0xfe, 0xba, 0xbe])
    )
  })
  it('DOWNLOAD_MAX', () => {
    expect(P.buildDownloadMax([0xca, 0xfe, 0xba, 0xbe])).toEqual(
      bytes([0xee, 0xca, 0xfe, 0xba, 0xbe])
    )
  })
  it('SHORT_DOWNLOAD', () => {
    expect(P.buildShortDownload(0x12345678, 0x55, [0xca, 0xfe, 0xba, 0xbe])).toEqual(
      bytes([0xed, 0x04, 0x00, 0x55, 0x78, 0x56, 0x34, 0x12, 0xca, 0xfe, 0xba, 0xbe])
    )
  })
  it('MODIFY_BITS', () => {
    expect(P.buildModifyBits(0xff, 0x1234, 0xabcd)).toEqual(
      bytes([0xec, 0xff, 0x34, 0x12, 0xcd, 0xab])
    )
  })
  it('SET_CAL_PAGE', () => {
    expect(P.buildSetCalPage(0x03, 0x12, 0x34)).toEqual(bytes([0xeb, 0x03, 0x12, 0x34]))
  })
  it('GET_CAL_PAGE', () => {
    expect(P.buildGetCalPage(0x02, 0x44)).toEqual(bytes([0xea, 0x02, 0x44]))
  })
  it('GET_PAG_PROCESSOR_INFO', () => {
    expect(P.buildGetPagProcessorInfo()).toEqual(bytes([0xe9]))
  })
  it('GET_SEGMENT_INFO', () => {
    expect(P.buildGetSegmentInfo(0, 5, 1, 0)).toEqual(bytes([0xe8, 0x00, 0x05, 0x01, 0x00]))
  })
  it('GET_PAGE_INFO', () => {
    expect(P.buildGetPageInfo(0x12, 0x34)).toEqual(bytes([0xe7, 0x00, 0x12, 0x34]))
  })
  it('SET_SEGMENT_MODE', () => {
    expect(P.buildSetSegmentMode(0x01, 0x23)).toEqual(bytes([0xe6, 0x01, 0x23]))
  })
  it('GET_SEGMENT_MODE', () => {
    expect(P.buildGetSegmentMode(0x23)).toEqual(bytes([0xe5, 0x00, 0x23]))
  })
  it('COPY_CAL_PAGE', () => {
    expect(P.buildCopyCalPage(0x12, 0x34, 0x56, 0x78)).toEqual(
      bytes([0xe4, 0x12, 0x34, 0x56, 0x78])
    )
  })

  it('SET_DAQ_PTR', () => {
    expect(P.buildSetDaqPtr(2, 3, 4)).toEqual(bytes([0xe2, 0x00, 0x02, 0x00, 0x03, 0x04]))
  })
  it('WRITE_DAQ', () => {
    expect(P.buildWriteDaq(31, 15, 1, 0x12345678)).toEqual(
      bytes([0xe1, 0x1f, 0x0f, 0x01, 0x78, 0x56, 0x34, 0x12])
    )
  })
  it('SET_DAQ_LIST_MODE', () => {
    expect(P.buildSetDaqListMode(0x3b, 256, 512, 1, 0xff)).toEqual(
      bytes([0xe0, 0x3b, 0x00, 0x01, 0x00, 0x02, 0x01, 0xff])
    )
  })
  it('START_STOP_DAQ_LIST', () => {
    expect(P.buildStartStopDaqList(1, 512)).toEqual(bytes([0xde, 0x01, 0x00, 0x02]))
  })
  it('START_STOP_SYNCH', () => {
    expect(P.buildStartStopSynch(3)).toEqual(bytes([0xdd, 0x03]))
  })
  it('READ_DAQ', () => {
    expect(P.buildReadDaq()).toEqual(bytes([0xdb]))
  })
  it('GET_DAQ_CLOCK', () => {
    expect(P.buildGetDaqClock()).toEqual(bytes([0xdc]))
  })
  it('GET_DAQ_LIST_MODE', () => {
    expect(P.buildGetDaqListMode(256)).toEqual(bytes([0xdf, 0x00, 0x00, 0x01]))
  })
  it('GET_DAQ_EVENT_INFO', () => {
    expect(P.buildGetDaqEventInfo(256)).toEqual(bytes([0xd7, 0x00, 0x00, 0x01]))
  })
  it('CLEAR_DAQ_LIST', () => {
    expect(P.buildClearDaqList(256)).toEqual(bytes([0xe3, 0x00, 0x00, 0x01]))
  })
  it('GET_DAQ_LIST_INFO', () => {
    expect(P.buildGetDaqListInfo(256)).toEqual(bytes([0xd8, 0x00, 0x00, 0x01]))
  })
  it('FREE_DAQ', () => {
    expect(P.buildFreeDaq()).toEqual(bytes([0xd6]))
  })
  it('ALLOC_DAQ', () => {
    expect(P.buildAllocDaq(258)).toEqual(bytes([0xd5, 0x00, 0x02, 0x01]))
  })
  it('ALLOC_ODT', () => {
    expect(P.buildAllocOdt(258, 3)).toEqual(bytes([0xd4, 0x00, 0x02, 0x01, 0x03]))
  })
  it('ALLOC_ODT_ENTRY', () => {
    expect(P.buildAllocOdtEntry(258, 3, 4)).toEqual(bytes([0xd3, 0x00, 0x02, 0x01, 0x03, 0x04]))
  })
  it('WRITE_DAQ_MULTIPLE', () => {
    expect(
      P.buildWriteDaqMultiple([
        { bitOffset: 1, size: 2, address: 3, addressExt: 4 },
        { bitOffset: 5, size: 6, address: 0x12345678, addressExt: 7 }
      ])
    ).toEqual(
      bytes([
        0xc7, 0x02, 0x01, 0x02, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x05, 0x06, 0x78, 0x56, 0x34,
        0x12, 0x07, 0x00
      ])
    )
  })

  it('PROGRAM_START', () => {
    expect(P.buildProgramStart()).toEqual(bytes([0xd2]))
  })
  it('PROGRAM_CLEAR', () => {
    expect(P.buildProgramClear(0x00, 0xa0000100)).toEqual(
      bytes([0xd1, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0xa0])
    )
  })
  it('PROGRAM', () => {
    expect(P.buildProgram(4, [0x01, 0x02, 0x03, 0x04])).toEqual(
      bytes([0xd0, 0x04, 0x01, 0x02, 0x03, 0x04])
    )
  })
  it('PROGRAM_RESET', () => {
    expect(P.buildProgramReset()).toEqual(bytes([0xcf]))
  })
  it('GET_SECTOR_INFO', () => {
    expect(P.buildGetSectorInfo(0, 0x12)).toEqual(bytes([0xcd, 0x00, 0x12]))
  })
  it('PROGRAM_PREPARE', () => {
    expect(P.buildProgramPrepare(0x1234)).toEqual(bytes([0xcc, 0x00, 0x34, 0x12]))
  })
  it('PROGRAM_FORMAT', () => {
    expect(P.buildProgramFormat(0x81, 0x82, 0x83, 0x01)).toEqual(
      bytes([0xcb, 0x81, 0x82, 0x83, 0x01])
    )
  })
  it('PROGRAM_NEXT', () => {
    expect(P.buildProgramNext(4, [0x01, 0x02, 0x03, 0x04])).toEqual(
      bytes([0xca, 0x04, 0x01, 0x02, 0x03, 0x04])
    )
  })
  it('PROGRAM_MAX', () => {
    expect(P.buildProgramMax([0x01, 0x02, 0x03, 0x04])).toEqual(
      bytes([0xc9, 0x01, 0x02, 0x03, 0x04])
    )
  })
  it('PROGRAM_VERIFY', () => {
    expect(P.buildProgramVerify(0x01, 0x0004, 0xcafebabe)).toEqual(
      bytes([0xc8, 0x01, 0x04, 0x00, 0xbe, 0xba, 0xfe, 0xca])
    )
  })
})

describe('XCP protocol codec — response parsers', () => {
  it('CONNECT response (INTEL)', () => {
    const r = P.parseConnectResponse(hex(DEFAULT_CONNECT_RESPONSE))
    expect(r.maxCto).toBe(255)
    expect(r.maxDto).toBe(1500)
    expect(r.protocolLayerVersion).toBe(1)
    expect(r.transportLayerVersion).toBe(1)
    expect(r.resource).toEqual({ calpag: true, daq: true, stim: true, pgm: true, dbg: false })
    expect(r.commModeBasic.optional).toBe(true)
    expect(r.commModeBasic.slaveBlockMode).toBe(true)
    expect(r.commModeBasic.addressGranularity).toBe(P.AddressGranularity.BYTE)
    expect(r.commModeBasic.byteOrder).toBe(ByteOrder.INTEL)
  })

  it('GET_STATUS response (all clear)', () => {
    const r = P.parseGetStatusResponse(hex('FF 00 1D FF 00 00'))
    expect(r.sessionConfigurationId).toBe(0)
    expect(r.sessionStatus).toEqual({
      storeCalRequest: false,
      storeDaqRequest: false,
      clearDaqRequest: false,
      daqRunning: false,
      resume: false
    })
    expect(r.resourceProtectionStatus).toEqual({ calpag: true, daq: true, stim: true, pgm: true })
  })

  it('GET_STATUS response (with flags + session id)', () => {
    const r = P.parseGetStatusResponse(hex('FF 09 1D 00 34 12'))
    expect(r.sessionStatus.storeCalRequest).toBe(true)
    expect(r.sessionStatus.clearDaqRequest).toBe(true)
    expect(r.sessionStatus.storeDaqRequest).toBe(false)
    expect(r.sessionConfigurationId).toBe(0x1234)
  })

  it('GET_COMM_MODE_INFO response', () => {
    const r = P.parseGetCommModeInfoResponse(hex('FF 00 01 FF 02 00 00 19'))
    expect(r.commModeOptional.masterBlockMode).toBe(true)
    expect(r.commModeOptional.interleavedMode).toBe(false)
    expect(r.maxBs).toBe(2)
    expect(r.minSt).toBe(0)
    expect(r.queueSize).toBe(0)
    expect(r.xcpDriverVersionNumber).toBe(25)
  })

  it('GET_VERSION response', () => {
    const r = P.parseGetVersionResponse(hex('FF 00 01 05 01 04'))
    expect(r).toEqual({ protocolMajor: 1, protocolMinor: 5, transportMajor: 1, transportMinor: 4 })
  })

  it('GET_ID response', () => {
    const r = P.parseGetIdResponse(hex('FF 00 01 FF 06 00 00 00'))
    expect(r).toEqual({ mode: 0, length: 6 })
  })

  it('GET_SEED response', () => {
    const r = P.parseGetSeedResponse(hex('FF 04 12 34 56 78'))
    expect(r).toEqual({ length: 4, seed: [0x12, 0x34, 0x56, 0x78] })
  })

  it('UNLOCK response', () => {
    const r = P.parseUnlockResponse(hex('FF 10'))
    expect(r).toEqual({ calpag: false, daq: false, stim: false, pgm: true })
  })

  it('BUILD_CHECKSUM response', () => {
    const r = P.parseBuildChecksumResponse(hex('FF 09 00 00 04 05 06 07'))
    expect(r.checksumType).toBe(ChecksumType.XCP_CRC_32)
    expect(r.checksum).toBe(0x07060504)
  })

  it('GET_CAL_PAGE response', () => {
    expect(P.parseGetCalPageResponse(hex('FF 00 00 55'))).toBe(0x55)
  })

  it('START_STOP_DAQ_LIST response', () => {
    expect(P.parseStartStopDaqListResponse(hex('FF 00')).firstPid).toBe(0)
  })

  it('GET_DAQ_CLOCK response', () => {
    expect(P.parseGetDaqClockResponse(hex('FF 00 03 04 78 56 34 12'))).toBe(0x12345678)
  })

  it('ERR response raises XcpError', () => {
    expect(() => P.checkResponse(hex('FE 20'))).toThrowError(P.XcpError)
    try {
      P.checkResponse(hex('FE 22'))
    } catch (e) {
      expect((e as P.XcpError).code).toBe(P.XcpErrorCode.ERR_OUT_OF_RANGE)
    }
  })
})

describe('XcpMaster — end-to-end command flow over a mock transport', () => {
  it('connect negotiates slave properties', async () => {
    const { master, mock } = connectedMaster()
    mock.pushResponse(DEFAULT_CONNECT_RESPONSE)
    const res = await master.connect()
    expect(mock.last).toEqual(bytes([0xff, 0x00]))
    expect(res.maxCto).toBe(255)
    expect(res.maxDto).toBe(1500)
    expect(master.slaveProperties.byteOrder).toBe(ByteOrder.INTEL)
    expect(master.slaveProperties.maxCto).toBe(255)
    expect(master.slaveProperties.maxDto).toBe(1500)
  })

  it('getVersion', async () => {
    const { master, mock } = connectedMaster()
    mock.pushResponse(DEFAULT_CONNECT_RESPONSE)
    await master.connect()
    mock.pushResponse('FF 00 01 05 01 04')
    const res = await master.getVersion()
    expect(mock.last).toEqual(bytes([0xc0, 0x00]))
    expect(res).toEqual({
      protocolMajor: 1,
      protocolMinor: 5,
      transportMajor: 1,
      transportMinor: 4
    })
  })

  it('getId + upload identifier', async () => {
    const { master, mock } = connectedMaster()
    mock.pushResponse(DEFAULT_CONNECT_RESPONSE)
    await master.connect()

    mock.pushResponse('FF 00 01 FF 06 00 00 00')
    const gid = await master.getId(0x01)
    expect(mock.last).toEqual(bytes([0xfa, 0x01]))
    expect(gid).toEqual({ mode: 0, length: 6 })

    mock.pushResponse('FF 58 43 50 73 69 6D')
    const data = await master.upload(gid.length)
    expect(mock.last).toEqual(bytes([0xf5, 0x06]))
    expect(data.toString('latin1')).toBe('XCPsim')
  })

  it('setMta', async () => {
    const { master, mock } = connectedMaster()
    mock.pushResponse(DEFAULT_CONNECT_RESPONSE)
    await master.connect()
    mock.pushResponse('FF')
    await master.setMta(0x12345678, 0x55)
    expect(mock.last).toEqual(bytes([0xf6, 0x00, 0x00, 0x55, 0x78, 0x56, 0x34, 0x12]))
  })

  it('shortUpload', async () => {
    const { master, mock } = connectedMaster()
    mock.pushResponse(DEFAULT_CONNECT_RESPONSE)
    await master.connect()
    mock.pushResponse('FF 01 02 03 04 05 06 07 08')
    const data = await master.shortUpload(8, 0xcafebabe, 1)
    expect(mock.last).toEqual(bytes([0xf4, 0x08, 0x00, 0x01, 0xbe, 0xba, 0xfe, 0xca]))
    expect(Array.from(data)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('buildChecksum', async () => {
    const { master, mock } = connectedMaster()
    mock.pushResponse(DEFAULT_CONNECT_RESPONSE)
    await master.connect()
    mock.pushResponse('FF 09 00 00 04 05 06 07')
    const res = await master.buildChecksum(1024)
    expect(mock.last).toEqual(bytes([0xf3, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00]))
    expect(res.checksumType).toBe(ChecksumType.XCP_CRC_32)
    expect(res.checksum).toBe(0x07060504)
  })

  it('getSeed + unlock', async () => {
    const { master, mock } = connectedMaster()
    mock.pushResponse(DEFAULT_CONNECT_RESPONSE)
    await master.connect()

    mock.pushResponse('FF 04 12 34 56 78')
    const seed = await master.getSeed(0x00, 0x00)
    expect(mock.last).toEqual(bytes([0xf8, 0x00, 0x00]))
    expect(seed).toEqual({ length: 4, seed: [0x12, 0x34, 0x56, 0x78] })

    mock.pushResponse('FF 10')
    const prot = await master.unlock(0x04, [0x12, 0x34, 0x56, 0x78])
    expect(mock.last).toEqual(bytes([0xf7, 0x04, 0x12, 0x34, 0x56, 0x78]))
    expect(prot).toEqual({ calpag: false, daq: false, stim: false, pgm: true })
  })

  it('download / shortDownload / modifyBits', async () => {
    const { master, mock } = connectedMaster()
    mock.pushResponse(DEFAULT_CONNECT_RESPONSE)
    await master.connect()

    mock.pushResponse('FF')
    await master.download([0xca, 0xfe, 0xba, 0xbe])
    expect(mock.last).toEqual(bytes([0xf0, 0x04, 0xca, 0xfe, 0xba, 0xbe]))

    mock.pushResponse('FF')
    await master.shortDownload(0x12345678, 0x55, [0xca, 0xfe, 0xba, 0xbe])
    expect(mock.last).toEqual(
      bytes([0xed, 0x04, 0x00, 0x55, 0x78, 0x56, 0x34, 0x12, 0xca, 0xfe, 0xba, 0xbe])
    )

    mock.pushResponse('FF')
    await master.modifyBits(0xff, 0x1234, 0xabcd)
    expect(mock.last).toEqual(bytes([0xec, 0xff, 0x34, 0x12, 0xcd, 0xab]))
  })

  it('DAQ configuration sequence', async () => {
    const { master, mock } = connectedMaster()
    mock.pushResponse(DEFAULT_CONNECT_RESPONSE)
    await master.connect()

    mock.pushResponse('FF')
    await master.setDaqPtr(2, 3, 4)
    expect(mock.last).toEqual(bytes([0xe2, 0x00, 0x02, 0x00, 0x03, 0x04]))

    mock.pushResponse('FF')
    await master.writeDaq(31, 15, 1, 0x12345678)
    expect(mock.last).toEqual(bytes([0xe1, 0x1f, 0x0f, 0x01, 0x78, 0x56, 0x34, 0x12]))

    mock.pushResponse('FF')
    await master.setDaqListMode(0x3b, 256, 512, 1, 0xff)
    expect(mock.last).toEqual(bytes([0xe0, 0x3b, 0x00, 0x01, 0x00, 0x02, 0x01, 0xff]))

    mock.pushResponse('FF 00')
    const ss = await master.startStopDaqList(1, 512)
    expect(mock.last).toEqual(bytes([0xde, 0x01, 0x00, 0x02]))
    expect(ss.firstPid).toBe(0)

    mock.pushResponse('FF')
    await master.startStopSynch(3)
    expect(mock.last).toEqual(bytes([0xdd, 0x03]))

    mock.pushResponse('FF 00 03 04 78 56 34 12')
    const ts = await master.getDaqClock()
    expect(mock.last).toEqual(bytes([0xdc]))
    expect(ts).toBe(0x12345678)
  })

  it('PGM sequence', async () => {
    const { master, mock } = connectedMaster()
    mock.pushResponse(DEFAULT_CONNECT_RESPONSE)
    await master.connect()

    mock.pushResponse('FF 00 01 08 2A FF 55')
    await master.programStart()
    expect(mock.last).toEqual(bytes([0xd2]))

    mock.pushResponse('FF')
    await master.programClear(0x00, 0xa0000100)
    expect(mock.last).toEqual(bytes([0xd1, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0xa0]))

    mock.pushResponse('FF')
    await master.program(4, [0x01, 0x02, 0x03, 0x04])
    expect(mock.last).toEqual(bytes([0xd0, 0x04, 0x01, 0x02, 0x03, 0x04]))

    mock.pushResponse('FF')
    await master.programReset()
    expect(mock.last).toEqual(bytes([0xcf]))

    mock.pushResponse('FF')
    await master.programVerify(0x01, 0x0004, 0xcafebabe)
    expect(mock.last).toEqual(bytes([0xc8, 0x01, 0x04, 0x00, 0xbe, 0xba, 0xfe, 0xca]))
  })

  it('propagates slave ERR responses as XcpError', async () => {
    const { master, mock } = connectedMaster()
    mock.pushResponse(DEFAULT_CONNECT_RESPONSE)
    await master.connect()
    mock.pushResponse('FE 22') // ERR_OUT_OF_RANGE
    await expect(master.upload(8)).rejects.toBeInstanceOf(P.XcpError)
  })
})
