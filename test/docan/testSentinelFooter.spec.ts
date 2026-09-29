import { describe, it, expect } from 'vitest'
import { spawnSync, SpawnSyncReturns } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { testSentinelFooterJs } from '../../src/main/docan/testSentinelFooter'

const electronBin = path.resolve(__dirname, '../../node_modules/electron/dist/electron')
const suitePath = path.resolve(__dirname, 'fixtures/sentinelSuite.js')

interface TapEntry {
  name: string
  ok: boolean
  skip: boolean
  suite: boolean
}

function runSuite(extraArgs: string[], env: Record<string, string>): SpawnSyncReturns<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecb-sentinel-'))
  const file = path.join(dir, 'suite.js')
  const source = fs.readFileSync(suitePath, 'utf8')
  fs.writeFileSync(file, `${source}\n${testSentinelFooterJs}\n`)
  return spawnSync(electronBin, [...extraArgs, '--test-reporter=tap', file], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      ...env
    }
  })
}

function tapEntries(stdout: string): TapEntry[] {
  const lines = stdout.split('\n')
  const entries: TapEntry[] = []
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(/^(ok|not ok) \d+ - (.*)$/)
    if (!match) continue
    let name = match[2]
    const skip = name.endsWith('# SKIP')
    if (skip) name = name.slice(0, -' # SKIP'.length)
    let suite = false
    for (let j = i + 1; j < lines.length; j++) {
      const yaml = lines[j].trim()
      if (yaml === '...') break
      if (yaml === "type: 'suite'") suite = true
    }
    entries.push({ name, ok: match[1] === 'ok', skip, suite })
  }
  return entries
}

function tapCount(stdout: string, label: string) {
  const line = stdout.split('\n').find((item) => item.startsWith(`# ${label} `))
  expect(line, label).toBeTruthy()
  return Number(line!.slice(label.length + 3))
}

function logCount(stdout: string, line: string) {
  return stdout.split('\n').filter((item) => item.trim() === line).length
}

function passed(entries: TapEntry[], name: string) {
  return entries.filter((entry) => entry.name === name && entry.ok && !entry.skip && !entry.suite)
}

function skipped(entries: TapEntry[], name: string) {
  return entries.filter((entry) => entry.name === name && entry.skip)
}

function suite(entries: TapEntry[], name: string) {
  return entries.find((entry) => entry.name === name && entry.suite)
}

describe.skipIf(!fs.existsSync(electronBin))('test sentinel footer', () => {
  it('runs sync, async, top-level, duplicate, and nested describe tests', () => {
    const result = runSuite([], { ONLY: 'false', ENABLE_ALL: 'true' })
    expect(result.status).toBe(0)
    const entries = tapEntries(result.stdout)

    expect(passed(entries, 'top level')).toHaveLength(1)
    expect(passed(entries, 'sync pass')).toHaveLength(1)
    expect(passed(entries, 'async pass')).toHaveLength(1)
    expect(passed(entries, 'nested pass')).toHaveLength(1)
    expect(passed(entries, 'duplicate name')).toHaveLength(2)
    expect(skipped(entries, 'explicit skip')).toHaveLength(1)
    expect(skipped(entries, 'nested skip')).toHaveLength(1)
    expect(result.stdout).not.toContain('RAN_SKIP_BODY')
    expect(result.stdout).not.toContain('RAN_NESTED_SKIP_BODY')
    expect(result.stdout).toContain('DUP_A')
    expect(result.stdout).toContain('DUP_B')

    expect(suite(entries, 'CAN Test')?.ok).toBe(true)
    expect(suite(entries, 'nested')?.ok).toBe(true)
    expect(suite(entries, 'UDS Test')?.ok).toBe(true)
    expect(suite(entries, 'empty suite')?.ok).toBe(true)
    expect(passed(entries, '____ecubus_pro_test___')).toHaveLength(1)

    expect(logCount(result.stdout, 'HOOK before CAN')).toBe(1)
    expect(logCount(result.stdout, 'HOOK after CAN')).toBe(1)
    expect(logCount(result.stdout, 'HOOK before nested')).toBe(1)
    expect(logCount(result.stdout, 'HOOK after nested')).toBe(1)
    expect(logCount(result.stdout, 'HOOK beforeEach CAN')).toBe(5)
    expect(logCount(result.stdout, 'HOOK afterEach CAN')).toBe(5)
    expect(logCount(result.stdout, 'HOOK beforeEach nested')).toBe(2)
    expect(logCount(result.stdout, 'HOOK afterEach nested')).toBe(2)

    expect(tapCount(result.stdout, 'tests')).toBe(9)
    expect(tapCount(result.stdout, 'suites')).toBe(4)
    expect(tapCount(result.stdout, 'pass')).toBe(7)
    expect(tapCount(result.stdout, 'fail')).toBe(0)
    expect(tapCount(result.stdout, 'skipped')).toBe(2)
  })

  it('keeps every describe visible while discovery skips test bodies', () => {
    const result = runSuite(['--test-only'], { ONLY: 'true' })
    expect(result.status).toBe(0)
    const entries = tapEntries(result.stdout)

    for (const name of [
      'top level',
      'sync pass',
      'async pass',
      'explicit skip',
      'nested pass',
      'nested skip',
      'duplicate name'
    ]) {
      expect(skipped(entries, name).length).toBeGreaterThan(0)
    }
    expect(skipped(entries, 'duplicate name')).toHaveLength(2)
    expect(result.stdout).not.toContain('RAN ')
    expect(result.stdout).not.toContain('HOOK ')
    expect(result.stdout).not.toContain('DUP_A')

    expect(suite(entries, 'CAN Test')?.ok).toBe(true)
    expect(suite(entries, 'nested')?.ok).toBe(true)
    expect(suite(entries, 'UDS Test')?.ok).toBe(true)
    expect(suite(entries, 'empty suite')?.ok).toBe(true)
    expect(passed(entries, '____ecubus_pro_test___')).toHaveLength(1)

    expect(tapCount(result.stdout, 'tests')).toBe(9)
    expect(tapCount(result.stdout, 'suites')).toBe(4)
    expect(tapCount(result.stdout, 'pass')).toBe(1)
    expect(tapCount(result.stdout, 'skipped')).toBe(8)
  })

  it('still runs nested describes when only-mode is on for every test', () => {
    const result = runSuite(['--test-only'], { ONLY: 'true', ENABLE_ALL: 'true' })
    expect(result.status).toBe(0)
    const entries = tapEntries(result.stdout)

    expect(passed(entries, 'nested pass')).toHaveLength(1)
    expect(passed(entries, 'sync pass')).toHaveLength(1)
    expect(suite(entries, 'nested')?.ok).toBe(true)
    expect(suite(entries, 'CAN Test')?.ok).toBe(true)
    expect(skipped(entries, 'explicit skip')).toHaveLength(1)
    expect(tapCount(result.stdout, 'pass')).toBe(7)
    expect(tapCount(result.stdout, 'skipped')).toBe(2)
    expect(tapCount(result.stdout, 'suites')).toBe(4)
  })

  it('runs one nested test and leaves the surrounding describes in the report', () => {
    const result = runSuite([], { ONLY: 'false', ENABLE: '4' })
    expect(result.status).toBe(0)
    const entries = tapEntries(result.stdout)

    expect(result.stdout).toContain('RAN 4 nested pass')
    expect(result.stdout).not.toContain('RAN 0 ')
    expect(result.stdout).not.toContain('RAN 1 ')
    expect(result.stdout).not.toContain('RAN 2 ')
    expect(result.stdout).not.toContain('DUP_A')
    expect(result.stdout).not.toContain('DUP_B')
    expect(passed(entries, 'nested pass')).toHaveLength(1)
    expect(skipped(entries, 'sync pass')).toHaveLength(1)
    expect(skipped(entries, 'async pass')).toHaveLength(1)
    expect(skipped(entries, 'top level')).toHaveLength(1)
    expect(skipped(entries, 'duplicate name')).toHaveLength(2)
    expect(suite(entries, 'nested')?.ok).toBe(true)
    expect(suite(entries, 'CAN Test')?.ok).toBe(true)
    expect(suite(entries, 'UDS Test')?.ok).toBe(true)
    expect(logCount(result.stdout, 'HOOK before nested')).toBe(1)
    expect(logCount(result.stdout, 'HOOK beforeEach nested')).toBe(1)
    expect(tapCount(result.stdout, 'pass')).toBe(2)
    expect(tapCount(result.stdout, 'skipped')).toBe(7)
  })

  it('runs every leaf inside a describe, including its nested describe', () => {
    const result = runSuite([], { ONLY: 'false', ENABLE: '1,2,3,4,5' })
    expect(result.status).toBe(0)
    const entries = tapEntries(result.stdout)

    expect(result.stdout).toContain('RAN 1 sync pass')
    expect(result.stdout).toContain('RAN 2 async pass')
    expect(result.stdout).toContain('RAN 4 nested pass')
    expect(result.stdout).not.toContain('RAN 0 ')
    expect(result.stdout).not.toContain('DUP_A')
    expect(passed(entries, 'sync pass')).toHaveLength(1)
    expect(passed(entries, 'async pass')).toHaveLength(1)
    expect(passed(entries, 'nested pass')).toHaveLength(1)
    expect(skipped(entries, 'explicit skip')).toHaveLength(1)
    expect(skipped(entries, 'nested skip')).toHaveLength(1)
    expect(skipped(entries, 'top level')).toHaveLength(1)
    expect(skipped(entries, 'duplicate name')).toHaveLength(2)
    expect(suite(entries, 'CAN Test')?.ok).toBe(true)
    expect(suite(entries, 'nested')?.ok).toBe(true)
    expect(logCount(result.stdout, 'HOOK before CAN')).toBe(1)
    expect(logCount(result.stdout, 'HOOK before nested')).toBe(1)
    expect(tapCount(result.stdout, 'pass')).toBe(4)
    expect(tapCount(result.stdout, 'skipped')).toBe(5)
  })

  it('runs a nested describe without running sibling tests', () => {
    const result = runSuite([], { ONLY: 'false', ENABLE: '4,5' })
    expect(result.status).toBe(0)
    const entries = tapEntries(result.stdout)

    expect(result.stdout).toContain('RAN 4 nested pass')
    expect(result.stdout).not.toContain('RAN 1 ')
    expect(result.stdout).not.toContain('RAN_NESTED_SKIP_BODY')
    expect(passed(entries, 'nested pass')).toHaveLength(1)
    expect(skipped(entries, 'nested skip')).toHaveLength(1)
    expect(skipped(entries, 'sync pass')).toHaveLength(1)
    expect(suite(entries, 'nested')?.ok).toBe(true)
    expect(suite(entries, 'CAN Test')?.ok).toBe(true)
    expect(tapCount(result.stdout, 'pass')).toBe(2)
    expect(tapCount(result.stdout, 'skipped')).toBe(7)
  })

  it('runs one test inside a later describe and still reports earlier suites', () => {
    const result = runSuite([], { ONLY: 'false', ENABLE: '6' })
    expect(result.status).toBe(0)
    const entries = tapEntries(result.stdout)

    expect(result.stdout).toContain('DUP_A')
    expect(result.stdout).not.toContain('DUP_B')
    expect(result.stdout).not.toContain('RAN 1 ')
    expect(passed(entries, 'duplicate name')).toHaveLength(1)
    expect(skipped(entries, 'duplicate name')).toHaveLength(1)
    expect(skipped(entries, 'sync pass')).toHaveLength(1)
    expect(suite(entries, 'CAN Test')?.ok).toBe(true)
    expect(suite(entries, 'nested')?.ok).toBe(true)
    expect(suite(entries, 'UDS Test')?.ok).toBe(true)
    expect(suite(entries, 'empty suite')?.ok).toBe(true)
    expect(logCount(result.stdout, 'HOOK before CAN')).toBe(1)
    expect(tapCount(result.stdout, 'pass')).toBe(2)
    expect(tapCount(result.stdout, 'skipped')).toBe(7)
  })

  it('reports a failed test without dropping sibling describes or the sentinel', () => {
    const result = runSuite([], { ONLY: 'false', ENABLE_ALL: 'true', FAIL: '1' })
    expect(result.status).toBe(1)
    const entries = tapEntries(result.stdout)

    expect(result.stdout).toContain('DUP_A')
    expect(result.stdout).toContain('DUP_B')
    expect(passed(entries, 'duplicate name')).toHaveLength(1)
    expect(entries.filter((entry) => entry.name === 'duplicate name' && !entry.ok)).toHaveLength(1)
    expect(passed(entries, 'sync pass')).toHaveLength(1)
    expect(passed(entries, 'nested pass')).toHaveLength(1)
    expect(passed(entries, '____ecubus_pro_test___')).toHaveLength(1)
    expect(suite(entries, 'CAN Test')?.ok).toBe(true)
    expect(suite(entries, 'nested')?.ok).toBe(true)
    expect(suite(entries, 'UDS Test')?.ok).toBe(false)
    expect(suite(entries, 'empty suite')?.ok).toBe(true)
    expect(tapCount(result.stdout, 'pass')).toBe(6)
    expect(tapCount(result.stdout, 'fail')).toBe(1)
    expect(tapCount(result.stdout, 'skipped')).toBe(2)
  })
})
