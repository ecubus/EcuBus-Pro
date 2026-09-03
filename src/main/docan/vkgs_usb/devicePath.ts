export interface VkgsUsbPathCandidate {
  path: string
  interfaceNumber: number
}

const CURRENT_PATH_PREFIX = 'libusb://1d50:606f/'
const LEGACY_DEVICE_ID = 'vid_1d50&pid_606f'

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
  if (path.startsWith(CURRENT_PATH_PREFIX)) return path
  if (!path.toLowerCase().includes(LEGACY_DEVICE_ID)) return path

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
