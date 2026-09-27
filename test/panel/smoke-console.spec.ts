import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'

it('writes smoke and electron-log output when the launcher pipes are broken', () => {
  const artifacts = mkdtempSync(path.join(os.tmpdir(), 'panel-console-test-'))
  try {
    execFileSync(process.execPath, [
      '-e',
      `
        const brokenPipe = () => { throw Object.assign(new Error('broken pipe'), { code: 'EPIPE' }) }
        process.stdout.write = brokenPipe
        process.stderr.write = brokenPipe
        require('./test/panel/smoke-console.cjs')(${JSON.stringify(artifacts)})
        const log = require('electron-log/node')
        log.transports.file.level = false
        log.info('application info')
        log.error('application error')
        console.log('smoke finished')
        process.exit(0)
      `
    ])
    const output = readFileSync(path.join(artifacts, 'console.log'), 'utf8')
    expect(output).toContain('application info')
    expect(output).toContain('application error')
    expect(output).toContain('smoke finished')
  } finally {
    rmSync(artifacts, { recursive: true, force: true })
  }
})
