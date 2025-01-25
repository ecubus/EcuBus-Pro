import type { DBC, Message, Signal } from "./dbcVisitor"

// Convert two's complement to signed value
function fromTwosComplement(value: number, bits: number): number {
    if (value & (1 << (bits - 1))) {
        return -(((~value + 1) & ((1 << bits) - 1)))
    }
    return value
}

// Calculate max raw value based on signal length
export function getMaxRawValue(length: number): number {
    return Math.pow(2, length) - 1
}

// Convert physical value to raw value
function physToRaw(phys: number, row: Signal): number {
    let rawValue = Math.round((phys - (row.offset || 0)) / (row.factor || 1))

    // Get max value based on length
    const maxRaw = getMaxRawValue(row.length)

    if (row.isSigned) {
        // For signed values, handle negative numbers with two's complement
        if (rawValue < 0) {
            rawValue = toTwosComplement(rawValue, row.length)
        } else if (rawValue > maxRaw / 2) {
            // Limit positive values to max signed value
            rawValue = Math.floor(maxRaw / 2)
        }
    } else {
        // For unsigned values, simply clamp between 0 and max
        rawValue = Math.min(Math.max(rawValue, 0), maxRaw)
    }

    return rawValue
}
// Convert signed value to two's complement
function toTwosComplement(value: number, bits: number): number {
    if (value >= 0) return value
    const mask = (1 << bits) - 1
    return (~(-value) + 1) & mask
}

// Convert raw value to physical value
export function rawToPhys(raw: number, row: Signal): number {
    let actualValue = raw

    if (row.isSigned) {
        // Only convert from two's complement if it's a signed value
        const maxRaw = getMaxRawValue(row.length)
        if (raw > maxRaw / 2) {
            // If the value is in the negative range of two's complement
            actualValue = fromTwosComplement(raw, row.length)
        }
    }

    return actualValue * (row.factor || 1) + (row.offset || 0)
}


export function updateSignalRaw(signal: Signal) {
    if (signal.value === undefined) return
    const maxRaw = getMaxRawValue(signal.length)
    signal.value = Math.min(Math.max(0, signal.value), maxRaw)


    if (signal.values || signal.valueTable) {
        // For enum values, directly set the raw value as phys value
        signal.physValue = signal.value
    } else {
        // Calculate new physical value
        const newPhysValue = rawToPhys(signal.value!, signal)

        // Check if this physical value would exceed limits
        if (signal.minimum !== undefined && newPhysValue < signal.minimum) {
            // Adjust raw value based on minimum physical value
            signal.value = physToRaw(signal.minimum, signal)
            signal.physValue = signal.minimum
        } else if (signal.maximum !== undefined && newPhysValue > signal.maximum) {
            // Adjust raw value based on maximum physical value
            signal.value = physToRaw(signal.maximum, signal)
            signal.physValue = signal.maximum
        } else {
            signal.physValue = newPhysValue
        }
    }
}
export function updateSignalPhys(row: Signal) {
    if (row.physValue === undefined) return

    if (row.values || row.valueTable) {
        // For enum values, directly set the phys value as raw value
        row.value = typeof row.physValue === 'number' ? row.physValue : 0
    } else {
        const physValue = typeof row.physValue === 'number' ? row.physValue : 0

        // Clamp physical value to min/max if defined
        let clampedPhysValue = physValue
        if (row.minimum !== undefined && physValue < row.minimum) {
            clampedPhysValue = row.minimum
        } else if (row.maximum !== undefined && physValue > row.maximum) {
            clampedPhysValue = row.maximum
        }

        // Update physical value if it was clamped
        if (clampedPhysValue !== physValue) {
            row.physValue = clampedPhysValue
        }

        // Calculate and set raw value
        row.value = physToRaw(clampedPhysValue, row)
    }
}

export function writeMessageData(message: Message, data: Buffer, db: DBC) {
    // 首先找到多路复用器信号(如果存在)并更新其值
    let multiplexer: Signal | undefined
    let multiplexerValue: number | undefined

    Object.values(message.signals).forEach(signal => {
        if (signal.multiplexerIndicator === 'M') {
            multiplexer = signal
            readSignalFromBuffer(signal, data, db)
            multiplexerValue = signal.value
        }
    })

    // 更新所有信号的值
    Object.values(message.signals).forEach(signal => {
        // 处理多路复用信号的逻辑
        if (signal.multiplexerIndicator) {
            // 跳过已处理的多路复用器信号
            if (signal.multiplexerIndicator === 'M') {
                return
            }
            // 如果是被多路复用的信号，需要检查条件
            if (multiplexer && multiplexerValue !== undefined) {
                if (signal.multiplexerRange) {
                    // 处理范围多路复用
                    const isInRange = signal.multiplexerRange.range.some(
                        val => val === multiplexerValue
                    )
                    if (isInRange) {
                        readSignalFromBuffer(signal, data, db)
                    }
                } else {
                    // 处理单值多路复用
                    const val = Number(signal.multiplexerIndicator.slice(1))
                    if (val === multiplexerValue) {
                        readSignalFromBuffer(signal, data, db)
                    }
                }
            }
        } else {
            // 非多路复用信号，直接处理
            readSignalFromBuffer(signal, data, db)
        }
    })
}

// 从缓冲区读取信号值的辅助函数
function readSignalFromBuffer(signal: Signal, data: Buffer, db: DBC) {
    let rawValue = 0

    if (signal.isLittleEndian) {
        // Intel格式 (Little Endian)
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
        // Motorola格式 (Big Endian)
        let startByte = Math.floor(signal.startBit / 8)
        let startBitInByte = 7 - (signal.startBit % 8)
        let remainingBits = signal.length

        while (remainingBits > 0 && startByte >= 0 && startByte < data.length) {
            const bitsInThisByte = Math.min(startBitInByte + 1, remainingBits)
            const position = startBitInByte - bitsInThisByte + 1
            const mask = (1 << bitsInThisByte) - 1
            const value = (data[startByte] >> position) & mask

            rawValue = (rawValue << bitsInThisByte) | value

            remainingBits -= bitsInThisByte
            startByte -= 1
            startBitInByte = 7
        }
    }

    // 检查原始值是否合法
    const maxValue = Math.pow(2, signal.length) - 1
    if (rawValue > maxValue) {
        return // 如果值超出信号长度允许的范围，不更新信号
    }

    // 对于枚举值，检查值是否在有效范围内
    if (signal.values) {
        const validValues = Object.values(signal.values).map(v => v.value)
        if (!validValues.includes(rawValue)) {
            return // 如果值不在枚举列表中，不更新信号
        }
    } else if (signal.valueTable) {
        // 如果有值表，检查值是否在值表范围内

        const vt = Object.values(db.valueTables).find(vt => vt.name === signal.valueTable)
        if (vt) {
            const validValues = vt.values.map(v => v.value)
            if (!validValues.includes(rawValue)) {
                return // 如果值不在值表中，不更新信号
            }
        }

    } else {
        // 对于数值类型信号，检查是否在最小值和最大值范围内
        let physValue = rawValue

        if (signal.isSigned) {
            // 检查最高位是否为1（负数）
            const isNegative = (rawValue & (1 << (signal.length - 1))) !== 0
            if (isNegative) {
                // 转换为有符号值
                const signBit = 1 << (signal.length - 1)
                const valueMask = signBit - 1
                physValue = -((~rawValue & valueMask) + 1)
            }
        }

        // 计算物理值
        physValue = physValue * (signal.factor || 1) + (signal.offset || 0)

        // 检查物理值是否在有效范围内
        if (signal.minimum !== undefined && physValue < signal.minimum) {
            return // 如果物理值小于最小值，不更新信号
        }
        if (signal.maximum !== undefined && physValue > signal.maximum) {
            return // 如果物理值大于最大值，不更新信号
        }
    }

    // 所有检查都通过后，更新信号值
    signal.value = rawValue

    // 更新物理值
    if (signal.values || signal.valueTable) {
        signal.physValue = rawValue
    } else {
        if (signal.isSigned) {
            // 检查最高位是否为1（负数）
            const isNegative = (rawValue & (1 << (signal.length - 1))) !== 0
            if (isNegative) {
                // 转换为有符号值
                const signBit = 1 << (signal.length - 1)
                const valueMask = signBit - 1
                rawValue = -((~rawValue & valueMask) + 1)
            }
        }

        // 应用因子和偏移计算物理值
        signal.physValue = rawValue * (signal.factor || 1) + (signal.offset || 0)
    }
}

export function getMessageData(message: Message): Buffer {
    const data = Buffer.alloc(message.length)

    // 首先找到多路复用器信号(如果存在)
    let multiplexer: Signal | undefined
    let multiplexerValue: number | undefined

    Object.values(message.signals).forEach(signal => {
        if (signal.multiplexerIndicator === 'M') {
            multiplexer = signal
            multiplexerValue = signal.value
        }
    })

    // 处理所有信号
    Object.values(message.signals).forEach(signal => {
        // 跳过未定义值的信号
        if (signal.value === undefined) return

        // 处理多路复用信号的逻辑
        if (signal.multiplexerIndicator) {
            // 如果是多路复用器本身，正常处理
            if (signal.multiplexerIndicator === 'M') {
                writeSignalToBuffer(signal, data)
            }
            // 如果是被多路复用的信号，需要检查条件
            else if (multiplexer && multiplexerValue !== undefined) {
                if (signal.multiplexerRange) {
                    // 处理范围多路复用
                    const isInRange = signal.multiplexerRange.range.some(
                        val => val === multiplexerValue
                    )
                    if (isInRange) {
                        writeSignalToBuffer(signal, data)
                    }
                } else {
                    // 处理单值多路复用
                    const val = Number(signal.multiplexerIndicator.slice(1))
                    if (val === multiplexerValue) {
                        writeSignalToBuffer(signal, data)
                    }
                }
            }
        } else {
            // 非多路复用信号，直接处理
            writeSignalToBuffer(signal, data)
        }
    })

    return data
}

// 将信号写入缓冲区的辅助函数
function writeSignalToBuffer(signal: Signal, data: Buffer) {
    let rawValue = signal.value
    if (rawValue === undefined) return

    const maxValue = Math.pow(2, signal.length) - 1
    rawValue = Math.min(rawValue, maxValue)

    if (signal.isLittleEndian) {
        // Intel格式 (Little Endian)
        let startByte = Math.floor(signal.startBit / 8)
        let startBitInByte = signal.startBit % 8
        let remainingBits = signal.length
        let valueIndex = 0

        while (remainingBits > 0) {
            if (startByte >= data.length) break

            const bitsInThisByte = Math.min(8 - startBitInByte, remainingBits)
            const mask = (1 << bitsInThisByte) - 1
            const value = (rawValue >> valueIndex) & mask

            data[startByte] &= ~(mask << startBitInByte)
            data[startByte] |= (value << startBitInByte)

            remainingBits -= bitsInThisByte
            valueIndex += bitsInThisByte
            startByte += 1
            startBitInByte = 0
        }
    } else {
        // Motorola格式 (Big Endian)
        let startByte = Math.floor(signal.startBit / 8)
        let startBitInByte = 7 - (signal.startBit % 8)
        let remainingBits = signal.length
        let valueIndex = signal.length - 1

        while (remainingBits > 0) {
            if (startByte >= data.length) break

            const bitsInThisByte = Math.min(startBitInByte + 1, remainingBits)
            const mask = (1 << bitsInThisByte) - 1
            const value = (rawValue >> (signal.length - remainingBits)) & mask
            const position = startBitInByte - bitsInThisByte + 1

            data[startByte] &= ~(mask << position)
            data[startByte] |= (value << position)

            remainingBits -= bitsInThisByte
            startByte -= 1
            startBitInByte = 7
        }
    }
}