import vsomeip from './build/Release/vsomeip.node'
import dllLib from '../../../resources/lib/vsomeip3.dll?asset&asarUnpack'
import path from 'path'

const libPath = path.dirname(dllLib)

if (process.platform == 'win32') {
  vsomeip.LoadDll(libPath)
}
// vSomeIP Callback Management System TypeScript Interface

export interface VsomeipMessage {
  service: number
  instance: number
  method: number
  client: number
  session: number
  payload?: Buffer
  messageType: number
  requestCode: number
  protocolVersion: number
  interfaceVersion: number
  _messageId?: number // Internal message ID for response handling
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

// Unified callback data structure
export type VsomeipCallbackData =
  | { type: 'state'; data: number }
  | { type: 'message'; data: VsomeipMessage }
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

  sendRequest(service: number, instance: number, method: number, payload: Buffer) {
    this.sendc.sendMessage(service, instance, method, payload)
  }

  sendResponse(request: VsomeipMessage, payload: Buffer) {
    // Send a response based on the received request message using message ID
    if (request._messageId !== undefined) {
      this.sendc.sendResponse(request._messageId, payload)
    } else {
      console.warn('Cannot send response: message ID not available')
    }
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
      this.cb.registerMessageHandler(0xffff, 0xffff, 0xffff, this.cbId, this.sendc)
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
