import { LDF } from '../ldfParse'

export type NodeProtocolSyncDecision = 'none' | 'auto' | 'confirm'

function nodeAttrEntries(ldf: LDF) {
  return Object.entries(ldf.nodeAttrs || {})
}

/**
 * Returns node names whose Protocol differs from the given LIN version.
 */
export function getNodesNeedingProtocolSync(ldf: LDF, version: string): string[] {
  return nodeAttrEntries(ldf)
    .filter(([, attr]) => attr && attr.LIN_protocol !== version)
    .map(([name]) => name)
}

/**
 * True when at least one node Protocol is set and differs from `expectedVersion`.
 * Used to detect nodes that were customized away from the previous global version.
 */
export function hasCustomNodeProtocols(ldf: LDF, expectedVersion?: string): boolean {
  return nodeAttrEntries(ldf).some(
    ([, attr]) => Boolean(attr?.LIN_protocol) && attr.LIN_protocol !== expectedVersion
  )
}

/**
 * Decide how a global LIN protocol version change should affect node Protocol values.
 *
 * - `none`: every node already matches the new version (or there are no nodes)
 * - `auto`: all nodes still follow the previous global version (or are empty) — sync silently
 * - `confirm`: at least one node was customized to a different version — ask before overwriting
 */
export function getNodeProtocolSyncDecision(
  ldf: LDF,
  newVersion: string,
  previousGlobalVersion?: string
): NodeProtocolSyncDecision {
  if (!newVersion) {
    return 'none'
  }
  if (getNodesNeedingProtocolSync(ldf, newVersion).length === 0) {
    return 'none'
  }
  if (hasCustomNodeProtocols(ldf, previousGlobalVersion)) {
    return 'confirm'
  }
  return 'auto'
}

/**
 * Set every node's Protocol to `version`.
 */
export function syncAllNodeProtocols(ldf: LDF, version: string): void {
  for (const [, attr] of nodeAttrEntries(ldf)) {
    if (attr) {
      attr.LIN_protocol = version
    }
  }
}
