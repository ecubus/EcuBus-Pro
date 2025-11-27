import crypto from 'crypto'

const const_Zero = Buffer.from('00000000000000000000000000000000', 'hex')
const const_Rb = Buffer.from('00000000000000000000000000000087', 'hex')
const const_blockSize = 16

function bitShiftLeft(buffer: Buffer) {
  const shifted = Buffer.alloc(buffer.length)
  const last = buffer.length - 1
  for (let index = 0; index < last; index++) {
    shifted[index] = buffer[index] << 1
    if (buffer[index + 1] & 0x80) {
      shifted[index] += 0x01
    }
  }
  shifted[last] = buffer[last] << 1
  return shifted
}
function xor(bufferA: Buffer, bufferB: Buffer) {
  const length = Math.min(bufferA.length, bufferB.length)
  const output = Buffer.alloc(length)
  for (let index = 0; index < length; index++) {
    output[index] = bufferA[index] ^ bufferB[index]
  }
  return output
}
const bitmasks = [0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01]
function toBinaryString(buffer: Buffer) {
  let binary = ''
  for (let bufferIndex = 0; bufferIndex < buffer.length; bufferIndex++) {
    for (let bitmaskIndex = 0; bitmaskIndex < bitmasks.length; bitmaskIndex++) {
      binary += buffer[bufferIndex] & bitmasks[bitmaskIndex] ? '1' : '0'
    }
  }
  return binary
}
function generateSubkeys(key: Buffer) {
  const l = aes(key, const_Zero)

  let subkey1 = bitShiftLeft(l)
  if (l[0] & 0x80) {
    subkey1 = xor(subkey1, const_Rb)
  }

  let subkey2 = bitShiftLeft(subkey1)
  if (subkey1[0] & 0x80) {
    subkey2 = xor(subkey2, const_Rb)
  }

  return { subkey1: subkey1, subkey2: subkey2 }
}

function aes(key: Buffer, message: Buffer): Buffer {
  const keyLengthToCipher: Record<number, string> = {
    16: 'aes-128-cbc',
    24: 'aes-192-cbc',
    32: 'aes-256-cbc'
  }
  if (!keyLengthToCipher[key.length]) {
    throw new Error('Keys must be 128, 192, or 256 bits in length.')
  }
  const cipher = crypto.createCipheriv(keyLengthToCipher[key.length], key, const_Zero)
  const result = cipher.update(message)
  cipher.final()
  return result
}
/**
 * CMAC algorithm, nodejs default crypto module does not support CMAC, so we need to implement it ourselves.
 * @category  Crypto Extend
 * @param key key must be 128, 192, or 256 bits in length.
 * @param message input message
 * @returns CMAC result
 * @example
 * const key=Buffer.from('2b7e151628aed2a6abf7158809cf4f3c','hex');
 * const message=Buffer.from('6bc1bee22e409f96e93d7e117393172a','hex');
 * const result=CMAC(key,message);
 * //which should print 070a16b46b4d4144f79bdd9dd04a287c
 * console.log(result.toString('hex'));
 */
export default function CMAC(key: Buffer, message: Buffer) {
  const subkeys = generateSubkeys(key)
  let blockCount = Math.ceil(message.length / const_blockSize)
  let lastBlockCompleteFlag, lastBlock, lastBlockIndex

  if (blockCount === 0) {
    blockCount = 1
    lastBlockCompleteFlag = false
  } else {
    lastBlockCompleteFlag = message.length % const_blockSize === 0
  }
  // eslint-disable-next-line prefer-const
  lastBlockIndex = blockCount - 1

  if (lastBlockCompleteFlag) {
    lastBlock = xor(getMessageBlock(message, lastBlockIndex), subkeys.subkey1)
  } else {
    lastBlock = xor(getPaddedMessageBlock(message, lastBlockIndex), subkeys.subkey2)
  }

  let x = Buffer.from('00000000000000000000000000000000', 'hex')
  let y: Buffer | undefined

  for (let index = 0; index < lastBlockIndex; index++) {
    y = xor(x, getMessageBlock(message, index))
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    x = aes(key, y)
  }
  y = xor(lastBlock, x)
  return aes(key, y)
}

function getMessageBlock(message: Buffer, blockIndex: number) {
  const block = Buffer.alloc(const_blockSize)
  const start = blockIndex * const_blockSize
  const end = start + const_blockSize

  message.copy(block, 0, start, end)

  return block
}

function getPaddedMessageBlock(message: Buffer, blockIndex: number) {
  const block = Buffer.alloc(const_blockSize)
  const start = blockIndex * const_blockSize
  const end = message.length

  block.fill(0)
  message.copy(block, 0, start, end)
  block[end - start] = 0x80

  return block
}
