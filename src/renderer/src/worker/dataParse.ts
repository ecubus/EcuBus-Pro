import { LinMsg } from "nodeCan/lin"
import { DataSet } from "src/preload/data"

// Database reference
let database: DataSet['database']

// Process LIN data messages
function parseLinData(data: LinMsg[]) {
    const findDb = (name?: string) => {
        if (!name) return null
        for (const db of Object.values(database.lin)) {

            if (db.name === name) {
                return db
            }
        }
        return null
    }

    const result: Record<string, (number|string)[][]> = {}

    for (const msg of data) {
        const db = findDb(msg.database)

        // Process each LIN message
        //

        if (db && msg.name) {
            //find frame by frameId
            const frame = db.frames[msg.name]
            // Process signals if available
            if (frame && frame.signals) {

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
                            for (let i = 0; i < byteLength && (startByte + i) < msg.data.length; i++) {
                                tempBuffer[i] = msg.data[startByte + i]
                            }
                            
                            if (length <= 8) {
                                value = tempBuffer[0]
                            } else if (length <= 16) {
                                value = tempBuffer.readUInt16BE(0)
                            } else if (length <= 24) {
                                value = tempBuffer.readUInt16BE(0) << 8 | tempBuffer[2]
                            } else if (length <= 32) {
                                value = tempBuffer.readUInt32BE(0)
                            } else {
                                // 超过32位用16进制字符串表示
                                value = tempBuffer.subarray(0, byteLength).toString('hex')
                            }
                        } else {
                            // 非字节对齐的情况
                            let tempBuffer = Buffer.alloc(8)
                            for (let i = 0; i < byteLength && (startByte + i) < msg.data.length; i++) {
                                const currentByte = msg.data[startByte + i]
                                const nextByte = (startByte + i + 1) < msg.data.length ? msg.data[startByte + i + 1] : 0
                                
                                // 组合当前字节和下一个字节的bits
                                tempBuffer[i] = ((currentByte >> bitOffset) | (nextByte << (8 - bitOffset))) & 0xFF
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
                                value = tempBuffer.readUInt16BE(0) << 8 | tempBuffer[2]
                            } else if (length <= 32) {
                                value = tempBuffer.readUInt32BE(0)
                            } else {
                                // 超过32位用16进制字符串表示
                                value = tempBuffer.subarray(0, byteLength).toString('hex')
                            }
                        }
                        
                        // 对于数字类型，需要清除多余的位
                        if (typeof value === 'number' && length < 32) {
                            const mask = (1 << length) - 1
                            value &= mask
                        }
                    } else {
                        // Handle scalar type signals - process bit by bit
                        let tempValue = 0
                        
                        for (let i = 0; i < length; i++) {
                            const targetBit = startBit + i
                            const byteOffset = Math.floor(targetBit / 8)
                            const bitOffset = targetBit % 8
                            
                            if (byteOffset < msg.data.length) {
                                // 获取对应位的值
                                if ((msg.data[byteOffset] & (1 << bitOffset)) !== 0) {
                                    tempValue |= (1 << i)
                                }
                            }
                        }
                        
                        value = tempValue
                    }

                    // Create signal key
                    const signalKey = `lin.${db.name}.signals.${signal.name}`

                    // Initialize array if needed
                    if (!result[signalKey]) {
                        result[signalKey] = []
                    }

                    //转为秒
                    const ts= parseFloat(((msg.ts || 0)/1000000).toFixed(3))
                   
                    result[signalKey].push([ts, value])
                }
            }
        }
    }

    return result
}

// Initialize database reference
function initDataBase(db: DataSet['database']) {
    database = db
}

// Export functions for both testing and worker usage
export {
    parseLinData,
    initDataBase
}

// Check if we're in a worker context
declare const self: Worker
const isWorker = typeof self !== 'undefined'

// Only set up worker message handler if we're in a worker context
if (isWorker) {
    self.onmessage = (event) => {
        const { method, data } = event.data

        switch (method) {
            case 'initDataBase':
                {
                    initDataBase(data)
                    break
                }


            case 'linBase':
                {
                    const result = parseLinData(data.map((item: any) => item.message.data));
                    self.postMessage(result)
                    break
                }


            default:
                break
        }
    }
}


