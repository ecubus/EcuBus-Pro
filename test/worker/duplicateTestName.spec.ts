import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const bundlePath = path.resolve(__dirname, '../../resources/lib/js/index.js')

interface TapEntry {
  name: string
  ok: boolean
  skip: boolean
}

/**
 * Run two `DiagnosticSessionControl160 test` cases through the shipped worker
 * `test()` / `describe()`, the same names as resources/examples/test_simple/test.ts.
 * Both calls land on the uds.ts wrapper callsite; testCnt must still run each body.
 */
function runDuplicate(indexes: number[], failSecond: boolean) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecb-dup-test-'))
  const file = path.join(dir, 'duplicate.mjs')
  const control = Object.fromEntries(indexes.map((index) => [index, true]))
  fs.writeFileSync(
    file,
    `import { createRequire } from 'module'
import assert from 'node:assert'
const require = createRequire(import.meta.url)
const worker = require(${JSON.stringify(bundlePath)})
worker.Util.start(undefined, {}, undefined, ${JSON.stringify(control)})
worker.Util.event.emit('__varFc')
worker.describe('UDS Test', () => {
  worker.test('DiagnosticSessionControl160 test', () => {
    console.log('BODY_SESSION_DEFAULT')
    assert.equal(1, 1)
  })
  worker.test('DiagnosticSessionControl160 test', () => {
    console.log('BODY_SESSION_TYPE_2')
    assert.equal(1, ${failSecond ? 2 : 1})
  })
})
`
  )
  return spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ONLY: 'false',
      MODE: 'test'
    }
  })
}

function tapEntries(stdout: string): TapEntry[] {
  const entries: TapEntry[] = []
  for (const line of stdout.split('\n')) {
    const match = line.trim().match(/^(ok|not ok) \d+ - (.*)$/)
    if (!match) continue
    let name = match[2]
    const skip = name.endsWith('# SKIP')
    if (skip) name = name.slice(0, -' # SKIP'.length).trimEnd()
    entries.push({ name, ok: match[1] === 'ok', skip })
  }
  return entries
}

function cases(stdout: string) {
  return tapEntries(stdout).filter((entry) => entry.name === 'DiagnosticSessionControl160 test')
}

describe('worker duplicate test names', () => {
  it('runs both same-named test_simple cases and keeps distinct results', () => {
    const result = runDuplicate([0, 1], true)
    const found = cases(result.stdout)

    expect(result.stdout).toContain('BODY_SESSION_DEFAULT')
    expect(result.stdout).toContain('BODY_SESSION_TYPE_2')
    expect(found).toEqual([
      { name: 'DiagnosticSessionControl160 test', ok: true, skip: false },
      { name: 'DiagnosticSessionControl160 test', ok: false, skip: false }
    ])
    expect(result.status).toBe(1)
  })

  it('gives each same-named case its own testCnt slot', () => {
    const first = runDuplicate([0], false)
    const second = runDuplicate([1], false)

    expect(first.stdout).toContain('BODY_SESSION_DEFAULT')
    expect(first.stdout).not.toContain('BODY_SESSION_TYPE_2')
    expect(cases(first.stdout)).toEqual([
      { name: 'DiagnosticSessionControl160 test', ok: true, skip: false },
      { name: 'DiagnosticSessionControl160 test', ok: true, skip: true }
    ])

    expect(second.stdout).toContain('BODY_SESSION_TYPE_2')
    expect(second.stdout).not.toContain('BODY_SESSION_DEFAULT')
    expect(cases(second.stdout)).toEqual([
      { name: 'DiagnosticSessionControl160 test', ok: true, skip: true },
      { name: 'DiagnosticSessionControl160 test', ok: true, skip: false }
    ])
    expect(first.status).toBe(0)
    expect(second.status).toBe(0)
  })
})
