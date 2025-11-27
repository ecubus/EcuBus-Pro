import { SecureAccessDll } from 'ECB'
import path from 'path'

const sa = new SecureAccessDll(path.join(process.env.PROJECT_ROOT, 'dll', 'GenerateKeyEx.dll'))

const seed = sa.GenerateKeyEx(
  Buffer.from([1, 2, 3, 4, 5]),
  1,
  Buffer.from([1, 2, 3, 4, 5]),
  Buffer.from([1, 2, 3, 4, 5])
)
console.log(seed.toString('hex'))
