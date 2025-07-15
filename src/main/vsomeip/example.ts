import { VsomeipCallbackManager, VsomeipMessage, VsomeipAvailabilityInfo } from './index'

// Example usage of the vSomeIP callback management system
export class VsomeipExample {
  private callbackManager: VsomeipCallbackManager
  private registeredCallbacks: string[] = []

  constructor(vsomeipApp: any) {
    this.callbackManager = new VsomeipCallbackManager(vsomeipApp)

    // Check if application is set
    if (!this.callbackManager.hasApplication()) {
      console.warn('vSomeIP application not set. Callbacks may not work properly.')
    }
  }

  /**
   * Example: Register all types of callbacks
   */
  setupCallbacks() {
    console.log('Setting up vSomeIP callbacks...')

    // 1. State handler - called when the application state changes
    const stateCallbackId = this.callbackManager.registerStateHandler((state) => {
      console.log('Application state changed:', state)
      switch (state) {
        case 0: // VSOMEIP_STATE_UNKNOWN
          console.log('State: Unknown')
          break
        case 1: // VSOMEIP_STATE_REGISTERED
          console.log('State: Registered')
          break
        case 2: // VSOMEIP_STATE_DEREGISTERED
          console.log('State: Deregistered')
          break
        default:
          console.log('State: Unknown state value')
      }
    })
    this.registeredCallbacks.push(stateCallbackId)

    // 2. Message handler - called when a message is received
    const messageCallbackId = this.callbackManager.registerMessageHandler(
      0x1234, // service ID
      0x5678, // instance ID
      0x9abc, // method ID
      (message: VsomeipMessage) => {
        console.log('Received message:')
        console.log('  Service:', '0x' + message.service.toString(16))
        console.log('  Instance:', '0x' + message.instance.toString(16))
        console.log('  Method:', '0x' + message.method.toString(16))
        console.log('  Client:', '0x' + message.client.toString(16))
        console.log('  Session:', message.session)

        if (message.payload) {
          console.log('  Payload length:', message.payload.length)
          console.log('  Payload:', message.payload.toString('hex'))
        }
      }
    )
    this.registeredCallbacks.push(messageCallbackId)

    // 3. Availability handler - called when service availability changes
    const availabilityCallbackId = this.callbackManager.registerAvailabilityHandler(
      0x1234, // service ID
      0x5678, // instance ID
      (info: VsomeipAvailabilityInfo) => {
        console.log('Service availability changed:')
        console.log('  Service:', '0x' + info.service.toString(16))
        console.log('  Instance:', '0x' + info.instance.toString(16))
        console.log('  Available:', info.available)

        if (info.available) {
          console.log('Service is now available!')
        } else {
          console.log('Service is no longer available.')
        }
      }
    )
    this.registeredCallbacks.push(availabilityCallbackId)

    // 4. Subscription handler - called when clients subscribe/unsubscribe
    const subscriptionCallbackId = this.callbackManager.registerSubscriptionHandler(
      0x1234, // service ID
      0x5678, // instance ID
      0x1111, // eventgroup ID
      (info) => {
        console.log('Subscription state changed:')
        console.log('  Client:', '0x' + info.client.toString(16))
        console.log('  UID:', info.uid)
        console.log('  GID:', info.gid)
        console.log('  Subscribed:', info.subscribed)

        if (info.subscribed) {
          console.log('Client subscribed to eventgroup')
        } else {
          console.log('Client unsubscribed from eventgroup')
        }
      }
    )
    this.registeredCallbacks.push(subscriptionCallbackId)

    // 5. Subscription status handler - called when subscription requests are processed
    const subscriptionStatusCallbackId = this.callbackManager.registerSubscriptionStatusHandler(
      0x1234, // service ID
      0x5678, // instance ID
      0x1111, // eventgroup ID
      0x2222, // event ID
      (info) => {
        console.log('Subscription status:')
        console.log('  Eventgroup:', '0x' + info.eventgroup.toString(16))
        console.log('  Event:', '0x' + info.event.toString(16))
        console.log('  Status:', info.status)

        switch (info.status) {
          case 0: // OK
            console.log('Subscription accepted')
            break
          case 7: // REJECTED
            console.log('Subscription rejected')
            break
          default:
            console.log('Unknown subscription status')
        }
      }
    )
    this.registeredCallbacks.push(subscriptionStatusCallbackId)

    // 6. Watchdog handler - called periodically for monitoring
    const watchdogCallbackId = this.callbackManager.setWatchdogHandler(() => {
      console.log('Watchdog triggered - application is alive')
      console.log('Active callbacks:', this.callbackManager.getCallbackCount())
    }, 10) // Every 10 seconds
    this.registeredCallbacks.push(watchdogCallbackId)

    console.log('All callbacks registered successfully')
    console.log('Total callbacks:', this.callbackManager.getCallbackCount())
  }

  /**
   * Example: Register a wildcard message handler (ANY_SERVICE, ANY_INSTANCE, ANY_METHOD)
   */
  setupWildcardMessageHandler() {
    const wildcardCallbackId = this.callbackManager.registerMessageHandler(
      0xffff, // ANY_SERVICE
      0xffff, // ANY_INSTANCE
      0xffff, // ANY_METHOD
      (message: VsomeipMessage) => {
        console.log('Wildcard message received:')
        console.log('  Service:', '0x' + message.service.toString(16))
        console.log('  Instance:', '0x' + message.instance.toString(16))
        console.log('  Method:', '0x' + message.method.toString(16))
      }
    )
    this.registeredCallbacks.push(wildcardCallbackId)
    console.log('Wildcard message handler registered')
  }

  /**
   * Example: Register multiple message handlers for different services
   */
  setupMultipleServiceHandlers() {
    const services = [
      { service: 0x1000, instance: 0x2000, method: 0x3000, name: 'Service A' },
      { service: 0x4000, instance: 0x5000, method: 0x6000, name: 'Service B' },
      { service: 0x7000, instance: 0x8000, method: 0x9000, name: 'Service C' }
    ]

    services.forEach(({ service, instance, method, name }) => {
      const callbackId = this.callbackManager.registerMessageHandler(
        service,
        instance,
        method,
        (message: VsomeipMessage) => {
          console.log(`Message from ${name}:`)
          console.log('  Payload length:', message.payload?.length || 0)
        }
      )
      this.registeredCallbacks.push(callbackId)
    })

    console.log(`Registered handlers for ${services.length} services`)
  }

  /**
   * Example: Dynamic callback management
   */
  demonstrateDynamicCallbacks() {
    console.log('Demonstrating dynamic callback management...')

    // Register a temporary callback
    const tempCallbackId = this.callbackManager.registerMessageHandler(
      0xaaaa,
      0xbbbb,
      0xcccc,
      (message: VsomeipMessage) => {
        console.log('Temporary callback triggered')
      }
    )

    console.log('Temporary callback registered:', tempCallbackId)
    console.log('Total callbacks:', this.callbackManager.getCallbackCount())

    // Simulate some time passing...
    setTimeout(() => {
      // Unregister the temporary callback
      this.callbackManager.unregisterCallback(tempCallbackId)
      console.log('Temporary callback unregistered')
      console.log('Total callbacks:', this.callbackManager.getCallbackCount())
    }, 5000)
  }

  /**
   * Clean up all registered callbacks
   */
  cleanup() {
    console.log('Cleaning up callbacks...')
    this.callbackManager.unregisterAllCallbacks()
    this.registeredCallbacks = []
    console.log('All callbacks cleaned up')
  }

  /**
   * Get callback statistics
   */
  getStats() {
    return {
      totalCallbacks: this.callbackManager.getCallbackCount(),
      registeredCallbackIds: this.registeredCallbacks.length,
      callbackIds: [...this.registeredCallbacks]
    }
  }
}

// Usage example:
/*
import { VsomeipExample } from './example';

// Assuming you have a vSomeIP application instance
const vsomeipApp = getVsomeipApp(); // your vSomeIP app instance

// Create the example instance
const example = new VsomeipExample(vsomeipApp);

// Setup all callbacks
example.setupCallbacks();

// Setup additional handlers
example.setupWildcardMessageHandler();
example.setupMultipleServiceHandlers();

// Demonstrate dynamic callback management
example.demonstrateDynamicCallbacks();

// Get statistics
const stats = example.getStats();
console.log('Callback statistics:', stats);

// Clean up when done
setTimeout(() => {
  example.cleanup();
}, 30000); // Clean up after 30 seconds
*/
