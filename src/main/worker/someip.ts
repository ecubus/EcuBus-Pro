/**
 * SOME/IP Worker Module
 *
 * This module provides SOME/IP (Scalable service-Oriented MiddlewarE over IP) message handling classes.
 * SOME/IP is an automotive communication protocol used for service-oriented communication in vehicles.
 *
 * Catalog: SOME/IP - Handles SOME/IP protocol message types and operations
 */

import { SomeipMessage, SomeipMessageType } from '../share/someip'

/**
 * @catalog SOME/IP
 * Base class for SOME/IP messages
 * This class provides the foundation for all SOME/IP message types.
 * It encapsulates the basic SOME/IP message structure and common functionality.
 */
class SomeipMessageBase {
  /**
   * Creates a new SOME/IP message base instance
   * @param msg - The SOME/IP message data
   */
  constructor(public msg: SomeipMessage) {}

  setPayload(payload: Buffer) {
    this.msg.payload = payload
  }
}

/**
 * SOME/IP Request Message Handler
 *
 * @catalog SOME/IP
 * This class handles SOME/IP request messages specifically.
 * It validates that the message type is REQUEST and provides request-specific functionality.
 */
class SomeipMessageRequest extends SomeipMessageBase {
  /**
   * Creates a new SOME/IP request message instance
   * @param msg - The SOME/IP message data (must be of type REQUEST)
   * @throws {Error} If the message type is not REQUEST
   */
  constructor(public msg: SomeipMessage) {
    if (msg.messageType != SomeipMessageType.REQUEST) {
      throw new Error('SomeipMessageRequest must be SomeipMessageType.REQUEST')
    }
    super(msg)
  }
}

/**
 * SOME/IP Response Message Handler
 * @catalog SOME/IP
 * This class handles SOME/IP response messages specifically.
 * It validates that the message type is RESPONSE and provides response-specific functionality,
 * including the ability to create responses from requests.
 */
class SomeipMessageResponse extends SomeipMessageBase {
  /**
   * Creates a new SOME/IP response message instance
   * @param msg - The SOME/IP message data (must be of type RESPONSE)
   * @throws {Error} If the message type is not RESPONSE
   */
  constructor(public msg: SomeipMessage) {
    if (msg.messageType != SomeipMessageType.RESPONSE) {
      throw new Error('SomeipMessageResponse must be SomeipMessageType.RESPONSE')
    }
    super(msg)
  }

  /**
   * Creates a SOME/IP response message from a request message
   *
   * This static method takes a request message and creates a corresponding response message
   * by copying the request data and changing the message type to RESPONSE.
   *
   * @param request - The SOME/IP request message to create a response from
   * @returns A new SomeipMessageResponse instance based on the request
   */
  static fromSomeipRequest(request: SomeipMessageRequest, payload: Buffer = Buffer.from([])) {
    const response = new SomeipMessageResponse({
      ...request.msg,
      messageType: SomeipMessageType.RESPONSE
    })
    response.setPayload(payload)
    return response
  }
}

// Export all SOME/IP message classes for use in other modules
export { SomeipMessageBase, SomeipMessageRequest, SomeipMessageResponse }
