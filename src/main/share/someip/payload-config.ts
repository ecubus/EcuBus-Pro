/**
 * Payload and Queue Size Configuration Interfaces
 */

/**
 * Payload size configuration for specific IP and port
 */
export interface PayloadSizeConfig {
  /**
   * IP Address of:
   * - On client side: the IP of the remote service for which the payload size should be limited.
   * - On service side: the IP of the offered service for which the payload size for receiving
   *   and sending should be limited.
   */
  unicast: string

  /**
   * Array which holds pairs of port and payload size statements
   */
  ports: Array<{
    /**
     * The ports regarding:
     * - On client side: the port of the remote service for which the payload size should be limited.
     * - On service side: the port of the offered service for which the payload size for receiving
     *   and sending should be limited.
     */
    port: string

    /**
     * The payload regarding:
     * - On client side: the payload size limit in bytes of a message sent to the remote service
     *   hosted on beforehand specified IP and port.
     * - On service side: the payload size limit in bytes of messages received and sent by the
     *   service offered on previously specified IP and port. If multiple services are hosted
     *   on the same port they all share the limit specified.
     */
    'max-payload-size': string
  }>
}

/**
 * Endpoint queue size configuration for specific IP and port
 */
export interface EndpointQueueConfig {
  /**
   * - On client side: The IP of the remote service for which the queue size of sent requests should be limited.
   * - On service side: The IP of the offered service for which the queue size for sent responses should be limited.
   *   This IP address is therefore identical to the IP address specified via unicast setting on top level of the json file.
   */
  unicast: string

  /**
   * Array which holds pairs of port and queue size statements
   */
  ports: Array<{
    /**
     * - On client side: the port of the remote service for which the queue size of sent requests should be limited.
     * - On service side: the port of the offered service for which the queue size for send responses should be limited.
     */
    port: string

    /**
     * - On client side: the queue size limit in bytes of messages sent to the remote service
     *   hosted on beforehand specified IP and port.
     * - On service side: the queue size limit in bytes for responses sent by the service
     *   offered on previously specified IP and port. If multiple services are hosted on
     *   the same port they all share the limit specified.
     */
    'queue-size-limit': string
  }>
}

/**
 * Global payload size configuration
 */
export interface GlobalPayloadConfig {
  /**
   * Array to limit the maximum allowed payload sizes per IP and port.
   * If not specified otherwise the allowed payload sizes are unlimited.
   * The settings in this array only affect communication over TCP.
   * To limit the local payload size max-payload-size-local can be used.
   */
  'payload-sizes'?: PayloadSizeConfig[]

  /**
   * The maximum allowed payload size for node internal communication in bytes.
   * By default the payload size for node internal communication is unlimited.
   * It can be limited via this setting.
   */
  'max-payload-size-local'?: string

  /**
   * The maximum allowed payload size for TCP communication in bytes.
   * By default the payload size for TCP communication is unlimited.
   * It can be limited via this setting.
   */
  'max-payload-size-reliable'?: string

  /**
   * The maximum allowed payload size for UDP communication via SOME/IP-TP in bytes.
   * By default the payload size for UDP via SOME/IP-TP communication is unlimited.
   * It can be limited via this setting. This setting only applies for SOME/IP-TP enabled
   * methods/events/fields (otherwise the UDP default of 1400 bytes applies).
   */
  'max-payload-size-unreliable'?: string

  /**
   * The number of processed messages which are half the size or smaller than the allocated
   * buffer used to process them before the memory for the buffer is released and starts
   * to grow dynamically again. This setting can be useful in scenarios where only a small
   * number of the overall messages are a lot bigger then the rest and the memory allocated
   * to process them should be released in a timely manner. If the value is set to zero
   * the buffer sizes aren't reset and are as big as the biggest processed message.
   * @default 5
   */
  'buffer-shrink-threshold'?: number
}

/**
 * Global endpoint queue configuration
 */
export interface GlobalQueueConfig {
  /**
   * Array to limit the maximum allowed size in bytes of cached outgoing messages per IP and port
   * (message queue size per endpoint). If not specified otherwise the allowed queue size is unlimited.
   * The settings in this array only affect external communication.
   * To limit the local queue size endpoint-queue-limit-local can be used.
   */
  'endpoint-queue-limits'?: EndpointQueueConfig[]

  /**
   * Setting to limit the maximum allowed size in bytes of cached outgoing messages
   * for external communication (message queue size per endpoint). By default the queue
   * size for external communication is unlimited. It can be limited via this setting.
   * Settings done in the endpoint-queue-limits array override this setting.
   */
  'endpoint-queue-limit-external'?: string

  /**
   * Setting to limit the maximum allowed size in bytes of cached outgoing messages
   * for local communication (message queue size per endpoint). By default the queue
   * size for node internal communication is unlimited. It can be limited via this setting.
   */
  'endpoint-queue-limit-local'?: string
}

/**
 * TCP restart configuration
 */
export interface TcpRestartConfig {
  /**
   * Setting to limit the number of TCP client endpoint restart aborts due to unfinished TCP handshake.
   * After the limit is reached, a forced restart of the TCP client endpoint is done if the
   * connection attempt is still pending.
   * @default 5
   */
  'tcp-restart-aborts-max'?: number

  /**
   * Setting to define the maximum time until the TCP client endpoint connection attempt
   * should be finished. If tcp-connect-time-max is elapsed, the TCP client endpoint is
   * forcefully restarted if the connection attempt is still pending.
   * @default 5000
   */
  'tcp-connect-time-max'?: number
}

/**
 * File permissions configuration
 */
export interface FilePermissionsConfig {
  /**
   * If UDS is used, this configures the user file-creation mode mask (umask)
   * for the permissions of the sockets
   * @default 0666
   */
  'permissions-uds'?: string
}
