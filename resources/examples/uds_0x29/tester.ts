import { DiagRequest } from 'ECB'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const challenge = Buffer.from(
  Array(32)
    .fill(0)
    .map(() => Math.floor(Math.random() * 256))
)
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
  verifyCertificateUnidirectional.diagSetParameterRaw('challengeClient', challenge)
  //save
  await verifyCertificateUnidirectional.changeService()
})

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
  //save
  await proofOfOwnership.changeService()
})
