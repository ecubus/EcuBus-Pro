/**
 * Service Discovery and Tracing Configuration Interfaces
 */

/**
 * TTL factor configuration for offers
 */
export interface TtlFactorOffer {
  /**
   * The id of the service
   */
  service: string

  /**
   * The id of the service instance
   */
  instance: string

  /**
   * TTL correction factor
   */
  ttl_factor: number
}

/**
 * TTL factor configuration for subscriptions
 */
export interface TtlFactorSubscription {
  /**
   * The id of the service
   */
  service: string

  /**
   * The id of the service instance
   */
  instance: string

  /**
   * TTL correction factor
   */
  ttl_factor: number
}

/**
 * Service discovery configuration
 * Contains settings related to the Service Discovery of the host application
 */
export interface ServiceDiscoveryConfig {
  /**
   * Specifies whether the Service Discovery is enabled
   * @default true
   */
  enable?: boolean

  /**
   * Specifies the initial Service Discovery state after startup
   * @default "unknown"
   */
  initial_state?: 'unknown' | 'suspended' | 'resumed'

  /**
   * The multicast address which the messages of the Service Discovery will be sent to
   * @default "224.224.224.0"
   */
  multicast?: string

  /**
   * The port of the Service Discovery
   * @default 30490
   */
  port?: number

  /**
   * The protocol that is used for sending the Service Discovery messages
   * @default "udp"
   */
  protocol?: 'tcp' | 'udp'

  /**
   * Minimum delay before first offer message
   * @default 0
   */
  initial_delay_min?: number

  /**
   * Maximum delay before first offer message
   * @default 3000
   */
  initial_delay_max?: number

  /**
   * Base delay sending offer messages within the repetition phase
   * @default 10
   */
  repetitions_base_delay?: number

  /**
   * Maximum number of repetitions for provided services within the repetition phase
   * @default 3
   */
  repetitions_max?: number

  /**
   * Lifetime of entries for provided services as well as consumed services and eventgroups
   * @default 0xFFFFFF
   */
  ttl?: string

  /**
   * Array which holds correction factors for incoming remote offers. If a value greater
   * than one is specified for a service instance, the TTL field of the corresponding
   * service entry will be multiplied with the specified factor.
   */
  ttl_factor_offers?: TtlFactorOffer[]

  /**
   * Array which holds correction factors for incoming remote subscriptions. If a value
   * greater than one is specified for a service instance, the TTL field of the corresponding
   * eventgroup entry will be multiplied with the specified factor.
   */
  ttl_factor_subscriptions?: TtlFactorSubscription[]

  /**
   * Cycle of the OfferService messages in the main phase
   * @default 1000
   */
  cyclic_offer_delay?: number

  /**
   * Minimum delay of a unicast message to a multicast message for provided services and eventgroups
   * @default 2000
   */
  request_response_delay?: number

  /**
   * Time which the stack collects new service offers before they enter the repetition phase.
   * This can be used to reduce the number of sent messages during startup.
   * @default 500
   */
  offer_debounce_time?: number

  /**
   * Time which the stack collects non local service requests before sending find messages
   * @default 500
   */
  find_debounce_time?: number

  /**
   * Maximum possible number of different remote subscribers. Additional remote subscribers
   * will not be acknowledged.
   * @default 3
   */
  max_remote_subscribers?: number

  /**
   * Number of initial debounces using find_initial_debounce_time. This can be used to
   * modify the number of sent messages during initial part of startup (valid values: 0 - 2^8-1)
   * @default 0
   */
  find_initial_debounce_reps?: number

  /**
   * Time which the stack collects new service requests before they enter the repetition phase.
   * This can be used to modify the number of sent messages during initial part of startup
   * @default 200
   */
  find_initial_debounce_time?: number

  /**
   * Enables the tracking of the route state on_net_interface_or_route_state_changed
   * @default true
   */
  wait_route_netlink_notification?: boolean
}

/**
 * Tracing channel configuration
 */
export interface TracingChannel {
  /**
   * The name of the channel
   */
  name: string

  /**
   * The id of the channel
   */
  id: string
}

/**
 * Tracing filter match configuration
 */
export interface TracingFilterMatch {
  /**
   * Service ID
   */
  service: string

  /**
   * Instance ID
   */
  instance: string

  /**
   * Method ID
   */
  method: string
}

/**
 * Tracing filter configuration
 */
export interface TracingFilter {
  /**
   * The id of the channel over that the filtered messages are forwarded to DLT.
   * If no channel is specified the default channel (TC) is used. If you want to
   * use a filter in several different channels, you can provide an array of channel ids.
   */
  channel?: string | string[]

  /**
   * Specification of the criteria to include/exclude a message into/from the trace.
   * You can either specify lists (array) or ranges of matching elements. A list may
   * contain single identifiers which match all messages from/to all instances of the
   * corresponding service or tuples consisting of service, instance and method-identifier.
   * 'any' may be used as a wildcard for matching all services, instances or methods.
   * A range is specified by two tuples "from" and "to", each consisting of service-,
   * instance-and method-identifier. All messages with service-, instance-and method-identifiers
   * that are greater than or equal to "from" and less than or equal to "to" are matched.
   */
  matches?: TracingFilterMatch[]

  /**
   * Specifies the filter type. The default value is positive.
   * - A positive filter is used and a message matches one of the filter rules,
   *   the message will be traced/forwarded to DLT.
   * - A negative filter messages can be excluded. So when a message matches one
   *   of the filter rules, the message will not be traced/forwarded to DLT.
   * - A header-only filter is a positive filter that does not trace the message payload.
   * @default "positive"
   */
  type?: 'positive' | 'negative' | 'header-only'
}

/**
 * Tracing configuration for the Trace Connector
 * Used to forward the internal messages that are sent over the Unix Domain Sockets (UDS) to DLT.
 */
export interface TracingConfig {
  /**
   * Specifies whether the tracing of the SOME/IP messages is enabled.
   * If tracing is enabled, the messages will be forwarded to DLT by the Trace Connector.
   * @default false
   */
  enable?: boolean

  /**
   * Specifies whether the tracing of the SOME/IP service discovery messages is enabled.
   * @default false
   */
  sd_enable?: boolean

  /**
   * Contains the channels to DLT. You can set up multiple channels to DLT over that
   * you can forward the messages.
   */
  channels?: TracingChannel[]

  /**
   * Contains the filters that are applied on the messages. You can apply filters
   * respectively filter rules on the messages with specific criteria and expressions.
   * So only the filtered messages are forwarded to DLT.
   */
  filters?: TracingFilter[]
}
