import type { DBC, Message, Signal } from './dbcVisitor'

// Format float value with smart decimal places
function formatFloat(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString()
  }

  // Convert to string with 4 decimal places
  let formatted = value.toFixed(4)

  // Remove trailing zeros after decimal point
  while (formatted.endsWith('0')) {
    formatted = formatted.slice(0, -1)
  }

  // Remove decimal point if it's the last character
  if (formatted.endsWith('.')) {
    formatted = formatted.slice(0, -1)
  }

  return formatted
}

// Convert two's complement to signed value
function fromTwosComplement(value: number, bits: number): number {
  if (value & (1 << (bits - 1))) {
    return -((~value + 1) & ((1 << bits) - 1))
  }
  return value
}

// Convert signed value to two's complement
function toTwosComplement(value: number, bits: number): number {
  if (value >= 0) return value
  const mask = (1 << bits) - 1
  return (~-value + 1) & mask
}

// Calculate max raw value based on signal length
function getMaxRawValue(length: number): number {
  return Math.pow(2, length) - 1
}

// Convert physical value to raw value
function physToRaw(phys: number, signal: Signal): number {
  let rawValue = Math.round((phys - (signal.offset || 0)) / (signal.factor || 1))
  const maxRaw = getMaxRawValue(signal.length)

  if (signal.isSigned) {
    if (rawValue < 0) {
      rawValue = toTwosComplement(rawValue, signal.length)
    } else if (rawValue > maxRaw / 2) {
      rawValue = Math.floor(maxRaw / 2)
    }
  } else {
    rawValue = Math.min(Math.max(rawValue, 0), maxRaw)
  }

  return rawValue
}

// Convert raw value to physical value
function rawToPhys(raw: number, signal: Signal): number {
  let actualValue = raw

  if (signal.isSigned) {
    const maxRaw = getMaxRawValue(signal.length)
    if (raw > maxRaw / 2) {
      actualValue = fromTwosComplement(raw, signal.length)
    }
  }

  return actualValue * (signal.factor || 1) + (signal.offset || 0)
}

// Handle IEEE float conversion
function handleFloatConversion(value: number, signal: Signal, isToFloat: boolean): number {
  if (signal.valueType === 1) {
    // IEEE Float (single precision)
    const buffer = new ArrayBuffer(4)
    const view = new DataView(buffer)
    if (isToFloat) {
      // For 32-bit values, we need to handle them as unsigned 32-bit integers
      view.setUint32(0, value >>> 0, signal.isLittleEndian)
      return view.getFloat32(0, signal.isLittleEndian)
    } else {
      view.setFloat32(0, value, signal.isLittleEndian)
      return view.getUint32(0, signal.isLittleEndian)
    }
  } else if (signal.valueType === 2) {
    // IEEE Double (double precision)
    const buffer = new ArrayBuffer(8)
    const view = new DataView(buffer)
    if (isToFloat) {
      // For 64-bit values, we need to handle them as unsigned 64-bit integers
      // Since JavaScript doesn't have 64-bit integers, we need to handle this differently
      // For now, we'll assume the value is already a 64-bit representation
      // This is a simplified approach - in practice, you might need to handle this differently
      const low32 = value & 0xffffffff
      const high32 = (value >> 32) & 0xffffffff
      view.setUint32(0, low32, signal.isLittleEndian)
      view.setUint32(4, high32, signal.isLittleEndian)
      return view.getFloat64(0, signal.isLittleEndian)
    } else {
      view.setFloat64(0, value, signal.isLittleEndian)
      // Return the lower 32 bits for compatibility
      return view.getUint32(0, signal.isLittleEndian)
    }
  }
  return value
}

// Validate signal value against constraints
function validateSignalValue(value: number, signal: Signal, db: DBC): boolean {
  const maxValue = getMaxRawValue(signal.length)
  if (value > maxValue) return false

  if (signal.values) {
    const validValues = Object.values(signal.values).map((v) => v.value)
    if (!validValues.includes(value)) return false
  } else if (signal.valueTable) {
    const vt = Object.values(db.valueTables).find((vt) => vt.name === signal.valueTable)
    if (vt) {
      const validValues = vt.values.map((v) => v.value)
      if (!validValues.includes(value)) return false
    }
  } else {
    // Check physical value limits
    let physValue = value
    if (signal.valueType === 1 || signal.valueType === 2) {
      physValue = handleFloatConversion(value, signal, true)
    } else if (signal.isSigned) {
      physValue = rawToPhys(value, signal)
    } else {
      physValue = rawToPhys(value, signal)
    }

    // Skip min/max validation if both min and max are 0 (indicating no limits)
    if (signal.minimum === 0 && signal.maximum === 0) {
      // No min/max restrictions when both are 0
    } else {
      if (signal.minimum !== undefined && physValue < signal.minimum) return false
      if (signal.maximum !== undefined && physValue > signal.maximum) return false
    }
  }

  return true
}

// Get enum label for signal value
function getEnumLabel(value: number, signal: Signal, db: DBC): string | undefined {
  if (signal.values) {
    return signal.values.find((v) => v.value === value)?.label
  } else if (signal.valueTable) {
    const vt = Object.values(db.valueTables).find((vt) => vt.name === signal.valueTable)
    return vt?.values.find((v) => v.value === value)?.label
  }
  return undefined
}

// Read signal from buffer
function readSignalFromBuffer(signal: Signal, data: Buffer, db: DBC): number | undefined {
  let rawValue = 0

  if (signal.isLittleEndian) {
    // Intel format (Little Endian)
    let startByte = Math.floor(signal.startBit / 8)
    let startBitInByte = signal.startBit % 8
    let remainingBits = signal.length
    let valueIndex = 0

    while (remainingBits > 0 && startByte < data.length) {
      const bitsInThisByte = Math.min(8 - startBitInByte, remainingBits)
      const mask = (1 << bitsInThisByte) - 1
      const value = (data[startByte] >> startBitInByte) & mask
      rawValue |= value << valueIndex

      remainingBits -= bitsInThisByte
      valueIndex += bitsInThisByte
      startByte += 1
      startBitInByte = 0
    }
  } else {
    // Motorola format (Big Endian)
    let startByte = Math.floor(signal.startBit / 8)
    let startBitInByte = signal.startBit % 8
    let remainingBits = signal.length

    while (remainingBits > 0) {
      if (startByte < 0 || startByte >= data.length) break

      const bitsInThisByte = Math.min(8 - startBitInByte, remainingBits)
      const position = startBitInByte
      const mask = (1 << bitsInThisByte) - 1
      const value = (data[startByte] >> position) & mask
      rawValue = (rawValue << bitsInThisByte) | value

      remainingBits -= bitsInThisByte
      startByte -= 1
      startBitInByte = 7
    }
  }

  // For 32-bit values, ensure we handle them as unsigned integers
  if (signal.length === 32) {
    rawValue = rawValue >>> 0
  }

  if (!validateSignalValue(rawValue, signal, db)) {
    return undefined
  }

  return rawValue
}

// Write signal to buffer
function writeSignalToBuffer(signal: Signal, data: Buffer): void {
  let rawValue = signal.value
  if (rawValue === undefined) return

  console.log(
    'Writing signal to buffer:',
    signal.name,
    'rawValue:',
    rawValue,
    'startBit:',
    signal.startBit,
    'length:',
    signal.length,
    'isSigned:',
    signal.isSigned
  )

  const maxValue = getMaxRawValue(signal.length)
  rawValue = Math.min(rawValue, maxValue)

  if (signal.isLittleEndian) {
    // Intel format (Little Endian)
    let startByte = Math.floor(signal.startBit / 8)
    let startBitInByte = signal.startBit % 8
    let remainingBits = signal.length
    let valueIndex = 0

    console.log(
      'Little endian - startByte:',
      startByte,
      'startBitInByte:',
      startBitInByte,
      'remainingBits:',
      remainingBits
    )

    while (remainingBits > 0) {
      if (startByte >= data.length) break

      const bitsInThisByte = Math.min(8 - startBitInByte, remainingBits)
      const mask = (1 << bitsInThisByte) - 1
      const value = (rawValue >> valueIndex) & mask

      console.log(
        'Byte',
        startByte,
        'bitsInThisByte:',
        bitsInThisByte,
        'mask:',
        mask.toString(16),
        'value:',
        value.toString(16),
        'valueIndex:',
        valueIndex
      )

      data[startByte] &= ~(mask << startBitInByte)
      data[startByte] |= value << startBitInByte

      console.log('Updated byte', startByte, ':', data[startByte].toString(16))

      remainingBits -= bitsInThisByte
      valueIndex += bitsInThisByte
      startByte += 1
      startBitInByte = 0
    }
  } else {
    // Motorola format (Big Endian)
    let startByte = Math.floor(signal.startBit / 8)
    let startBitInByte = signal.startBit % 8
    let remainingBits = signal.length

    while (remainingBits > 0) {
      if (startByte < 0 || startByte >= data.length) break

      const bitsInThisByte = Math.min(8 - startBitInByte, remainingBits)
      const position = startBitInByte
      const mask = (1 << bitsInThisByte) - 1
      const value = (rawValue >> (signal.length - remainingBits)) & mask

      data[startByte] &= ~(mask << position)
      data[startByte] |= value << position

      remainingBits -= bitsInThisByte
      startByte += 1
      startBitInByte = 0
    }
  }
}

// Main API Functions

/**
 * Set signal value
 * @param signal - The signal to set
 * @param val - Value to set (string for physical value, number for raw value)
 * @param db - DBC database for validation
 */
export function setSignal(signal: Signal, val: string | number, db: DBC): void {
  let rawValue: number
  let physValue: string

  if (typeof val === 'string') {
    // Physical value (string)
    if (signal.values || signal.valueTable) {
      // For enum values, find by label
      const enumLabel = val
      if (signal.values) {
        const enumValue = signal.values.find((v) => v.label === enumLabel)
        if (!enumValue) return
        rawValue = enumValue.value
        physValue = enumLabel
      } else if (signal.valueTable) {
        const vt = Object.values(db.valueTables).find((vt) => vt.name === signal.valueTable)
        if (vt) {
          const enumValue = vt.values.find((v) => v.label === enumLabel)
          if (!enumValue) return
          rawValue = enumValue.value
          physValue = enumLabel
        } else {
          return
        }
      } else {
        return
      }
    } else {
      // Numeric physical value
      const numVal = parseFloat(val)
      if (isNaN(numVal)) return

      if (signal.valueType === 1 || signal.valueType === 2) {
        // Handle IEEE float conversion
        rawValue = handleFloatConversion(numVal, signal, false)
        physValue = formatFloat(numVal)
      } else {
        // Regular numeric conversion
        rawValue = physToRaw(numVal, signal)
        physValue = formatFloat(numVal)
      }
    }
  } else {
    // Raw value (number)
    rawValue = val
    if (signal.values || signal.valueTable) {
      const label = getEnumLabel(rawValue, signal, db)
      physValue = label || rawValue.toString()
    } else if (signal.valueType === 1 || signal.valueType === 2) {
      const floatValue = handleFloatConversion(rawValue, signal, true)
      physValue = formatFloat(floatValue)
    } else {
      const physNumValue = rawToPhys(rawValue, signal)
      physValue = formatFloat(physNumValue)
    }
  }

  // Validate the value
  if (!validateSignalValue(rawValue, signal, db)) {
    return
  }

  // Set the values
  signal.value = rawValue
  signal.physValue = physValue

  // If this is a multiplexed signal, ensure the multiplexer is set correctly
  if (signal.multiplexerIndicator && signal.multiplexerIndicator !== 'M') {
    // Find the message containing this signal
    const message = Object.values(db.messages).find((msg) =>
      Object.values(msg.signals).some((s) => s === signal)
    )
    if (message) {
      // Find the multiplexer signal
      const multiplexer = Object.values(message.signals).find((s) => s.multiplexerIndicator === 'M')
      if (multiplexer) {
        // Set the multiplexer value based on the signal's multiplexer indicator
        if (signal.multiplexerRange) {
          // For range-based multiplexing, use the first value in the range
          multiplexer.value = signal.multiplexerRange.range[0]
        } else {
          // For simple multiplexing, extract the value from the indicator
          const multiplexerValue = Number(signal.multiplexerIndicator.slice(1))
          multiplexer.value = multiplexerValue
        }
      }
    }
  }
}

/**
 * Get signal value
 * @param signal - The signal to get
 * @param db - DBC database for enum labels
 * @returns Object with raw and phy values
 */
export function getSignal(signal: Signal, db: DBC): { raw: number; phy: string } {
  const raw = signal.value || 0
  let phy: string

  if (signal.values || signal.valueTable) {
    // For enum values, return the label
    const label = getEnumLabel(raw, signal, db)
    phy = label || raw.toString()
  } else {
    // For numeric values, return the physical value as string
    let physValue: number
    if (signal.valueType === 1 || signal.valueType === 2) {
      physValue = handleFloatConversion(raw, signal, true)
    } else {
      physValue = rawToPhys(raw, signal)
    }
    phy = formatFloat(physValue)
  }

  return { raw, phy }
}

/**
 * Write message data from signals to buffer
 * @param message - The message containing signals
 * @param data - Buffer to write to
 * @param db - DBC database for validation
 */
export function writeMessageData(message: Message, data: Buffer, db: DBC): void {
  // Find multiplexer signal if exists
  let multiplexer: Signal | undefined
  let multiplexerValue: number | undefined

  Object.values(message.signals).forEach((signal) => {
    if (signal.multiplexerIndicator === 'M') {
      multiplexer = signal
      const rawValue = readSignalFromBuffer(signal, data, db)
      if (rawValue !== undefined) {
        signal.value = rawValue
        // Update physical value for multiplexer signal
        if (signal.values || signal.valueTable) {
          const label = getEnumLabel(rawValue, signal, db)
          signal.physValue = label || rawValue.toString()
        } else if (signal.valueType === 1 || signal.valueType === 2) {
          const floatValue = handleFloatConversion(rawValue, signal, true)
          signal.physValue = formatFloat(floatValue)
        } else {
          const physNumValue = rawToPhys(rawValue, signal)
          signal.physValue = formatFloat(physNumValue)
        }
        multiplexerValue = rawValue
      }
    }
  })

  // Process all signals
  Object.values(message.signals).forEach((signal) => {
    if (signal.multiplexerIndicator) {
      if (signal.multiplexerIndicator === 'M') {
        return // Already processed
      }
      // Check multiplexing conditions
      if (multiplexer && multiplexerValue !== undefined) {
        if (signal.multiplexerRange) {
          const isInRange = signal.multiplexerRange.range.some((val) => val === multiplexerValue)
          if (isInRange) {
            const rawValue = readSignalFromBuffer(signal, data, db)
            if (rawValue !== undefined) {
              signal.value = rawValue
              // Update physical value for multiplexed signal
              if (signal.values || signal.valueTable) {
                const label = getEnumLabel(rawValue, signal, db)
                signal.physValue = label || rawValue.toString()
              } else if (signal.valueType === 1 || signal.valueType === 2) {
                const floatValue = handleFloatConversion(rawValue, signal, true)
                signal.physValue = formatFloat(floatValue)
              } else {
                const physNumValue = rawToPhys(rawValue, signal)
                signal.physValue = formatFloat(physNumValue)
              }
            }
          }
        } else {
          const val = Number(signal.multiplexerIndicator.slice(1))
          if (val === multiplexerValue) {
            const rawValue = readSignalFromBuffer(signal, data, db)
            if (rawValue !== undefined) {
              signal.value = rawValue
              // Update physical value for multiplexed signal
              if (signal.values || signal.valueTable) {
                const label = getEnumLabel(rawValue, signal, db)
                signal.physValue = label || rawValue.toString()
              } else if (signal.valueType === 1 || signal.valueType === 2) {
                const floatValue = handleFloatConversion(rawValue, signal, true)
                signal.physValue = formatFloat(floatValue)
              } else {
                const physNumValue = rawToPhys(rawValue, signal)
                signal.physValue = formatFloat(physNumValue)
              }
            }
          }
        }
      }
    } else {
      // Non-multiplexed signal
      const rawValue = readSignalFromBuffer(signal, data, db)
      if (rawValue !== undefined) {
        signal.value = rawValue
        // Update physical value for non-multiplexed signal
        if (signal.values || signal.valueTable) {
          const label = getEnumLabel(rawValue, signal, db)
          signal.physValue = label || rawValue.toString()
        } else if (signal.valueType === 1 || signal.valueType === 2) {
          const floatValue = handleFloatConversion(rawValue, signal, true)
          signal.physValue = formatFloat(floatValue)
        } else {
          const physNumValue = rawToPhys(rawValue, signal)
          signal.physValue = formatFloat(physNumValue)
        }
      }
    }
  })
}

/**
 * Get message data buffer from signals
 * @param message - The message containing signals
 * @returns Buffer with signal data
 */
export function getMessageData(message: Message): Buffer {
  const data = Buffer.alloc(message.length).fill(0)

  // 首先找到多路复用器信号(如果存在)
  let multiplexer: Signal | undefined
  let multiplexerValue: number | undefined

  Object.values(message.signals).forEach((signal) => {
    if (signal.multiplexerIndicator === 'M') {
      multiplexer = signal
      multiplexerValue = signal.value
      console.log('Found multiplexer:', signal.name, 'value:', signal.value)
    }
  })

  // 处理所有信号
  Object.values(message.signals).forEach((signal) => {
    // 跳过未定义值的信号
    if (signal.value === undefined) return

    console.log(
      'Processing signal:',
      signal.name,
      'value:',
      signal.value,
      'multiplexerIndicator:',
      signal.multiplexerIndicator
    )

    // 处理多路复用信号的逻辑
    if (signal.multiplexerIndicator) {
      // 如果是多路复用器本身，正常处理
      if (signal.multiplexerIndicator === 'M') {
        console.log('Writing multiplexer signal:', signal.name)
        writeSignalToBuffer(signal, data)
      }
      // 如果是被多路复用的信号，需要检查条件
      else if (multiplexer && multiplexerValue !== undefined) {
        if (signal.multiplexerRange) {
          // 处理范围多路复用
          const isInRange = signal.multiplexerRange.range.some((val) => val === multiplexerValue)
          if (isInRange) {
            console.log('Writing range multiplexed signal:', signal.name)
            writeSignalToBuffer(signal, data)
          }
        } else {
          // 处理单值多路复用
          const val = Number(signal.multiplexerIndicator.slice(1))
          console.log(
            'Checking multiplexed signal:',
            signal.name,
            'expected val:',
            val,
            'multiplexerValue:',
            multiplexerValue
          )
          if (val === multiplexerValue) {
            console.log('Writing multiplexed signal:', signal.name)
            writeSignalToBuffer(signal, data)
          }
        }
      }
    } else {
      // 非多路复用信号，直接处理
      console.log('Writing non-multiplexed signal:', signal.name)
      writeSignalToBuffer(signal, data)
    }
  })

  console.log('Final buffer:', data)
  return data
}
