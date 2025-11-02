# NSUC1612 LIN OTA Example

This example demonstrates how to perform Over-The-Air (OTA) firmware updates on an NSUC1612 ECU using LIN (Local Interconnect Network) protocol with LIN-UDS (Unified Diagnostic Services based on LIN-TP).

> [!INFO]
> The NSUC1612 series is a dedicated processor chip that integrates 4-channel/3-channel half-bridge drivers, suitable for controlling low-power motors. It can drive brushed DC motors, brushless DC motors, stepper motors, etc., and is widely used in the automotive industry.

## Overview

The example includes:

- LIN-TP used for communication
- Load dll security access key generation
- Calculate firmware CRC checksums in `tester.ts`

## Files Structure

```text
NSUC1612_LIN_OTA/
├── NSUC1612_LIN_OTA.ecb     # Main project configuration
├── tester.ts                # TypeScript test script
├── readme.md                # This documentation
├── firmware/
│   └── project_rom_boot.bin # Firmware binary file
├── algorithm/
│   └── GenerateKeyEx.dll    # Security access key generation
└── System32/
    ├── ucrtbased.dll        # Runtime libraries
    └── vcruntime140d.dll
```

## Usage

1. **Hardware Setup**: Connect your [LinCable](https://app.whyengineer.com/docs/um/hardware/lincable.html) device to COM5 (or update the configuration)
2. **ECU Connection**: Ensure NSUC1612 ECU is connected via LIN bus
3. **Run the Test**: Execute the tester script to perform the OTA validation

## Code Example

```typescript
// Read firmware file
const fw = path.join(process.env.PROJECT_ROOT, 'firmware', 'project_rom_boot.bin')
const content = await fs.readFile(fw)

// Calculate CRC32_JAMCRC checksum
const crc = CRC.buildInCrc('CRC32_JAMCRC')
const crcValue = crc.computeBuffer(content)

// Create and execute diagnostic service
const service = DiagRequest.from('NSUC1612_LIN_UDS_Tester.RoutineControl_routineID$F001')
service.diagSetParameterRaw('routineControlOptionRecord', crcValue)
await service.changeService()
```
