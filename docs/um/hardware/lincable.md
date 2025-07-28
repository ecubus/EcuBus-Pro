<script setup>
import LinCableProductPage from './components/LinCableProductPage.vue'
</script>
# EcuBus LinCable – USB to LIN Adapter for Automotive Development

<LinCableProductPage />



The EcuBus LinCable adapter enables seamless connection of a LIN network to a computer via
USB Type-C. Supporting a single LIN channel.

**Board dimensions:** 59mm (height) × 19mm (length)


## Fault Injection and Conformance Testing

With built-in advanced fault injection capabilities, LinCable allows engineers to simulate
various error conditions and perform comprehensive conformance testing. This is essential
for validating the robustness and reliability of LIN nodes and networks during development
and quality assurance.

>Follow ISO/DIS 17987-6

---

### Break Field/Delimiter Length Control
- **Break Length Length**: Adjustable break field length from 13 to 26 bits (default: 13 bits)
- **Break Delimiter Length**: Configurable delimiter length from 0 to 14.6 bits (default: 1 bit)

### Inter-byte Spacing Control
- **Header Inter-byte Space**: Control spacing between sync byte and identifier field (0-14 bits, default: 0)
- **Data Inter-byte Space**: Individual control of spacing between each data byte (0-4 bits per byte)

### Sync/PID Field Customization
- **Sync Value Override**: Custom sync byte value or disable sync transmission entirely (default: 0x55, false means master do not send sync val)
- **PID Override**: Custom Protected Identifier (PID) value or disable PID transmission (default: getPID(frameId), false means master do not send pid)

### Bit-level Fault Injection
- **Precise Bit Manipulation**: Inject faults at any specific bit position starting from the break field
- **Bit Value Control**: Force specific bits to high (1) or low (0) states

### Checksum Override
- **Checksum Override**: Override the checksum with a custom value

---

> See [Lin Conformance Test Example](../../../resources/examples/lin_conformance_test/readme.md) for more details.   

## Advanced LIN Protocol Support

LinCable fully supports the LIN 2.0, 2.1, 2.2A, and SAE J2602 standards, providing
compatibility with a wide range of automotive LIN devices and networks. Supported baud rates
include 19200, 10400, 9600, and 2400 bps, making LinCable suitable for both legacy and
modern LIN applications.

## PWM Output Capability

LinCable includes advanced [PWM](../pwm/pwm.md) output functionality, making it
a versatile tool for automotive development and testing. The PWM output feature enables
precise control of digital signals for various automotive applications.

### PWM Output Specifications
- **Frequency Range**: 1 Hz to 20KHz with high precision
- **Duty Cycle Control**: 0% to 100% with 0.1% resolution
- **Output Voltage**: High level equals VBAT input voltage, low level equals 0V
- **Channel Count**: Single PWM output channel
- **Frequency Accuracy**: ±0.1% typical


## Cross-Platform and Software Integration

LinCable is fully compatible with Windows, macOS, and Linux operating systems (USB-ACM driver). It integrates
seamlessly with the **EcuBus-Pro** software suite, and also supports third-party automotive
development tools. A comprehensive SDK and API are provided for custom application
development.

## Open Communication Protocol for Secondary Development

LinCable provides an open communication protocol that enables users to perform secondary development
and customization according to their specific requirements. The protocol is well-documented and
includes comprehensive APIs, allowing developers to integrate LinCable into their own applications
or create custom solutions for specialized automotive testing scenarios. This open architecture
ensures flexibility and extensibility for advanced users who need tailored functionality beyond
the standard features.

## DFU Firmware Update Support

LinCable supports Device Firmware Update (DFU) functionality, allowing users to easily update
the device firmware to the latest version or install custom firmware. This feature ensures that
LinCable can be kept up-to-date with the latest improvements, bug fixes, and new features without
requiring hardware replacement. The DFU process is straightforward and can be performed through
the EcuBus-Pro software or dedicated DFU tools, providing a reliable and safe method for firmware
updates.
