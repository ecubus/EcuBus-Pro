import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  acquireInstanceSlot,
  createInstanceSession,
  extractAuthState,
  extractProtocolUrl,
  forwardProtocolUrl,
  getRecordPath,
  getSessionDataPath,
  listLiveInstances,
  releaseInstanceSlot,
  type InstanceSession,
  type ProtocolForwardRequest
} from 'src/main/multiInstance'

function waitForListening(session: InstanceSession): Promise<void> {
  if (session.server.listening) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    session.server.once('listening', () => resolve())
    session.server.once('error', reject)
  })
}

describe('multiInstance', () => {
  let tmpBaseDir: string
  const sessions: InstanceSession[] = []

  beforeEach(() => {
    tmpBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecubus-multi-inst-'))
  })

  afterEach(() => {
    while (sessions.length > 0) {
      sessions.pop()?.dispose()
    }
    fs.rmSync(tmpBaseDir, { recursive: true, force: true })
  })

  it('extracts ecubuspro:// protocol URL and OAuth state from argv', () => {
    expect(extractProtocolUrl(['ecubuspro.exe'])).toBeUndefined()
    expect(extractProtocolUrl(['ecubuspro.exe', '--foo', 'bar.ecb'])).toBeUndefined()

    const url = 'ecubuspro://callback?code=abc123&state=state-xyz'
    expect(extractProtocolUrl(['ecubuspro.exe', '--allow-file', url])).toBe(url)
    expect(extractProtocolUrl(['ecubuspro.exe', `"${url}"`])).toBe(url)
    expect(extractAuthState(url)).toBe('state-xyz')
    expect(extractAuthState('ecubuspro://callback?code=abc123')).toBeUndefined()
  })

  it('keeps default sessionData for slot 0 and isolates secondary slots', () => {
    expect(getSessionDataPath(tmpBaseDir, 0)).toBeUndefined()
    expect(getSessionDataPath(tmpBaseDir, 1)).toBe(path.join(tmpBaseDir, 'sessions', 'inst-1'))
    expect(getSessionDataPath(tmpBaseDir, 2)).toBe(path.join(tmpBaseDir, 'sessions', 'inst-2'))
  })

  it('allocates distinct slots, reuses released slots, and reclaims stale dead-PID slots', () => {
    const alivePids = new Set<number>([1001, 1002, 1003])
    const isAlive = (pid: number) => alivePids.has(pid)

    const s0 = acquireInstanceSlot(tmpBaseDir, { pid: 1001, isAlive })
    const s1 = acquireInstanceSlot(tmpBaseDir, { pid: 1002, isAlive })
    const s2 = acquireInstanceSlot(tmpBaseDir, { pid: 1003, isAlive })

    expect(s0.slot).toBe(0)
    expect(s1.slot).toBe(1)
    expect(s2.slot).toBe(2)

    // Releasing slot 1 allows the next instance to reuse slot 1
    releaseInstanceSlot(tmpBaseDir, s1)
    alivePids.delete(1002)
    alivePids.add(1004)
    const s1Reused = acquireInstanceSlot(tmpBaseDir, { pid: 1004, isAlive })
    expect(s1Reused.slot).toBe(1)

    // Simulate process crash on slot 0 (PID dies without releasing lockfile)
    alivePids.delete(1001)
    alivePids.add(1005)
    const s0Reclaimed = acquireInstanceSlot(tmpBaseDir, { pid: 1005, isAlive })
    expect(s0Reclaimed.slot).toBe(0)
    expect(s0Reclaimed.pid).toBe(1005)

    // Releasing an old record must NOT delete another live PID's record
    releaseInstanceSlot(tmpBaseDir, s0)
    expect(fs.existsSync(getRecordPath(tmpBaseDir, 0))).toBe(true)

    releaseInstanceSlot(tmpBaseDir, s0Reclaimed)
    releaseInstanceSlot(tmpBaseDir, s1Reused)
    releaseInstanceSlot(tmpBaseDir, s2)
    expect(listLiveInstances(tmpBaseDir, { isAlive })).toHaveLength(0)
  })

  it('routes ecubuspro:// callback strictly to the instance owning the matching OAuth state', async () => {
    const alivePids = new Set<number>([2001, 2002])
    const isAlive = (pid: number) => alivePids.has(pid)

    const inst1Received: ProtocolForwardRequest[] = []
    const inst2Received: ProtocolForwardRequest[] = []
    const inst1States = new Set<string>(['state-inst-1'])
    const inst2States = new Set<string>(['state-inst-2'])

    const session1 = createInstanceSession(
      tmpBaseDir,
      (req) => {
        if (req.matchStateOnly) {
          if (!req.state || !inst1States.delete(req.state)) return false
        }
        inst1Received.push(req)
        return true
      },
      { pid: 2001, isAlive }
    )
    sessions.push(session1)

    const session2 = createInstanceSession(
      tmpBaseDir,
      (req) => {
        if (req.matchStateOnly) {
          if (!req.state || !inst2States.delete(req.state)) return false
        }
        inst2Received.push(req)
        return true
      },
      { pid: 2002, isAlive }
    )
    sessions.push(session2)

    await Promise.all([waitForListening(session1), waitForListening(session2)])

    expect(session1.record.slot).toBe(0)
    expect(session1.sessionDataPath).toBeUndefined()
    expect(session2.record.slot).toBe(1)
    expect(session2.sessionDataPath).toBe(path.join(tmpBaseDir, 'sessions', 'inst-1'))

    // Callback for instance 2 must be handled ONLY by instance 2
    const urlForInst2 = 'ecubuspro://callback?code=code2&state=state-inst-2'
    const forwarded2 = await forwardProtocolUrl(tmpBaseDir, urlForInst2, { isAlive })
    expect(forwarded2).toBe(true)
    expect(inst1Received).toHaveLength(0)
    expect(inst2Received).toHaveLength(1)
    expect(inst2Received[0].url).toBe(urlForInst2)

    // Callback for instance 1 must be handled ONLY by instance 1
    const urlForInst1 = 'ecubuspro://callback?code=code1&state=state-inst-1'
    const forwarded1 = await forwardProtocolUrl(tmpBaseDir, urlForInst1, { isAlive })
    expect(forwarded1).toBe(true)
    expect(inst1Received).toHaveLength(1)
    expect(inst1Received[0].url).toBe(urlForInst1)
    expect(inst2Received).toHaveLength(1)
  })

  it('continues forwarding to remaining instances after slot 0 exits', async () => {
    const alivePids = new Set<number>([3001, 3002])
    const isAlive = (pid: number) => alivePids.has(pid)

    const inst2Received: string[] = []
    const inst2States = new Set<string>(['state-after-close'])

    const session1 = createInstanceSession(tmpBaseDir, () => false, { pid: 3001, isAlive })
    const session2 = createInstanceSession(
      tmpBaseDir,
      (req) => {
        if (req.matchStateOnly && (!req.state || !inst2States.delete(req.state))) {
          return false
        }
        inst2Received.push(req.url)
        return true
      },
      { pid: 3002, isAlive }
    )
    sessions.push(session1, session2)
    await Promise.all([waitForListening(session1), waitForListening(session2)])

    // Close primary slot 0 instance
    session1.dispose()
    alivePids.delete(3001)

    const callbackUrl = 'ecubuspro://callback?code=ok&state=state-after-close'
    const forwarded = await forwardProtocolUrl(tmpBaseDir, callbackUrl, { isAlive })
    expect(forwarded).toBe(true)
    expect(inst2Received).toEqual([callbackUrl])
  })

  it('falls back to a single live instance when no state matches, and returns false when none are running', async () => {
    const emptyForward = await forwardProtocolUrl(
      tmpBaseDir,
      'ecubuspro://callback?code=orphan&state=unknown'
    )
    expect(emptyForward).toBe(false)

    const alivePids = new Set<number>([4001, 4002])
    const isAlive = (pid: number) => alivePids.has(pid)
    let totalHandled = 0

    const session1 = createInstanceSession(
      tmpBaseDir,
      (req) => {
        if (req.matchStateOnly) return false
        totalHandled++
        return true
      },
      { pid: 4001, isAlive }
    )
    const session2 = createInstanceSession(
      tmpBaseDir,
      (req) => {
        if (req.matchStateOnly) return false
        totalHandled++
        return true
      },
      { pid: 4002, isAlive }
    )
    sessions.push(session1, session2)
    await Promise.all([waitForListening(session1), waitForListening(session2)])

    const forwarded = await forwardProtocolUrl(
      tmpBaseDir,
      'ecubuspro://callback?code=fallback&state=unmatched',
      { isAlive }
    )
    expect(forwarded).toBe(true)
    expect(totalHandled).toBe(1)
  })
})
