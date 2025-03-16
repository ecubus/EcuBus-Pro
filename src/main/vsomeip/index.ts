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

  init() {
    const result = this.app.init()
    if (result) {
      this.app.register_state_handler(this.onStateChange)
    } else {
      throw new Error('Failed to initialize application')
    }
  }

  onStateChange(state: any) {
    console.log('State changed:', state)
  }
  stop() {
    this.app.stop()
  }
}
