# CAN E2E (End-to-End) Protection Example

## Overview

This example demonstrates how to implement End-to-End (E2E) protection for CAN messages using CRC8 checksum and sequence counter. E2E protection is a safety mechanism commonly used in automotive systems to detect message corruption, loss, or replay attacks.

## E2E Protection Mechanism

The example implements a simple E2E protection scheme where:
- **Byte 6**: Contains a sequence counter (0-255, wraps around)
- **Byte 7**: Contains a CRC8 checksum computed over bytes 0-6

This ensures that:
1. Message sequence can be tracked (counter)
2. Message integrity can be verified (CRC8 checksum)
3. Missing or corrupted messages can be detected

## Code Example

```typescript
import {CRC} from 'ECB'

let cnt=0;
const crc8=CRC.buildInCrc('CRC8')!
Util.setTxPending((msg)=>{
    if(msg.id==1&&msg.data.length==8){
        msg.data[6]=(cnt++)%256;
        msg.data[7]=crc8.compute(msg.data.subarray(0,7))
        return msg.data
    }else{
        return msg.data
    }
})
```

## How It Works

1. **CRC8 Initialization**: Creates a CRC8 calculator using the built-in CRC module
2. **Message Interception**: Uses `Util.setTxPending` to intercept all outgoing CAN messages before transmission
3. **E2E Protection**: For messages with ID 1 and 8-byte length:
   - Updates byte 6 with an incrementing counter (modulo 256)
   - Computes CRC8 checksum over bytes 0-6
   - Writes the checksum to byte 7
4. **Message Transmission**: Returns the modified message data for transmission

