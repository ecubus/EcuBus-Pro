# vSomeIP Configuration Interfaces

This directory contains comprehensive TypeScript interfaces for vSomeIP 3.5.5 configuration, based on the official vSomeIP configuration documentation.

## File Structure

The configuration interfaces are split into multiple files for better organization and maintainability:

### Core Files

- **`index.ts`** - Main configuration interface and core sub-interfaces
- **`payload-config.ts`** - Payload size and queue configuration
- **`security-config.ts`** - Security and policy configuration
- **`service-discovery-config.ts`** - Service discovery and tracing configuration
- **`service-config.ts`** - Service, client, and internal service configuration
- **`other-config.ts`** - Other configurations (watchdog, E2E, debounce, etc.)

### Main Interface

The main interface `SomeipConfig` combines all sub-interfaces to provide a comprehensive type-safe configuration:

```typescript
import { SomeipConfig } from './index';

const config: SomeipConfig = {
  logging: {
    level: 'info',
    console: true
  },
  applications: [
    {
      name: 'my-app',
      id: '0x1234'
    }
  ],
  // ... other configuration
};
```

## Key Features

### Complete Coverage
- All configuration options from vSomeIP 3.5.5 documentation
- Comprehensive TypeDoc comments for every property
- Default value annotations with `@default` tags
- Deprecated property annotations with `@deprecated` tags

### Type Safety
- Proper TypeScript types for all configuration options
- Union types for properties that accept multiple value types
- Optional properties to match vSomeIP's flexible configuration
- Complex nested structures properly typed

### Modular Design
- Split into logical sub-interfaces for better organization
- Easy to import specific configuration sections
- Re-exported for convenience

## Configuration Sections

### Logging (`LoggingConfig`)
- Console, file, and DLT logging
- Log levels and statistics
- Version logging configuration

### Routing (`RoutingConfig`)
- Host and guest routing setup
- TCP communication configuration
- Legacy routing credentials

### Applications (`ApplicationConfig`)
- Application definitions and IDs
- Thread management and dispatching
- Plugin configuration

### Network (`NetworkConfig`)
- Diagnosis address and mask
- Unicast and netmask settings
- Device binding

### Security (`SecurityConfig`)
- UNIX credentials authentication
- Security policies and rules
- Container policy extensions
- Security update whitelist

### Service Discovery (`ServiceDiscoveryConfig`)
- Multicast and port configuration
- TTL and timing settings
- Debouncing configuration

### Tracing (`TracingConfig`)
- DLT integration
- Channel and filter configuration
- Message tracing options

### Services (`ServiceConfig`)
- Service and instance definitions
- Events and eventgroups
- Reliable/unreliable communication
- SOME/IP-TP configuration
- nPDU debounce times

### Clients (`ClientConfig`)
- Port configuration and mappings
- Reliable/unreliable port ranges
- Remote service port configuration

### Other Configurations
- **Watchdog** (`WatchdogConfig`) - Health monitoring
- **E2E Protection** (`E2EConfig`) - End-to-end security
- **Debounce** (`DebounceConfig`) - Event filtering
- **Acceptances** (`AcceptanceConfig`) - Port security
- **Partitions** (`PartitionConfig`) - Service grouping

## Usage Examples

### Basic Configuration
```typescript
import { SomeipConfig } from './index';

const basicConfig: SomeipConfig = {
  logging: {
    level: 'info',
    console: true
  },
  applications: [
    {
      name: 'service-app',
      id: '0x1234'
    }
  ],
  services: [
    {
      service: '0x1000',
      instance: '0x0001',
      reliable: {
        port: 30501
      }
    }
  ]
};
```

### Security Configuration
```typescript
import { SecurityConfig } from './security-config';

const securityConfig: SecurityConfig = {
  check_credentials: true,
  allow_remote_clients: false,
  policies: [
    {
      credentials: {
        uid: 1000,
        gid: 1000
      },
      allow: {
        requests: [
          {
            service: '0x1000',
            instances: [
              {
                ids: ['0x0001'],
                methods: ['0x0001']
              }
            ]
          }
        ]
      }
    }
  ]
};
```

### Service Discovery Configuration
```typescript
import { ServiceDiscoveryConfig } from './service-discovery-config';

const sdConfig: ServiceDiscoveryConfig = {
  enable: true,
  multicast: '224.224.224.0',
  port: 30490,
  protocol: 'udp',
  ttl: '0xFFFFFF'
};
```

## Environment Variables

The following environment variables are supported by vSomeIP but are not part of the configuration interface:

- `VSOMEIP_APPLICATION_NAME` - Application name
- `VSOMEIP_CONFIGURATION` - Configuration file path
- `VSOMEIP_CONFIGURATION_<application>` - Application-specific configuration
- `VSOMEIP_MANDATORY_CONFIGURATION_FILES` - Mandatory configuration files
- `VSOMEIP_CLIENTSIDELOGGING` - Client-side logging
- `VSOMEIP_CONFIGURATION_MODULE` - Configuration module (TBD)
- `VSOMEIP_E2E_PROTECTION_MODULE` - E2E protection module (TBD)
- `VSOMEIP_LOAD_PLUGINS` - Plugin loading (TBD)

## Version Compatibility

These interfaces are based on vSomeIP 3.5.5 configuration documentation. For other versions, please refer to the corresponding documentation.

## References

- [vSomeIP Configuration Documentation](https://github.com/GENIVI/vsomeip/wiki/vsomeip-in-10-minutes#configuration)
- [vSomeIP GitHub Repository](https://github.com/GENIVI/vsomeip) 