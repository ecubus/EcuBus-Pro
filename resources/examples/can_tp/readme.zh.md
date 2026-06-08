# CAN-TP 示例

演示了用于 ISO 15765-2（CAN 传输层协议）通信的 `CanTpCreateConnection` / `CanTpSendData` / `CanTpRecvData` 工作器 API。 无需硬件——两个节点均运行在单个虚拟 CAN 总线上。

## 概述

- **节点 1 (tester.ts)**：使用 `CanTp*` API 发送请求并接收响应。 启动时运行四个测试，涵盖单帧和多帧场景，最多 500 字节。
- **节点 2 (ecu.ts)**：使用 `Util.OnCan` + `output()` 实现的模拟 ECU。 手动处理 ISO 15765-2 SF / FF / CF / FC 帧，并回显肯定响应（`service_id + 0x40`）。
- **设备**：SIMULATE_0（虚拟 CAN 总线——无需硬件）

## 寻址

| 参数    | 测试端     | ECU     |
| ----- | ------- | ------- |
| TX ID | `0x7E0` | `0x7E8` |
| RX ID | `0x7E8` | `0x7E0` |
| 寻址    | 正常      | 正常      |

## 测试

| # | 负载    | 帧类型           | 通过条件                                    |
| - | ----- | ------------- | --------------------------------------- |
| 1 | 2 B   | SF TX → SF RX | `resp[0] == 0x50`, `resp.length == 2`   |
| 2 | 8 B   | MF TX → MF RX | `resp[0] == 0x62`, `resp.length == 8`   |
| 3 | 20 B  | MF TX → MF RX | `resp[0] == 0x76`, `resp.length == 20`  |
| 4 | 500 B | MF TX → MF RX | `resp[0] == 0x76`, `resp.length == 500` |

## 如何运行

1. 在 EcuBus-Pro 中打开 `can_tp.ecb`
2. 启动项目 — 两个节点自动启动
3. 检查 Tester 日志以获取通过/失败结果

预期的测试输出：

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

## 代码亮点

### Tester — 创建连接并发送/接收

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

### ECU — 使用 Util.OnCan 的原始帧处理程序

```typescript
Util.OnCan(0x7E0, (msg) => {
  const d = Array.from(msg.data)
  const frameType = (d[0] >> 4) & 0x0f

  if (frameType === 0) {           // SF — 立即响应
    respond(d.slice(1, 1 + (d[0] & 0x0f)))
  } else if (frameType === 1) {    // FF — 发送 FC
    rxState = { totalLen: ((d[0] & 0xf) << 8) | d[1], buf: [...d.slice(2)], expectedSN: 1 }
    sendRaw([0x30, 0x00, 0x00])
  } else if (frameType === 2) {    // CF — 累积，完成后响应
    rxState!.buf.push(...d.slice(1))
    if (rxState!.buf.length >= rxState!.totalLen) respond(rxState!.buf)
  } else if (frameType === 3) {    // FC — 发送剩余的 CF
    while (txState!.offset < txState!.data.length) { ... }
  }
})
```

## 文件结构

```
can_tp/
├── can_tp.ecb    # 项目配置（SIMULATE_0，两个节点）
├── tester.ts     # 节点 1 — CanTp* API 演示
├── ecu.ts        # 节点 2 — Util.OnCan + output() ECU 模拟器
├── readme.md
└── readme.zh.md
```

## 真实硬件

将 `SIMULATE_0` 替换为真实的 CAN 设备。 对于在同一物理总线上设置两个节点的情况，两个通道必须能够相互确认（背对背连接的独立通道，或总线上的真实 ECU）。 有关硬件配置，请参阅 [EcuBus-Pro 文档](https://ecubus.org)。
