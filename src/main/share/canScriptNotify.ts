import { cloneDeep } from 'lodash'
import type { CanDB, CanMessage, CanMsgType, Signal } from './can'
import { writeMessageData } from 'src/renderer/src/database/dbc/calc'

/**
 * Script `output()` stamps `msgType.uuid` with the sender node so that node does not
 * receive its own TX. Interaction sends and bus frames leave uuid unset, so every
 * script on the channel gets them, including `OnSignal`.
 */
export function shouldDeliverCanFrameToNode(
  frame: { msgType?: CanMsgType },
  nodeId: string
): boolean {
  return frame.msgType?.uuid != nodeId
}

/**
 * Signal updates `Util.canMsg` emits for one CAN frame.
 * The event name is `databaseName.signalName`, the same string `OnSignal` listens for.
 */
export function collectCanOnSignalEvents(
  msg: Pick<CanMessage, 'id' | 'data' | 'database'>,
  databases: Record<string, CanDB>
): { event: string; signal: Signal }[] {
  const db = msg.database ? databases[msg.database] : undefined
  if (!db) return []
  const msgDef = cloneDeep(db.messages.find((item) => item.id === msg.id))
  if (!msgDef) return []
  const data = Buffer.isBuffer(msg.data) ? msg.data : Buffer.from(msg.data)
  writeMessageData(msgDef, data, db)
  return (msgDef.signals || []).map((signal) => ({
    event: `${db.name}.${signal.name}`,
    signal
  }))
}
