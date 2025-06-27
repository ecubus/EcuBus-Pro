# CAN

CAN/CAN-FD is an industry-standard vehicle bus protocol designed for reliable ECU communication in automotive applications.

> [!IMPORTANT]
> Some features described in this section may require a CAN DBC file. For more information about DBC files, please refer to our [database documentation](../dbc).

Supported Hardware:

| Manufacturer | Protocols |
|--------|-------------------|
| PEAK | CAN, CAN-FD |
| KVASER | CAN, CAN-FD |
| ZLG | CAN, CAN-FD |
| Toomoss | CAN, CAN-FD |
| VECTOR | CAN, CAN-FD |
| SLCAN | CAN, CAN-FD |

## SLCAN Special

SLCAN is a low-cost open-source solution, with firmware sourced from [canable-fw](https://github.com/normaldotcom/canable-fw), and communication based on USB-ACM. 
> [!NOTE]
> This firmware currently does not provide any ACK/NACK feedback for serial commands.


## Device Configuration

For demonstration purposes, we'll use a simulated device. You can configure the baud rate and sample point in the device settings.

![alt text](image.png)

### Baud Rate Setting

The baud rate setting is used to configure the baud rate of the CAN bus.

Click the `Bit Timing` button to open the bit timing configuration window.
![alt text](image-8.png)
![alt text](image-9.png)



## Interactive Mode and Node Scripts

EcuBus-Pro offers two primary methods for CAN communication:

- Interactive Mode: For manual frame transmission
- Node Scripts: For automated communication using custom scripts

![alt text](image-1.png)

### Interactive Mode

Each frame can be configured for periodic transmission or manual triggering (single-shot or key-bound).
![alt text](image-2.png)

You can add frames in two ways:

- Manual frame configuration
- Import from DBC database
  ![alt text](image-3.png)

### Node Scripts

Nodes can be configured with UDS capabilities (tester) and custom scripts.
![alt text](image-4.png)

Example script for periodic signal updates:

```typescript
import { setSignal } from 'ECB'
let val = 0
// Update signal value every second
setInterval(() => {
  setSignal('Model3CAN.VCLEFT_liftgateLatchRequest', val++ % 5)
}, 1000)
```

## Diagnostic Operations

1. **Tester Configuration**

   - Configure addressing
   - Set diagnostic parameters
     ![alt text](image-5.png)

2. **Diagnostic Services**

   - Configure diagnostic services
   - Create schedule tables and sequences
     ![alt text](image-6.png)

3. **Message Monitoring**
   - View transmitted and received messages in the trace window
     ![alt text](image-7.png)
