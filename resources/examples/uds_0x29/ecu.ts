import { DiagResponse } from 'ECB'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

const challenge = Buffer.from(
  Array(32)
    .fill(0)
    .map(() => Math.floor(Math.random() * 256))
)
let publicKey: crypto.KeyObject

Util.On('Tester_can_0.authenticationConfiguration.send', async (req) => {
  const resp = DiagResponse.fromDiagRequest(req)
  resp.diagSetParameter('returnValue', 0x2) //ACPE
  await resp.outputDiag()
})
let memorySize: number
Util.On('Tester_can_0.RequestDownload520.send', async (req) => {
  const resp = DiagResponse.fromDiagRequest(req)
  memorySize = Number(req.diagGetParameter('memorySize'))
  console.log(`memorySize:${memorySize}`)
  resp.diagSetRaw(Buffer.from([0x74, 0x40, 0, 0, 0, 0x81]))
  await resp.outputDiag()
})
const ecdh = crypto.createECDH('prime256v1')
ecdh.generateKeys()
const publicKeyGen = ecdh.getPublicKey()

let challengeTester: Buffer
Util.On('Tester_can_0.verifyCertificateUnidirectional.send', async (req) => {
  const resp = DiagResponse.fromDiagRequest(req)

  const data = req.diagGetRaw()
  // 29 01 00 lengthOfCertificateClient(2)
  const lengthOfCertificateClient = data.readUint16BE(3)
  console.log(`cert length:${lengthOfCertificateClient}`)
  //cert
  const cert = new crypto.X509Certificate(data.subarray(5, 5 + lengthOfCertificateClient))
  console.log(`cert issuer:${cert.issuer}`)
  publicKey = cert.publicKey
  //verify the cert
  const ca_str = await fs.readFile(path.join(process.env.PROJECT_ROOT, 'ca.crt'), 'utf-8')
  const ca = new crypto.X509Certificate(ca_str)
  const verifyResult = cert.verify(ca.publicKey)
  console.log(`verify result:${verifyResult}`)
  if (verifyResult) {
    const cLen = data.readUint16BE(5 + lengthOfCertificateClient)
    console.log(`challenge length:${cLen}`)
    //challenge
    challengeTester = data.subarray(
      7 + lengthOfCertificateClient,
      7 + lengthOfCertificateClient + cLen
    )

    //client cert verify ok
    // resp.diagSetParameter('lengthOfChallengeServer',32)
    // resp.diagSetParameterSize('challengeServer',32*8)
    resp.diagSetParameterRaw('challengeServer', challenge)
    resp.diagSetParameter('returnValue', 0x11) //certificate ok, verify ownership

    resp.diagSetParameterRaw('ephemeralPublicKeyServer', publicKeyGen)
    resp.diagSetParameter('lengthOfEphemeralPublicKeyServer', publicKeyGen.length)
    await resp.outputDiag()
  } else {
    throw new Error('client cert verify failed')
  }
})
let realKey: Buffer
Util.On('Tester_can_0.proofOfOwnership.send', async (req) => {
  const resp = DiagResponse.fromDiagRequest(req)
  const data = req.diagGetRaw()
  // 29 01 00 lengthOfCertificateClient(2)
  const lengthOfProofOfOwnershipClient = data.readUint16BE(2)
  console.log(`sign length:${lengthOfProofOfOwnershipClient}`)
  //sign
  const sign = data.subarray(4, 4 + lengthOfProofOfOwnershipClient)
  //verify the sign
  const verifyResult = crypto.verify('RSA-SHA256', challenge, publicKey, sign)
  console.log(`verify result:${verifyResult}`)
  if (verifyResult) {
    const lengthOfEphemeralPublicKeyClient = data.readUint16BE(4 + lengthOfProofOfOwnershipClient)
    console.log(`ephemeralPublicKeyClient length:${lengthOfEphemeralPublicKeyClient}`)
    //ephemeralPublicKeyClient
    const ephemeralPublicKeyClient = data.subarray(
      6 + lengthOfProofOfOwnershipClient,
      6 + lengthOfProofOfOwnershipClient + lengthOfEphemeralPublicKeyClient
    )
    const sharedSecret = ecdh.computeSecret(ephemeralPublicKeyClient)

    console.log(`sharedSecret in ecu:${sharedSecret.toString('hex')}`)

    //hkdf
    const salt = Buffer.concat([challengeTester, challenge])
    realKey = Buffer.from(crypto.hkdfSync('sha256', sharedSecret, salt, '', 32))
    console.log(`realKey in ecu:${realKey.toString('hex')}`)
    resp.diagSetParameter('returnValue', 0x12) //authentication ok
    await resp.outputDiag()
  } else {
    throw new Error('client sign verify failed')
  }
})
let fwContent: Buffer = Buffer.alloc(0)
let decipher: crypto.DecipherGCM

Util.On('Tester_can_0.TransferData540.send', async (req) => {
  const raw = req.diagGetRaw()
  if (!decipher) {
    decipher = crypto.createDecipheriv('aes-256-gcm', realKey, Buffer.alloc(12, 0))
  }
  const transferRequestParameterRecord = raw.subarray(2)
  const decrypted = decipher.update(transferRequestParameterRecord)
  if (fwContent.length < memorySize) {
    fwContent = Buffer.concat([fwContent, decrypted])
    if (fwContent.length >= memorySize) {
      console.log(`decrypted content :${fwContent.subarray(0, memorySize).toString('ascii')}`)
    }
  }
  const resp = DiagResponse.fromDiagRequest(req)
  resp.diagSetRaw(Buffer.from([0x76, Number(req.diagGetParameter('blockSequenceCounter'))]))
  await resp.outputDiag()
})

Util.On('Tester_can_0.RequestTransferExit550.send', async (req) => {
  const raw = req.diagGetRaw()
  decipher.setAuthTag(raw.subarray(2))
  decipher.final()
  const resp = DiagResponse.fromDiagRequest(req)
  resp.diagSetRaw(Buffer.from([0x77]))
  await resp.outputDiag()
})
