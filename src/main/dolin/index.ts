import { applyBuffer, getRxPdu, getTxPdu, ServiceItem, UdsDevice } from '../share/uds'
import { PeakLin } from './peak'
import dllLib from '../../../resources/lib/zlgcan.dll?asset&asarUnpack'
import path from 'path'
import {
  getFrameData,
  getPID,
  LinBaseInfo,
  LinChecksumType,
  LinDevice,
  LinDirection,
  LinMode,
  LinMsg
} from '../share/lin'
import { Frame, LDF } from 'src/renderer/src/database/ldfParse'
import EventEmitter from 'events'
import { cloneDeep, isEqual } from 'lodash'
import LinBase from './base'
import { TesterInfo } from '../share/tester'
import { UdsLOG } from '../log'
import UdsTester from '../workerClient'
import fs from 'fs'
import { LIN_TP, TpError } from './lintp'
import { findService } from '../docan/uds'
import { NodeItem } from 'src/preload/data'
import { getJsPath } from '../util'
import { ToomossLin } from './toomoss'
import { KvaserLin } from './kvaser'
import { VectorLin } from './vector'

const libPath = path.dirname(dllLib)
PeakLin.loadDllPath(libPath)
ToomossLin.loadDllPath(libPath)

export function openLinDevice(device: LinBaseInfo) {
  let linBase: LinBase | undefined

  // #v-ifdef IGNORE_NODE!='1'
  if (device.vendor == 'peak') {
    linBase = new PeakLin(device)
  } else if (device.vendor == 'toomoss') {
    linBase = new ToomossLin(device)
  } else if (device.vendor == 'kvaser') {
    linBase = new KvaserLin(device)
  } else if (device.vendor == 'vector') {
    linBase = new VectorLin(device)
  }

  return linBase
}

export function getLinVersion(vendor: string) {
  // #v-ifdef IGNORE_NODE!='1'
  vendor = vendor.toUpperCase()
  if (vendor === 'PEAK') {
    return PeakLin.getLibVersion()
  } else if (vendor === 'TOOMOSS') {
    return ToomossLin.getLibVersion()
  } else if (vendor === 'KVASER') {
    return KvaserLin.getLibVersion()
  } else if (vendor === 'VECTOR') {
    return VectorLin.getLibVersion()
  }
  // #v-endif
  else {
    return 'unknown'
  }
}

export function getLinDevices(vendor: string) {
  vendor = vendor.toUpperCase()
  // #v-ifdef IGNORE_NODE!='1'
  if (vendor === 'PEAK') {
    return PeakLin.getValidDevices()
  } else if (vendor === 'TOOMOSS') {
    return ToomossLin.getValidDevices()
  } else if (vendor === 'KVASER') {
    return KvaserLin.getValidDevices()
  } else if (vendor === 'VECTOR') {
    return VectorLin.getValidDevices()
  }
  // #v-endif
  else {
    return []
  }
}

export function updateSignalVal(db: LDF, signalName: string, value: number | number[] | string) {
  const signal = db.signals[signalName]
  if (signal) {
    //compare value
    const lastValue = signal.value != undefined ? signal.value : signal.initValue
    if (!isEqual(lastValue, value)) {
      signal.update = true
    }
    if (typeof value === 'string') {
      //find in encode
      //TODO:
    } else {
      signal.value = value
    }
  }
}
