export interface VcanUsbPathCandidate {
  path: string
  interfaceNumber: number
  identitySelector?: string
}

const CURRENT_PATH_PREFIX = 'libusb://1d50:6080/'
const LEGACY_DEVICE_ID = 'vid_1d50&pid_6080'
const IDENTITY_PATH_PREFIX = 'vcan-usb://'

/**
 * Resolves handles saved by the former WinUSB backend without coupling the
 * driver to a platform API. A legacy handle is migrated only when its channel
 * identifies exactly one currently connected libusb interface.
 */
export function resolveVcanUsbPath(
  path: string,
  channel: number,
  listDevices: () => readonly VcanUsbPathCandidate[]
): string {
  const normalizedPath = path.toLowerCase()
  if (normalizedPath.startsWith(CURRENT_PATH_PREFIX)) {
    let devices: readonly VcanUsbPathCandidate[]
    try {
      devices = listDevices()
    } catch (error) {
      throw new Error(
        `Unable to validate the stored VCAN USB path: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }

    const exactMatches = devices.filter(
      (device) => device.interfaceNumber === channel && device.path.toLowerCase() === normalizedPath
    )
    if (exactMatches.length === 1) return exactMatches[0].path
    if (exactMatches.length > 1) {
      throw new Error(`Multiple VCAN USB interfaces report the stored path ${path}.`)
    }

    // USB topology paths can change after personality switches or reconnects.
    // Migrate a pre-identity handle only when its channel is unambiguous.
    const channelMatches = devices.filter((device) => device.interfaceNumber === channel)
    if (channelMatches.length === 1) return channelMatches[0].path
    if (channelMatches.length === 0) {
      throw new Error(
        `The stored VCAN USB path ${path} is no longer connected, and channel ${channel} is unavailable. Reconnect the device and refresh Hardware.`
      )
    }
    throw new Error(
      `The stored VCAN USB path ${path} is no longer valid and multiple channel ${channel} interfaces are connected. Reselect the intended device in Hardware.`
    )
  }
  if (normalizedPath.startsWith(IDENTITY_PATH_PREFIX)) {
    let matches: readonly VcanUsbPathCandidate[]
    try {
      matches = listDevices().filter(
        (device) =>
          device.interfaceNumber === channel &&
          device.identitySelector?.toLowerCase() === path.toLowerCase()
      )
    } catch (error) {
      throw new Error(
        `Unable to resolve the stored VCAN USB hardware identity: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }

    if (matches.length === 1) return matches[0].path
    if (matches.length === 0) {
      throw new Error(
        `VCAN USB device ${path} channel ${channel} is not connected or its hardware identity is unavailable.`
      )
    }
    throw new Error(
      `Multiple VCAN USB devices report ${path} channel ${channel}; refusing an ambiguous device selection.`
    )
  }
  if (!normalizedPath.includes(LEGACY_DEVICE_ID)) return path

  let matches: readonly VcanUsbPathCandidate[]
  try {
    matches = listDevices().filter((device) => device.interfaceNumber === channel)
  } catch (error) {
    throw new Error(
      `Unable to migrate the stored VCAN USB device path: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }

  if (matches.length === 1) return matches[0].path
  if (matches.length === 0) {
    throw new Error(
      `The stored VCAN USB device path uses the legacy WinUSB format, but channel ${channel} is not connected. Reconnect the device and reselect it in Hardware.`
    )
  }

  throw new Error(
    `The stored VCAN USB device path matches multiple channel ${channel} interfaces. Reselect the intended device in Hardware.`
  )
}
