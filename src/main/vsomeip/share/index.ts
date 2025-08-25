/**
 * vSomeIP Configuration Interfaces
 *
 * This module contains comprehensive TypeScript interfaces for vSomeIP 3.5.5 configuration.
 * The main interface is split into multiple sub-interfaces for better organization and maintainability.
 *
 * @see {@link https://github.com/GENIVI/vsomeip/wiki/vsomeip-in-10-minutes#configuration}
 */

// Import all sub-interfaces
import type {
  GlobalPayloadConfig,
  GlobalQueueConfig,
  TcpRestartConfig,
  FilePermissionsConfig
} from './payload-config'

import type { SecurityConfig } from './security-config'

import type { ServiceDiscoveryConfig, TracingConfig } from './service-discovery-config'

import type { ServiceConfig, InternalServiceConfig, ClientConfig } from './service-config'

import type {
  WatchdogConfig,
  LocalClientsKeepaliveConfig,
  SelectiveBroadcastsConfig,
  E2EConfig,
  DebounceConfig,
  AcceptanceConfig,
  SecureServiceConfig,
  PartitionConfig,
  SuppressMissingEventLogConfig,
  NpduDefaultTimingsConfig
} from './other-config'

/**
 * Logging configuration for vSomeIP
 * Used to configure the log messages of vSomeIP
 */
export interface LoggingConfig {
  /**
   * Specifies whether logging via console is enabled
   * @default true
   */
  console?: boolean

  /**
   * File logging configuration
   */
  file?: {
    /**
     * Specifies whether a log file should be created
     * @default false
     */
    enable?: boolean

    /**
     * The absolute path of the log file
     * @default "/tmp/vsomeip.log"
     */
    path?: string
  }

  /**
   * Specifies whether Diagnostic Log and Trace (DLT) is enabled
   * @default false
   */
  dlt?: boolean

  /**
   * Specifies the log level
   * @default "info"
   */
  level?: 'trace' | 'debug' | 'info' | 'warning' | 'error' | 'fatal'

  /**
   * Configures logging of the vsomeip version
   */
  version?: {
    /**
     * Enable or disable cyclic logging of vsomeip version
     * @default true
     */
    enable?: boolean

    /**
     * Configures interval in seconds to log the vsomeip version
     * @default 10
     */
    interval?: number
  }

  /**
   * Configures interval in seconds in which the routing manager logs its used memory.
   * Setting a value greater than zero enables the logging.
   * @default 0
   */
  memory_log_interval?: number

  /**
   * Configures interval in seconds in which the routing manager logs its internal status.
   * Setting a value greater than zero enables the logging.
   * @default 0
   */
  status_log_interval?: number

  /**
   * Statistics logging configuration
   */
  statistics?: {
    /**
     * How often to report statistics data (received messages/events) in ms.
     * The minimum possible interval is 1000, for configured values below, 1000 will be used.
     * @default 10000
     */
    interval?: number

    /**
     * Minimum frequency of reported events
     * @default 50
     */
    'min-frequency'?: number

    /**
     * Maximum number of different messages that are reported
     * @default 50
     */
    'max-messages'?: number
  }
}

/**
 * Routing host configuration
 */
export interface RoutingHost {
  /**
   * Name of the application that hosts the routing component
   */
  name: string

  /**
   * User identifier of the process that runs the routing component.
   * Must be specified if credential checks are enabled by check_credentials set to true.
   */
  uid?: number

  /**
   * Group identifier of the process that runs the routing component.
   * Must be specified if credential checks are enabled by check_credentials set to true.
   */
  gid?: number

  /**
   * The unicast address that shall be used by the routing manager,
   * if the internal communication shall be done by using TCP connections.
   */
  unicast?: string

  /**
   * The port that shall be used by the routing manager,
   * if the internal communication shall be done by using TCP connections.
   */
  port?: number
}

/**
 * Routing guest configuration
 */
export interface RoutingGuest {
  /**
   * The unicast address that shall be used by the applications to connect to the routing manager.
   * If not set, the unicast address of the host entry is used.
   */
  unicast?: string

  /**
   * A set of port ranges that shall be used to connect to the routing manager per user identifier/group identifier.
   * Either specify uid, gid and ranges, or only a set of port ranges.
   * If uid and gid are not explicitly specified, they default to any.
   * Each client application requires two ports, one for receiving messages from other applications
   * and one to send messages to other applications.
   */
  ports?: Array<{
    /**
     * User identifier
     */
    uid?: number

    /**
     * Group identifier
     */
    gid?: number

    /**
     * Set of port ranges. Each entry consists of a first, last pair that determines
     * the first and the last port of a port range.
     */
    ranges?: Array<{
      /**
       * First port of a port range
       */
      first: number

      /**
       * Last port of a port range
       */
      last: number
    }>

    /**
     * First port of a port range (legacy format)
     */
    first?: number

    /**
     * Last port of a port range (legacy format)
     */
    last?: number
  }>
}

/**
 * Routing configuration
 * Specifies the properties of the routing. Either a string that specifies the application
 * that hosts the routing component or a structure that specifies all properties of the routing.
 * If the routing is not specified, the first started application will host the routing component.
 */
export interface RoutingConfig {
  /**
   * Properties of the routing manager
   */
  host?: RoutingHost

  /**
   * Properties of all applications that do not host the routing component,
   * if the internal communication shall be done using TCP connections.
   */
  guests?: RoutingGuest
}

/**
 * The UID / GID of the application acting as routing manager.
 * @deprecated Use routing.host.uid and routing.host.gid instead
 * Must be specified if credentials checks are enabled using check_credentials set to true
 * in order to successfully check the routing managers credentials passed on connect
 */
export interface RoutingCredentials {
  /**
   * The routing managers UID
   */
  uid: number

  /**
   * The routing managers GID
   */
  gid: number
}

/**
 * Application plugin configuration
 */
export interface ApplicationPlugin {
  /**
   * The name of the plug-in
   */
  name: string

  /**
   * The plug-in type. An application plug-in extends the functionality on application level.
   * It gets informed by vsomeip over the basic application states (INIT/START/STOP) and can,
   * based on these notifications, access the standard "application"-API via the runtime.
   */
  type: 'application_plugin'

  /**
   * Generic way to define configuration data for plugins
   */
  additional?: Record<string, any>
}

/**
 * Application configuration
 */
export interface ApplicationConfig {
  /**
   * The name of the application
   */
  name: string

  /**
   * The id of the application. Usually its high byte is equal to the diagnosis address.
   * In this case the low byte must be different from zero. Thus, if the diagnosis address is 0x63,
   * valid values range from 0x6301 until 0x63FF. It is also possible to use id values with
   * a high byte different from the diagnosis address.
   */
  id: string

  /**
   * The maximum number of threads that shall be used to execute the application callbacks
   * @default 10
   */
  max_dispatchers?: number

  /**
   * The maximum time in ms that an application callback may consume before the callback
   * is considered to be blocked (and an additional thread is used to execute pending callbacks
   * if max_dispatchers is configured greater than 0)
   * @default 100
   */
  max_dispatch_time?: number

  /**
   * The maximum time in seconds that an application will wait for a detached dispatcher
   * thread to finish executing
   * @default 5
   */
  max_detached_thread_wait_time?: number

  /**
   * The number of internal threads to process messages and events within an application.
   * Valid values are 1-255
   * @default 2
   */
  threads?: number

  /**
   * The nice level for internal threads processing messages and events. POSIX/Linux only.
   * For actual values refer to nice() documentation
   * @default 0
   */
  io_thread_nice?: number

  /**
   * Specifies a debounce-time interval in ms in which request-service messages are sent
   * to the routing manager. If an application requests many services in short same time
   * the load of sent messages to the routing manager and furthermore the replies from
   * the routing manager (which contains the routing info for the requested service if available)
   * can be heavily reduced
   */
  request_debounce_time?: number

  /**
   * Contains the plug-ins that should be loaded to extend the functionality of vsomeip
   */
  plugins?: ApplicationPlugin[]

  /**
   * Client/Application specific configuration of debouncing
   */
  debounce?: any

  /**
   * Configures the session handling. Mostly used for E2E use cases when the application
   * handles the CRC calculation over the SOME/IP header by themself, and need the ability
   * to switch off the session handling as otherwise their calculated checksum does not
   * match reality after vsomeip inserts the session identifier
   * @default true
   */
  has_session_handling?: boolean

  /**
   * If set to a positive value, it enables the io_context object's event processing
   * run_for implementation to run the loop based on duration instead of running it
   * until the work queue has work to be done
   * @default 0
   */
  event_loop_periodicity?: number
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  /**
   * Network identifier used to support multiple routing managers on one host.
   * This setting changes the name of the unix domain sockets in /tmp/.
   * @default "vsomeip"
   */
  network?: string

  /**
   * The diagnosis address (byte) that will be used to build client identifiers.
   * The diagnosis address is assigned to the most significant byte in all client identifiers
   * if not specified otherwise (for example through a predefined client ID)
   * @default 0x01
   */
  diagnosis?: string

  /**
   * The diagnosis mask (2 byte) is used to control the maximum amount of allowed
   * concurrent vsomeip clients on an ECU and the start value of the client IDs.
   * @default 0xFF00
   */
  diagnosis_mask?: string

  /**
   * The IP address of the host system
   */
  unicast?: string

  /**
   * The netmask to specify the subnet of the host system
   */
  netmask?: string

  /**
   * If specified, IP endpoints will be bound to this device
   */
  device?: string
}

/**
 * Dispatching configuration
 * Define default settings for the maximum number of (additional) dispatchers
 * and the maximum dispatch time. These default values are overwritten by
 * application specific definitions.
 */
export interface DispatchingConfig {
  /**
   * The maximum number of threads that shall be used to execute the application callbacks
   * @default 10
   */
  max_dispatchers?: number

  /**
   * The maximum time in ms that an application callback may consume before the callback
   * is considered to be blocked (and an additional thread is used to execute pending
   * callbacks if max_dispatchers is configured greater than 0)
   * @default 100
   */
  max_dispatch_time?: number
}

/**
 * Main vSomeIP Configuration Interface
 *
 * This interface represents the complete configuration structure for vSomeIP 3.5.5.
 * It combines all sub-interfaces to provide a comprehensive type-safe configuration.
 *
 * @see {@link https://github.com/GENIVI/vsomeip/wiki/vsomeip-in-10-minutes#configuration}
 */
export interface SomeipConfig
  extends GlobalPayloadConfig,
    GlobalQueueConfig,
    TcpRestartConfig,
    FilePermissionsConfig {
  /**
   * Logging configuration for vSomeIP
   * Used to configure the log messages of vSomeIP
   */
  logging?: LoggingConfig

  /**
   * Routing configuration
   * Specifies the properties of the routing. Either a string that specifies the application
   * that hosts the routing component or a structure that specifies all properties of the routing.
   * If the routing is not specified, the first started application will host the routing component.
   */
  routing?: string | RoutingConfig

  /**
   * The UID / GID of the application acting as routing manager.
   * @deprecated Use routing.host.uid and routing.host.gid instead
   * Must be specified if credentials checks are enabled using check_credentials set to true
   * in order to successfully check the routing managers credentials passed on connect
   */
  'routing-credentials'?: RoutingCredentials

  /**
   * Contains the applications of the host system that use this config file
   */
  applications?: ApplicationConfig[]

  /**
   * Network configuration
   */
  network?: NetworkConfig

  /**
   * Configures the time in milliseconds local clients wait for acknowledgement
   * of their deregistration from the routing manager during shutdown
   * @default 5000
   */
  shutdown_timeout?: number

  /**
   * Define default settings for the maximum number of (additional) dispatchers
   * and the maximum dispatch time. These default values are overwritten by
   * application specific definitions.
   */
  dispatching?: DispatchingConfig

  /**
   * Security configuration based on UNIX credentials.
   * If activated every local connection is authenticated during connect using
   * the standard UNIX credential passing mechanism.
   */
  security?: SecurityConfig

  /**
   * Tracing configuration for the Trace Connector
   * Used to forward the internal messages that are sent over the Unix Domain Sockets (UDS) to DLT.
   */
  tracing?: TracingConfig

  /**
   * Specifies the size of the socket receive buffer (SO_RCVBUF) used for UDP client
   * and server endpoints in bytes. Requires CAP_NET_ADMIN to be successful.
   * @default 1703936
   */
  'udp-receive-buffer-size'?: number

  /**
   * Contains settings related to the Service Discovery of the host application
   */
  'service-discovery'?: ServiceDiscoveryConfig

  /**
   * Global nPDU default timings configuration
   * The nPDU feature can be used to reduce network load as it enables the vsomeip stack
   * to combine multiple vsomeip messages in one single ethernet frame.
   */
  'npdu-default-timings'?: NpduDefaultTimingsConfig

  /**
   * Contains the services of the service provider
   */
  services?: ServiceConfig[]

  /**
   * Specifies service/instance ranges for pure internal service-instances.
   * This information is used by vsomeip to avoid sending Find-Service messages
   * via the Service-Discovery when a client is requesting a not available service-instance.
   * Its can either be done on service/instance level or on service level only which
   * then includes all instance from 0x0000-0xffff.
   */
  internal_services?: InternalServiceConfig[]

  /**
   * The client-side ports that shall be used to connect to a specific service.
   * For each service, an array of ports to be used for reliable/unreliable communication
   * can be specified. vsomeip will take the first free port of the list. If no free port
   * can be found, the connection will fail. If vsomeip is asked to connect to a service
   * instance without specified port(s), the port will be selected by the system. This
   * implies that the user has to ensure that the ports configured here do not overlap
   * with the ports automatically selected by the IP stack.
   */
  clients?: ClientConfig[]

  /**
   * The Watchdog sends periodically pings to all known local clients. If a client
   * isn't responding within a configured time/amount of pongs the watchdog deregisters
   * this application/client. If not configured the watchdog isn't activated.
   */
  watchdog?: WatchdogConfig

  /**
   * The Local Clients Keepalive option activates the sending of periodic ping messages
   * from the routing manager clients to the routing host. The routing manager host shall
   * reply to the ping with a pong. The idea is to have a simpler alternetive to the
   * TCP_KEEPALIVE, particularly for systems where this option can not be configured.
   */
  'local-clients-keepalive'?: LocalClientsKeepaliveConfig

  /**
   * This nodes allow to add a list of IP addresses on which CAPI-Selective-Broadcasts
   * feature is supported. If not specified the feature can't be used and the subscription
   * behavior of the stack is same as with normal events.
   */
  supports_selective_broadcasts?: SelectiveBroadcastsConfig[]

  /**
   * Used to configure the E2E protection for the specified events
   */
  e2e?: E2EConfig

  /**
   * Events/fields sent by external devices will be forwarded to the applications
   * only if a configurable function evaluates to true. The function checks whether
   * the event/field payload has changed and whether a specified interval has been
   * elapsed since the last forwarding.
   */
  debounce?: DebounceConfig[]

  /**
   * Service requests done by an application can be debounced to be more efficient
   * if many services are requested simultaneously (e.g. at startup). This configuration
   * variable specified the maximum request debounce time in milliseconds.
   * @default 10
   */
  request_debounce_time?: number

  /**
   * Can be used to modify the assignment of ports to the unsecure, optional and secure ranges.
   */
  acceptances?: AcceptanceConfig[]

  /**
   * List of service instances that are only accepted, if being offered on a secure port.
   */
  'secure-services'?: SecureServiceConfig[]

  /**
   * Allows to group service instances that are offered on the same port into partitions.
   * For each partition, a separate client port will be used. The goal is to enable faster
   * processing of specific events if a single server port is used to offer many services
   * that send many messages, especially at startup.
   */
  partitions?: PartitionConfig[][]

  /**
   * Used to filter the log message "deliver_notification: Event [1234.5678.80f3]
   * is not registered. The message is dropped." that occurs whenever vSomeIP
   * receives an event without having a corresponding object being registered.
   */
  suppress_missing_event_logs?: SuppressMissingEventLogConfig[]
}

export interface SomeipInfo {
  id: string
  name: string
  services: ServiceConfig[]
  device: string
  application: ApplicationConfig
}

// Re-export imported sub-interfaces for convenience
export type {
  GlobalPayloadConfig,
  GlobalQueueConfig,
  TcpRestartConfig,
  FilePermissionsConfig,
  SecurityConfig,
  ServiceDiscoveryConfig,
  TracingConfig,
  ServiceConfig,
  InternalServiceConfig,
  ClientConfig,
  WatchdogConfig,
  LocalClientsKeepaliveConfig,
  SelectiveBroadcastsConfig,
  E2EConfig,
  DebounceConfig,
  AcceptanceConfig,
  SecureServiceConfig,
  PartitionConfig,
  SuppressMissingEventLogConfig,
  NpduDefaultTimingsConfig
}
