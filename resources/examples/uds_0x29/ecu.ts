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
    //client cert verify ok
    // resp.diagSetParameter('lengthOfChallengeServer',32)
    // resp.diagSetParameterSize('challengeServer',32*8)
    resp.diagSetParameterRaw('challengeServer', challenge)
    resp.diagSetParameter('returnValue', 0x11) //certificate ok, verify ownership
    await resp.outputDiag()
  } else {
    throw new Error('client cert verify failed')
  }
})

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
    resp.diagSetParameter('returnValue', 0x12) //authentication ok
    await resp.outputDiag()
  } else {
    throw new Error('client sign verify failed')
  }
})
