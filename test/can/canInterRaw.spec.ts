import { describe, expect, test } from 'vitest'
import type { CanDB, Message, Signal } from 'src/main/share/can'
import {
  buildCanInterPayload,
  interactionPayloadLength,
  rawHexIsPartial,
  rawPayloadIsBlank
} from 'src/main/share/canIaData'
import {
  ensureSignalDefaults,
  getMessageData,
  linkRawHexToSignals,
  messagePayloadHex
} from 'src/renderer/src/database/dbc/calc'

/**
 * Bytes from the CAN interaction edit dialog in the bug report
 * (frame XCDLampCANFDNMFra, DLC 8).
 */
const editedHex = ['50', '50', '02', '00', '00', '00', '00', '83']

function byteSignal(name: string, startBit: number): Signal {
  return {
    attributes: {},
    bit_length: 8,
    comments: {},
    factor: '1',
    initial_value: '0',
    is_big_endian: false,
    is_float: false,
    is_multiplexer: false,
    is_signed: false,
    max: '0',
    min: '0',
    name,
    offset: '0',
    multiplex: undefined,
    receivers: [],
    start_bit: startBit,
    values: {}
  }
}

function nmMessage(): Message {
  return {
    attributes: {},
    comment: '',
    cycle_time: 0,
    header_id: undefined,
    id: 0x550,
    is_complex_multiplexed: false,
    is_extended_frame: false,
    is_fd: false,
    is_j1939: false,
    length: 8,
    mux_names: {},
    name: 'XCDLampCANFDNMFra',
    pdu_name: '',
    signals: [byteSignal('byte0', 0), byteSignal('byte7', 56)],
    transmitters: []
  }
}

describe('CAN interaction raw payload', () => {
  test('interaction editor length matches classic and CAN FD DLC maps', () => {
    expect(interactionPayloadLength(8, false)).toBe(8)
    expect(interactionPayloadLength(9, false)).toBe(8)
    expect(interactionPayloadLength(9, true)).toBe(12)
    expect(interactionPayloadLength(15, true)).toBe(64)
    expect(interactionPayloadLength(3, false)).toBe(3)
  })

  test('blank raw means the row was never edited; a single nibble is still partial', () => {
    expect(rawPayloadIsBlank(undefined)).toBe(true)
    expect(rawPayloadIsBlank([])).toBe(true)
    expect(rawPayloadIsBlank(['00', '0', '', '  '])).toBe(true)
    expect(rawPayloadIsBlank(editedHex)).toBe(false)
    expect(rawHexIsPartial(['5', '00'])).toBe(true)
    expect(rawHexIsPartial(['50', '00'])).toBe(false)
  })

  test('manual row payload is the hex it stores', () => {
    const payload = buildCanInterPayload({
      dlc: 8,
      type: 'can',
      data: editedHex
    })
    expect(payload).toEqual(Buffer.from([0x50, 0x50, 0x02, 0x00, 0x00, 0x00, 0x00, 0x83]))
  })

  test('raw edit updates signals by CAN id and send matches that encode', () => {
    const message = nmMessage()
    const db = {
      messages: [{ id: 1, signals: [] } as unknown as Message, message]
    } as CanDB
    // The old editor indexed messages by CAN id and missed this frame.
    expect(db.messages[0x550]).toBeUndefined()
    expect(linkRawHexToSignals(db, 0x999, editedHex, 8)).toBeUndefined()

    const canonical = linkRawHexToSignals(db, 0x550, editedHex, 8)
    expect(message.signals.find((signal) => signal.name === 'byte0')!.value).toBe('80')
    expect(message.signals.find((signal) => signal.name === 'byte7')!.value).toBe('131')

    const fromSignals = getMessageData(message)
    // Byte 2 is not a signal, so both views drop it. They still describe one payload.
    expect(fromSignals[2]).toBe(0x00)
    expect(canonical).toEqual(messagePayloadHex(message, 8))
    expect(buildCanInterPayload({ dlc: 8, type: 'can', data: canonical! })).toEqual(
      Buffer.from(canonical!.map((byte) => parseInt(byte, 16)))
    )
    expect(buildCanInterPayload({ dlc: 8, type: 'can', data: canonical! }).subarray(0, 8)).toEqual(
      fromSignals
    )
  })

  test('signal values round-trip through raw hex without drifting', () => {
    const message = nmMessage()
    const db = { messages: [message] } as CanDB
    message.signals[0].value = '80'
    message.signals[1].value = '131'
    const hex = messagePayloadHex(message, 8)
    const canonical = linkRawHexToSignals(db, 0x550, hex, 8)
    expect(canonical).toEqual(hex)
    expect(message.signals[0].value).toBe('80')
    expect(message.signals[1].value).toBe('131')
    expect(buildCanInterPayload({ dlc: 8, type: 'can', data: canonical! })).toEqual(
      getMessageData(message)
    )
  })

  test('explicit zero raw clears signal values', () => {
    const message = nmMessage()
    const db = { messages: [message] } as CanDB
    message.signals[0].value = '80'
    const canonical = linkRawHexToSignals(
      db,
      0x550,
      ['00', '00', '00', '00', '00', '00', '00', '00'],
      8
    )
    expect(message.signals[0].value).toBe('0')
    expect(canonical).toEqual(['00', '00', '00', '00', '00', '00', '00', '00'])
  })

  test('new database row adopts DBC initial values into raw hex', () => {
    const message = nmMessage()
    message.signals[0].initial_value = '80'
    message.signals[1].initial_value = '131'
    ensureSignalDefaults(message)
    expect(message.signals[0].value).toBe('80')
    expect(messagePayloadHex(message, 8)[0]).toBe('50')
    expect(messagePayloadHex(message, 8)[7]).toBe('83')
    ensureSignalDefaults(message)
    expect(message.signals[0].value).toBe('80')
  })

  test('CAN FD DLC sizes the buffer and invalid nibbles become 0', () => {
    const payload = buildCanInterPayload({
      dlc: 9,
      type: 'ecanfd',
      data: ['aa', 'zz', '1']
    })
    expect(payload.length).toBe(12)
    expect(payload[0]).toBe(0xaa)
    expect(payload[1]).toBe(0)
    expect(payload[2]).toBe(0x01)
    expect(payload[11]).toBe(0)
  })
})
