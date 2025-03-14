import vsomeip from './build/Release/vsomeip.node'

export function loadDllPath(dllPath: string) {
  if (process.platform == 'win32') {
    vsomeip.LoadDll(dllPath)
  }
}

export class VSomeIP_Client {
  private rtm: any
  constructor() {
    this.rtm = vsomeip.runtime.get()
  }
}
