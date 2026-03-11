import { CanDB } from './share/can'
import { execBinary } from './util'
import { getPythonPath } from './python'
import fsP from 'fs/promises'
import path from 'path'
import iconv from 'iconv-lite'

/** Common encodings for DBC comments/units (Chinese etc.). Tried in order when encoding is not specified. */
const DEFAULT_ENCODINGS = ['gbk', 'gb2312', 'gb18030', 'big5', 'cp936'] as const

/**
 * Fix strings that were encoded (e.g. GBK/Big5) but misinterpreted as Latin-1 during DBC parse.
 * Each byte (0x80-0xFF) becomes U+00XX; convert back to bytes and decode with given encoding(s).
 * Only applies when all chars are in 0-255 (indicating misinterpreted bytes).
 */
function fixMisencodedString(
  str: string,
  encodings: readonly string[] = DEFAULT_ENCODINGS
): string {
  if (typeof str !== 'string' || str.length === 0) return str
  const chars = [...str]
  const allSingleByte = chars.every((c) => (c.codePointAt(0) ?? 0) <= 0xff)
  const hasHighBytes = chars.some((c) => {
    const cp = c.codePointAt(0) ?? 0
    return cp >= 0x80 && cp <= 0xff
  })
  if (!allSingleByte || !hasHighBytes) return str
  const bytes = Buffer.from(chars.map((c) => c.charCodeAt(0) & 0xff))
  for (const enc of encodings) {
    try {
      const decoded = iconv.decode(bytes, enc)
      if (!decoded.includes('�')) return decoded
    } catch {
      /* try next */
    }
  }
  return str
}

function fixMisencodedInValue(val: unknown, encodings: readonly string[]): unknown {
  if (typeof val === 'string') return fixMisencodedString(val, encodings)
  if (Array.isArray(val)) return val.map((v) => fixMisencodedInValue(v, encodings))
  if (val !== null && typeof val === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(val)) out[k] = fixMisencodedInValue(v, encodings)
    return out
  }
  return val
}

export interface ParseFileOptions {
  /** Encoding(s) to try when fixing misinterpreted strings (e.g. gbk, big5). If omitted, tries gbk, gb2312, gb18030, big5, cp936. */
  encoding?: string | string[]
}

export async function parseFile(
  filePath: string,
  outputJsonPath: string,
  options?: ParseFileOptions
): Promise<{ data: CanDB; msg: string }> {
  const pythonPath = getPythonPath()
  const result = await execBinary(pythonPath, [
    '-m',
    'canmatrix.cli.convert',
    filePath,
    outputJsonPath,
    '--jsonExportAll'
  ])
  if (result.success) {
    if (result.stdout.toLowerCase().includes('error')) {
      throw new Error(result.stdout)
    }
    if (result.stderr.toLowerCase().includes('error')) {
      throw new Error(result.stderr)
    }
    const json = await fsP.readFile(outputJsonPath, 'utf-8')
    const encodings =
      options?.encoding === undefined
        ? DEFAULT_ENCODINGS
        : Array.isArray(options.encoding)
          ? options.encoding
          : [options.encoding]
    const data = fixMisencodedInValue(JSON.parse(json), encodings) as CanDB
    return {
      data,
      msg: result.stdout
    }
  } else {
    throw new Error(result.stderr)
  }
}

export async function exportOtherFile(
  tmpDir: string,
  fileType: string,
  candb: CanDB,
  outputFilePath: string
): Promise<void> {
  //covert candb to json firstly, then conver the json file to the other file
  const jsonFilePath = path.join(tmpDir, 'canmatrix.json')
  await fsP.writeFile(jsonFilePath, JSON.stringify(candb, null, 2))
  const pythonPath = getPythonPath()
  // Omit -f to infer format from output path extension; avoids KeyError when a
  // format module failed to load (e.g. arxml when lxml is missing)
  const result = await execBinary(pythonPath, [
    '-m',
    'canmatrix.cli.convert',
    jsonFilePath,
    outputFilePath
  ])
  if (result.success) {
    if (result.stdout.toLowerCase().includes('error')) {
      throw new Error(result.stdout)
    }
    if (result.stderr.toLowerCase().includes('error')) {
      throw new Error(result.stderr)
    }
  } else {
    throw new Error(result.stderr)
  }
}
