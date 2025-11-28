import { describe, test, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import iconv from 'iconv-lite'

/**
 * Check if a buffer contains valid UTF-8 encoded text
 */
function isValidUtf8(buffer: Buffer): boolean {
  try {
    const text = buffer.toString('utf-8')
    // Check for replacement character which indicates invalid UTF-8
    if (text.includes('\uFFFD')) {
      return false
    }
    // Re-encode and compare to detect invalid sequences
    const reEncoded = Buffer.from(text, 'utf-8')
    return buffer.equals(reEncoded)
  } catch {
    return false
  }
}

/**
 * Detect and decode file content with proper encoding
 * Tries UTF-8 first, then falls back to GBK/GB2312 for Chinese encoding
 */
function decodeFileContent(buffer: Buffer): string {
  // Check for BOM markers
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    // UTF-8 BOM
    return buffer.toString('utf-8')
  }
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    // UTF-16 LE BOM
    return iconv.decode(buffer, 'utf-16le')
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    // UTF-16 BE BOM
    return iconv.decode(buffer, 'utf-16be')
  }

  // Try UTF-8 first
  if (isValidUtf8(buffer)) {
    return buffer.toString('utf-8')
  }

  // Fall back to GBK (which is a superset of GB2312) for Chinese encoding
  return iconv.decode(buffer, 'gbk')
}

describe('Encoding Detection Tests', () => {
  const testDir = path.join(__dirname)

  // Sample DBC content with Chinese characters
  const dbcContent = `VERSION ""

NS_ :

BS_:

BU_: 发动机控制单元 变速箱控制单元

BO_ 256 发动机状态: 8 发动机控制单元
 SG_ 发动机转速 : 0|16@1+ (0.25,0) [0|16383.5] "rpm" Vector__XXX
 SG_ 冷却液温度 : 16|8@1+ (1,-40) [-40|215] "°C" Vector__XXX

CM_ BU_ 发动机控制单元 "这是发动机控制单元的描述";
CM_ BO_ 256 "发动机状态消息";
CM_ SG_ 256 发动机转速 "发动机转速信号";
`

  test('should correctly decode UTF-8 encoded file', () => {
    // Create UTF-8 encoded buffer
    const utf8Buffer = Buffer.from(dbcContent, 'utf-8')

    const decoded = decodeFileContent(utf8Buffer)
    expect(decoded).toContain('发动机控制单元')
    expect(decoded).toContain('变速箱控制单元')
    expect(decoded).toContain('发动机转速')
    expect(decoded).toContain('冷却液温度')
  })

  test('should correctly decode GBK encoded file', () => {
    // Create GBK encoded buffer
    const gbkBuffer = iconv.encode(dbcContent, 'gbk')

    const decoded = decodeFileContent(gbkBuffer)
    expect(decoded).toContain('发动机控制单元')
    expect(decoded).toContain('变速箱控制单元')
    expect(decoded).toContain('发动机转速')
    expect(decoded).toContain('冷却液温度')
  })

  test('should correctly decode GB2312 encoded file', () => {
    // Create GB2312 encoded buffer (subset of GBK)
    const gb2312Buffer = iconv.encode(dbcContent, 'gb2312')

    const decoded = decodeFileContent(gb2312Buffer)
    expect(decoded).toContain('发动机控制单元')
    expect(decoded).toContain('变速箱控制单元')
    expect(decoded).toContain('发动机转速')
    expect(decoded).toContain('冷却液温度')
  })

  test('should correctly decode UTF-8 with BOM', () => {
    // Create UTF-8 with BOM
    const bom = Buffer.from([0xef, 0xbb, 0xbf])
    const content = Buffer.from(dbcContent, 'utf-8')
    const utf8BomBuffer = Buffer.concat([bom, content])

    const decoded = decodeFileContent(utf8BomBuffer)
    expect(decoded).toContain('发动机控制单元')
  })

  test('should correctly decode UTF-16 LE with BOM', () => {
    // Create UTF-16 LE with BOM (manually add BOM as iconv-lite doesn't add it)
    const bom = Buffer.from([0xff, 0xfe])
    const content = iconv.encode(dbcContent, 'utf-16le')
    const utf16leBuffer = Buffer.concat([bom, content])

    const decoded = decodeFileContent(utf16leBuffer)
    expect(decoded).toContain('发动机控制单元')
  })

  test('should correctly decode ASCII-only content', () => {
    const asciiContent = `VERSION ""
NS_ :
BS_:
BU_: ECU1 ECU2
BO_ 256 EngineStatus: 8 ECU1
 SG_ EngineRPM : 0|16@1+ (0.25,0) [0|16383.5] "rpm" Vector__XXX
`
    const asciiBuffer = Buffer.from(asciiContent, 'utf-8')

    const decoded = decodeFileContent(asciiBuffer)
    expect(decoded).toContain('ECU1')
    expect(decoded).toContain('EngineRPM')
  })

  test('isValidUtf8 should return true for valid UTF-8', () => {
    const validUtf8 = Buffer.from('Hello 世界', 'utf-8')
    expect(isValidUtf8(validUtf8)).toBe(true)
  })

  test('isValidUtf8 should return false for GBK encoded Chinese', () => {
    const gbkBuffer = iconv.encode('Hello 世界', 'gbk')
    expect(isValidUtf8(gbkBuffer)).toBe(false)
  })

  test('should handle mixed content with special characters', () => {
    const mixedContent = `VERSION ""
CM_ "温度单位: °C, 压力单位: kPa, 电压: μV";
`
    // Test UTF-8
    const utf8Buffer = Buffer.from(mixedContent, 'utf-8')
    let decoded = decodeFileContent(utf8Buffer)
    expect(decoded).toContain('温度单位')
    expect(decoded).toContain('°C')

    // Test GBK
    const gbkBuffer = iconv.encode(mixedContent, 'gbk')
    decoded = decodeFileContent(gbkBuffer)
    expect(decoded).toContain('温度单位')
  })

  test('should read and decode GBK test file', () => {
    // Create a GBK encoded test file
    const gbkFilePath = path.join(testDir, 'test_gbk.dbc')
    const gbkBuffer = iconv.encode(dbcContent, 'gbk')
    fs.writeFileSync(gbkFilePath, gbkBuffer)

    // Read and decode
    const fileBuffer = fs.readFileSync(gbkFilePath)
    const decoded = decodeFileContent(fileBuffer)

    expect(decoded).toContain('发动机控制单元')
    expect(decoded).toContain('冷却液温度')

    // Cleanup
    fs.unlinkSync(gbkFilePath)
  })

  test('should read and decode UTF-8 test file', () => {
    // Create a UTF-8 encoded test file
    const utf8FilePath = path.join(testDir, 'test_utf8.dbc')
    fs.writeFileSync(utf8FilePath, dbcContent, 'utf-8')

    // Read and decode
    const fileBuffer = fs.readFileSync(utf8FilePath)
    const decoded = decodeFileContent(fileBuffer)

    expect(decoded).toContain('发动机控制单元')
    expect(decoded).toContain('冷却液温度')

    // Cleanup
    fs.unlinkSync(utf8FilePath)
  })
})
