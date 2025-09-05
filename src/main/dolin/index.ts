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
import { LinCable } from './ecubus'

const libPath = path.dirname(dllLib)
PeakLin.loadDllPath(libPath)
ToomossLin.loadDllPath(libPath)

export function openLinDevice(device: LinBaseInfo) {
  let linBase: LinBase | undefined
  if (device.vendor == 'peak') {
    linBase = new PeakLin(device)
  } else if (device.vendor == 'toomoss') {
    linBase = new ToomossLin(device)
  } else if (device.vendor == 'kvaser') {
    linBase = new KvaserLin(device)
  } else if (device.vendor == 'vector') {
    linBase = new VectorLin(device)
  } else if (device.vendor == 'ecubus') {
    linBase = new LinCable(device)
  }

  return linBase
}

export function getLinVersion(vendor: string) {
  vendor = vendor.toUpperCase()
  if (vendor === 'PEAK') {
    return PeakLin.getLibVersion()
  } else if (vendor === 'TOOMOSS') {
    return ToomossLin.getLibVersion()
  } else if (vendor === 'KVASER') {
    return KvaserLin.getLibVersion()
  } else if (vendor === 'VECTOR') {
    return VectorLin.getLibVersion()
  } else if (vendor === 'ECUBUS') {
    return LinCable.getLibVersion()
  } else {
    return 'Not supported'
  }
}

export function getLinDevices(vendor: string) {
  vendor = vendor.toUpperCase()
  if (vendor === 'PEAK') {
    return PeakLin.getValidDevices()
  } else if (vendor === 'TOOMOSS') {
    return ToomossLin.getValidDevices()
  } else if (vendor === 'KVASER') {
    return KvaserLin.getValidDevices()
  } else if (vendor === 'VECTOR') {
    return VectorLin.getValidDevices()
  } else if (vendor === 'ECUBUS') {
    return LinCable.getValidDevices()
  } else {
    return []
  }
}
