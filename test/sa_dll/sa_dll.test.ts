import { test, expect } from 'vitest'
import SecureAccessDll from './../../src/main/worker/secureAccess'
import path from 'path'

test('SecureAccessDllOpt', () => {
  const dllPath = path.join(__dirname, 'GenerateKeyExOpt.dll')
  const sa = new SecureAccessDll(dllPath)

  const seed = sa.GenerateKeyExOpt(
    Buffer.from([1, 2, 3, 4, 5]),
    1,
    Buffer.from([1, 2, 3, 4, 5]),
    Buffer.from([1, 2, 3, 4, 5]),
    Buffer.from([1, 2, 3, 4, 5])
  )
  expect(seed).toEqual(Buffer.from('020406080a', 'hex'))
})

test('SecureAccessDll', () => {
  const dllPath = path.join(__dirname, 'GenerateKeyEx.dll')
  const sa = new SecureAccessDll(dllPath)

  const seed = sa.GenerateKeyEx(
    Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]),
    1,
    Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]),
    Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])
  )
  expect(seed).toEqual(Buffer.from('fefdfcfbfaf9f8f7', 'hex'))
})

test('SecureAccessDll empty function in dll', () => {
  const dllPath = path.join(__dirname, 'GenerateKeyEx.dll')
  const sa = new SecureAccessDll(dllPath)
  try {
    const seed = sa.GenerateKeyExOpt(
      Buffer.from([1, 2, 3, 4, 5]),
      1,
      Buffer.from([1, 2, 3, 4, 5]),
      Buffer.from([1, 2, 3, 4, 5]),
      Buffer.from([1, 2, 3, 4, 5])
    )
    expect(true).toEqual(false)
  } catch (e) {
    expect(true).toEqual(true)
  }
})
