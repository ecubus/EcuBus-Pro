import { describe, it, expect } from 'vitest'
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { testSentinelFooterJs } from '../../src/main/docan/testSentinelFooter'

const electronBin = path.resolve(__dirname, '../../node_modules/electron/dist/electron')

/**
 * Mirrors the worker's ONLY switch: discovery marks every suite and test as
 * only, a real run uses the plain node:test functions.
 */
const userTests = `
const { describe, test } = require('node:test')
const assert = require('node:assert')
const selfDescribe = process.env.ONLY == 'true' ? describe.only : describe
const selfTest = process.env.ONLY == 'true' ? test.only : test

selfDescribe('CAN Test', () => {
  selfTest('case A', () => {
    console.log('RAN_CASE_A')
    assert.strictEqual(1, 1)
  })
  selfTest('case B', () => {
    console.log('RAN_CASE_B')
    assert.strictEqual(2, 2)
  })
})
`

function runWithElectronNode(extraArgs: string[], env: Record<string, string | undefined>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecb-sentinel-'))
  const file = path.join(dir, 'suite.js')
  fs.writeFileSync(file, `${userTests}\n${testSentinelFooterJs}\n`)
  return spawnSync(electronBin, [...extraArgs, '--test-reporter=tap', file], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      ...env
    }
  })
}

function passedTest(stdout: string, name: string) {
  return stdout.split('\n').some((line) => {
    const text = line.trim()
    return text.startsWith('ok ') && text.includes(`- ${name}`) && !text.includes('# SKIP')
  })
}

describe.skipIf(!fs.existsSync(electronBin))('test sentinel footer', () => {
  it('keeps user tests running when ONLY is unset (Node 24 run path)', () => {
    const result = runWithElectronNode([], { ONLY: 'false' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('RAN_CASE_A')
    expect(result.stdout).toContain('RAN_CASE_B')
    expect(passedTest(result.stdout, 'case A')).toBe(true)
    expect(passedTest(result.stdout, 'case B')).toBe(true)
    expect(passedTest(result.stdout, '____ecubus_pro_test___')).toBe(true)
  })

  it('still runs the only sentinel and user tests during discovery', () => {
    const result = runWithElectronNode(['--test-only'], { ONLY: 'true' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('RAN_CASE_A')
    expect(result.stdout).toContain('RAN_CASE_B')
    expect(passedTest(result.stdout, 'case A')).toBe(true)
    expect(passedTest(result.stdout, '____ecubus_pro_test___')).toBe(true)
  })
})
