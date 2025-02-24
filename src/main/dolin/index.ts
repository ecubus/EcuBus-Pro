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

const libPath = path.dirname(dllLib)
PeakLin.loadDllPath(libPath)

export function openLinDevice(device: LinBaseInfo) {
  let linBase: LinBase | undefined

  // #v-ifdef IGNORE_NODE!='1'
  if (device.vendor == 'peak') {
    linBase = new PeakLin(device)
  }

  return linBase
}

export function getLinVersion(vendor: string) {
  // #v-ifdef IGNORE_NODE!='1'
  vendor = vendor.toUpperCase()
  if (vendor === 'PEAK') {
    return PeakLin.getLibVersion()
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
