# How To Develop New Adapter

`Lin` adapter is similar to `Can` adapter, so you can refer to the `Can` adapter for development.

## Reference Pull Request

You may be able to get some reference from these PRs:

- [#137](https://github.com/ecubus/EcuBus-Pro/pull/137) - Vector Can

## Step by Step Guide

You can get detail steps from [Step by Step Guide](./adapter/detail.md)

## Prerequisites

- [node-gyp](https://github.com/nodejs/node-gyp) - For building native modules
- [napi](https://nodejs.org/api/n-api.html) - Node.js Native API
- [swig](https://www.swig.org/) - Simplified Wrapper and Interface Generator

---

## Create Adapter Folder

Create your adapter in the following directory:

```text
src/main/docan/${adapter_name}
```

## Directory Structure

Each adapter directory should follow this structure:

```text
${adapter_name}/
├── index.ts           # Main adapter implementation file
├── swig/             # SWIG interface definitions
│   ├── ${adapter_name}.i    # Main SWIG interface file
│   ├── buffer.i            # Buffer handling interface
│   └── s.bat               # Build script
├── inc/              # C/C++ header files
└── lib/              # Third-party library files
```

---

## SWIG Interface Implementation

The SWIG interface is crucial for bridging between JavaScript/TypeScript and native C/C++ code. Here's how to implement it:

### 1. Main Interface File (${adapter_name}.i)

Create a main interface file in the `swig` directory:

```swig
%module ${adapter_name}

%header %{
#include <windows.h>
#include <stdlib.h>
#include "your_native_header.h"
%}

%include <stdint.i>
%include <windows.i>
%include "your_native_header.h"

// Define typemaps for buffer handling
%include "./buffer.i"
%typemap(in) (void *data, size_t length) = (const void* buffer_data, const size_t buffer_len);

// Define pointer and array classes
%include <cpointer.i>
%pointer_class(unsigned long, JSUINT64)
%pointer_class(long, JSINT64)
%array_class(uint8_t, ByteArray);

%init %{
  // Add initialization code here
%}
```

### 2. Buffer Interface (buffer.i)

Create a buffer interface file for handling binary data:

```swig
%typemap(in) (const size_t buffer_len,const void* buffer_data) {
  if ($input.IsBuffer()) {
    Napi::Buffer<char> buf = $input.As<Napi::Buffer<char>>();
    $2 = reinterpret_cast<void *>(buf.Data());
    $1 = buf.ByteLength();
  } else {
    SWIG_exception_fail(SWIG_TypeError, "in method '$symname', argument is not a Buffer");
  }
}
```

### 3. Build Script (s.bat)

Create a build script to generate the SWIG wrapper:

```batch
swig -I"./../inc" -c++ -javascript -napi -v ./${adapter_name}.i 
```

### Key Points for SWIG Implementation

1. **Type Mapping**
   - Use `%typemap` for C/C++ to JavaScript type conversion
   - Handle buffers and pointers properly
   - Consider endianness for binary data

2. **Header Inclusion
   - Include system and library headers
   - Use `%header %{ ... %}` for C/C++ code
   - Use `%include` for SWIG interfaces

3. **Error Handling**
   - Implement error checking in typemaps
   - Use `SWIG_exception_fail` for errors
   - Handle memory management carefully

4. **Module Initialization**
   - Use `%init %{ ... %}` for setup code
   - Register callbacks if needed
   - Initialize global variables

### Common SWIG Directives

```swig
%module name          // Define module name
%include file         // Include SWIG interface
%header %{ ... %}     // Include C/C++ code
%typemap(...) ...     // Define type mapping
%pointer_class(...)   // Define pointer class
%array_class(...)     // Define array class
```

---

## Base Class Implementation

All adapters must inherit from the `CanBase` abstract class and implement the following required methods:

```typescript
abstract class CanBase {
  abstract info: CanBaseInfo;           // Adapter basic information
  abstract log: CanLOG;                 // Logging object
  abstract close(): void;               // Close the adapter
  abstract readBase(...): Promise<...>; // Read CAN message
  abstract writeBase(...): Promise<...>;// Write CAN message
  abstract getReadBaseId(...): string;  // Get read ID
  abstract setOption(...): void;        // Set options
  abstract event: EventEmitter;         // Event emitter
}
```

## Required Static Methods

Each adapter class must implement the following static methods:

- `getValidDevices()`: Returns the list of available devices
- `getLibVersion()`: Returns the library version information
- `getDefaultBitrate()`: Returns the default bitrate configuration

---

## Implementation Steps

1. Create adapter directory structure
2. Implement SWIG interface to wrap native libraries
3. Create adapter class and inherit from `CanBase`
4. Implement all required abstract methods
5. Implement static methods
6. Add error handling and logging
7. Implement event handling mechanism
8. Add proper cleanup in close() method
9. Implement proper error propagation

---

## Example: KVASER_CAN Adapter

Reference implementation from the `kvaser` adapter:

```typescript
export class KVASER_CAN extends CanBase {
  event: EventEmitter;
  info: CanBaseInfo;
  handle: number;
  private closed: boolean = false;
  private readAbort: AbortController;

  constructor(info: CanBaseInfo) {
    super();
    this.info = info;
    this.event = new EventEmitter();
    this.readAbort = new AbortController();
    // Initialize native resources
  }

  async readBase(id: number, msgType: CanMsgType, timeout: number): Promise<{ data: Buffer; ts: number }> {
    // Implementation
  }

  async writeBase(id: number, msgType: CanMsgType, data: Buffer): Promise<number> {
    // Implementation
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.readAbort.abort();
    // Cleanup native resources
  }

  // ... other methods
}
```

adapter

## Testing

After implementing the adapter, you should create a test file(`${adapter_name}.test.ts`) in the `test/docan` directory. Here's how to implement the tests:

### 1. Test Setup

```typescript
import { describe, it, beforeAll, afterAll, test } from 'vitest'
import * as path from 'path'

// Load native library
const dllPath = path.join(__dirname, '../../resources/lib')
YOUR_ADAPTER.loadDllPath(dllPath)

describe('adapter test', () => {
  let client!: YOUR_ADAPTER
  
  beforeAll(() => {
    // Initialize adapter with test configuration
    client = new YOUR_ADAPTER({
      handle: 0,
      name: 'test',
      id: 'adapter_name',
      vendor: 'vendor_name',
      canfd: false,
      bitrate: {
        freq: 250000,
        preScaler: 2,
        timeSeg1: 68,
        timeSeg2: 11,
        sjw: 11
      },
      bitratefd: {
        freq: 1000000,
        preScaler: 1,
        timeSeg1: 20,
        timeSeg2: 19,
        sjw: 19
      }
    })
  })

  afterAll(() => {
    // Clean up
    client.close()
  })
})
```

### 2. Test Cases

Implement the following test cases:

1. **Basic Operations**

   ```typescript
   test('basic operations', async () => {
     // Test adapter initialization
     expect(client.info).toBeDefined()
     expect(client.info.name).toBe('test')
     
     // Test device capabilities
     const devices = await YOUR_ADAPTER.getValidDevices()
     expect(devices.length).toBeGreaterThan(0)
     
     // Test version information
     const version = await YOUR_ADAPTER.getLibVersion()
     expect(version).toBeDefined()
   })
   ```

2. **Message Transmission**

   ```typescript
   test('message transmission', async () => {
     // Test single frame transmission
     const result = await client.writeBase(
       3, // CAN ID
       {
         idType: CAN_ID_TYPE.STANDARD,
         brs: false,
         canfd: false,
         remote: false
       },
       Buffer.alloc(8, 0)
     )
     expect(result).toBeDefined()
     
     // Test read operation
     const readResult = await client.readBase(3, {
       idType: CAN_ID_TYPE.STANDARD,
       brs: false,
       canfd: false,
       remote: false
     }, 1000)
     expect(readResult).toBeDefined()
     expect(readResult.data).toBeDefined()
   })
   ```

3. **Multi-frame Transmission**

   ```typescript
   test('multi-frame transmission', async () => {
     const list = []
     for (let i = 0; i < 10; i++) {
       list.push(
         client.writeBase(
           3,
           {
             idType: CAN_ID_TYPE.STANDARD,
             brs: false,
             canfd: false,
             remote: false
           },
           Buffer.alloc(8, i)
         )
       )
     }
     const results = await Promise.all(list)
     expect(results.length).toBe(10)
     expect(results.every(r => r !== undefined)).toBe(true)
   })
   ```

4. **Error Handling**

   ```typescript
   test('error handling', async () => {
     // Test invalid parameters
     await expect(client.writeBase(
       -1, // Invalid CAN ID
       {
         idType: CAN_ID_TYPE.STANDARD,
         brs: false,
         canfd: false,
         remote: false
       },
       Buffer.alloc(8, 0)
     )).rejects.toThrow()
     
     // Test closed adapter
     client.close()
     await expect(client.writeBase(
       3,
       {
         idType: CAN_ID_TYPE.STANDARD,
         brs: false,
         canfd: false,
         remote: false
       },
       Buffer.alloc(8, 0)
     )).rejects.toThrow()
   })
   ```

5. **Event Handling**

   ```typescript
   test('event handling', async () => {
     const messageHandler = jest.fn()
     client.attachCanMessage(messageHandler)
     
     // Trigger some events
     await client.writeBase(3, {
       idType: CAN_ID_TYPE.STANDARD,
       brs: false,
       canfd: false,
       remote: false
     }, Buffer.alloc(8, 0))
     
     // Verify event handling
     expect(messageHandler).toHaveBeenCalled()
     
     client.detachCanMessage(messageHandler)
   })
   ```

### 3. Test Configuration

Make sure to test with different configurations:

- Standard CAN vs CAN FD
- Different bitrates
- Different message types (standard/extended)
- Different data lengths
- Error conditions and recovery
- Timeout scenarios
- Resource cleanup

### 4. Running Tests

Run the tests using:

```bash
npm test
# or
vitest test/docan/${adapter_name}.test.ts
```

Remember to:

- Test on different platforms if your adapter supports multiple platforms
- Test with different hardware configurations
- Test error conditions and recovery scenarios
- Test performance with high message rates
- Test long-running operations for stability
- Test resource cleanup and memory leaks
- Test concurrent operations
- Test timeout handling

---

## Add In UI

1. edit vendor in  `src/main/share/can.ts`

   ```typescript
   export type CanVendor = 'peak' | 'simulate' | 'zlg' | 'kvaser' |  'toomoss'| 'your_adapter_name'
   ```

2. add device in `src/main/docan/can.ts`
   you should edit these functions:
     - `openCanDevice`
     - `getCanVersion`
     - `getCanDevices`
     - `canClean`

3. add device in `src/renderer/src/views/uds/components/hardware.vue`

   ```typescript
   function buildTree() {
     const t: tree[] = []
     const zlg: tree = {
       label: 'ZLG',
       vendor: 'zlg',
       append: false,
       id: 'ZLG',
       children: []
     }
     t.push(zlg)
     addSubTree('zlg', zlg)
     // add your device here
     const your_device: tree = {
       label: 'your_device_name',
       vendor: 'your_adapter_name',
       append: false,
       id: 'your_device_id',
       children: []
     }
     t.push(your_device)
     addSubTree('your_adapter_name', your_device)
   }
   ```

4. then almost done, you can config your device in `Device` window
