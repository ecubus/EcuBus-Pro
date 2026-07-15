# UDS over Serial (UART-CAN)

EcuBus-Pro can run a complete **UDS / ISO 15765-2 (CAN-TP) protocol stack** over a standard serial port.

The **UDS** device, implemented internally by the `uartcan` vendor, presents the serial port as a virtual CAN bus. Each CAN frame is transferred over UART as a fixed 13-byte record.

Almost everything available on a physical CAN device can also be used here, including:

* UDS Tester
* Diagnostic sequences
* Multi-frame transmission with flow control
* Tester Present
* CAN Interactive panels
* Trace window

This is particularly useful when your MCU does not have a CAN transceiver, or when no CAN debugging interface is available. You only need to implement a small UART bridge on the MCU side, and the complete diagnostic toolchain can then be reused.

## On-Wire Frame Format

Each CAN frame is represented by a fixed **13-byte** record. The format is compatible with the SocketCAN `can_frame` layout commonly used by MCU-side UART-to-CAN bridges.

| Byte | Description                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 0–3  | CAN ID as a big-endian `uint32`. Bit 31 (`0x80000000`) indicates an extended 29-bit frame. Bit 30 (`0x40000000`) indicates a remote frame. |
| 4    | DLC, from 0 to 8                                                                                                                           |
| 5–12 | CAN data, padded with zeros to 8 bytes                                                                                                     |

Example: CAN ID `0x7AA`, data `03 22 F1 90`:

```text
00 00 07 AA 04 03 22 F1 90 00 00 00 00
```

To recover from corrupted or misaligned byte streams, the receiver validates the DLC and the reserved CAN ID bits of each candidate record.

If the serial line remains idle for more than 100 ms, any incomplete record is discarded.

## Adding a UDS Device

1. Open the **Devices** window from **Hardware → Devices**.
2. Under the **Serial** group, select **UDS**, and then click the **+** button.
3. Select the serial **Device** or COM port.
4. Configure **Frequency**. This value represents the **UART baud rate**, not the CAN bus bitrate. The default value is `115200`.
5. Click **Add Device**.

![uds-device](../../../media/um/serial/uds-device.png)

> [!IMPORTANT]
> A serial port can only be opened by one program or device at a time.
>
> Close any serial terminal or serial assistant application that is currently using the port. Do not configure both a standard Serial device and a UDS device on the same COM port. Otherwise, the project will fail to start with an `Access denied` error.

## Interactive Transmission

In the **Network** window, you can add a Serial Interactive panel to transmit raw serial data.

To use the `UDS over Serial` feature, add a CAN Interactive panel instead:

![serial-network](../../../media/um/serial/serial-network.png)

* **Serial IA** (`Serial → Interactive`): Sends bytes exactly as entered. To transmit a valid CAN frame, you must enter the complete 13-byte record, for example:

  ```text
  00 00 07 AA 04 03 22 F1 90 00 00 00 00
  ```

* **CAN IA** (`CAN → Interactive`): The UDS device behaves as a CAN device, so the standard CAN panel with ID, DLC, and Data fields can also be used. EcuBus-Pro automatically packs the CAN frame into the 13-byte UART record.

## Running UDS Diagnostics

Create a **CAN Tester** from **Diagnostics → Tester**, and configure the diagnostic address pair, for example:

```text
TxId: 0x7AA
RxId: 0x7AB
```

After the project starts, diagnostic services and sequences operate over the serial port in the same way as they do on a physical CAN bus.

Supported functions include:

* ISO-TP multi-frame transmission
* First Frame, Consecutive Frame, and Flow Control handling
* Functional addressing
* Tester Present

## Transmission Examples

* **Serial IA**: Send the raw 13-byte UART record through the Serial Interactive panel.
* **CAN IA**: Send CAN or diagnostic frames through the CAN Interactive panel.
* **Sequence**: Add a UDS Tester and transmit diagnostic requests through a diagnostic sequence.

![serial-ia](../../../media/um/serial/serial-transmit.gif)

## MCU-Side Bridge

Only a small bridge implementation is required on the MCU side:

1. Collect UART bytes until a complete 13-byte record has been received. Reset the receive counter after an idle timeout, such as 100 ms.
2. Parse the CAN ID, DLC, and data, and pass the frame to the ISO-TP or UDS stack as though it had been received from a physical CAN controller.
3. In the transmit direction, pack each outgoing CAN frame into the same 13-byte format, pad the data field to 8 bytes, and write the record to UART.

Any ISO 15765-2-compliant ISO-TP implementation can be used, such as [isotp-c](https://github.com/openxc/isotp-c).
