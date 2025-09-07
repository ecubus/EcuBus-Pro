import vsomeip from './build/Release/vsomeip.node'
import dllLib from '../../../resources/lib/vsomeip3.dll?asset&asarUnpack'
import path from 'path'
import {
  SomeipMessage,
  VsomeipAvailabilityInfo,
  VsomeipSubscriptionInfo,
  VsomeipSubscriptionStatusInfo
} from '../share/someip'

const libPath = path.dirname(dllLib)

if (process.platform == 'win32') {
  vsomeip.LoadDll(libPath)
}
// vSomeIP Callback Management System TypeScript Interface

// Unified callback data structure
export type VsomeipCallbackData =
  | { type: 'state'; data: number }
  | { type: 'message'; data: SomeipMessage }
  | { type: 'availability'; data: VsomeipAvailabilityInfo }
  | { type: 'subscription'; data: VsomeipSubscriptionInfo }
  | { type: 'subscription_status'; data: VsomeipSubscriptionStatusInfo }
  | { type: 'watchdog'; data: undefined }
  | { type: 'trace'; data: string }

export type VsomeipCallback = (callbackData: VsomeipCallbackData) => void

// Event types for the EventEmitter - automatically derived from VsomeipCallbackData
export type VsomeipEventMap = {
  [K in VsomeipCallbackData['type']]: K extends 'watchdog'
    ? () => void
    : (data: Extract<VsomeipCallbackData, { type: K }>['data']) => void
}

export default class VSomeIP_Client {
  private rtm: any
  app: any
  sendc: any

  private cb: any = null
  private cbId: string | undefined

  static traceRegister: boolean = false

  constructor(
    public name: string,
    configFilePath: string,
    cb: (callbackData: VsomeipCallbackData) => void
  ) {
    this.rtm = vsomeip.runtime.get()
    this.app = this.rtm.create_application(name, configFilePath)
    this.cb = new vsomeip.VsomeipCallbackWrapper(this.rtm, this.app)
    this.sendc = new vsomeip.Send(this.rtm, this.app)
    this.cbId = vsomeip.RegisterCallback(name, name, cb.bind(this))
  }

  sendMessage(message: SomeipMessage) {
    const msg = new vsomeip.SomeipMessage()
    msg.service = message.service
    msg.instance = message.instance
    msg.method = message.method
    msg.client = message.client
    msg.session = message.session
    msg.payload = message.payload
    msg.messageType = message.messageType
    msg.returnCode = message.returnCode
    msg.protocolVersion = message.protocolVersion
    msg.interfaceVersion = message.interfaceVersion
    msg.reliable = message.reliable || false
    this.sendc.sendMessage(msg, Buffer.from(message.payload))
  }

  init() {
    if (!VSomeIP_Client.traceRegister) {
      this.cb.registerTraceHandler(this.cbId)
      VSomeIP_Client.traceRegister = true
    }
    const result = this.app.init()
    if (!result) {
      throw new Error('Failed to initialize application')
    } else {
      this.cb.registerStateHandler(this.cbId)
      this.cb.registerMessageHandler(0xffff, 0xffff, 0xffff, this.cbId)
      this.cb.registerAvailabilityHandler(0xffff, 0xffff, this.cbId)
    }
  }
  start() {
    this.cb.start()
  }

  stop() {
    this.app.clear_all_handler()

    if (this.cb) {
      this.cb.stop()
    }

    vsomeip.UnregisterCallback(this.cbId)

    this.rtm.remove_application(this.name)
  }
}
