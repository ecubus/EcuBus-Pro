# CAN-TP 示例

演示 ISO 15765-2（CAN 传输层协议）的 Worker API：`CanTpCreateConnection` / `CanTpSendData` / `CanTpRecvData`。无需真实硬件——两个节点运行在同一个虚拟 CAN 总线上即可。

## 概述

- **节点 1 (tester.ts)**：使用 `CanTp*` API 发送请求、接收响应。启动时自动执行四个测试，覆盖单帧和多帧场景，最大 500 字节。
- **节点 2 (ecu.ts)**：用 `Util.OnCan` + `output()` 实现的模拟 ECU，手动处理 ISO 15765-2 的 SF / FF / CF / FC 帧，返回正响应（`service_id + 0x40`，其余字节原样）。
- **设备**：SIMULATE_0（虚拟 CAN 总线，无需硬件）

## 地址配置

| 参数 | Tester | ECU |
|------|--------|-----|
| TX ID | `0x7E0` | `0x7E8` |
| RX ID | `0x7E8` | `0x7E0` |
| 寻址模式 | Normal | Normal |

## 测试项

| # | 数据长度 | 帧类型 | 通过条件 |
|---|---------|--------|---------|
| 1 | 2 B | SF TX → SF RX | `resp[0] == 0x50`，`resp.length == 2` |
| 2 | 8 B | MF TX → MF RX | `resp[0] == 0x62`，`resp.length == 8` |
| 3 | 20 B | MF TX → MF RX | `resp[0] == 0x76`，`resp.length == 20` |
| 4 | 500 B | MF TX → MF RX | `resp[0] == 0x76`，`resp.length == 500` |

## 如何运行

1. 在 EcuBus-Pro 中打开 `can_tp.ecb`
2. 启动工程，两个节点自动运行
3. 查看 Tester 节点日志

预期 Tester 输出：

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

## 代码要点

### Tester — 创建连接并收发数据

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

### ECU — 用 Util.OnCan 处理原始帧

```typescript
Util.OnCan(0x7E0, (msg) => {
  const d = Array.from(msg.data)
  const frameType = (d[0] >> 4) & 0x0f

  if (frameType === 0) {           // SF — 直接回复
    respond(d.slice(1, 1 + (d[0] & 0x0f)))
  } else if (frameType === 1) {    // FF — 发 FC
    rxState = { totalLen: ((d[0] & 0xf) << 8) | d[1], buf: [...d.slice(2)], expectedSN: 1 }
    sendRaw([0x30, 0x00, 0x00])
  } else if (frameType === 2) {    // CF — 累积，完整后回复
    rxState!.buf.push(...d.slice(1))
    if (rxState!.buf.length >= rxState!.totalLen) respond(rxState!.buf)
  } else if (frameType === 3) {    // FC — 发送剩余 CF
    while (txState!.offset < txState!.data.length) { ... }
  }
})
```

## 文件结构

```
can_tp/
├── can_tp.ecb    # 工程配置（SIMULATE_0，两个节点）
├── tester.ts     # 节点 1 — CanTp* API 演示
├── ecu.ts        # 节点 2 — Util.OnCan + output() 模拟 ECU
├── readme.md
└── readme.zh.md
```

## 真实硬件

将 SIMULATE_0 替换为真实 CAN 设备。双节点在同一物理总线上通信时，两个通道必须能互相 ACK（背靠背连接的两个通道，或总线上接有真实 ECU）。详见 [EcuBus-Pro 文档](https://ecubus.org)。
