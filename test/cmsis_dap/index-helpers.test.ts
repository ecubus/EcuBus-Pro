import { describe, it, expect } from 'vitest'
import { stringVectorToPathArray, u8VectorToBuffer } from '../../src/main/cmsis_dap/vector-helpers'

describe('vector-helpers (no native)', () => {
  it('stringVectorToPathArray maps get/size to string[]', () => {
    const vec = { size: () => 2, get: (i: number) => (i === 0 ? '\\\\?\\usb#vid_1' : 'dev2') }
    expect(stringVectorToPathArray(vec)).toEqual(['\\\\?\\usb#vid_1', 'dev2'])
  })

  it('u8VectorToBuffer', () => {
    const vec = { size: () => 3, get: (i: number) => [0, 0xff, 0x80][i]! }
    expect([...u8VectorToBuffer(vec)]).toEqual([0, 0xff, 0x80])
  })
})
