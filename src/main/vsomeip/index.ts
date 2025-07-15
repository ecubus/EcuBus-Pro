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

export interface VsomeipCallbackWrapper {
  setApplication(app: any): void
  hasApplication(): boolean
  registerStateHandler(callbackId: string): void
  registerMessageHandler(
    service: number,
    instance: number,
    method: number,
    callbackId: string
  ): void
  registerAvailabilityHandler(service: number, instance: number, callbackId: string): void
  registerSubscriptionHandler(
    service: number,
    instance: number,
    eventgroup: number,
    callbackId: string
  ): void
  registerSubscriptionStatusHandler(
    service: number,
    instance: number,
    eventgroup: number,
    event: number,
    callbackId: string
  ): void
  setWatchdogHandler(callbackId: string, intervalSeconds: number): void
}

// Native module interface
declare const nativeModule: {
  registerCallback(callbackType: string, callback: Function): string
  unregisterCallback(callbackId: string): void
  createVsomeipCallbackWrapper(): VsomeipCallbackWrapper
}

// High-level wrapper class for easier usage
export class VsomeipCallbackManager {
  private wrapper: VsomeipCallbackWrapper
  private callbacks: Map<string, Function> = new Map()

  constructor(app: any) {
    this.wrapper = nativeModule.createVsomeipCallbackWrapper()
    this.wrapper.setApplication(app)
  }

  /**
   * Register a state handler callback
   */
  registerStateHandler(callback: VsomeipStateHandler): string {
    const callbackId = nativeModule.registerCallback('state', callback)
    this.callbacks.set(callbackId, callback)
    this.wrapper.registerStateHandler(callbackId)
    return callbackId
  }

  /**
   * Register a message handler callback
   */
  registerMessageHandler(
    service: number,
    instance: number,
    method: number,
    callback: VsomeipMessageHandler
  ): string {
    const callbackId = nativeModule.registerCallback('message', callback)
    this.callbacks.set(callbackId, callback)
    this.wrapper.registerMessageHandler(service, instance, method, callbackId)
    return callbackId
  }

  /**
   * Register an availability handler callback
   */
  registerAvailabilityHandler(
    service: number,
    instance: number,
    callback: VsomeipAvailabilityHandler
  ): string {
    const callbackId = nativeModule.registerCallback('availability', callback)
    this.callbacks.set(callbackId, callback)
    this.wrapper.registerAvailabilityHandler(service, instance, callbackId)
    return callbackId
  }

  /**
   * Register a subscription handler callback
   */
  registerSubscriptionHandler(
    service: number,
    instance: number,
    eventgroup: number,
    callback: VsomeipSubscriptionHandler
  ): string {
    const callbackId = nativeModule.registerCallback('subscription', callback)
    this.callbacks.set(callbackId, callback)
    this.wrapper.registerSubscriptionHandler(service, instance, eventgroup, callbackId)
    return callbackId
  }

  /**
   * Register a subscription status handler callback
   */
  registerSubscriptionStatusHandler(
    service: number,
    instance: number,
    eventgroup: number,
    event: number,
    callback: VsomeipSubscriptionStatusHandler
  ): string {
    const callbackId = nativeModule.registerCallback('subscription_status', callback)
    this.callbacks.set(callbackId, callback)
    this.wrapper.registerSubscriptionStatusHandler(service, instance, eventgroup, event, callbackId)
    return callbackId
  }

  /**
   * Set a watchdog handler callback
   */
  setWatchdogHandler(callback: VsomeipWatchdogHandler, intervalSeconds: number): string {
    const callbackId = nativeModule.registerCallback('watchdog', callback)
    this.callbacks.set(callbackId, callback)
    this.wrapper.setWatchdogHandler(callbackId, intervalSeconds)
    return callbackId
  }

  /**
   * Unregister a callback by ID
   */
  unregisterCallback(callbackId: string): void {
    if (this.callbacks.has(callbackId)) {
      nativeModule.unregisterCallback(callbackId)
      this.callbacks.delete(callbackId)
    }
  }

  /**
   * Unregister all callbacks
   */
  unregisterAllCallbacks(): void {
    for (const callbackId of this.callbacks.keys()) {
      nativeModule.unregisterCallback(callbackId)
    }
    this.callbacks.clear()
  }

  /**
   * Get the number of registered callbacks
   */
  getCallbackCount(): number {
    return this.callbacks.size
  }

  /**
   * Check if a callback ID is registered
   */
  hasCallback(callbackId: string): boolean {
    return this.callbacks.has(callbackId)
  }

  /**
   * Check if the vSomeIP application is set
   */
  hasApplication(): boolean {
    return this.wrapper.hasApplication()
  }
}

// Export the native module functions
export const registerCallback = nativeModule.registerCallback
export const unregisterCallback = nativeModule.unregisterCallback
export const createVsomeipCallbackWrapper = nativeModule.createVsomeipCallbackWrapper

// Example usage:
/*
import { VsomeipCallbackManager } from './vsomeip';

// Create a callback manager
const callbackManager = new VsomeipCallbackManager(vsomeipApp);

// Register a state handler
const stateCallbackId = callbackManager.registerStateHandler((state) => {
  console.log('State changed:', state);
});

// Register a message handler
const messageCallbackId = callbackManager.registerMessageHandler(0x1234, 0x5678, 0x9ABC, (message) => {
  console.log('Received message:', message);
  console.log('Payload:', message.payload);
});

// Register an availability handler
const availabilityCallbackId = callbackManager.registerAvailabilityHandler(0x1234, 0x5678, (info) => {
  console.log('Service availability changed:', info);
});

// Set a watchdog handler
const watchdogCallbackId = callbackManager.setWatchdogHandler(() => {
  console.log('Watchdog triggered');
}, 5); // Every 5 seconds

// Clean up when done
callbackManager.unregisterCallback(stateCallbackId);
callbackManager.unregisterAllCallbacks();
*/

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
      this.app.start()
      // this.app.register_state_handler(this.onStateChange)
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
