import { UdsDevice } from '../share/uds'
import { PEAK_TP } from './peak'
import dllLib from '../../../resources/lib/zlgcan.dll?asset&asarUnpack'
import path from 'path'
import { ZLG_CAN } from './zlg'
import { KVASER_CAN } from './kvaser'
import { SIMULATE_CAN } from './simulate'
import { TOOMOSS_CAN } from './toomoss'
import { VECTOR_CAN } from './vector'
import { CanBaseInfo } from '../share/can'
import { CanBase } from './base'
import { SLCAN_CAN } from './slcan'
import { Candle_CAN } from './candle'

const libPath = path.dirname(dllLib)
PEAK_TP.loadDllPath(libPath)
ZLG_CAN.loadDllPath(libPath)
KVASER_CAN.loadDllPath(libPath)
TOOMOSS_CAN.loadDllPath(libPath)
VECTOR_CAN.loadDllPath(libPath)

export function openCanDevice(canDevice: CanBaseInfo) {
  let canBase: CanBase | undefined

  if (canDevice.vendor == 'peak') {
    canBase = new PEAK_TP(canDevice)
  } else if (canDevice.vendor == 'zlg') {
    canBase = new ZLG_CAN(canDevice)
  } else if (canDevice.vendor == 'kvaser') {
    canBase = new KVASER_CAN(canDevice)
  } else if (canDevice.vendor == 'simulate') {
    canBase = new SIMULATE_CAN(canDevice)
  } else if (canDevice.vendor == 'toomoss') {
    canBase = new TOOMOSS_CAN(canDevice)
  } else if (canDevice.vendor == 'vector') {
    canBase = new VECTOR_CAN(canDevice)
  } else if (canDevice.vendor == 'slcan') {
    canBase = new SLCAN_CAN(canDevice)
  } else if (canDevice.vendor == 'candle') {
    canBase = new Candle_CAN(canDevice)
  }

  return canBase
}

export function getCanVersion(vendor: string) {
  vendor = vendor.toUpperCase()
  if (vendor === 'PEAK') {
    return PEAK_TP.getLibVersion()
  } else if (vendor === 'ZLG') {
    return ZLG_CAN.getLibVersion()
  } else if (vendor === 'KVASER') {
    return KVASER_CAN.getLibVersion()
  } else if (vendor === 'SIMULATE') {
    return SIMULATE_CAN.getLibVersion()
  } else if (vendor === 'TOOMOSS') {
    return TOOMOSS_CAN.getLibVersion()
  } else if (vendor === 'VECTOR') {
    return VECTOR_CAN.getLibVersion()
  } else if (vendor === 'SLCAN') {
    return SLCAN_CAN.getLibVersion()
  } else if (vendor === 'CANDLE') {
    return Candle_CAN.getLibVersion()
  } else {
    return 'Not supported'
  }
}

export function getCanDevices(vendor: string) {
  vendor = vendor.toUpperCase()
  if (vendor === 'PEAK') {
    return PEAK_TP.getValidDevices()
  } else if (vendor === 'ZLG') {
    return ZLG_CAN.getValidDevices()
  } else if (vendor === 'KVASER') {
    return KVASER_CAN.getValidDevices()
  } else if (vendor === 'SIMULATE') {
    return SIMULATE_CAN.getValidDevices()
  } else if (vendor === 'TOOMOSS') {
    return TOOMOSS_CAN.getValidDevices()
  } else if (vendor === 'VECTOR') {
    return VECTOR_CAN.getValidDevices()
  } else if (vendor === 'SLCAN') {
    return SLCAN_CAN.getValidDevices()
  } else if (vendor === 'CANDLE') {
    return Candle_CAN.getValidDevices()
  } else {
    return []
  }
}

export function canClean() {
  KVASER_CAN.unloadDll()
}

