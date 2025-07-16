import vsomeip from './build/Release/vsomeip.node'

// vSomeIP Callback Management System TypeScript Interface

export interface VsomeipMessage {
  service: number
  instance: number
  method: number
  client: number
  session: number
  payload?: Buffer
}

export interface VsomeipAvailabilityInfo {
  service: number
  instance: number
  available: boolean
}

export interface VsomeipSubscriptionInfo {
  client: number
  uid: number
  gid: number
  subscribed: boolean
}

export interface VsomeipSubscriptionStatusInfo {
  service: number
  instance: number
  eventgroup: number
  event: number
  status: number
}

export type VsomeipStateHandler = (state: number) => void
export type VsomeipMessageHandler = (message: VsomeipMessage) => void
export type VsomeipAvailabilityHandler = (info: VsomeipAvailabilityInfo) => void
export type VsomeipSubscriptionHandler = (info: VsomeipSubscriptionInfo) => void
export type VsomeipSubscriptionStatusHandler = (info: VsomeipSubscriptionStatusInfo) => void
export type VsomeipWatchdogHandler = () => void

//

export function loadDllPath(dllPath: string) {
  if (process.platform == 'win32') {
    vsomeip.LoadDll(dllPath)
  }
}

export class VSomeIP_Client {
  private rtm: any
  private app: any
  private cb: any = null
  private cbId: string | undefined
  constructor(name: string, configFilePath: string) {
    this.rtm = vsomeip.runtime.get()
    this.app = this.rtm.create_application(name, configFilePath)
    this.cb = new vsomeip.VsomeipCallbackWrapper(this.app)

    this.cbId = vsomeip.RegisterCallback(name, this.callback.bind(this))
  }
  callback(x: any) {
    console.log('xxxxxxxxxxxxxxxx', x)
  }
  init() {
    const result = this.app.init()
    if (result) {
      this.app.start()
      this.cb.registerStateHandler(this.cbId)
      // this.app.register_state_handler(this.onStateChange)
    } else {
      throw new Error('Failed to initialize application')
    }
  }
  stop() {
    this.app.stop()
    vsomeip.UnregisterCallback(this.cbId)
  }
}
