import { DiagRequest } from 'ECB'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const challengeSelf = Buffer.from(
  Array(32)
    .fill(0)
    .map(() => Math.floor(Math.random() * 256))
)
let fwContent: Buffer
Util.Init(async () => {
  // reader client.crt
  const cert = await fs.readFile(path.join(process.env.PROJECT_ROOT, 'client.crt'), 'utf-8')
  //modify verify
  const verifyCertificateUnidirectional = DiagRequest.from(
    'Tester_can_0.verifyCertificateUnidirectional'
  )
  //set certificate
  verifyCertificateUnidirectional.diagSetParameterSize('certificateClient', cert.length * 8)
  verifyCertificateUnidirectional.diagSetParameterRaw(
    'certificateClient',
    Buffer.from(cert, 'ascii')
  )
  verifyCertificateUnidirectional.diagSetParameter('lengthOfCertificateClient', cert.length)
  //random challenge 32 bytes
  verifyCertificateUnidirectional.diagSetParameter('lengthOfChallengeClient', 32)
  verifyCertificateUnidirectional.diagSetParameterSize('challengeClient', 32 * 8)
  verifyCertificateUnidirectional.diagSetParameterRaw('challengeClient', challengeSelf)
  //save
  await verifyCertificateUnidirectional.changeService()

  //read fwContent
  fwContent = await fs.readFile(path.join(process.env.PROJECT_ROOT, 'test.txt'))
  //setup 0x34 size
  const RequestDownload520 = DiagRequest.from('Tester_can_0.RequestDownload520')
  RequestDownload520.diagSetParameter('memorySize', fwContent.length)
  await RequestDownload520.changeService()
})

const ecdh = crypto.createECDH('prime256v1')
ecdh.generateKeys()
const publicKey = ecdh.getPublicKey()
let realKey: Buffer

Util.On('Tester_can_0.verifyCertificateUnidirectional.recv', async (resp) => {
  const data = resp.diagGetRaw()
  // 69 11 11 lengthOfCertificateClient(2)
  const lengthOfCertificateClient = data.readUint16BE(3)
  console.log(`challenge length:${lengthOfCertificateClient}`)
  const challenge = data.subarray(5, 5 + lengthOfCertificateClient)
  console.log(`challenge:${challenge.toString('hex')}`)
  //use clien.key sign rsa the challenge
  const privateKey = await fs.readFile(path.join(process.env.PROJECT_ROOT, 'client.key'), 'utf-8')
  const sign = crypto.sign('RSA-SHA256', challenge, privateKey)
  console.log(`sign len:${sign.length}`)
  console.log(`sign:${sign.toString('hex')}`)
  //set sign
  const proofOfOwnership = DiagRequest.from('Tester_can_0.proofOfOwnership')
  proofOfOwnership.diagSetParameterSize('proofOfOwnershipClient', sign.length * 8)
  proofOfOwnership.diagSetParameterRaw('proofOfOwnershipClient', sign)
  proofOfOwnership.diagSetParameter('lengthOfProofOfOwnershipClient', sign.length)

  proofOfOwnership.diagSetParameter('lengthOfEphemeralPublicKeyClient', publicKey.length)
  proofOfOwnership.diagSetParameterSize('ephemeralPublicKeyClient', publicKey.length * 8)
  proofOfOwnership.diagSetParameterRaw('ephemeralPublicKeyClient', publicKey)
  //save
  await proofOfOwnership.changeService()

  const lengthOfPeerKey = data.readUint16BE(5 + lengthOfCertificateClient)
  const peerPublicKey = data.subarray(
    5 + lengthOfCertificateClient + 2,
    5 + lengthOfCertificateClient + 2 + lengthOfPeerKey
  )
  console.log(`peerPublicKey length:${lengthOfPeerKey}`)
  const sharedSecret = ecdh.computeSecret(peerPublicKey)
  console.log(`sharedSecret in tester:${sharedSecret.toString('hex')}`)
  //hkdf
  const salt = Buffer.concat([challengeSelf, challenge])
  realKey = Buffer.from(crypto.hkdfSync('sha256', sharedSecret, salt, '', 32))
  console.log(`realKey in tester:${realKey.toString('hex')}`)
})

let maxChunkSize = 0
Util.On('Tester_can_0.RequestDownload520.recv', (resp) => {
  maxChunkSize = resp.diagGetParameterRaw('maxNumberOfBlockLength').readUint32BE(0)
})

//aes-gcm encrypt

Util.Register('Tester_can_0.SecureDownload', async () => {
  if (maxChunkSize <= 2) {
    throw new Error('maxNumberOfBlockLength is undefined or too small')
  }
  if (fwContent) {
    const cipher = crypto.createCipheriv('aes-256-gcm', realKey, Buffer.alloc(12, 0))
    maxChunkSize -= 2
    if (maxChunkSize & 0x07) {
      maxChunkSize -= maxChunkSize & 0x07
    }
    const numChunks = Math.ceil(fwContent.length / maxChunkSize)
    const list = []
    for (let i = 0; i < numChunks; i++) {
      const start = i * maxChunkSize
      const end = Math.min(start + maxChunkSize, fwContent.length)
      console.log(`chunk ${i + 1}/${numChunks} start: ${start}, end: ${end}`)
      const chunk = fwContent.subarray(start, end)

      const transferRequest = DiagRequest.from('Tester_can_0.TransferData540')

      const encrypt = cipher.update(chunk)
      console.log(
        `chunk ${i + 1}/${numChunks} size: ${chunk.length}, encrypted size: ${encrypt.length}`
      )
      transferRequest.diagSetParameterSize('transferRequestParameterRecord', encrypt.length * 8)
      // 设置传输请求参数记录
      transferRequest.diagSetParameterRaw('transferRequestParameterRecord', encrypt)

      // 计算块序号 (从1开始)
      const blockSequenceCounter = Buffer.alloc(1)
      blockSequenceCounter.writeUInt8((i + 1) & 0xff) // 使用循环计数 1-255
      transferRequest.diagSetParameterRaw('blockSequenceCounter', blockSequenceCounter)

      list.push(transferRequest)
    }
    //set auth tag
    cipher.final()
    const authTag = cipher.getAuthTag()
    const RequestTransferExit550 = DiagRequest.from('Tester_can_0.RequestTransferExit550')
    RequestTransferExit550.diagSetParameterSize('auth', authTag.length * 8)
    // 设置传输请求参数记录
    RequestTransferExit550.diagSetParameterRaw('auth', authTag)
    await RequestTransferExit550.changeService()
    // 发送所有块
    return list
  } else {
    return []
  }
})
