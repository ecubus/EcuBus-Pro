import { LinMsg } from 'nodeCan/lin'
import { Frame, LDF, SignalEncodeType } from '../ldfParse'

export function getPhysicalValue(
  rawValue: number,
  encodingTypes: SignalEncodeType['encodingTypes'],
  db: LDF
): { numVal?: number; strVal?: string; usedEncode?: SignalEncodeType['encodingTypes'][0] } {
  // 遍历所有编码类型
  const result: {
    numVal?: number
    strVal?: string
    usedEncode?: SignalEncodeType['encodingTypes'][0]
  } = {
    numVal: undefined,
    strVal: undefined,
    usedEncode: undefined
  }
  for (const encodingType of encodingTypes) {
    switch (encodingType.type) {
      case 'physicalValue': {
        if (encodingType.physicalValue) {
          const { minValue, maxValue, scale, offset } = encodingType.physicalValue
          if (rawValue >= minValue && rawValue <= maxValue) {
            const physValue = Number((scale * rawValue + offset).toFixed(3))
            const tt = encodingType.physicalValue.textInfo
              ? `${physValue}${encodingType.physicalValue.textInfo}`
              : undefined
            result.numVal = physValue
            result.strVal = tt
            result.usedEncode = encodingType
          }
        }
        break
      }
      case 'logicalValue': {
        if (encodingType.logicalValue && encodingType.logicalValue.signalValue === rawValue) {
          result.strVal = encodingType.logicalValue.textInfo || ''
          result.usedEncode = encodingType
        }
        break
      }
      case 'bcdValue': {
        // BCD编码：每4位表示一个十进制数字

        ;(result.numVal = rawValue
          .toString()
          .split('')
          .map(Number)
          .reduce((acc, digit) => (acc << 4) | digit, 0)),
          (result.usedEncode = encodingType)

        break
      }
      case 'asciiValue': {
        // ASCII编码：直接转换为字符串
        result.strVal = rawValue.toString()
        result.usedEncode = encodingType
        break
      }
    }
  }
  // 如果没有找到匹配的编码，返回原始值
  return result
}

export function getRawValue(
  physValue: number | string,
  encodingTypes: SignalEncodeType['encodingTypes'],
  db: LDF
): { value?: number; usedEncode?: SignalEncodeType['encodingTypes'][0] } {
  // 遍历所有编码类型
  for (const encodingType of encodingTypes) {
    switch (encodingType.type) {
      case 'physicalValue': {
        if (encodingType.physicalValue && !Number.isNaN(Number(physValue))) {
          const { minValue, maxValue, scale, offset } = encodingType.physicalValue
          // 反向计算：raw = (phys - offset) / scale
          const rawValue = (Number(physValue) - offset) / scale
          // 检查计算出的raw值是否在有效范围内
          if (rawValue >= minValue && rawValue <= maxValue) {
            return { value: Math.round(rawValue), usedEncode: encodingType }
          }
        }
        break
      }
      case 'logicalValue': {
        if (encodingType.logicalValue) {
          // 如果是字符串，检查是否匹配文本信息
          if (typeof physValue === 'string' && encodingType.logicalValue.textInfo === physValue) {
            return { value: encodingType.logicalValue.signalValue, usedEncode: encodingType }
          }
          // 如果是数字，检查是否匹配信号值
          if (
            typeof physValue === 'number' &&
            encodingType.logicalValue.signalValue === physValue
          ) {
            return { value: encodingType.logicalValue.signalValue, usedEncode: encodingType }
          }
        }
        break
      }
      case 'bcdValue': {
        // BCD编码反向转换：将数字转换为BCD格式

        return { value: parseInt(Number(physValue).toString(16), 10), usedEncode: encodingType }

        break
      }
      case 'asciiValue': {
        // ASCII编码反向转换：将字符串转换为数字
        if (typeof physValue === 'string') {
          return { value: parseInt(physValue, 10), usedEncode: encodingType }
        }
        break
      }
    }
  }
  // 如果没有找到匹配的编码，返回undefined
  return {}
}

export function writeMessageData(frame: Frame, data: Buffer, db: LDF) {
  for (const signal of frame.signals) {
    // Find signal definition
    const signalDef = db.signals[signal.name]
    if (!signalDef) continue

    // Calculate signal value from raw data
    let value: number | string = 0
    const startBit = signal.offset
    const length = signalDef.signalSizeBits

    if (signalDef.singleType === 'ByteArray') {
      // Handle byte array type signals
      const startByte = Math.floor(startBit / 8)
      const byteLength = Math.ceil(length / 8)
      const bitOffset = startBit % 8

      if (bitOffset === 0) {
        // 如果是字节对齐的情况
        const tempBuffer = Buffer.alloc(8)
        for (let i = 0; i < byteLength && startByte + i < data.length; i++) {
          tempBuffer[i] = data[startByte + i]
        }

        if (length <= 8) {
          value = tempBuffer[0]
        } else if (length <= 16) {
          value = tempBuffer.readUInt16BE(0)
        } else if (length <= 24) {
          value = (tempBuffer.readUInt16BE(0) << 8) | tempBuffer[2]
        } else if (length <= 32) {
          value = tempBuffer.readUInt32BE(0)
        } else {
          // 超过32位用16进制字符串表示
          value = tempBuffer.subarray(0, byteLength).toString('hex')
          signalDef.value = Array.prototype.slice.call(tempBuffer.subarray(0, byteLength), 0)
        }
      } else {
        // 非字节对齐的情况
        let tempBuffer = Buffer.alloc(8)
        for (let i = 0; i < byteLength && startByte + i < data.length; i++) {
          const currentByte = data[startByte + i]
          const nextByte = startByte + i + 1 < data.length ? data[startByte + i + 1] : 0

          // 组合当前字节和下一个字节的bits
          tempBuffer[i] = ((currentByte >> bitOffset) | (nextByte << (8 - bitOffset))) & 0xff
        }
        //截断
        tempBuffer = tempBuffer.subarray(0, byteLength)
        //反转
        tempBuffer = tempBuffer.reverse()
        if (length <= 8) {
          value = tempBuffer[0]
        } else if (length <= 16) {
          value = tempBuffer.readUInt16BE(0)
        } else if (length <= 24) {
          value = (tempBuffer.readUInt16BE(0) << 8) | tempBuffer[2]
        } else if (length <= 32) {
          value = tempBuffer.readUInt32BE(0)
        } else {
          // 超过32位用16进制字符串表示
          value = tempBuffer.subarray(0, byteLength).toString('hex')
          signalDef.value = Array.prototype.slice.call(tempBuffer.subarray(0, byteLength), 0)
        }
      }

      // 对于数字类型，需要清除多余的位
      if (typeof value === 'number') {
        const mask = (1 << length) - 1
        value &= mask
        signalDef.value = value
      }
      signalDef.physValue = value
    } else {
      // Handle scalar type signals - process bit by bit
      let tempValue = 0

      for (let i = 0; i < length; i++) {
        const targetBit = startBit + i
        const byteOffset = Math.floor(targetBit / 8)
        const bitOffset = targetBit % 8

        if (byteOffset < data.length) {
          // 获取对应位的值
          if ((data[byteOffset] & (1 << bitOffset)) !== 0) {
            tempValue |= 1 << i
          }
        }
      }
      signalDef.value = tempValue
      signalDef.physValue = tempValue
      //check enum
      for (const encodeKey of Object.keys(db.signalRep)) {
        if (db.signalRep[encodeKey].includes(signalDef.signalName)) {
          const encodeInfo = db.signalEncodeTypes[encodeKey]
          // 直接使用所有编码类型进行转换
          const { numVal, strVal, usedEncode } = getPhysicalValue(
            tempValue,
            encodeInfo.encodingTypes,
            db
          )

          if (usedEncode) {
            signalDef.physValueEnum = strVal
            if (numVal !== undefined) {
              signalDef.physValue = numVal
            }
          }
          break
        }
      }
    }
  }
}
