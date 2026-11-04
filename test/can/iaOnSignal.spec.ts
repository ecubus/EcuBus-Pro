import { describe, expect, test } from 'vitest'
import { CAN_ID_TYPE, type CanDB, type Message, type Signal } from 'src/main/share/can'
import {
  collectCanOnSignalEvents,
  shouldDeliverCanFrameToNode
} from 'src/main/share/canScriptNotify'
import { buildCanInterPayload } from 'src/main/share/canIaData'
import { linkRawHexToSignals } from 'src/renderer/src/database/dbc/calc'

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

describe('IA send and OnSignal', () => {
  test('IA TX is delivered to scripts; a node does not receive its own output()', () => {
    const iaFrame = {
      msgType: {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: false,
        remote: false
      }
    }
    expect(shouldDeliverCanFrameToNode(iaFrame, 'script-node')).toBe(true)

    const ownOutput = {
      msgType: { ...iaFrame.msgType, uuid: 'script-node' }
    }
    expect(shouldDeliverCanFrameToNode(ownOutput, 'script-node')).toBe(false)
    expect(shouldDeliverCanFrameToNode(ownOutput, 'other-node')).toBe(true)
  })

  test('a sent IA payload emits OnSignal values from the linked encode', () => {
    const message = nmMessage()
    const db = { name: 'NmDb', messages: [message] } as CanDB
    const canonical = linkRawHexToSignals(db, 0x550, editedHex, 8)
    const data = buildCanInterPayload({ dlc: 8, type: 'can', data: canonical! })

    const events = collectCanOnSignalEvents({ id: 0x550, data, database: 'nm' }, { nm: db })
    const byName = Object.fromEntries(events.map((item) => [item.event, item.signal.value]))

    expect(byName['NmDb.byte0']).toBe('80')
    expect(byName['NmDb.byte7']).toBe('131')
    expect(events).toHaveLength(2)
    expect(data[2]).toBe(0x00)
  })
})
