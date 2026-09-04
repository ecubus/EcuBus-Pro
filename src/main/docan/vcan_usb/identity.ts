export interface VcanUsbIdentitySource {
  uid: readonly number[]
  uuid: readonly number[]
}

export interface VcanUsbIdentity {
  kind: 'uuid' | 'uid'
  value: string
}

const WORD_COUNT = 4
const INVALID_WORD = 0xffffffff
const SELECTOR_PREFIX = 'vcan-usb://'

function formatWords(words: readonly number[]): string | undefined {
  if (
    words.length !== WORD_COUNT ||
    words.some((word) => !Number.isInteger(word) || word < 0 || word > INVALID_WORD) ||
    words.every((word) => word === 0) ||
    words.every((word) => word === INVALID_WORD)
  ) {
    return undefined
  }
  return words.map((word) => word.toString(16).padStart(8, '0')).join('')
}

/** Returns the immutable OTP identity exposed by the VCAN USB firmware. */
export function getVcanUsbIdentity(source: VcanUsbIdentitySource): VcanUsbIdentity | undefined {
  const uuid = formatWords(source.uuid)
  if (uuid) return { kind: 'uuid', value: uuid }

  const uid = formatWords(source.uid)
  if (uid) return { kind: 'uid', value: uid }
  return undefined
}

export function makeVcanUsbIdentitySelector(identity: VcanUsbIdentity): string {
  return `${SELECTOR_PREFIX}${identity.kind}/${identity.value}`
}

export function isVcanUsbIdentitySelector(value: string): boolean {
  return /^vcan-usb:\/\/(?:uuid|uid)\/[0-9a-f]{32}$/i.test(value)
}

export function formatVcanUsbSerialNumber(identity: VcanUsbIdentity): string {
  return `${identity.kind.toUpperCase()}:${identity.value}`
}
