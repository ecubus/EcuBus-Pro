import vsomeip from './build/Release/vsomeip.node'

export function loadDllPath(dllPath: string) {
  if (process.platform == 'win32') {
    vsomeip.LoadDll(dllPath)
  }
}

export class VSomeIP_Client {
  private rtm: any
  private app: any
  constructor(name: string, configFilePath: string) {
    this.rtm = vsomeip.runtime.get()

    this.app = this.rtm.create_application(name, configFilePath)
  }

  init(): boolean {
    const result = this.app.init()
    return result
  }
}
