# CAN

CAN/CAN-FD is an industry-standard vehicle bus protocol designed for reliable ECU communication in automotive applications.

> [!IMPORTANT]
> Some features described in this section may require a CAN DBC file. For more information about DBC files, please refer to our [database documentation](../dbc).

Supported Hardware:

| Manufacturer | Protocols   |
| ------------ | ----------- |
| PEAK         | CAN, CAN-FD |
| KVASER       | CAN, CAN-FD |
| ZLG          | CAN, CAN-FD |
| Toomoss      | CAN, CAN-FD |
| VECTOR       | CAN, CAN-FD |
| SLCAN        | CAN, CAN-FD |

## SLCAN Special

SLCAN is a low-cost open-source solution, with firmware sourced from [canable-fw](https://github.com/normaldotcom/canable-fw), and communication based on USB-ACM.

> [!NOTE]
> This firmware currently does not provide any ACK/NACK feedback for serial commands.

## GS_USB

Windows/Linux/Mac CAN driver based on usbfs or WinUSB WCID for Geschwister Schneider USB/CAN devices and candleLight USB CAN interfaces.

### Linux gs_usb

Linux kernels 3.7 and above have merged the `gs_usb` driver.
Check if the `gs_usb` module is enabled using

```bash
lsmod | grep gs_usb
```

If it's not loaded, use

```bash
sudo modprobe gs_usb
```

To remove it, use

```bash
sudo rmmod gs_usb
```

Configure automatic loading at startup:

```bash
echo "gs_usb"  | sudo tee /etc/modules-load.d/gs_usb.conf
```

Non-root users require corresponding user group membership.

Use `devadm` to monitor device connections and obtain the precise device path:

```bash
sudo devadm monitor --property
```

Check the device group ownership. Assuming `ttyUSB0` (actual device may vary):

```bash
stat -c "%G" /dev/ttyUSB0
```

- Arch Linux: Should return `uucp`

```bash
sudo usermod -aG uucp $USER
newgrp uucp
```

- Debian/Ubuntu: Should return `dialout`
- Fedora/RHEL: Should return `dialout`

```bash
sudo usermod -aG dialout $USER
newgrp dialout
```

## Device Configuration

For demonstration purposes, we'll use a simulated device. You can configure the baud rate and sample point in the device settings.

![alt text](../../../media/um/can/image.png)

### Baud Rate Setting

The baud rate setting is used to configure the baud rate of the CAN bus.

Click the `Bit Timing` button to open the bit timing configuration window.
![alt text](../../../media/um/can/image-8.png)
![alt text](../../../media/um/can/image-9.png)

## Interactive Mode and Node Scripts

EcuBus-Pro offers two primary methods for CAN communication:

- Interactive Mode: For manual frame transmission
- Node Scripts: For automated communication using custom scripts

![alt text](../../../media/um/can/image-1.png)

### Interactive Mode

Each frame can be configured for periodic transmission or manual triggering (single-shot or key-bound).
![alt text](../../../media/um/can/image-2.png)

You can add frames in two ways:

- Manual frame configuration
- Import from DBC database
  ![alt text](../../../media/um/can/image-3.png)

### Node Scripts

Nodes can be configured with UDS capabilities (tester) and custom scripts.
![alt text](../../../media/um/can/image-4.png)

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
     ![alt text](../../../media/um/can/image-5.png)

2. **Diagnostic Services**

   - Configure diagnostic services
   - Create schedule tables and sequences
     ![alt text](../../../media/um/can/image-6.png)

3. **Message Monitoring**
   - View transmitted and received messages in the trace window
     ![alt text](../../../media/um/can/image-7.png)

