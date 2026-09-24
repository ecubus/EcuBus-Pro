export interface VkgsUsbPathCandidate {
  path: string
  interfaceNumber: number
  identitySelector?: string
}

const CURRENT_PATH_PREFIX = 'libusb://1d50:606f/'
const LEGACY_DEVICE_ID = 'vid_1d50&pid_606f'
const IDENTITY_PATH_PREFIX = 'vkgs-usb://'

/**
 * Resolves handles saved by the former WinUSB backend without coupling the
 * driver to a platform API. A legacy handle is migrated only when its channel
 * identifies exactly one currently connected libusb interface.
 */
export function resolveVkgsUsbPath(
  path: string,
  channel: number,
  listDevices: () => readonly VkgsUsbPathCandidate[]
): string {
  const normalizedPath = path.toLowerCase()
  if (normalizedPath.startsWith(CURRENT_PATH_PREFIX)) {
    let devices: readonly VkgsUsbPathCandidate[]
    try {
      devices = listDevices()
    } catch (error) {
      throw new Error(
        `Unable to validate the stored VKGS USB path: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }

    const exactMatches = devices.filter(
      (device) => device.interfaceNumber === channel && device.path.toLowerCase() === normalizedPath
    )
    if (exactMatches.length === 1) return exactMatches[0].path
    if (exactMatches.length > 1) {
      throw new Error(`Multiple VKGS USB interfaces report the stored path ${path}.`)
    }

    // A libusb topology path can change after firmware personality switching,
    // reconnecting through another hub port, or USB re-enumeration. Existing
    // projects may still contain such a pre-identity handle. Migrate it only
    // when the channel identifies exactly one connected interface.
    const channelMatches = devices.filter((device) => device.interfaceNumber === channel)
    if (channelMatches.length === 1) return channelMatches[0].path
    if (channelMatches.length === 0) {
      throw new Error(
        `The stored VKGS USB path ${path} is no longer connected, and channel ${channel} is unavailable. Reconnect the device and refresh Hardware.`
      )
    }
    throw new Error(
      `The stored VKGS USB path ${path} is no longer valid and multiple channel ${channel} interfaces are connected. Reselect the intended device in Hardware.`
    )
  }
  if (normalizedPath.startsWith(IDENTITY_PATH_PREFIX)) {
    let matches: readonly VkgsUsbPathCandidate[]
    try {
      matches = listDevices().filter(
        (device) =>
          device.interfaceNumber === channel &&
          device.identitySelector?.toLowerCase() === path.toLowerCase()
      )
    } catch (error) {
      throw new Error(
        `Unable to resolve the stored VKGS USB hardware identity: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }

    if (matches.length === 1) return matches[0].path
    if (matches.length === 0) {
      throw new Error(
        `VKGS USB device ${path} channel ${channel} is not connected or its hardware identity is unavailable.`
      )
    }
    throw new Error(
      `Multiple VKGS USB devices report ${path} channel ${channel}; refusing an ambiguous device selection.`
    )
  }
  if (!normalizedPath.includes(LEGACY_DEVICE_ID)) return path

  let matches: readonly VkgsUsbPathCandidate[]
  try {
    matches = listDevices().filter((device) => device.interfaceNumber === channel)
  } catch (error) {
    throw new Error(
      `Unable to migrate the stored VKGS USB device path: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }

  if (matches.length === 1) return matches[0].path
  if (matches.length === 0) {
    throw new Error(
      `The stored VKGS USB device path uses the legacy WinUSB format, but channel ${channel} is not connected. Reconnect the device and reselect it in Hardware.`
    )
  }

  throw new Error(
    `The stored VKGS USB device path matches multiple channel ${channel} interfaces. Reselect the intended device in Hardware.`
  )
}
