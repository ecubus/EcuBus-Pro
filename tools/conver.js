const fs=require('fs')
const path=require('path')

const hexString = fs.readFileSync(path.resolve(__dirname, './a.txt'), 'utf-8')
// Remove spaces and convert to buffer
const hexArray = hexString.split(' ').filter(h => h.length > 0)

const buffer = Buffer.from(hexArray.map(h => parseInt(h, 16)))

// Write to a.bin
const outputPath = path.resolve(__dirname, './a.bin')
fs.writeFileSync(outputPath, buffer)

console.log(`Successfully converted ${hexArray.length} bytes to ${outputPath}`)
