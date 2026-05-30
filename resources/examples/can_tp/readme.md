# CAN-TP Example

Demonstrates the `CanTpCreateConnection` / `CanTpSendData` / `CanTpRecvData` worker API for ISO 15765-2 (CAN Transport Protocol) communication. No hardware required — both nodes run on a single virtual CAN bus.

## Overview

- **Node 1 (tester.ts)**: Uses the `CanTp*` API to send requests and receive responses. Runs four tests on startup covering single-frame and multi-frame scenarios up to 500 bytes.
- **Node 2 (ecu.ts)**: Simulated ECU implemented with `Util.OnCan` + `output()`. Handles ISO 15765-2 SF / FF / CF / FC frames manually and echoes back a positive response (`service_id + 0x40`).
- **Device**: SIMULATE_0 (virtual CAN bus — no hardware needed)

## Addressing

| Parameter | Tester | ECU |
|-----------|--------|-----|
| TX ID | `0x7E0` | `0x7E8` |
| RX ID | `0x7E8` | `0x7E0` |
| Addressing | Normal | Normal |

## Tests

| # | Payload | Frame type | Pass condition |
|---|---------|-----------|----------------|
| 1 | 2 B | SF TX → SF RX | `resp[0] == 0x50`, `resp.length == 2` |
| 2 | 8 B | MF TX → MF RX | `resp[0] == 0x62`, `resp.length == 8` |
| 3 | 20 B | MF TX → MF RX | `resp[0] == 0x76`, `resp.length == 20` |
| 4 | 500 B | MF TX → MF RX | `resp[0] == 0x76`, `resp.length == 500` |

## How to Run

1. Open `can_tp.ecb` in EcuBus-Pro
2. Start the project — both nodes launch automatically
3. Check the Tester log for pass / fail results

Expected tester output:

```
[Tester] Connection ready

=== Test 1: SF  2B ===
  TX 2B: 10 01
  RX 2B: 50 01
  PASS ✓

=== Test 2: MF  8B ===
  TX 8B: 22 f1 80 01 02 03 04 05
  RX 8B: 62 f1 80 01 02 03 04 05
  PASS ✓

=== Test 3: MF 20B ===
  TX 20B: 36 01 02 03 04 05 06 07 ...
  RX 20B: 76 01 02 03 04 05 06 07 ...
  PASS ✓

=== Test 4: MF 500B ===
  TX 500B: 36 00 01 02 03 04 05 06 ...
  RX 500B: 76 00 01 02 03 04 05 06 ...
  PASS ✓

[Tester] Done  4/4 passed
```

## Code Highlights

### Tester — create connection and send/receive

```typescript
import { CanTpCreateConnection, CanTpSendData, CanTpRecvData, CanTpCloseConnection } from 'ECB'
import type { CanTpAddr } from 'ECB'

const addr: CanTpAddr = {
  name: 'tester',
  idType: CAN_ID_TYPE.STANDARD, brs: false, canfd: false, remote: false,
  canIdTx: '0x7E0', canIdRx: '0x7E8',
  addrFormat: CAN_ADDR_FORMAT.NORMAL, addrType: CAN_ADDR_TYPE.PHYSICAL,
  SA: '0xF1', TA: '0x01', AE: '0x00',
  nAs: 1000, nAr: 1000, nBs: 1000, nCr: 1500,
  stMin: 0, bs: 0, maxWTF: 0, dlc: 8, padding: false, paddingValue: '0x00'
}

const handle = await CanTpCreateConnection(addr)
await CanTpSendData(handle, [0x10, 0x01])
const { data } = await CanTpRecvData(handle, 2000)
await CanTpCloseConnection(handle)
```

### ECU — raw frame handler with Util.OnCan

```typescript
Util.OnCan(0x7E0, (msg) => {
  const d = Array.from(msg.data)
  const frameType = (d[0] >> 4) & 0x0f

  if (frameType === 0) {           // SF — respond immediately
    respond(d.slice(1, 1 + (d[0] & 0x0f)))
  } else if (frameType === 1) {    // FF — send FC
    rxState = { totalLen: ((d[0] & 0xf) << 8) | d[1], buf: [...d.slice(2)], expectedSN: 1 }
    sendRaw([0x30, 0x00, 0x00])
  } else if (frameType === 2) {    // CF — accumulate, respond when complete
    rxState!.buf.push(...d.slice(1))
    if (rxState!.buf.length >= rxState!.totalLen) respond(rxState!.buf)
  } else if (frameType === 3) {    // FC — send remaining CFs
    while (txState!.offset < txState!.data.length) { ... }
  }
})
```

## File Structure

```
can_tp/
├── can_tp.ecb    # Project config (SIMULATE_0, two nodes)
├── tester.ts     # Node 1 — CanTp* API demo
├── ecu.ts        # Node 2 — Util.OnCan + output() ECU simulator
├── readme.md
└── readme.zh.md
```

## Real Hardware

Replace `SIMULATE_0` with a real CAN device. For a two-node setup on the same physical bus, both channels must be able to ACK each other (separate channels connected back-to-back, or a real ECU on the bus). See the [EcuBus-Pro documentation](https://ecubus.org) for hardware configuration.
