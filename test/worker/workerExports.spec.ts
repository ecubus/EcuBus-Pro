import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const bundlePath = path.resolve(__dirname, '../../resources/lib/js/index.js')
const typingsPath = path.resolve(__dirname, '../../src/main/share/index.d.ts.html')

describe('worker bundle exports', () => {
  it('includes LIN scheduler APIs in the runtime bundle', () => {
    expect(fs.existsSync(bundlePath)).toBe(true)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const worker = require(bundlePath) as Record<string, unknown>
    expect(typeof worker.linStartScheduler).toBe('function')
    expect(typeof worker.linStopScheduler).toBe('function')
    expect(typeof worker.linPowerCtrl).toBe('function')
    expect(typeof worker.linBaudRateCtrl).toBe('function')
  })

  it('includes LIN scheduler APIs in generated script typings', () => {
    expect(fs.existsSync(typingsPath)).toBe(true)
    const typings = fs.readFileSync(typingsPath, 'utf-8')
    expect(typings).toContain('declare function linStartScheduler')
    expect(typings).toContain('activeCtrl: boolean[]')
    expect(typings).toContain('declare function linStopScheduler')
    expect(typings).toMatch(/export \{[^}]*linStartScheduler[^}]*\}/)
  })
})
