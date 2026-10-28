import type { ReplayChannelMap } from 'src/preload/data'

/**
 * Build channel-map rows from log channels found in a replay file.
 *
 * Rows with no device are replaced by the detected channels. Assigned devices stay
 * put unless `allowRetarget` is set and the file has a single channel that none of
 * those devices point at — the form default is log channel 1, which drops a file
 * that only contains another channel. A partial scan passes `allowRetarget: false`
 * so a prefix of the log cannot move a device the user already assigned.
 */
export function mergeReplayChannelMap(
  current: ReplayChannelMap[],
  detected: number[],
  options?: { allowRetarget?: boolean }
): ReplayChannelMap[] {
  const allowRetarget = options?.allowRetarget !== false
  if (detected.length === 0) {
    return current.map((item) => ({
      logChannel: item.logChannel,
      deviceIds: [...item.deviceIds]
    }))
  }

  const withDevices = current.filter((item) => item.deviceIds.length > 0)
  if (withDevices.length === 0) {
    return detected.map((logChannel) => ({ logChannel, deviceIds: [] }))
  }

  const detectedSet = new Set(detected)
  const assignedChannels = new Set(withDevices.map((item) => item.logChannel))
  const allAssignmentsMiss = [...assignedChannels].every((channel) => !detectedSet.has(channel))
  if (allowRetarget && allAssignmentsMiss && detected.length === 1 && assignedChannels.size === 1) {
    const deviceIds = [...new Set(withDevices.flatMap((item) => item.deviceIds))]
    return [{ logChannel: detected[0], deviceIds }]
  }

  const next = current.map((item) => ({
    logChannel: item.logChannel,
    deviceIds: [...item.deviceIds]
  }))
  const existing = new Set(next.map((item) => item.logChannel))
  for (const channel of detected) {
    if (!existing.has(channel)) {
      next.push({ logChannel: channel, deviceIds: [] })
    }
  }
  return next
}
