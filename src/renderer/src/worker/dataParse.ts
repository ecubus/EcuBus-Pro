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

    const result: Record<string, { ts: number, val: number }[]> = {}
    
    for (const msg of data) {
        const db = findDb(msg.database)
        
        // Process each LIN message
       //
 
        if (db &&  msg.name) {
             //find frame by frameId
            const frame=db.frames[msg.name]
            // Process signals if available
            if (frame&&frame.signals) {
              
                for (const signal of frame.signals) {
                    // Find signal definition
                    const signalDef = db.signals[signal.name]
                    if (!signalDef) continue

                    // Calculate signal value from raw data
                    let value = 0
                    const startBit = signal.offset
                    const length = signalDef.signalSizeBits
                    
                    if (signalDef.singleType === 'ByteArray') {
                        // Handle byte array type signals with bit-level precision
                        const startByte = Math.floor(startBit / 8)
                        const startBitInByte = startBit % 8
                        let remainingBits = length
                        let currentBit = 0

                        // If not byte aligned, handle first partial byte
                        if (startBitInByte !== 0) {
                            const bitsInFirstByte = Math.min(8 - startBitInByte, remainingBits)
                            const mask = ((1 << bitsInFirstByte) - 1)
                            const extractedBits = (msg.data[startByte] >> startBitInByte) & mask
                            value |= extractedBits
                            currentBit += bitsInFirstByte
                            remainingBits -= bitsInFirstByte
                        }

                        // Handle full bytes
                        while (remainingBits >= 8) {
                            const byteIndex = startByte + Math.floor((startBitInByte + currentBit) / 8)
                            if (byteIndex >= msg.data.length) break
                            
                            value |= msg.data[byteIndex] << currentBit
                            currentBit += 8
                            remainingBits -= 8
                        }

                        // Handle remaining bits in last byte if any
                        if (remainingBits > 0) {
                            const byteIndex = startByte + Math.floor((startBitInByte + currentBit) / 8)
                            if (byteIndex < msg.data.length) {
                                const mask = ((1 << remainingBits) - 1)
                                const extractedBits = msg.data[byteIndex] & mask
                                value |= extractedBits << currentBit
                            }
                        }
                    } else {
                        // Handle scalar type signals
                        const startByte = Math.floor(startBit / 8)
                        const startBitInByte = startBit % 8
                        let remainingBits = length
                        let currentBit = 0

                        while (remainingBits > 0 && startByte + Math.floor(currentBit / 8) < msg.data.length) {
                            const byteIndex = startByte + Math.floor((startBitInByte + currentBit) / 8)
                            const bitIndex = (startBitInByte + currentBit) % 8
                            const bitsInThisByte = Math.min(8 - bitIndex, remainingBits)
                            
                            const mask = ((1 << bitsInThisByte) - 1)
                            const extractedBits = (msg.data[byteIndex] >> bitIndex) & mask
                            value |= extractedBits << currentBit
                            
                            currentBit += bitsInThisByte
                            remainingBits -= bitsInThisByte
                        }
                    }

                    // Create signal key
                    const signalKey = `lin.${db.name}.signals.${signal.name}`
                    
                    // Initialize array if needed
                    if (!result[signalKey]) {
                        result[signalKey] = []
                    }
                    
                    // Add value to results
                    result[signalKey].push({
                        ts: msg.ts || 0,
                        val: value
                    })
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
        const { metod, data } = event.data
        
        switch (metod) {
            case 'initDataBase':
                initDataBase(data)
                break
                
            case 'linBase':
                const result = parseLinData(data.map(item => item.message.data))
                self.postMessage(result)
                break
        }
    }
}


