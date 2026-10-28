import { describe, expect, test } from 'vitest'
import type { CanDB, Message, Signal } from 'src/main/share/can'
import {
  buildCanInterPayload,
  interactionPayloadLength,
  rawPayloadIsBlank
} from 'src/main/share/canIaData'
import { getMessageData, writeRawHexToMessage } from 'src/renderer/src/database/dbc/calc'

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

  test('blank raw means the row was never edited', () => {
    expect(rawPayloadIsBlank(undefined)).toBe(true)
    expect(rawPayloadIsBlank([])).toBe(true)
    expect(rawPayloadIsBlank(['00', '0', '', '  '])).toBe(true)
    expect(rawPayloadIsBlank(editedHex)).toBe(false)
  })

  test('database frame sends the edited raw bytes, not a zero signal encode', () => {
    const payload = buildCanInterPayload({
      dlc: 8,
      type: 'can',
      data: editedHex
    })
    expect(payload).toEqual(Buffer.from([0x50, 0x50, 0x02, 0x00, 0x00, 0x00, 0x00, 0x83]))

    const message = nmMessage()
    // Signals still at their initial 0. Re-encoding the frame from signals used to be
    // what ipc-send-can did for any row with a database, so the bus saw eight 00 bytes.
    message.signals.forEach((signal) => {
      signal.value = '0'
    })
    const fromSignals = getMessageData(message)
    expect(fromSignals).toEqual(Buffer.alloc(8))
    expect(payload.equals(fromSignals)).toBe(false)
  })

  test('unmapped raw bytes survive even when signal re-encode drops them', () => {
    const message = nmMessage()
    const db = {
      messages: [{ id: 1, signals: [] } as unknown as Message, message]
    } as CanDB
    // Old editor used db.messages[parseInt(id, 16)] and missed this frame entirely.
    expect(db.messages[0x550]).toBeUndefined()

    expect(writeRawHexToMessage(db, 0x550, editedHex)).toBe(true)
    expect(message.signals.find((signal) => signal.name === 'byte0')!.value).toBe('80')
    expect(message.signals.find((signal) => signal.name === 'byte7')!.value).toBe('131')

    const fromSignals = getMessageData(message)
    // Byte 2 (0x02) is not covered by a signal, so a signal rebuild clears it.
    expect(fromSignals[0]).toBe(0x50)
    expect(fromSignals[2]).toBe(0x00)
    expect(fromSignals[7]).toBe(0x83)

    const payload = buildCanInterPayload({ dlc: 8, type: 'can', data: editedHex })
    expect(payload[2]).toBe(0x02)
    expect(payload).toEqual(Buffer.from(editedHex.map((byte) => parseInt(byte, 16))))
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
