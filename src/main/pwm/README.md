# PWM Control Implementation

This module provides a simplified PWM (Pulse Width Modulation) control system for the EcuBus platform.

## Overview

The PWM implementation consists of:

- **PwmBase**: Abstract base class defining the PWM interface
- **EcuBusPwm**: Concrete implementation for EcuBus PWM devices
- **Factory functions**: For creating and managing PWM devices

## Features

- **Device Management**: Open/close PWM devices
- **Duty Cycle Control**: Set duty cycle from 0-100%
- **Frequency Configuration**: Set during device construction (cannot be changed afterward)
- **Polarity Configuration**: Set during device construction (cannot be changed afterward)
- **Error Handling**: Comprehensive error handling and logging
- **Event System**: Real-time status updates via events

## Key Design Principle

**Frequency and polarity are configured during device construction and cannot be modified afterward. Only duty cycle can be changed during operation.**

## Usage

### Basic Usage

```typescript
import { createPwmDevice, getValidPwmDevices, PwmBaseInfo } from './pwm'

async function controlPwm() {
  // Get available devices
  const devices = await getValidPwmDevices()
  
  if (devices.length === 0) {
    console.log('No PWM devices found')
    return
  }
  
  // Create device info with frequency and polarity configured
  const pwmInfo: PwmBaseInfo = {
    id: 'my-pwm',
    device: devices[0],
    baudRate: 115200,
    freq: 1000,        // 1kHz frequency (configured during construction)
    initDuty: 50,      // 50% initial duty cycle
    polarity: false,   // Active low (configured during construction)
    resetStatus: false,
    vendor: 'ecubus',
    name: 'My PWM Device'
  }
  
  // Create and use PWM device
  const pwm = createPwmDevice(pwmInfo)
  
  await pwm.open()           // Frequency and polarity are set during initialization
  pwm.setDutyCycle(25)       // Only duty cycle can be modified
  pwm.setDutyCycle(75)       // Change duty cycle as needed
  await pwm.close()
}
```

### Advanced Usage

```typescript
import { EcuBusPwm } from './pwm/ecubus'

// Direct device creation
const pwm = new EcuBusPwm(pwmInfo)

// Event handling
pwm.on('pwm-info', (data) => {
  console.log('PWM Info:', data)
})

pwm.on('pwm-error', (data) => {
  console.error('PWM Error:', data)
})

pwm.on('close', () => {
  console.log('PWM device closed')
})
```

## API Reference

### PwmBase (Abstract Class)

#### Methods

- `open(): Promise<void>` - Open the PWM device
- `close(): Promise<void>` - Close the PWM device
- `setDutyCycle(dutyCycle: number): void` - Set duty cycle (0-100%)
- `isDeviceOpen(): boolean` - Check if device is open
- `getInfo(): PwmBaseInfo` - Get device info

### EcuBusPwm

#### Constructor

```typescript
constructor(info: PwmBaseInfo)
```

**Note**: Frequency and polarity are configured in the `info` parameter and cannot be changed after construction.

#### Static Methods

- `getValidDevices(): Promise<PwmDevice[]>` - Get available EcuBus PWM devices
- `loadDllPath(dllPath: string): void` - Load DLL (no-op for serial implementation)
- `getLibVersion(): string` - Get library version

#### Events

- `pwm-info` - PWM information messages
- `pwm-error` - PWM error messages
- `close` - Device closed event

### Factory Functions

- `createPwmDevice(info: PwmBaseInfo): PwmBase` - Create PWM device
- `getValidPwmDevices(): Promise<PwmDevice[]>` - Get all available devices

## Device Communication

The EcuBus PWM implementation communicates with devices via serial port using a simple command protocol:

### Commands

- `INIT:freq:duty:polarity\r` - Initialize PWM (sent during open)
- `DUTY:value\r` - Set duty cycle (only command sent after initialization)
- `STOP\r` - Stop PWM output (sent during close)

### Responses

- `OK` - Command successful
- `ERROR:message` - Command failed
- `PWM:duty:freq:polarity` - Status response

## Configuration

### During Construction (Fixed)

- **Frequency**: Set in `PwmBaseInfo.freq` - cannot be changed afterward
- **Polarity**: Set in `PwmBaseInfo.polarity` - cannot be changed afterward
- **Initial Duty Cycle**: Set in `PwmBaseInfo.initDuty` - starting duty cycle

### During Operation (Modifiable)

- **Duty Cycle**: Can be changed using `setDutyCycle()` method

## Error Handling

The implementation includes comprehensive error handling:

- **Device not found**: Throws error when device is not available
- **Invalid parameters**: Validates duty cycle (0-100%)
- **Communication errors**: Handles serial port errors and timeouts
- **Device state errors**: Prevents operations on closed devices

## Logging

The implementation provides detailed logging:

- **Info messages**: Successful operations and status updates
- **Error messages**: Failed operations and error details
- **Event emission**: Real-time status updates via events

## Hardware Support

Currently supports:
- **EcuBus PWM devices**: Serial-based PWM controllers
- **Vendor ID**: 0xecbb
- **Product ID**: 0xa002

## Example

See `example.ts` for a complete usage example showing how frequency is configured during construction and only duty cycle can be modified afterward. 