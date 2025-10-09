import DFU from './build/Release/dfu.node'
import dllLib from '../../../resources/lib/dfu/CubeProgrammer_API.dll?asset&asarUnpack'
import path from 'path'

const libPath = path.dirname(dllLib)

if (process.platform == 'win32') {
  DFU.LoadDll(libPath)
}

export default class DFU_Client {
  constructor() {}

  static getDeviceInfo() {
    const ptr = new DFU.dfuDeviceInfoPtr()
    const num = DFU.getDfuDeviceList(ptr.cast(), 0xdf11, 0x0483)
    DFU.deleteInterfaceList()
    console.log(num + 2)
    // console.log(1)
  }
  close() {}

  connect() {
    return DFU.connect()
  }
}
