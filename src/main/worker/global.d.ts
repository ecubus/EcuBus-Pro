/* eslint-disable no-var */
import { UDSClass } from './uds'

declare global {
  var Util: UDSClass
  var cmdId: number
}

export {}
