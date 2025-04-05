import peak from './../build/Release/peak.node'
import {
  CanAddr,
  CanDevice,
  CAN_ADDR_FORMAT,
  CAN_ADDR_TYPE,
  CAN_ID_TYPE,
  calcCanIdNormalFixed,
  calcCanIdMixed,
  addrToId,
  swapAddr,
  CanMsgType,
  CAN_ERROR_ID,
  CanError,
  getLenByDlc,
  CanBaseInfo,
  getTsUs,
  CanMessage
} from '../../share/can'
import { EventEmitter } from 'events'
import { queue, QueueObject } from 'async'
import { v4 } from 'uuid'
import { TpError, CanTp, TP_ERROR_ID } from '../cantp'
import { CanLOG } from '../../log'
import { CanBase } from '../base'
const allDevice: Record<string, number> = {
  PCAN_NONEBUS: peak.PCAN_NONEBUS,
  //   PCAN_ISABUS1: peak.PCAN_ISABUS1,
  //   PCAN_ISABUS2: peak.PCAN_ISABUS2,
  //   PCAN_ISABUS3: peak.PCAN_ISABUS3,
  //   PCAN_ISABUS4: peak.PCAN_ISABUS4,
  //   PCAN_ISABUS5: peak.PCAN_ISABUS5,
  //   PCAN_ISABUS6: peak.PCAN_ISABUS6,
  //   PCAN_ISABUS7: peak.PCAN_ISABUS7,
  //   PCAN_ISABUS8: peak.PCAN_ISABUS8,
  //   PCAN_DNGBUS1: peak.PCAN_DNGBUS1,
  PCAN_PCIBUS1: peak.PCAN_PCIBUS1,
  PCAN_PCIBUS2: peak.PCAN_PCIBUS2,
  PCAN_PCIBUS3: peak.PCAN_PCIBUS3,
  PCAN_PCIBUS4: peak.PCAN_PCIBUS4,
  PCAN_PCIBUS5: peak.PCAN_PCIBUS5,
  PCAN_PCIBUS6: peak.PCAN_PCIBUS6,
  PCAN_PCIBUS7: peak.PCAN_PCIBUS7,
  PCAN_PCIBUS8: peak.PCAN_PCIBUS8,
  PCAN_PCIBUS9: peak.PCAN_PCIBUS9,
  PCAN_PCIBUS10: peak.PCAN_PCIBUS10,
  PCAN_PCIBUS11: peak.PCAN_PCIBUS11,
  PCAN_PCIBUS12: peak.PCAN_PCIBUS12,
  PCAN_PCIBUS13: peak.PCAN_PCIBUS13,
  PCAN_PCIBUS14: peak.PCAN_PCIBUS14,
  PCAN_PCIBUS15: peak.PCAN_PCIBUS15,
  PCAN_PCIBUS16: peak.PCAN_PCIBUS16,
  PCAN_USBBUS1: peak.PCAN_USBBUS1,
  PCAN_USBBUS2: peak.PCAN_USBBUS2,
  PCAN_USBBUS3: peak.PCAN_USBBUS3,
  PCAN_USBBUS4: peak.PCAN_USBBUS4,
  PCAN_USBBUS5: peak.PCAN_USBBUS5,
  PCAN_USBBUS6: peak.PCAN_USBBUS6,
  PCAN_USBBUS7: peak.PCAN_USBBUS7,
  PCAN_USBBUS8: peak.PCAN_USBBUS8,
  PCAN_USBBUS9: peak.PCAN_USBBUS9,
  PCAN_USBBUS10: peak.PCAN_USBBUS10,
  PCAN_USBBUS11: peak.PCAN_USBBUS11,
  PCAN_USBBUS12: peak.PCAN_USBBUS12,
  PCAN_USBBUS13: peak.PCAN_USBBUS13,
  PCAN_USBBUS14: peak.PCAN_USBBUS14,
  PCAN_USBBUS15: peak.PCAN_USBBUS15,
  PCAN_USBBUS16: peak.PCAN_USBBUS16,
  PCAN_PCCBUS1: peak.PCAN_PCCBUS1,
  PCAN_PCCBUS2: peak.PCAN_PCCBUS2,
  PCAN_LANBUS1: peak.PCAN_LANBUS1,
  PCAN_LANBUS2: peak.PCAN_LANBUS2,
  PCAN_LANBUS3: peak.PCAN_LANBUS3,
  PCAN_LANBUS4: peak.PCAN_LANBUS4,
  PCAN_LANBUS5: peak.PCAN_LANBUS5,
  PCAN_LANBUS6: peak.PCAN_LANBUS6,
  PCAN_LANBUS7: peak.PCAN_LANBUS7,
  PCAN_LANBUS8: peak.PCAN_LANBUS8,
  PCAN_LANBUS9: peak.PCAN_LANBUS9,
  PCAN_LANBUS10: peak.PCAN_LANBUS10,
  PCAN_LANBUS11: peak.PCAN_LANBUS11,
  PCAN_LANBUS12: peak.PCAN_LANBUS12,
  PCAN_LANBUS13: peak.PCAN_LANBUS13,
  PCAN_LANBUS14: peak.PCAN_LANBUS14,
  PCAN_LANBUS15: peak.PCAN_LANBUS15,
  PCAN_LANBUS16: peak.PCAN_LANBUS16
}

function buf2str(buf: Buffer) {
  const nullCharIndex = buf.indexOf(0) // 0 是 '\0' 的 ASCII 码
  if (nullCharIndex === -1) {
    return buf.toString('utf8')
  }
  return buf.toString('utf8', 0, nullCharIndex)
}
function err2str(err: number, lang = 0x9) {
  const buf = Buffer.alloc(1024)
  peak.CANTP_GetErrorText_2016(err, lang, buf)

  return buf2str(buf)
}

function statusIsOk(status: number, strict = true): boolean {
  return peak.CANTP_StatusIsOk_2016(status, peak.PCANTP_STATUS_OK, strict)
}

class PeakNetAddr {
  _msg: any
  constructor(_msg?: any) {
    if (_msg) {
      this._msg = _msg
    } else {
      this._msg = new peak.cantp_netaddrinfo()
    }
  }
  get msgtype() {
    return this._msg.msgtype
  }
  set msgtype(value) {
    this._msg.msgtype = value
  }
  get format() {
    return this._msg.format
  }
  set format(value) {
    this._msg.format = value
  }
  get target_type() {
    return this._msg.target_type
  }
  set target_type(value) {
    this._msg.target_type = value
  }
  get source_addr() {
    return this._msg.source_addr
  }
  set source_addr(value) {
    this._msg.source_addr = value
  }
  get target_addr() {
    return this._msg.target_addr
  }
  set target_addr(value) {
    this._msg.target_addr = value
  }
  get extension_addr() {
    return this._msg.extension_addr
  }
  set extension_addr(value) {
    this._msg.extension_addr = value
  }
  toString() {
    const val = {
      format: this.format,
      target_type: this.target_type,
      source_addr: this.source_addr,
      target_addr: this.target_addr,
      extension_addr: this.extension_addr
    }
    if (
      val.format == peak.PCANTP_ISOTP_FORMAT_NORMAL ||
      val.format == peak.PCANTP_ISOTP_FORMAT_FIXED_NORMAL
    ) {
      val.extension_addr = 0
    }

    return JSON.stringify(val)
  }
}
function convert2PeakAddr(addr: CanAddr): PeakNetAddr {
  const netAddr = new PeakNetAddr()
  if (addr.addrFormat == CAN_ADDR_FORMAT.MIXED) {
    netAddr.msgtype = peak.PCANTP_ISOTP_MSGTYPE_REMOTE_DIAGNOSTIC
  } else {
    netAddr.msgtype = peak.PCANTP_ISOTP_MSGTYPE_DIAGNOSTIC
  }
  switch (addr.addrFormat) {
    case 'NORMAL':
      netAddr.format = peak.PCANTP_ISOTP_FORMAT_NORMAL
      break
    case 'NORMAL_FIXED':
      netAddr.format = peak.PCANTP_ISOTP_FORMAT_FIXED_NORMAL
      break
    case 'EXTENDED':
      netAddr.format = peak.PCANTP_ISOTP_FORMAT_EXTENDED
      break
    case 'MIXED':
      netAddr.format = peak.PCANTP_ISOTP_FORMAT_MIXED
      break
    case 'ENHANCED':
      netAddr.format = peak.PCANTP_ISOTP_FORMAT_ENHANCED
      break
    default:
      throw new Error(`unsupported address format ${addr.addrFormat}`)
  }
  netAddr.target_type =
    addr.addrType == 'PHYSICAL'
      ? peak.PCANTP_ISOTP_ADDRESSING_PHYSICAL
      : peak.PCANTP_ISOTP_ADDRESSING_FUNCTIONAL
  netAddr.source_addr = Number(addr.SA)
  netAddr.target_addr = Number(addr.TA)
  netAddr.extension_addr = Number(addr.AE)

  return netAddr
}

// function convert2CanAddr(msg:any):CanAddr{
//     let addr:CAN_ADDR_FORMAT
//     switch(msg.format){
//         case peak.PCANTP_ISOTP_FORMAT_NORMAL:
//             addr= CAN_ADDR_FORMAT.NORMAL
//             break
//         case peak.PCANTP_ISOTP_FORMAT_FIXED_NORMAL:
//             addr= CAN_ADDR_FORMAT.FIXED_NORMAL
//             break
//         case peak.PCANTP_ISOTP_FORMAT_EXTENDED:
//             addr= CAN_ADDR_FORMAT.EXTENDED
//             break
//         case peak.PCANTP_ISOTP_FORMAT_MIXED:
//             addr= CAN_ADDR_FORMAT.MIXED
//             break
//         case peak.PCANTP_ISOTP_FORMAT_ENHANCED:
//             addr= CAN_ADDR_FORMAT.ENHANCED
//             break
//         default:
//             throw new Error(`unsupported address format ${msg.format}`)
//     }
//     const target_type:CAN_ADDR_TYPE= msg.target_type==peak.PCANTP_ISOTP_ADDRESSING_PHYSICAL?CAN_ADDR_TYPE.PHYSICAL:CAN_ADDR_TYPE.FUNCTIONAL
//     return {
//         msgType:msg.msgtype,
//         addrFormat:addr,
//         addrType:target_type,
//         SA:msg.source_addr,
//         TA:msg.target_addr,
//         AE:msg.extension_addr
//     }
// }

export class CAN_MSG_BASE {
  msg: any
  constructor(_msg: any) {
    this.msg = _msg
  }
  get flags() {
    return this.msg.flags
  }
  get length() {
    return this.msg.length
  }
  get data() {
    const len = this.msg.length
    const buf = Buffer.alloc(len)
    const b = peak.ByteArray.frompointer(this.msg.data)

    for (let i = 0; i < len; i++) {
      buf[i] = b.getitem(i)
    }
    return buf
  }
  get netstatus() {
    return this.msg.netstatus
  }
}

export class CAN_MSG_ANY extends CAN_MSG_BASE {
  constructor(_msg?: any) {
    if (_msg) {
      super(_msg)
    } else {
      super(new peak.cantp_msgdata())
    }
  }
}

export class CAN_MSG_ISOTP extends CAN_MSG_BASE {
  netaddrinfo: PeakNetAddr
  constructor(_msg?: any) {
    if (_msg) {
      super(_msg)
      this.netaddrinfo = new PeakNetAddr(this.msg.netaddrinfo)
    } else {
      super(new peak.cantp_msgdata_isotp())
      this.netaddrinfo = new PeakNetAddr()
    }
  }
}

export class CAN_MSG_FRAME extends CAN_MSG_BASE {
  constructor(_msg?: any) {
    if (_msg) {
      super(_msg)
    } else {
      super(new peak.cantp_msgdata_isotp())
    }
  }
}

export class CAN_MSG {
  msg: any
  constructor(_msg?: any) {
    if (_msg) {
      this.msg = _msg
    } else {
      this.msg = new peak.cantp_msg()
    }
  }
  get type() {
    return this.msg.type
  }
  get canInfo() {
    return {
      dlc: this.msg.can_info.dlc,
      canId: this.msg.can_info.can_id,
      canMsgType: this.msg.can_info.can_msgtype
    }
  }
  get() {
    if (this.msg.type == peak.PCANTP_MSGTYPE_ISOTP) {
      return new CAN_MSG_ISOTP(peak.GetMsgDataIsoTp(this.msg))
    } else if (this.msg.type == peak.PCANTP_MSGTYPE_FRAME) {
      return new CAN_MSG_FRAME(peak.GetMsgDataCan(this.msg))
    } else {
      return new CAN_MSG_ANY(peak.GetMsgDataAny(this.msg))
    }
  }
}

export class PEAK_TP extends CanBase implements CanTp {
  id: string
  info: CanBaseInfo
  handle: number
  log: CanLOG
  event = new EventEmitter()
  mapping = new Map<string, number>()
  private readAbort = new AbortController()
  pendingCmds = new Map<
    string,
    {
      resolve: (value: number) => void
      reject: (reason: TpError) => void
      addr: CanAddr
      data: Buffer
      msg: any
    }
  >()
  pendingBaseCmds = new Map<
    string,
    {
      resolve: (value: number) => void
      reject: (reason: CanError) => void
      msgType: CanMsgType
      data: Buffer
      msg: any
      extra?: { database?: string; name?: string }
    }[]
  >()
  writeQueueMap = new Map<
    string,
    QueueObject<{
      addr: CanAddr
      data: Buffer
      resolve: (ts: number) => void
      reject: (err: TpError) => void
    }>
  >()
  rejectMap = new Map<
    number,
    {
      reject: (reason: TpError) => void
      addr: CanAddr
    }
  >()
  rejectBaseMap = new Map<
    number,
    {
      reject: (reason: CanError) => void
      msgType: CanMsgType
    }
  >()
  cnt = 0
  startTime = getTsUs()
  tsOffset: number | undefined
  // recvTpQueue = new Map<string, ({ data: Buffer, ts: number } | TpError)[]>()
  // recvTpPending = new Map<string, { resolve: (value: { data: Buffer, ts: number }) => void, reject: (reason: TpError) => void }>()
  closed = false
  constructor(baseInfo: CanBaseInfo) {
    super()
    this.info = baseInfo
    this.handle = baseInfo.handle
    const devices = PEAK_TP.getValidDevices()
    //init
    let str = `f_clock_mhz=${this.info.bitrate.clock},nom_brp=${this.info.bitrate.preScaler},nom_tseg1=${this.info.bitrate.timeSeg1},nom_tseg2=${this.info.bitrate.timeSeg2},nom_sjw=${this.info.bitrate.sjw}`
    if (this.info.canfd && this.info.bitratefd) {
      str +=
        ',' +
        `data_brp=${this.info.bitratefd.preScaler},data_tseg1=${this.info.bitratefd.timeSeg1},data_tseg2=${this.info.bitratefd.timeSeg2},data_sjw=${this.info.bitratefd.sjw}`
    }
    // console.log(str)
    this.id = this.info.id
    let ret = peak.CANTP_InitializeFD_2016(this.handle, str)
    if (ret != 0) {
      if (ret == -2013265920) {
        //calcuate real freq
        this.info.bitrate.freq =
          (Number(this.info.bitrate.clock || 40) * 1000000) /
          (this.info.bitrate.preScaler *
            (this.info.bitrate.timeSeg1 + this.info.bitrate.timeSeg2 + 1))
        //try init with normal
        let baud = peak.PCANTP_BAUDRATE_500K
        switch (this.info.bitrate.freq) {
          case 1000000:
            baud = peak.PCANTP_BAUDRATE_1M
            break
          case 800000:
            baud = peak.PCANTP_BAUDRATE_800K
            break
          case 500000:
            baud = peak.PCANTP_BAUDRATE_500K
            break
          case 250000:
            baud = peak.PCANTP_BAUDRATE_250K
            break
          case 125000:
            baud = peak.PCANTP_BAUDRATE_125K
            break
          case 100000:
            baud = peak.PCANTP_BAUDRATE_100K
            break
          default:
            throw `SJA1000 does not support ${this.info.bitrate.freq} baudrate`
        }

        ret = peak.CANTP_Initialize_2016(this.handle, baud, 0, 0, 0)
        if (ret != 0) {
          throw new Error(err2str(ret))
        }
      } else {
        throw new Error(err2str(ret))
      }
    }

    const targetDevice = devices.find((item) => item.handle == this.handle)
    if (targetDevice == undefined) {
      throw new Error('device not found')
    }
    this.log = new CanLOG('PEAK', this.info.name, this.event)
    peak.CreateTSFN(this.handle, this.id, this.callback.bind(this))

    const buf = Buffer.alloc(1)

    // buf[0] = Number(baseInfo.dlc)
    // if (Number(baseInfo.dlc) >= 8 && Number(baseInfo.dlc) <= 15) {
    //   ret = peak.CANTP_SetValue_2016(this.handle, peak.PCANTP_PARAMETER_CAN_TX_DL, buf)
    //   if (ret != 0) {
    //     throw new Error(err2str(ret))
    //   }
    // }
    buf[0] = 1
    ret = peak.CANTP_SetValue_2016(this.handle, peak.PCANTP_PARAMETER_ALLOW_MSGTYPE_CANINFO, buf)
    if (ret != 0) {
      throw new Error(err2str(ret))
    }
    // buf[0] = 1
    // ret = peak.CANTP_SetValue_2016(this.handle, peak.PCAN_BUSOFF_AUTORESET, buf)
    // if (ret != 0) {
    //   throw new Error(err2str(ret))
    // }
    // if (baseInfo.padding) {
    //   buf[0] = 1
    // } else {
    //   buf[0] = 0
    // }
    // ret = peak.CANTP_SetValue_2016(this.handle, peak.PCANTP_PARAMETER_CAN_DATA_PADDING, buf)
    // if (ret != 0) {
    //   throw new Error(err2str(ret))
    // }
    // if (baseInfo.padding) {
    //   buf[0] = Number(baseInfo.paddingValue)
    //   ret = peak.CANTP_SetValue_2016(this.handle, peak.PCANTP_PARAMETER_CAN_PADDING_VALUE, buf)
    //   if (ret != 0) {
    //     throw new Error(err2str(ret))
    //   }
    // }
    this.setOption('PEAK:PCANTP_PARAMETER_SUPPORT_29B_FIXED_NORMAL', 0)
    this.setOption('PEAK:PCANTP_PARAMETER_SUPPORT_29B_MIXED', 0)
  }
  reset() {
    const buf = Buffer.alloc(1)
    buf[0] = 1
    peak.CANTP_SetValue_2016(this.handle, peak.PCANTP_PARAMETER_RESET_HARD, buf)
  }
  static getValidDevices() {
    const devices: CanDevice[] = []
    if (process.platform == 'win32') {
      const buf = Buffer.alloc(1)
      for (const label of Object.keys(allDevice)) {
        const result = peak.CANTP_GetValue_2016(
          allDevice[label],
          peak.PCANTP_PARAMETER_CHANNEL_CONDITION,
          buf
        )
        if (result === 0) {
          if (buf[0] == peak.PCANTP_CHANNEL_AVAILABLE) {
            devices.push({
              label: label,
              id: label,
              handle: allDevice[label],
              busy: false
            })
          } else if (buf[0] == (peak.PCANTP_CHANNEL_AVAILABLE | peak.PCANTP_CHANNEL_OCCUPIED)) {
            devices.push({
              label: label,
              id: label,
              handle: allDevice[label],
              busy: true
            })
          }
        }
      }
    }
    //sort by handle
    return devices.sort((a, b) => a.handle - b.handle)
  }
  static getLibVersion() {
    if (process.platform == 'win32') {
      const buf = Buffer.alloc(1024)
      const result = peak.CANTP_GetValue_2016(0, peak.PCANTP_PARAMETER_API_VERSION, buf)
      if (result == 0) {
        return buf2str(buf)
      } else {
        throw new Error(err2str(result))
      }
    } else {
      return 'only support windows'
    }
  }
  static loadDllPath(dllPath: string) {
    if (process.platform == 'win32') {
      peak.LoadDll(dllPath)
    }
  }
  setOption(option: string, value: any) {
    if (option.startsWith('PEAK:')) {
      const buf = Buffer.alloc(1)
      if (value) {
        buf[0] = 1
      } else {
        buf[0] = 0
      }
      const param = peak[option.split(':')[1]]
      if (param == undefined) {
        throw new Error('invalid option')
      }
      const ret = peak.CANTP_SetValue_2016(this.handle, param, buf)
      if (ret != 0) {
        throw new Error(err2str(ret))
      }
    }
  }
  close(isReset = false, msg?: string) {
    try {
      this.readAbort.abort()
      for (const [key, value] of this.pendingCmds) {
        peak.CANTP_MsgDataFree_2016(value.msg)
        value.reject(
          new TpError(
            isReset ? TP_ERROR_ID.TP_BUS_ERROR : TP_ERROR_ID.TP_BUS_CLOSED,
            value.addr,
            value.data,
            msg
          )
        )
      }
      this.pendingCmds.clear()
      for (const [key, value] of this.rejectMap) {
        value.reject(
          new TpError(
            isReset ? TP_ERROR_ID.TP_BUS_ERROR : TP_ERROR_ID.TP_BUS_CLOSED,
            value.addr,
            undefined,
            msg
          )
        )
      }
      this.rejectMap.clear()
      //handle writeQueueMap
      for (const [key, value] of this.writeQueueMap) {
        const list = value.workersList()
        for (const item of list) {
          item.data.reject(
            new TpError(
              isReset ? TP_ERROR_ID.TP_BUS_ERROR : TP_ERROR_ID.TP_BUS_CLOSED,
              item.data.addr,
              undefined,
              msg
            )
          )
        }
      }
      this.writeQueueMap.clear()
      for (const [key, value] of this.rejectBaseMap) {
        value.reject(
          new CanError(
            isReset ? CAN_ERROR_ID.CAN_BUS_ERROR : CAN_ERROR_ID.CAN_BUS_CLOSED,
            value.msgType,
            undefined,
            msg
          )
        )
      }
      this.rejectBaseMap.clear()
      //pendingBaseCmds
      for (const [key, values] of this.pendingBaseCmds) {
        for (const value of values) {
          peak.CANTP_MsgDataFree_2016(value.msg)
          value.reject(
            new CanError(
              isReset ? CAN_ERROR_ID.CAN_BUS_ERROR : CAN_ERROR_ID.CAN_BUS_CLOSED,
              value.msgType,
              undefined,
              msg
            )
          )
        }
      }
      this.pendingBaseCmds.clear()

      if (!isReset) {
        this.closed = true
        this.log.close()
        peak.CANTP_Uninitialize_2016(this.handle)
        peak.FreeTSFN(this.id)
        this.event.emit('close', msg)
      } else {
        this.reset()
      }
    } catch (e) {
      null
    }
  }
  callback() {
    this._read()
  }

  _read(): void {
    {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const msg = new CAN_MSG()
        // peak.CANTP_MsgDataAlloc_2016(msg.msg, peak.PCANTP_MSGTYPE_ANY)
        // Reads the first message in the queue.
        const tsClass = new peak.TimeStamp()
        const result = peak.CANTP_Read_2016(
          this.handle,
          msg.msg,
          tsClass.cast(),
          peak.PCANTP_MSGTYPE_ANY
        )
        let ts = tsClass.value()
        if (this.tsOffset == undefined) {
          this.tsOffset = ts - (getTsUs() - this.startTime)
        }
        ts = ts - this.tsOffset
        // if (result & (peak.PCANTP_STATUS_MASK_BUS)) {

        //   const status = peak.CANTP_GetCanBusStatus_2016(this.handle)
        //   if (status != peak.PCANTP_STATUS_OK) {
        //     peak.CANTP_MsgDataFree_2016(msg.msg)
        //     this.busErrorHandle(status)
        //     return
        //   }
        // }
        if (!peak.CANTP_StatusIsOk_2016(result)) {
          return
        }
        if (result == peak.PCANTP_STATUS_NO_MESSAGE) {
          //free
          peak.CANTP_MsgDataFree_2016(msg.msg)
          return
        } else if (result == peak.PCANTP_STATUS_OK) {
          if ((msg.type & peak.PCANTP_MSGTYPE_ISOTP) == peak.PCANTP_MSGTYPE_ISOTP) {
            const isotp = msg.get() as CAN_MSG_ISOTP
            const addr = isotp.netaddrinfo

            const flags = isotp.flags
            //tx confirm
            if (flags == peak.PCANTP_MSGFLAG_LOOPBACK) {
              const id = `write-${msg.canInfo.canId}-${msg.canInfo.canMsgType}-${addr.toString()}`
              const item = this.pendingCmds.get(id)

              if (item) {
                if (
                  (addr.msgtype & peak.PCANTP_ISOTP_MSGTYPE_FLAG_INDICATION_TX) ==
                  peak.PCANTP_ISOTP_MSGTYPE_FLAG_INDICATION_TX
                ) {
                  const progress = new peak.cantp_msgprogress()
                  const res = peak.CANTP_GetMsgProgress_2016(
                    this.handle,
                    item.msg,
                    peak.PCANTP_MSGDIRECTION_TX,
                    progress
                  )
                  if (res == 0) {
                    if (progress.state == peak.PCANTP_MSGPROGRESS_STATE_COMPLETED) {
                      // this.emit('sendTp', {
                      //   data: isotp.data,
                      //   ts: ts,
                      //   id: msg.canInfo.canId,
                      //   idType:
                      //     msg.canInfo.canMsgType & peak.PCANTP_CAN_MSGTYPE_EXTENDED
                      //       ? CAN_ID_TYPE.EXTENDED
                      //       : CAN_ID_TYPE.STANDARD,
                      //   canfd: (msg.canInfo.canMsgType & peak.PCANTP_CAN_MSGTYPE_FD) != 0,
                      //   brs: (msg.canInfo.canMsgType & peak.PCANTP_CAN_MSGTYPE_BRS) != 0,
                      //   remote: (msg.canInfo.canMsgType & peak.PCANTP_CAN_MSGTYPE_RTR) != 0
                      // })

                      item.resolve(ts)
                      peak.CANTP_MsgDataFree_2016(item.msg)
                      this.pendingCmds.delete(id)
                      setImmediate(this.callback.bind(this))
                      return
                    }
                  }
                } else {
                  //return timestamp
                  item.resolve(ts)
                  peak.CANTP_MsgDataFree_2016(item.msg)
                  this.pendingCmds.delete(id)
                }
              }
            }
            //recevied a frame
            else {
              let finished = false
              let rts = 0

              if (
                (addr.msgtype & peak.PCANTP_ISOTP_MSGTYPE_FLAG_INDICATION_RX) ==
                peak.PCANTP_ISOTP_MSGTYPE_FLAG_INDICATION_RX
              ) {
                const progress = new peak.cantp_msgprogress()
                const res = peak.CANTP_GetMsgProgress_2016(
                  this.handle,
                  msg.msg,
                  peak.PCANTP_MSGDIRECTION_RX,
                  progress
                )
                if (res == 0) {
                  if (progress.state == peak.PCANTP_MSGPROGRESS_STATE_COMPLETED) {
                    peak.CANTP_MsgDataFree_2016(msg.msg)
                  }
                }
              } else {
                finished = true
                rts = ts
              }
              if (finished) {
                const id = `read-${msg.canInfo.canId}-${msg.canInfo.canMsgType}-${addr.toString()}`
                this.event.emit(id, { data: isotp.data, ts: rts })
              }
            }
          } else if ((msg.type & peak.PCANTP_MSGTYPE_FRAME) != 0) {
            const frame = msg.get() as CAN_MSG_FRAME
            const flags = frame.flags
            if (flags == peak.PCANTP_MSGFLAG_LOOPBACK) {
              const canId = msg.canInfo.canId
              const id = `writeBase-${canId}-${msg.canInfo.canMsgType}`
              const items = this.pendingBaseCmds.get(id)

              if (items) {
                const item = items.shift()!
                //tx notification, item always exists
                peak.CANTP_MsgDataFree_2016(item.msg)
                if (items.length == 0) {
                  this.pendingBaseCmds.delete(id)
                }
                const message: CanMessage = {
                  dir: 'OUT',
                  id: msg.canInfo.canId,
                  data: frame.data,
                  ts: ts,
                  database: item.extra?.database,
                  name: item.extra?.name,
                  msgType: {
                    canfd: (msg.canInfo.canMsgType & peak.PCANTP_CAN_MSGTYPE_FD) != 0,
                    brs: (msg.canInfo.canMsgType & peak.PCANTP_CAN_MSGTYPE_BRS) != 0,
                    remote: (msg.canInfo.canMsgType & peak.PCANTP_CAN_MSGTYPE_RTR) != 0,
                    idType:
                      msg.canInfo.canMsgType & peak.PCANTP_CAN_MSGTYPE_EXTENDED
                        ? CAN_ID_TYPE.EXTENDED
                        : CAN_ID_TYPE.STANDARD,
                    uuid: item.msgType.uuid
                  },
                  device: this.info.name
                }
                this.log.canBase(message)
                this.event.emit(this.getReadBaseId(msg.canInfo.canId, message.msgType), message)

                item.resolve(ts)
                setImmediate(this.callback.bind(this))
                return
              }
            } else {
              //rx notification
              const id = `readBase-${msg.canInfo.canId}-${msg.canInfo.canMsgType}`
              const message: CanMessage = {
                dir: 'IN',
                id: msg.canInfo.canId,
                data: frame.data,
                ts: ts,
                msgType: {
                  canfd: (msg.canInfo.canMsgType & peak.PCANTP_CAN_MSGTYPE_FD) != 0,
                  brs: (msg.canInfo.canMsgType & peak.PCANTP_CAN_MSGTYPE_BRS) != 0,
                  remote: (msg.canInfo.canMsgType & peak.PCANTP_CAN_MSGTYPE_RTR) != 0,
                  idType:
                    msg.canInfo.canMsgType & peak.PCANTP_CAN_MSGTYPE_EXTENDED
                      ? CAN_ID_TYPE.EXTENDED
                      : CAN_ID_TYPE.STANDARD
                },
                device: this.info.name,
                database: this.info.database
              }
              //log must before emit
              this.log.canBase(message)
              this.event.emit(id, message)

              setImmediate(this.callback.bind(this))
              return
            }
          }
        } else {
          //error handle
          if ((msg.type & peak.PCANTP_MSGTYPE_CANINFO) == peak.PCANTP_MSGTYPE_CANINFO) {
            this.log.error(ts, 'bus error')
            this.close(true)
          }
        }
        peak.CANTP_MsgDataFree_2016(msg.msg)
      }
    }
  }
  _writeTp(addr: CanAddr, data: Buffer, netAddr: PeakNetAddr, cmdId: string, msgType: number) {
    return new Promise<number>(
      (resolve: (value: number) => void, reject: (reason: TpError) => void) => {
        let res = 0
        const msg = new peak.cantp_msg()

        res = peak.CANTP_MsgDataAlloc_2016(msg, peak.PCANTP_MSGTYPE_ISOTP)
        if (res != 0) {
          reject(new TpError(TP_ERROR_ID.TP_INTERNAL_ERROR, addr, data, err2str(res)))
          return
        }

        msg.can_info.dlc = 0
        msg.can_info.can_msgtype = 0
        msg.can_info.can_id = 0

        res = peak.CANTP_MsgDataInit_2016(msg, Number(addr.canIdTx), msgType, data, netAddr._msg)
        if (res != 0) {
          peak.CANTP_MsgDataFree_2016(msg)
          reject(new TpError(TP_ERROR_ID.TP_INTERNAL_ERROR, addr, data, err2str(res)))
          return
        }

        const item = this.pendingCmds.get(cmdId)
        if (item) {
          peak.CANTP_MsgDataFree_2016(msg)
          reject(new TpError(TP_ERROR_ID.TP_BUS_BUSY, addr, data))
          return
        } else {
          this.pendingCmds.set(cmdId, { resolve, reject, msg, data, addr })
        }
        //add mapping
        //swap source address and target address txid and rxid
        const cloneAddr = swapAddr(addr)
        this.addMapping(cloneAddr)
        res = peak.CANTP_Write_2016(this.handle, msg)
        if (!statusIsOk(res, false)) {
          this.pendingCmds.delete(cmdId)
          peak.CANTP_MsgDataFree_2016(msg)
          reject(new TpError(TP_ERROR_ID.TP_INTERNAL_ERROR, addr, data, err2str(res)))
        }
      }
    )
  }
  writeTp(addr: CanAddr, data: Buffer) {
    //TODO:apply time
    const id = addrToId(addr)
    const { msgType, netAddr } = this.addMapping(addr)
    const cmdId = `write-${id}-${msgType}-${netAddr.toString()}`

    // 检查是否已存在队列
    let q = this.writeQueueMap.get(cmdId)
    if (!q) {
      q = queue<any>((task: { resolve: any; reject: any; data: Buffer }, cb) => {
        this._writeTp(addr, task.data, netAddr, cmdId, msgType)
          .then(task.resolve)
          .catch(task.reject)
          .finally(cb) // 确保队列继续执行
      }, 1) // 并发数设为 1 确保顺序执行

      this.writeQueueMap.set(cmdId, q)

      q.drain(() => {
        this.writeQueueMap.delete(cmdId)
      })
    }
    return new Promise<number>((resolve, reject) => {
      // 将任务推入队列
      q?.push({
        data,
        addr,
        resolve,
        reject
      })
    })
  }
  addMapping(addr: CanAddr) {
    const netAddr = convert2PeakAddr(addr)
    let msgType = 0
    if (addr.idType === 'STANDARD') {
      msgType |= peak.PCANTP_CAN_MSGTYPE_STANDARD
    } else if (addr.idType === 'EXTENDED') {
      msgType |= peak.PCANTP_CAN_MSGTYPE_EXTENDED
    }
    if (addr.canfd) {
      msgType |= peak.PCANTP_CAN_MSGTYPE_FD
      if (addr.brs) {
        msgType |= peak.PCANTP_CAN_MSGTYPE_BRS
      }
    }
    if (addr.remote) {
      msgType |= peak.PCANTP_CAN_MSGTYPE_RTR
    }
    let skipAddMap = false
    if (addr.addrFormat == CAN_ADDR_FORMAT.FIXED_NORMAL) {
      skipAddMap = true
    }
    if (addr.addrFormat == CAN_ADDR_FORMAT.MIXED) {
      if (addr.idType == CAN_ID_TYPE.EXTENDED) {
        skipAddMap = true
      }
    }

    if (!skipAddMap) {
      const mappingId = `${Number(addr.canIdTx)}-${msgType}-${netAddr.toString()}`
      if (!this.mapping.has(mappingId)) {
        const map = new peak.cantp_mapping()
        map.can_id = Number(addr.canIdTx)
        map.can_id_flow_ctrl = Number(addr.canIdRx)
        map.can_msgtype = msgType
        map.netaddrinfo = netAddr._msg
        map.can_tx_dlc = 0
        const res = peak.CANTP_AddMapping_2016(this.handle, map)
        if (!statusIsOk(res, true)) {
          throw new Error(err2str(res))
        }
        this.mapping.set(mappingId, map.uid)
      }
    }

    return { msgType, netAddr }
  }
  removeMapping(addr: CanAddr) {
    let msgType = 0
    if (addr.idType === 'STANDARD') {
      msgType |= peak.PCANTP_CAN_MSGTYPE_STANDARD
    } else if (addr.idType === 'EXTENDED') {
      msgType |= peak.PCANTP_CAN_MSGTYPE_EXTENDED
    }
    if (this.info.canfd) {
      msgType |= peak.PCANTP_CAN_MSGTYPE_FD
    }
    const netAddr = convert2PeakAddr(addr)
    const mappingId = `${Number(addr.canIdTx)}-${msgType}-${Number(addr.canIdRx)}-${netAddr.toString()}`
    const item = this.mapping.get(mappingId)
    if (item) {
      peak.CANTP_RemoveMapping_2016(this.handle, item)
    }
  }
  getReadId(addr: CanAddr) {
    const id = addrToId(addr)
    const { msgType, netAddr } = this.addMapping(addr)
    const cmdId = `read-${id}-${msgType}-${netAddr.toString()}`
    return cmdId
  }
  getReadBaseId(id: number, msgType: CanMsgType) {
    let msgTypeNum = 0
    if (msgType.idType === 'STANDARD') {
      msgTypeNum |= peak.PCANTP_CAN_MSGTYPE_STANDARD
    } else if (msgType.idType === 'EXTENDED') {
      msgTypeNum |= peak.PCANTP_CAN_MSGTYPE_EXTENDED
    }
    if (msgType.canfd) {
      msgTypeNum |= peak.PCANTP_CAN_MSGTYPE_FD
      if (msgType.brs) {
        msgTypeNum |= peak.PCANTP_CAN_MSGTYPE_BRS
      }
    }
    if (msgType.remote) {
      msgTypeNum |= peak.PCANTP_CAN_MSGTYPE_RTR
    }
    return `readBase-${id}-${msgTypeNum}`
  }
  readTp(addr: CanAddr, timeout = 1000) {
    return new Promise<{ data: Buffer; ts: number }>(
      (
        resolve: (value: { data: Buffer; ts: number }) => void,
        reject: (reason: TpError) => void
      ) => {
        const cnt = this.cnt
        this.cnt++
        this.rejectMap.set(cnt, { reject, addr })
        const cmdId = this.getReadId(addr)
        const timeer = setTimeout(() => {
          if (this.rejectMap.has(cnt)) {
            this.rejectMap.delete(cnt)
            reject(new TpError(TP_ERROR_ID.TP_TIMEOUT_UPPER_READ, addr))
          }
          this.event.off(cmdId, cb)
        }, timeout)

        this.readAbort.signal.addEventListener('abort', () => {
          if (this.rejectMap.has(cnt)) {
            this.rejectMap.delete(cnt)
            reject(new TpError(TP_ERROR_ID.TP_BUS_CLOSED, addr))
          }
          this.event.off(cmdId, cb)
        })
        const cb = (val: any) => {
          clearTimeout(timeer)
          if (this.rejectMap.has(cnt)) {
            if (val instanceof TpError) {
              reject(val)
            } else {
              resolve({ data: val.data, ts: val.ts })
            }
            this.rejectMap.delete(cnt)
          }
        }
        this.event.once(cmdId, cb)
      }
    )
  }
  readBase(id: number, msgType: CanMsgType, timeout: number) {
    return new Promise<{ data: Buffer; ts: number }>(
      (
        resolve: (value: { data: Buffer; ts: number }) => void,
        reject: (reason: CanError) => void
      ) => {
        const cmdId = this.getReadBaseId(id, msgType)
        const cnt = this.cnt
        this.cnt++
        this.rejectBaseMap.set(cnt, { reject, msgType })

        this.readAbort.signal.addEventListener('abort', () => {
          if (this.rejectBaseMap.has(cnt)) {
            this.rejectBaseMap.delete(cnt)
            reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, msgType))
          }
          this.event.off(cmdId, readCb)
        })

        const readCb = (val: any) => {
          clearTimeout(timer)
          if (this.rejectBaseMap.has(cnt)) {
            if (val instanceof CanError) {
              reject(val)
            } else {
              resolve({ data: val.data, ts: val.ts })
            }
            this.rejectBaseMap.delete(cnt)
          }
        }
        const timer = setTimeout(() => {
          this.event.off(cmdId, readCb)
          if (this.rejectBaseMap.has(cnt)) {
            this.rejectBaseMap.delete(cnt)
            reject(new CanError(CAN_ERROR_ID.CAN_READ_TIMEOUT, msgType))
          }
        }, timeout)
        this.event.once(cmdId, readCb)
      }
    )
  }
  writeBase(
    id: number,
    msgType: CanMsgType,
    data: Buffer,
    extra?: { database?: string; name?: string }
  ) {
    let msgTypeNum = 0
    if (msgType.idType === 'STANDARD') {
      msgTypeNum |= peak.PCANTP_CAN_MSGTYPE_STANDARD
    } else if (msgType.idType === 'EXTENDED') {
      msgTypeNum |= peak.PCANTP_CAN_MSGTYPE_EXTENDED
    }
    if (msgType.canfd) {
      msgTypeNum |= peak.PCANTP_CAN_MSGTYPE_FD
      if (msgType.brs) {
        msgTypeNum |= peak.PCANTP_CAN_MSGTYPE_BRS
      }
    }
    if (msgType.remote) {
      msgTypeNum |= peak.PCANTP_CAN_MSGTYPE_RTR
    }
    let maxLen = msgType.canfd ? 64 : 8
    if (data.length > maxLen) {
      throw new CanError(CAN_ERROR_ID.CAN_PARAM_ERROR, msgType, data)
    }
    const cmdId = `writeBase-${id}-${msgTypeNum}`

    if (msgType.canfd) {
      //detect data.length range by dlc
      if (data.length > 8 && data.length <= 12) {
        maxLen = 12
      } else if (data.length > 12 && data.length <= 16) {
        maxLen = 16
      } else if (data.length > 16 && data.length <= 20) {
        maxLen = 20
      } else if (data.length > 20 && data.length <= 24) {
        maxLen = 24
      } else if (data.length > 24 && data.length <= 32) {
        maxLen = 32
      } else if (data.length > 32 && data.length <= 48) {
        maxLen = 48
      } else if (data.length > 48) {
        maxLen = 64
      } else {
        maxLen = data.length
      }
      data = Buffer.concat([data, Buffer.alloc(maxLen - data.length).fill(0)])
    }
    return this._writeBase(id, msgType, msgTypeNum, cmdId, data, extra)
  }
  _writeBase(
    id: number,
    msgTypeE: CanMsgType,
    msgType: number,
    cmdId: string,
    data: Buffer,
    extra?: { database?: string; name?: string }
  ) {
    return new Promise<number>(
      (resolve: (value: number) => void, reject: (reason: CanError) => void) => {
        let res = 0
        const msg = new peak.cantp_msg()
        res = peak.CANTP_MsgDataAlloc_2016(
          msg,
          msgTypeE.canfd ? peak.PCANTP_MSGTYPE_CANFD : peak.PCANTP_MSGTYPE_CAN
        )
        if (res != 0) {
          const eStr = err2str(res)
          reject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgTypeE, undefined, eStr))
          this.close(false, eStr)
          return
        }
        res = peak.CANTP_MsgDataInit_2016(msg, id, msgType, data, null)
        if (res != 0) {
          peak.CANTP_MsgDataFree_2016(msg)
          const eStr = err2str(res)
          reject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgTypeE, data, eStr))
          this.close(false, eStr)
          return
        }
        const item = this.pendingBaseCmds.get(cmdId)
        if (item) {
          item.push({ resolve, reject, msg, data, msgType: msgTypeE, extra })
        } else {
          this.pendingBaseCmds.set(cmdId, [
            { resolve, reject, msg, data, msgType: msgTypeE, extra }
          ])
        }
        res = peak.CANTP_Write_2016(this.handle, msg)
        if (!statusIsOk(res, false)) {
          // this.pendingBaseCmds.delete(cmdId)
          // pop last one
          this.pendingBaseCmds.get(cmdId)?.pop()
          peak.CANTP_MsgDataFree_2016(msg)
          const eStr = err2str(res)
          reject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgTypeE, data, eStr))
          this.close(false, eStr)
        }
      }
    )
  }
}
