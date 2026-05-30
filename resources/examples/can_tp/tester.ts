/**
 * CAN-TP tester — demonstrates CanTpCreateConnection / CanTpSendData / CanTpRecvData.
 *
 * TX = 0x7E0  (Tester → ECU)
 * RX = 0x7E8  (ECU → Tester)
 *
 * Runs four tests automatically on startup:
 *   Test 1 — Single Frame  TX → Single Frame  RX   (2 bytes)
 *   Test 2 — Multi  Frame  TX → Multi  Frame  RX   (8 bytes)
 *   Test 3 — Multi  Frame  TX → Multi  Frame  RX   (20 bytes)
 *   Test 4 — Multi  Frame  TX → Multi  Frame  RX   (500 bytes)
 */
import {
  CanTpCreateConnection,
  CanTpSendData,
  CanTpRecvData,
  CanTpCloseConnection,
  CAN_ADDR_FORMAT,
  CAN_ADDR_TYPE,
  CAN_ID_TYPE
} from 'ECB'
import type { CanTpAddr } from 'ECB'

const addr: CanTpAddr = {
  name: 'tester',
  idType: CAN_ID_TYPE.STANDARD,
  brs: false,
  canfd: false,
  remote: false,
  canIdTx: '0x7E0',
  canIdRx: '0x7E8',
  addrFormat: CAN_ADDR_FORMAT.NORMAL,
  addrType: CAN_ADDR_TYPE.PHYSICAL,
  SA: '0xF1',
  TA: '0x01',
  AE: '0x00',
  nAs: 1000,
  nAr: 1000,
  nBs: 1000,
  nCr: 1500,
  stMin: 0,
  bs: 0,
  maxWTF: 0,
  dlc: 8,
  padding: false,
  paddingValue: '0x00'
}

function preview(bytes: number[], maxBytes = 8): string {
  const hex = bytes
    .slice(0, maxBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
  return bytes.length > maxBytes ? `${hex} ...` : hex
}

async function runTest(
  handle: string,
  label: string,
  request: number[],
  expectedFirstByte: number
): Promise<boolean> {
  console.log(`=== ${label} ===`)
  console.log(`  TX ${request.length}B: ${preview(request)}`)
  try {
    await CanTpSendData(handle, request)
    const { data } = await CanTpRecvData(handle, 3000)
    console.log(`  RX ${data.length}B: ${preview(data)}`)
    const pass = data[0] === expectedFirstByte && data.length === request.length
    console.log(`  ${pass ? 'PASS ✓' : 'FAIL ✗'}\n`)
    return pass
  } catch (e: any) {
    console.error(`  Error: ${e.message}\n`)
    return false
  }
}

Util.OnKey('c', async () => {
  // Give the ECU node a moment to register its OnCan listener
  await new Promise((r) => setTimeout(r, 200))

  const handle = await CanTpCreateConnection(addr)
  console.log('[Tester] Connection ready\n')

  let passed = 0
  const total = 4

  // Test 1 — Single Frame (2 bytes)
  if (await runTest(handle, 'Test 1: SF  2B', [0x10, 0x01], 0x50)) passed++

  // Test 2 — Multi Frame (8 bytes)
  if (
    await runTest(handle, 'Test 2: MF  8B', [0x22, 0xf1, 0x80, 0x01, 0x02, 0x03, 0x04, 0x05], 0x62)
  )
    passed++

  // Test 3 — Multi Frame (20 bytes)
  const req20 = [0x36, ...Array.from({ length: 19 }, (_, i) => (i + 1) & 0xff)]
  if (await runTest(handle, 'Test 3: MF 20B', req20, 0x76)) passed++

  // Test 4 — Multi Frame (500 bytes)
  // First byte = service 0x36 (TransferData), rest filled with a repeating pattern 0x00..0xFE
  const req500 = [0x36, ...Array.from({ length: 499 }, (_, i) => i & 0xff)]
  if (await runTest(handle, 'Test 4: MF 500B', req500, 0x76)) passed++

  await CanTpCloseConnection(handle)
  console.log(`[Tester] Done  ${passed}/${total} passed`)
})
