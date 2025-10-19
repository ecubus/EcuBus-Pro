const fs = require('fs')
const path = require('path')

// Frame structure from parser.ts
const FRAME_HEADER = Buffer.from([0x5a, 0x5b, 0x5c, 0x5d])
const FRAME_HEADER_SIZE = 4
const DATA_LENGTH = 12
const FRAME_LENGTH = FRAME_HEADER_SIZE + DATA_LENGTH

// Parse command line arguments
const args = process.argv.slice(2)
const mode = args[0] || 'to-csv' // 'to-csv' or 'to-bin'

if (mode === 'to-bin') {
  // Convert CSV to binary
  convertCsvToBin()
} else {
  // Convert binary/txt to CSV (default)
  convertBinToCsv()
}

function convertCsvToBin() {
  console.log('=== Converting CSV to binary ===\n')
  
  const csvPath = path.resolve(__dirname, './a.csv')
  const binPath = path.resolve(__dirname, './a.bin')
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ Error: a.csv not found!')
    process.exit(1)
  }
  
  // Read CSV file
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const lines = csvContent.trim().split('\n')
  
  // Skip header
  const header = lines[0]
  const dataLines = lines.slice(1)
  
  console.log(`CSV header: ${header}`)
  console.log(`Data rows: ${dataLines.length}\n`)
  
  // Create buffer for all frames
  const totalSize = dataLines.length * FRAME_LENGTH
  const buffer = Buffer.alloc(totalSize)
  let offset = 0
  let frameCount = 0
  
  for (const line of dataLines) {
    const fields = line.split(',')
    
    if (fields.length < 7) {
      console.log(`Warning: Skipping invalid line ${frameCount + 1}: ${line}`)
      continue
    }
    
    // Parse CSV fields: index,timestamp,type,type_id,type_status,coreID,crc
    const index = parseInt(fields[0])
    const timestamp = parseInt(fields[1])
    const type = parseInt(fields[2])
    const typeId = parseInt(fields[3])
    const typeStatus = parseInt(fields[4])
    const coreID = parseInt(fields[5])
    const crc = parseInt(fields[6])
    
    // Write frame header
    FRAME_HEADER.copy(buffer, offset)
    offset += FRAME_HEADER_SIZE
    
    // Write frame data (12 bytes)
    // timestamp (4 bytes LSB)
    buffer.writeUInt32LE(timestamp, offset)
    offset += 4
    
    // typeId (2 bytes LSB)
    buffer.writeUInt16LE(typeId, offset)
    offset += 2
    
    // typeStatus (2 bytes LSB)
    buffer.writeUInt16LE(typeStatus, offset)
    offset += 2
    
    // index (1 byte)
    buffer.writeUInt8(index, offset)
    offset += 1
    
    // type (1 byte)
    buffer.writeUInt8(type, offset)
    offset += 1
    
    // coreID (1 byte)
    buffer.writeUInt8(coreID, offset)
    offset += 1
    
    // crc (1 byte)
    buffer.writeUInt8(crc, offset)
    offset += 1
    
    frameCount++
  }
  
  // Write binary file
  fs.writeFileSync(binPath, buffer.slice(0, offset))
  
  console.log('=== Conversion Complete ===')
  console.log(`Total frames written: ${frameCount}`)
  console.log(`Output file: ${binPath} (${offset} bytes)`)
  console.log('\n✅ CSV to binary conversion done!')
}

function convertBinToCsv() {
  console.log('=== Step 1: Convert HEX text to binary ===')

  // Check if a.txt exists
  const txtPath = path.resolve(__dirname, './a.txt')
  const binPath = path.resolve(__dirname, './a.bin')
  let buffer

  if (fs.existsSync(txtPath)) {
    // Read and convert hex string to binary
    const hexString = fs.readFileSync(txtPath, 'utf-8')
    const hexArray = hexString.split(' ').filter(h => h.length > 0)
    
    buffer = Buffer.from(hexArray.map(h => parseInt(h, 16)))
    
    // Write to a.bin
    fs.writeFileSync(binPath, buffer)
    console.log(`✓ Converted ${hexArray.length} bytes from a.txt to a.bin`)
  } else if (fs.existsSync(binPath)) {
    // If a.txt doesn't exist but a.bin does, just read a.bin
    buffer = fs.readFileSync(binPath)
    console.log(`✓ Using existing a.bin (${buffer.length} bytes)`)
  } else {
    console.error('❌ Error: Neither a.txt nor a.bin found!')
    process.exit(1)
  }

  console.log('\n=== Step 2: Parse binary and convert to CSV ===')

  // Output CSV file
  const csvPath = path.resolve(__dirname, './a.csv')
  const csvLines = []

  // CSV header - index放前面
  csvLines.push('index,timestamp,type,type_id,type_status,coreID,crc')

  let position = 0
  let frameCount = 0
  let errorCount = 0
  let lastIndex = undefined
  const indexErrors = [] // Store index discontinuity errors

  console.log(`Total buffer size: ${buffer.length} bytes`)
  console.log('Starting to parse frames...\n')

  while (position < buffer.length) {
    // Search for frame header
    let headerIndex = -1
    for (let i = position; i <= buffer.length - FRAME_HEADER_SIZE; i++) {
      if (
        buffer[i] === FRAME_HEADER[0] &&
        buffer[i + 1] === FRAME_HEADER[1] &&
        buffer[i + 2] === FRAME_HEADER[2] &&
        buffer[i + 3] === FRAME_HEADER[3]
      ) {
        headerIndex = i
        break
      }
    }

    // No more frame headers found
    if (headerIndex === -1) {
      if (position < buffer.length) {
        console.log(`Skipped ${buffer.length - position} trailing bytes without valid frame header`)
      }
      break
    }

    // Skip bytes before frame header
    if (headerIndex > position) {
      console.log(`Skipped ${headerIndex - position} bytes before frame at position ${headerIndex}`)
      errorCount++
    }

    position = headerIndex

    // Check if we have enough data for a complete frame
    if (position + FRAME_LENGTH > buffer.length) {
      console.log(`Incomplete frame at position ${position}, only ${buffer.length - position} bytes remaining`)
      break
    }

    // Extract frame data (skip header)
    const block = buffer.subarray(position + FRAME_HEADER_SIZE, position + FRAME_LENGTH)

    // Parse according to the structure in parser.ts:
    // timestamp (4 bytes LSB), typeId (2 bytes LSB), typeStatus (2 bytes LSB), 
    // index (1 byte), type (1 byte), coreID (1 byte), crc (1 byte)
    const timestamp = block.readUInt32LE(0)
    const typeId = block.readUInt16LE(4)
    const typeStatus = block.readUInt16LE(6)
    const index = block.readUInt8(8)
    const type = block.readUInt8(9)
    const coreID = block.readUInt8(10)
    const crc = block.readUInt8(11)

    // Validate frame (simple check - type should be 0-5)
    if (type > 5) {
      console.log(`Warning: Invalid type ${type} at frame ${frameCount}, index ${index}`)
      errorCount++
    }

    // Check index continuity (uint8: 0-255 循环)
    if (lastIndex !== undefined) {
      const expectedIndex = (lastIndex + 1) & 0xff // 0-255循环
      if (index !== expectedIndex) {
        const error = {
          frameNumber: frameCount + 1,
          csvLine: csvLines.length + 1, // +1 for header
          expectedIndex: expectedIndex,
          actualIndex: index,
          lastIndex: lastIndex,
          timestamp: timestamp
        }
        indexErrors.push(error)
        console.log(`❌ Index discontinuity at frame ${error.frameNumber} (CSV line ${error.csvLine}): expected ${expectedIndex}, got ${index}`)
      }
    }
    lastIndex = index

    // Add to CSV - index放前面
    csvLines.push(`${index},${timestamp},${type},${typeId},${typeStatus},${coreID},${crc}`)

    frameCount++
    position += FRAME_LENGTH
  }

  // Write CSV file
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8')

  console.log('\n=== Conversion Complete ===')
  console.log(`Total frames parsed: ${frameCount}`)
  console.log(`Frame errors/warnings: ${errorCount}`)
  console.log(`Index discontinuities found: ${indexErrors.length}`)
  console.log(`Output files:`)
  console.log(`  - Binary: ${binPath}`)
  console.log(`  - CSV: ${csvPath} (${csvLines.length - 1} data rows)`)

  // Write index error report if there are any
  if (indexErrors.length > 0) {
    const errorReportPath = path.resolve(__dirname, './index_errors.txt')
    const errorLines = [
      '=== Index Discontinuity Report ===',
      `Total discontinuities: ${indexErrors.length}`,
      '',
      'Frame# | CSV Line | Expected | Actual | Last Index | Timestamp',
      '-------|----------|----------|--------|------------|----------'
    ]
    
    indexErrors.forEach(err => {
      errorLines.push(
        `${String(err.frameNumber).padStart(6)} | ${String(err.csvLine).padStart(8)} | ${String(err.expectedIndex).padStart(8)} | ${String(err.actualIndex).padStart(6)} | ${String(err.lastIndex).padStart(10)} | ${err.timestamp}`
      )
    })
    
    fs.writeFileSync(errorReportPath, errorLines.join('\n'), 'utf-8')
    console.log(`  - Error report: ${errorReportPath}`)
  }

  console.log('\n✅ All done!')
}

