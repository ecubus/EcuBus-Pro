import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import i18next from 'i18next'
import translation from '../../resources/locales/en/translation.json'
import { ReplayLOG } from '../../src/main/log'
import { Replay, scanReplayLogChannels } from '../../src/main/replay'
import { writeBlfCanFrames } from '../../src/main/transport/blf'
import type { CanBase } from '../../src/main/docan/base'
import type { ReplayChannelMap, ReplayItem } from '../../src/preload/data'
import { mergeReplayChannelMap } from '../../src/renderer/src/views/uds/network/replayChannelMap'

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-channel-map-'))
const blfPath = path.join(tempDir, 'channels.blf')

const frames = [
  { id: 0x56b, data: Buffer.from([0x11]), channel: 4, tsUs: 0 },
  { id: 0x100, data: Buffer.from([0x22]), channel: 4, tsUs: 1000 },
  { id: 0x200, data: Buffer.from([0x33]), channel: 2, tsUs: 2000 }
]

let sysWarn: ReturnType<typeof vi.spyOn>
let replayWarn: ReturnType<typeof vi.spyOn>

function warnText(): string[] {
  return sysWarn.mock.calls.map((call) => String(call[0]))
}

async function waitUntilDone(replay: Replay): Promise<void> {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const state = replay.getState()
    if (state === 'completed' || state === 'stopped') return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`replay did not finish (state=${replay.getState()})`)
}

async function replayFile(channelMap: ReplayChannelMap[]) {
  const delivered: number[] = []
  const canBaseMap = new Map<string, CanBase>()
  canBaseMap.set('sim', {
    info: { id: 'sim' },
    log: {
      canBase(frame: { id: number }) {
        delivered.push(frame.id)
      }
    }
  } as unknown as CanBase)

  const config: ReplayItem = {
    id: 'replay-1',
    name: 'file-replay',
    filePath: blfPath,
    format: 'blf',
    channel: ['sim'],
    channelMap,
    mode: 'offline',
    speedFactor: 0,
    repeatCount: 1,
    useOriginalTime: false
  }
  const replay = new Replay(
    config,
    { path: tempDir, name: 'replay-test' },
    canBaseMap,
    new Map(),
    [],
    new Map(),
    new Map(),
    new Map()
  )
  try {
    replay.start()
    await waitUntilDone(replay)
    return { state: replay.getState(), delivered }
  } finally {
    replay.close()
  }
}

beforeAll(async () => {
  await writeBlfCanFrames(blfPath, frames)
  if (!i18next.isInitialized) {
    await i18next.init({
      lng: 'en',
      fallbackLng: 'en',
      resources: { en: { translation } },
      interpolation: { escapeValue: false }
    })
  } else {
    i18next.addResourceBundle('en', 'translation', translation, true, true)
    await i18next.changeLanguage('en')
  }
})

beforeEach(() => {
  global.startTs = 0
  sysWarn = vi.spyOn(global.sysLog, 'warn').mockImplementation(() => global.sysLog)
  replayWarn = vi.spyOn(ReplayLOG.prototype, 'warn')
})

afterEach(() => {
  sysWarn.mockRestore()
  replayWarn.mockRestore()
})

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true })
})

describe('replay channel map', () => {
  it('drops every frame and warns once per missing channel when the map does not match', async () => {
    const { state, delivered } = await replayFile([{ logChannel: 1, deviceIds: ['sim'] }])

    expect(state).toBe('completed')
    expect(delivered).toEqual([])

    const messages = warnText()
    expect(messages.filter((msg) => msg.includes('log channel 4'))).toHaveLength(1)
    expect(messages.filter((msg) => msg.includes('log channel 2'))).toHaveLength(1)
    expect(messages.some((msg) => msg.includes('mapped: 1'))).toBe(true)
    expect(messages.some((msg) => msg.includes('dropped 3') && msg.includes('2, 4'))).toBe(true)
    expect(replayWarn.mock.calls.map((call) => call[0])).toEqual(messages)
  })

  it('delivers frames on the mapped channel and warns about the other channel', async () => {
    const { state, delivered } = await replayFile([{ logChannel: 4, deviceIds: ['sim'] }])

    expect(state).toBe('completed')
    expect(delivered).toEqual([0x56b, 0x100])

    const messages = warnText()
    expect(messages.some((msg) => msg.includes('log channel 4'))).toBe(false)
    expect(messages.filter((msg) => msg.includes('log channel 2'))).toHaveLength(1)
    expect(messages.some((msg) => msg.includes('dropped 1') && msg.includes('2'))).toBe(true)
    expect(replayWarn.mock.calls.map((call) => call[0])).toEqual(messages)
  })

  it('delivers every frame when each log channel is mapped', async () => {
    const { state, delivered } = await replayFile([
      { logChannel: 4, deviceIds: ['sim'] },
      { logChannel: 2, deviceIds: ['sim'] }
    ])

    expect(state).toBe('completed')
    expect(delivered).toEqual([0x56b, 0x100, 0x200])
    expect(warnText()).toEqual([])
    expect(replayWarn).not.toHaveBeenCalled()
  })

  it('scans distinct log channels without reading a capped file to the end', async () => {
    const full = await scanReplayLogChannels(blfPath, 'blf')
    expect(full).toEqual({ channels: [2, 4], truncated: false, scanned: 3 })

    const capped = await scanReplayLogChannels(blfPath, 'blf', 1)
    expect(capped.truncated).toBe(true)
    expect(capped.channels).toEqual([4])
    expect(capped.scanned).toBe(2)
  })
})

describe('mergeReplayChannelMap', () => {
  it('replaces the empty default row with channels from the file', () => {
    expect(mergeReplayChannelMap([{ logChannel: 1, deviceIds: [] }], [4])).toEqual([
      { logChannel: 4, deviceIds: [] }
    ])
  })

  it('moves a device off the default channel when the file has one other channel', () => {
    expect(mergeReplayChannelMap([{ logChannel: 1, deviceIds: ['sim'] }], [4])).toEqual([
      { logChannel: 4, deviceIds: ['sim'] }
    ])
  })

  it('keeps an existing device assignment when the file has several channels', () => {
    expect(mergeReplayChannelMap([{ logChannel: 1, deviceIds: ['sim'] }], [2, 4])).toEqual([
      { logChannel: 1, deviceIds: ['sim'] },
      { logChannel: 2, deviceIds: [] },
      { logChannel: 4, deviceIds: [] }
    ])
  })

  it('leaves a matching map unchanged', () => {
    expect(mergeReplayChannelMap([{ logChannel: 4, deviceIds: ['sim'] }], [4])).toEqual([
      { logChannel: 4, deviceIds: ['sim'] }
    ])
  })

  it('does not move an assigned device when the scan did not read the whole file', () => {
    expect(
      mergeReplayChannelMap([{ logChannel: 1, deviceIds: ['sim'] }], [4], { allowRetarget: false })
    ).toEqual([
      { logChannel: 1, deviceIds: ['sim'] },
      { logChannel: 4, deviceIds: [] }
    ])
  })
})
