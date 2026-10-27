import { afterEach, describe, expect, test, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { tmpdir } from 'os'

const mocks = vi.hoisted(() => ({ handle: vi.fn(), exec: vi.fn() }))
vi.mock('electron', () => ({
  app: { getPath: () => tmpdir() },
  ipcMain: { handle: mocks.handle }
}))
vi.mock('src/main/python', () => ({ getPythonPath: () => 'python' }))
vi.mock('src/main/util', () => ({ execBinary: mocks.exec }))

await import('src/main/ipc/cdd')
const parseTesterInfo = mocks.handle.mock.calls.find(
  ([name]) => name === 'ipcCddParseTesterInfo'
)![1]

afterEach(() => mocks.exec.mockReset())

describe('CDD parse IPC', () => {
  test('keeps simultaneous parse outputs separate and cleans temporary files', async () => {
    const outputs: string[] = []
    mocks.exec.mockImplementation(async (_python, args: string[]) => {
      outputs.push(args[3])
      expect(args[1]).toBe('parseTesterInfo')
      await fs.writeFile(args[3], JSON.stringify({ error: 0, data: { name: args[2] } }))
      return { success: true }
    })

    const results = await Promise.all([
      parseTesterInfo(null, '', 'left.cdd'),
      parseTesterInfo(null, '', 'right.cdd')
    ])
    expect(results.map((result) => result.data.name)).toEqual(['left.cdd', 'right.cdd'])
    expect(new Set(outputs).size).toBe(2)
    for (const output of outputs) {
      await expect(fs.access(path.dirname(output))).rejects.toThrow()
    }
  })

  test('cleans up when the parser process fails', async () => {
    let output = ''
    mocks.exec.mockImplementation(async (_python, args: string[]) => {
      output = args[3]
      return { success: false, stderr: 'Invalid CDD' }
    })
    await expect(parseTesterInfo(null, '', 'invalid.cdd')).rejects.toThrow('Invalid CDD')
    await expect(fs.access(path.dirname(output))).rejects.toThrow()
  })
})
