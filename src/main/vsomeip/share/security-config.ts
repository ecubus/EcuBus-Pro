/**
 * Security Configuration Interfaces
 */

/**
 * Security credentials configuration
 */
export interface SecurityCredentials {
  /**
   * Specifies the LINUX User ID of the client application as decimal number.
   * As a wildcard "any" can be used.
   */
  uid?: number | 'any'

  /**
   * Specifies the LINUX Group ID of the client application as decimal number.
   * As a wildcard "any" can be used.
   */
  gid?: number | 'any'

  /**
   * Specifies whether the LINUX user and group ids are allowed or denied for the policy.
   */
  allow?: {
    /**
     * Specifies a list of LINUX user ids. These may either be specified as decimal
     * numbers or as ranges. Ranges are specified by the first and the last valid id.
     */
    uid?: Array<number | { first: number; last: number }>

    /**
     * Specifies a list of LINUX group ids. These may either be specified as decimal
     * numbers or as ranges. Ranges are specified by the first and the last valid id.
     */
    gid?: Array<number | { first: number; last: number }>
  }

  /**
   * Specifies whether the LINUX user and group ids are allowed or denied for the policy.
   */
  deny?: {
    /**
     * Specifies a list of LINUX user ids. These may either be specified as decimal
     * numbers or as ranges. Ranges are specified by the first and the last valid id.
     */
    uid?: Array<number | { first: number; last: number }>

    /**
     * Specifies a list of LINUX group ids. These may either be specified as decimal
     * numbers or as ranges. Ranges are specified by the first and the last valid id.
     */
    gid?: Array<number | { first: number; last: number }>
  }
}

/**
 * Security request/offer configuration
 */
export interface SecurityRequestOffer {
  /**
   * Specifies a service for the requests/offers
   */
  service: string

  /**
   * Specifies a instance for the requests/offers. As a wildcard "any" can be used which
   * means a range from instance ID 0x01 to 0xFFFF which also implies a method
   * ID range from 0x01 to 0xFFFF.
   * @deprecated Use instances instead
   */
  instance?: string

  /**
   * Specifies a set of instance ID and method ID range pairs which are allowed/denied
   * to communicate with. If the ids tag below is not used to specify allowed/denied
   * requests on method ID level one can also only specify a a set of instance
   * ID ranges which are allowed to be requested analogous to the allowed offers section.
   * If no method IDs are specified, the allowed methods are by default a range
   * from 0x01 to 0xFFFF.
   */
  instances?: Array<{
    /**
     * Specifies a set of instance ID ranges which are allowed/denied to communicate with.
     * It is also possible to specify a single instance ID as array element without
     * giving an upper / lower range bound. As a wildcard "any" can be used which
     * means a range from instance ID 0x01 to 0xFFFF.
     */
    ids?: Array<string | { first: string; last: string }>

    /**
     * Specifies a set of method ID ranges which are allowed/denied to communicate with.
     * It is also possible to specify a single method ID as array element without
     * giving an upper / lower range bound. As a wildcard "any" can be used which
     * means a range from method ID 0x01 to 0xFFFF.
     */
    methods?: Array<string | { first: string; last: string }>
  }>
}

/**
 * Security allow/deny configuration
 */
export interface SecurityAllowDeny {
  /**
   * Specifies a set of service instance pairs which the above client application
   * using the credentials above is allowed/denied to communicate with.
   */
  requests?: SecurityRequestOffer[]

  /**
   * Specifies a set of service instance pairs which are allowed/denied to be offered
   * by the client application using the credentials above.
   */
  offers?: Array<{
    /**
     * Specifies a service for the offers
     */
    service: string

    /**
     * Specifies a instance for the offers. As a wildcard "any" can be used which
     * means a range from instance ID 0x01 to 0xFFFF.
     * @deprecated Use instances instead
     */
    instance?: string

    /**
     * Specifies a set of instance ID ranges which are allowed/denied to be offered by
     * the client application using the credentials above. It is also possible to
     * specify a single instance ID as array element without giving an upper /
     * lower range bound. As a wildcard "any" can be used which means a range
     * from instance ID 0x01 to 0xFFFF.
     */
    instances?: Array<string | { first: string; last: string }>
  }>
}

/**
 * Security policy configuration
 */
export interface SecurityPolicy {
  /**
   * Specifies the credentials for which a security policy will be applied.
   * If check_credentials is set to true the credentials of a local application
   * needs to be specified correctly to ensure local socket authentication can succeed.
   */
  credentials?: SecurityCredentials

  /**
   * This tag specifies either allow or deny depending on white or blacklisting is needed.
   * Specifying allow and deny entries in one policy is therefore not allowed.
   */
  allow?: SecurityAllowDeny

  /**
   * This tag specifies either allow or deny depending on white or blacklisting is needed.
   * Specifying allow and deny entries in one policy is therefore not allowed.
   */
  deny?: SecurityAllowDeny
}

/**
 * Security configuration based on UNIX credentials.
 * If activated every local connection is authenticated during connect using
 * the standard UNIX credential passing mechanism.
 */
export interface SecurityConfig {
  /**
   * Specifies whether security checks are active or not. This includes credentials
   * checks on connect as well as all policies checks configured in follow.
   * @default false
   */
  check_credentials?: boolean

  /**
   * Specifies whether incoming remote requests / subscriptions are allowed to be sent
   * to a local proxy / client. If not specified, all remote requests / subscriptions
   * are allowed to be received by default.
   * @default true
   */
  allow_remote_clients?: boolean

  /**
   * Specifies the security policies. Each policy at least needs to specify allow or deny.
   */
  policies?: SecurityPolicy[]

  /**
   * Container policy extensions configuration
   * Specifies the additional configuration folders to be loaded for each container hostname / filesystem path pair.
   */
  container_policy_extensions?: Array<{
    /**
     * Specifies the linux hostname
     */
    container: string

    /**
     * Specifies a filesystem path (relative to vsomeip_policy_extensions.json or absolute)
     * which contains $UID_$GID subfolders that hold a vsomeip_security.json file.
     * NOTE: ($UID / $GID is the UID /GID of the vsomeip client application to which
     * a client from hostname defined with container connects to.
     */
    path: string
  }>

  /**
   * Security update whitelist configuration
   * @deprecated TBD - This feature is still under development
   */
  'security-update-whitelist'?: {
    /**
     * Range of possible uids to use. Possible values are any, or range based using the tags first and last.
     * The range based possible values are dec/hex values or min/max respectively.
     */
    uids?: 'any' | { first: string | number; last: string | number }

    /**
     * Range of possible services to use. Possible values are any, or range based using the tags first and last.
     * The range based possible values are dec/hex values or min/max respectively.
     */
    services?: 'any' | { first: string | number; last: string | number }

    /**
     * Enables or disables the whitelist. Possible values are true or false.
     */
    'check-whitelist'?: boolean
  }
}
