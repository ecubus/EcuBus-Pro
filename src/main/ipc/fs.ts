import { ipcMain, shell } from 'electron'
import { glob } from 'glob'
import fsP from 'fs/promises'
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
    // Also check for common garbled patterns
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
function decodeFileContent(buffer: Buffer, forceEncoding?: string): string {
  if (forceEncoding) {
    return iconv.decode(buffer, forceEncoding)
  }
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

ipcMain.on('ipc-path-parse', async (event, arg) => {
  event.returnValue = path.parse(arg)
})
ipcMain.on('ipc-path-relative', async (event, ...args) => {
  event.returnValue = path.relative(args[0], args[1])
})
ipcMain.handle('ipc-glob', async (event, ...args) => {
  const par = args.shift()
  return glob(par, ...args)
})

ipcMain.handle('ipc-open-path', async (event, targetPath: string) => {
  try {
    await shell.openPath(targetPath)
    return true
  } catch (error) {
    console.error(`Failed to open path ${targetPath}:`, error)
    throw error
  }
})
ipcMain.handle('ipc-fs-readFile', async (event, ...args) => {
  const buffer = await fsP.readFile(args[0])
  return decodeFileContent(buffer, args[1] as string)
})

ipcMain.handle('ipc-fs-writeFile', async (event, ...args) => {
  const v = args[1]
  if (typeof v !== 'string') {
    args[1] = JSON.stringify(v, null, 2)
  }
  return fsP.writeFile(args[0], args[1])
})

ipcMain.handle('ipc-fs-readdir', async (event, ...args) => {
  return fsP.readdir(args[0], { withFileTypes: true })
})
ipcMain.handle('ipc-fs-mkdir', async (event, ...args) => {
  const dir = args[0]
  return fsP.mkdir(dir, { recursive: true })
})

ipcMain.handle('ipc-fs-exist', async (event, ...args) => {
  return fs.existsSync(args[0])
})
ipcMain.handle('ipc-fs-stat', async (event, ...args) => {
  return fsP.stat(args[0])
})

// 递归删除目录
ipcMain.handle('ipc-fs-rmdir', async (event, dirPath: string) => {
  try {
    await fsP.rm(dirPath, { recursive: true, force: true })
    return true
  } catch (error) {
    console.error(`Failed to remove directory ${dirPath}:`, error)
    throw error
  }
})
