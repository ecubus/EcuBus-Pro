/**
 * Service Configuration Interfaces
 */

/**
 * Service event configuration
 */
export interface ServiceEvent {
  /**
   * The id of the event
   */
  event: string

  /**
   * Specifies whether the event is of type field. A field is a combination
   * of getter, setter and notification event. It contains at least a getter,
   * a setter, or a notifier. The notifier sends an event message that transports
   * the current value of a field on change.
   */
  is_field?: boolean

  /**
   * Specifies whether the communication is reliable respectively whether the
   * event is sent with the TCP protocol. If the value is false the UDP protocol will be used.
   */
  is_reliable?: boolean

  /**
   * Defines the period for events to be sent. (values are defined in ms)
   */
  cycle?: number

  /**
   * Defines if the updates are sent right away if the event value changes
   * @default true
   */
  update_on_change?: boolean

  /**
   * When the update_on_change is set to true, and this parameter is also true,
   * the defined cycle will be reset when the event value changes.
   * @default false
   */
  change_resets_cycle?: boolean
}

/**
 * Service eventgroup configuration
 */
export interface ServiceEventgroup {
  /**
   * The id of the event group
   */
  eventgroup: string

  /**
   * Specifies the multicast that is used to publish the eventgroup
   */
  multicast?: {
    /**
     * The multicast address
     */
    address: string

    /**
     * The multicast port
     */
    port: number
  }

  /**
   * Contains the ids of the appropriate events
   */
  events: string[]

  /**
   * Specifies when to use multicast and when to use unicast to send a notification event.
   * Must be set to a non-negative number. If it is set to zero, all events of the eventgroup
   * will be sent by unicast. Otherwise, the events will be sent by unicast as long as the
   * number of subscribers is lower than the threshold and by multicast if the number of
   * subscribers is greater or equal. This means, a threshold of 1 will lead to all events
   * being sent by multicast.
   * @default 0
   */
  threshold?: number
}

/**
 * Service reliable configuration
 */
export interface ServiceReliable {
  /**
   * The port of the TCP endpoint
   */
  port: number

  /**
   * Specifies whether magic cookies are enabled
   * @default false
   */
  'enable-magic-cookies'?: boolean
}

/**
 * Service debounce times configuration
 */
export interface ServiceDebounceTimes {
  /**
   * Requests configuration
   */
  requests?: Record<
    string,
    {
      /**
       * Minimal time between sending a message to the same method of a remote service
       * over the same connection (src/dst address + src/dst port).
       */
      'debounce-time': number

      /**
       * The maximum time which a message to the same method of a remote service over
       * the same connection (src/dst address + src/dst port) is allowed to be buffered
       * on sender side.
       */
      'maximum-retention-time': number
    }
  >

  /**
   * Responses configuration
   */
  responses?: Record<
    string,
    {
      /**
       * Minimal time between sending a message to the same method of a remote service
       * over the same connection (src/dst address + src/dst port).
       */
      'debounce-time': number

      /**
       * The maximum time which a message to the same method of a remote service over
       * the same connection (src/dst address + src/dst port) is allowed to be buffered
       * on sender side.
       */
      'maximum-retention-time': number
    }
  >
}

/**
 * SOME/IP-TP configuration
 */
export interface SomeipTpConfig {
  /**
   * Contains the IDs for responses, fields and events which are sent from the node
   * to a remote client which can be segmented via SOME/IP-TP if they exceed the
   * maximum message size for UDP communication. If an ID isn't listed here the
   * message will otherwise be dropped if the maximum message size is exceeded.
   */
  'service-to-client'?: Array<
    | string
    | {
        /**
         * Configures the method id to use
         */
        method: string

        /**
         * New UDP payload in bytes, value must be a multiple of 16
         */
        'max-segment-length': number

        /**
         * Lower limit used between sending of two segments of the same SOME/IP-TP message.
         * Default for the separation time is 0, no matter whether a message is SOME/IP-TP or not.
         * For separation time 0, message sending is no different from what it was before.
         * @default 0
         */
        'separation-time'?: number
      }
  >

  /**
   * Contains the IDs for requests, which are sent from the node to a remote service
   * which can be segmented via SOME/IP-TP if they exceed the maximum message size
   * for UDP communication. If an ID isn't listed here the message will otherwise
   * be dropped if the maximum message size is exceeded. Please note that the unicast
   * key has to be set to the remote IP address of the offering node for this setting
   * to take effect.
   */
  'client-to-service'?: Array<
    | string
    | {
        /**
         * Configures the method id to use
         */
        method: string

        /**
         * New UDP payload in bytes, value must be a multiple of 16
         */
        'max-segment-length': number

        /**
         * Lower limit used between sending of two segments of the same SOME/IP-TP message.
         * Default for the separation time is 0, no matter whether a message is SOME/IP-TP or not.
         * For separation time 0, message sending is no different from what it was before.
         * @default 0
         */
        'separation-time'?: number
      }
  >
}

/**
 * Service configuration
 * Contains the services of the service provider
 */
export interface ServiceConfig {
  /**
   * The id of the service
   */
  service: string

  /**
   * The id of the service instance
   */
  instance: string

  /**
   * The protocol that is used to implement the service instance.
   * The default value is someip. If a different setting is provided,
   * vsomeip does not open the specified port (server side) or does not
   * connect to the specified port (client side). Thus, this option can
   * be used to let the service discovery announce a service that is
   * externally implemented.
   * @default "someip"
   */
  protocol?: string

  /**
   * The unicast that hosts the service instance. The unicast address is needed
   * if external service instances shall be used, but service discovery is disabled.
   * In this case, the provided unicast address is used to access the service instance.
   */
  unicast?: string

  /**
   * Specifies that the communication with the service is reliable respectively
   * the TCP protocol is used for communication.
   */
  reliable?: ServiceReliable

  /**
   * Specifies that the communication with the service is unreliable respectively
   * the UDP protocol is used for communication (valid values: the port of the UDP endpoint).
   */
  unreliable?: number

  /**
   * Contains the events of the service
   */
  events?: ServiceEvent[]

  /**
   * Events can be grouped together into on event group. For a client it is thus
   * possible to subscribe for an event group and to receive the appropriate events within the group.
   */
  eventgroups?: ServiceEventgroup[]

  /**
   * Used to configure the nPDU feature. This is described in detail in SOME/IP nPDU Default Timings.
   */
  'debounce-times'?: ServiceDebounceTimes

  /**
   * Used to configure the SOME/IP-TP feature. With SOME/IP Transport Protocol (TP)
   * it is possible to transport messages which exceed the UDP payload size limit of 1400 byte.
   * If enabled the message is segmented and send in multiple UDP datagrams.
   */
  'someip-tp'?: SomeipTpConfig
}

/**
 * Internal service configuration
 * Specifies service/instance ranges for pure internal service-instances.
 * This information is used by vsomeip to avoid sending Find-Service messages
 * via the Service-Discovery when a client is requesting a not available service-instance.
 * Its can either be done on service/instance level or on service level only which
 * then includes all instance from 0x0000-0xffff.
 */
export interface InternalServiceConfig {
  /**
   * The lowest entry of the internal service range
   */
  first:
    | string
    | {
        /**
         * The lowest Service-ID in hex of the internal service range
         */
        service: string

        /**
         * The lowest Instance-ID in hex of a internal service-instance range.
         * If not specified the lowest Instance-ID is 0x0000.
         */
        instance?: string
      }

  /**
   * The highest entry of the internal service range
   */
  last:
    | string
    | {
        /**
         * The highest Service-ID in hex of a internal service range
         */
        service: string

        /**
         * The highest Instance-ID in hex of a internal service-instance range.
         * If not specified the highest Instance-ID is 0xFFFF.
         */
        instance?: string
      }
}

/**
 * Client configuration
 * The client-side ports that shall be used to connect to a specific service.
 * For each service, an array of ports to be used for reliable/unreliable communication
 * can be specified. vsomeip will take the first free port of the list. If no free port
 * can be found, the connection will fail. If vsomeip is asked to connect to a service
 * instance without specified port(s), the port will be selected by the system. This
 * implies that the user has to ensure that the ports configured here do not overlap
 * with the ports automatically selected by the IP stack.
 */
export interface ClientConfig {
  /**
   * Specify the service the port configuration shall be applied to
   */
  service: string

  /**
   * Specify the instance the port configuration shall be applied to
   */
  instance: string

  /**
   * The list of client ports to be used for reliable (TCP) communication
   * to the given service instance. Ports can be specified in dec or hex format.
   */
  reliable?: number[]

  /**
   * The list of client ports to be used for unreliable (UDP) communication
   * to the given service instance. Ports can be specified in dec or hex format.
   */
  unreliable?: number[]

  /**
   * Specifies a range of reliable remote service ports
   */
  reliable_remote_ports?: {
    /**
     * Lower bound of the port range
     */
    first: number

    /**
     * Upper bound of the port range
     */
    last: number
  }

  /**
   * Specifies a range of unreliable remote service ports
   */
  unreliable_remote_ports?: {
    /**
     * Lower bound of the port range
     */
    first: number

    /**
     * Upper bound of the port range
     */
    last: number
  }

  /**
   * Specifies the range of reliable client ports to be mapped to the reliable_remote_ports range
   */
  reliable_client_ports?: {
    /**
     * Lower bound of the port range
     */
    first: number

    /**
     * Upper bound of the port range
     */
    last: number
  }

  /**
   * Specifies the range of unreliable client ports to be mapped to the unreliable_remote_ports range
   */
  unreliable_client_ports?: {
    /**
     * Lower bound of the port range
     */
    first: number

    /**
     * Upper bound of the port range
     */
    last: number
  }
}
