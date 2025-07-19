/**
 * Other Configuration Interfaces
 */

/**
 * Watchdog configuration
 * The Watchdog sends periodically pings to all known local clients. If a client
 * isn't responding within a configured time/amount of pongs the watchdog deregisters
 * this application/client. If not configured the watchdog isn't activated.
 */
export interface WatchdogConfig {
  /**
   * Specifies whether the watchdog is enabled or disabled
   * @default false
   */
  enable?: boolean

  /**
   * Specifies the timeout in ms the watchdog gets activated if a ping isn't
   * answered with a pong by a local client within that time. (valid values: 2 - 2^32)
   * @default 5000
   */
  timeout?: number

  /**
   * Specifies the amount of allowed missing pongs. (valid values: 1 - 2^32)
   * @default 3
   */
  allowed_missing_pongs?: number
}

/**
 * Local clients keepalive configuration
 * The Local Clients Keepalive option activates the sending of periodic ping messages
 * from the routing manager clients to the routing host. The routing manager host shall
 * reply to the ping with a pong. The idea is to have a simpler alternetive to the
 * TCP_KEEPALIVE, particularly for systems where this option can not be configured.
 */
export interface LocalClientsKeepaliveConfig {
  /**
   * Specifies whether the Local Clients Keepalive is enabled or disabled
   * @default false
   */
  enable?: boolean

  /**
   * Specifies the time in ms the Local Clients Keepalive messages are sent
   * @default 5000
   */
  time?: number
}

/**
 * Selective broadcasts support configuration
 * This nodes allow to add a list of IP addresses on which CAPI-Selective-Broadcasts
 * feature is supported. If not specified the feature can't be used and the subscription
 * behavior of the stack is same as with normal events.
 */
export interface SelectiveBroadcastsConfig {
  /**
   * Specifies an IP-Address (in IPv4 or IPv6 notation) on which the "selective"-feature is supported.
   * Multiple addresses can be configured.
   */
  address: string
}

/**
 * E2E protection configuration
 * Used to configure the E2E protection for the specified events
 */
export interface E2EConfig {
  /**
   * Specifies if E2E protection should be enabled or disabled. Use true to enable.
   */
  e2e_enabled: boolean

  /**
   * Specify the protected events
   */
  protected: Array<{
    /**
     * Specifies the service ID
     */
    service_id: string

    /**
     * Specifies the event ID to be protected
     */
    event_id: string

    /**
     * Specifies if it should protect (send) or check (receive) the messages, or both.
     * Possible values are protector, checker and both, respectively.
     */
    variant: 'protector' | 'checker' | 'both'

    /**
     * Specify the E2E profile to be used. Valid values are CRC8 for Profile 01,
     * P04 for Profile 04, P07 for Profile 07 and CRC32 for the Custom Profile with ethernet CRC.
     */
    profile: 'CRC8' | 'P04' | 'P07' | 'CRC32'

    /**
     * Specifies the offset of the CRC in bytes
     */
    crc_offset: number

    /**
     * Specifies a system wide unique 16 bit numerical identifier (Profile 01)
     */
    data_id?: number

    /**
     * Specifies the length of all data in bits (Profile 01)
     */
    data_length?: number

    /**
     * Specifies the offset of the counter in bits (Profile 01)
     * @default 8
     */
    counter_offset?: number

    /**
     * Specifies the offset of the dataID nibble (Profile 01)
     * @default 12
     */
    data_id_nibble_offset?: number

    /**
     * Specifies the dataID mode (valid values are 0, 1, 2 and 3) (Profile 01).
     * It impacts which part of the dataID is used in CRC calculation and if any
     * port of the dataID is sent in the E2E Header.
     */
    data_id_mode?: 0 | 1 | 2 | 3

    /**
     * Specifies the minimum length of the data in bits (Profile 04/07)
     * @default 0
     */
    min_data_length?: number

    /**
     * Specifies the maximum length of the data in bits (Profile 04/07)
     * @default 0xFFFF for Profile 04, 0xFFFFFFFF for Profile 07
     */
    max_data_length?: number

    /**
     * Specifies the maximum allowed difference between the counter value of the
     * current message and the previous valid message (Profile 04/07)
     * @default 0xFFFF for Profile 04, 0xFFFFFFFF for Profile 07
     */
    max_delta_counter?: number
  }>
}

/**
 * Debounce event configuration
 */
export interface DebounceEvent {
  /**
   * Event ID
   */
  event: string

  /**
   * Specifies whether the event is forwarded on payload change or not
   * @default false
   */
  on_change?: boolean

  /**
   * Array of payload indexes with given bit mask (optional) to be ignored
   * in payload change evaluation. Instead of specifying an index / bitmask pair,
   * one can only define the payload index which shall be ignored in the evaluation.
   */
  ignore?: Array<
    | {
        /**
         * Payload index to be checked with given bitmask
         */
        index: number

        /**
         * 1 Byte bitmask applied to byte at given payload index.
         * Example mask: 0x0f ignores payload changes in low nibble of the byte at given index.
         */
        mask?: number
      }
    | number
  >

  /**
   * Specifies if the event shall be debounced based on elapsed time interval.
   * (valid values: time in ms, never)
   * @default "never"
   */
  interval?: number | 'never'

  /**
   * Specifies if interval timer is reset when payload change was detected
   * @default false
   */
  on_change_resets_interval?: boolean

  /**
   * Specifies if last message should be sent after interval timeout
   * @default false
   */
  send_current_value_after?: boolean
}

/**
 * Debounce configuration
 * Events/fields sent by external devices will be forwarded to the applications
 * only if a configurable function evaluates to true. The function checks whether
 * the event/field payload has changed and whether a specified interval has been
 * elapsed since the last forwarding.
 */
export interface DebounceConfig {
  /**
   * Service ID which hosts the events to be debounced
   */
  service: string

  /**
   * Instance ID which hosts the events to be debounced
   */
  instance: string

  /**
   * Array of events which shall be debounced based on the following configuration options
   */
  events: DebounceEvent[]
}

/**
 * Acceptance configuration
 * Can be used to modify the assignment of ports to the unsecure, optional and secure ranges.
 */
export interface AcceptanceConfig {
  /**
   * The IP Address of the device where the ports should be modified
   */
  address: string

  /**
   * Either a single path to an activation file or a list of pathes to activation files.
   * The existence of an activation file switches on the filter mechanism for the specified address.
   */
  path: string | string[]

  /**
   * Type of ports to modify. Possible values are reliable and unreliable.
   */
  reliable?: Array<{
    /**
     * Adds that port to the secure port group
     */
    port?: number

    /**
     * Group of ports starting at first, to add as a secure port
     */
    first?: number

    /**
     * Group of ports ending at last, to add as a secure port
     */
    last?: number

    /**
     * Used to specify the type of ports to remove from secure ports group.
     * Possible values are optional and secure.
     * - optional, removes the following ports from the secure port range:
     *   - Closed(30491, 30499)
     *   - Closed(30898, 30998)
     *   - Closed(30501, 30599)
     * - secure, removes the following ports from the secure port range:
     *   - Closed(32491, 32499)
     *   - Closed(32898, 32998)
     *   - Closed(32501, 32599)
     */
    type?: 'optional' | 'secure'
  }>

  /**
   * Type of ports to modify. Possible values are reliable and unreliable.
   */
  unreliable?: Array<{
    /**
     * Adds that port to the secure port group
     */
    port?: number

    /**
     * Group of ports starting at first, to add as a secure port
     */
    first?: number

    /**
     * Group of ports ending at last, to add as a secure port
     */
    last?: number

    /**
     * Used to specify the type of ports to remove from secure ports group.
     * Possible values are optional and secure.
     * - optional, removes the following ports from the secure port range:
     *   - Closed(30491, 30499)
     *   - Closed(30898, 30998)
     *   - Closed(30501, 30599)
     * - secure, removes the following ports from the secure port range:
     *   - Closed(32491, 32499)
     *   - Closed(32898, 32998)
     *   - Closed(32501, 32599)
     */
    type?: 'optional' | 'secure'
  }>
}

/**
 * Secure service configuration
 * List of service instances that are only accepted, if being offered on a secure port.
 */
export interface SecureServiceConfig {
  /**
   * The id of the service
   */
  service: string

  /**
   * The id of the instance
   */
  instance: string
}

/**
 * Partition configuration
 * Allows to group service instances that are offered on the same port into partitions.
 * For each partition, a separate client port will be used. The goal is to enable faster
 * processing of specific events if a single server port is used to offer many services
 * that send many messages, especially at startup.
 */
export interface PartitionConfig {
  /**
   * The id of the service
   */
  service: string

  /**
   * The id of the instance
   */
  instance: string
}

/**
 * Suppress missing event log configuration
 * Used to filter the log message "deliver_notification: Event [1234.5678.80f3]
 * is not registered. The message is dropped." that occurs whenever vSomeIP
 * receives an event without having a corresponding object being registered.
 */
export interface SuppressMissingEventLogConfig {
  /**
   * Service ID of event to be filtered. Possible values: hex, dec, any.
   */
  service: string

  /**
   * Instance ID of event to be filtered. Possible values: hex, dec, any.
   */
  instance: string

  /**
   * Array of events to be filtered. Possible values:
   * - Single hex, dec value.
   * - Multiple hex, dec values.
   * - Range based hex, dec values.
   * - If no events is provided, then it's assumed all events are to be ignored.
   */
  events?: Array<string | { first: string; last: string }>
}

/**
 * nPDU default timings configuration
 * Global nPDU default timings configuration
 * The nPDU feature can be used to reduce network load as it enables the vsomeip stack
 * to combine multiple vsomeip messages in one single ethernet frame.
 */
export interface NpduDefaultTimingsConfig {
  /**
   * Default debounce time for requests in milliseconds
   * @default 2
   */
  'debounce-time-request'?: number

  /**
   * Default debounce time for responses in milliseconds
   * @default 2
   */
  'debounce-time-response'?: number

  /**
   * Default maximum retention time for requests in milliseconds
   * @default 5
   */
  'max-retention-time-request'?: number

  /**
   * Default maximum retention time for responses in milliseconds
   * @default 5
   */
  'max-retention-time-response'?: number
}
