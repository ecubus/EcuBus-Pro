# CAN 模糊测试示例

基于 [can-hax](https://github.com/rybolov/can-hax) 指纹格式的 CAN 总线模糊测试示例。 使用 ECB 的 `fingerprintFromCanMessages` 和 `fuzz` API 对 CAN 流量进行指纹识别和模糊测试，并监控 ECU 健康状态。

## 概述

- **节点 1 (fuzz.ts)**：加载指纹，发送模糊测试帧，监听 ECU 崩溃信号
- **节点 2 (ecu.ts)**：模拟的 ECU，当接收到触发 CAN ID 时“崩溃”，然后发送崩溃信号
- **设备**：SIMULATE_0（用于测试的虚拟 CAN 总线）

## 指纹格式

指纹文件 (`icsim_fingerprint.json`) 使用 can-hax 格式：

| 字符  | 含义                               |
| --- | -------------------------------- |
| `0` | 固定的 0x00（未观察到）                   |
| `N` | 十进制半字节 (0-9)  |
| `H` | 十六进制半字节 (0-F) |

示例：`"133": "00000000HN"` → CAN ID 0x133，5 字节，最后一个半字节可变。

## 文件结构

```
can_fuzz/
├── README.md
├── can_fuzz.ecb          # 项目配置
├── ecu.ts                 # 模拟的 ECU (节点 2)
├── fuzz.ts                # 模糊测试脚本 (节点 1)
├── icsim_fingerprint.json # ICSIM 车辆模拟器指纹
└── tsconfig.json
```

## 如何运行

1. 在 ECB 中打开 `can_fuzz.ecb`
2. 启动 CAN 设备 (SIMULATE_0)
3. 两个节点自动启动：
   - 节点1发送模糊测试帧
   - 节点2接收并监视触发信号

## ECU崩溃检测

当模拟ECU接收到**CAN ID 0x133**（漏洞触发）时，它将：

1. 记录`*** VULNERABILITY TRIGGERED ***`
2. 在总线上发送崩溃信号**0x7FF#DEAD**

模糊测试监听0x7FF。 当接收到时，`onAfterSend`返回`false`且模糊测试停止。

## 快速测试

要快速验证崩溃检测，请在`fuzz.ts`中取消注释：

```ts
canId: '133',  // Only fuzz 0x133
```

ECU将在第一个0x133帧上触发，模糊测试将立即停止。

## 模糊测试选项

| 选项           | 默认值   | 描述                          |
| ------------ | ----- | --------------------------- |
| `timing`     | 20    | 帧间延迟（毫秒）                    |
| `quick`      | false | 受限集：N=0,1,5,9；H=0,1,9,A,B,F |
| `superQuick` | false | 最小集：N=0,9；H=0,F             |
| `adaptive`   | true  | 为复杂模板自动缩减集                  |
| `canId`      | -     | 仅模糊测试此CAN ID（例如`'133'`）     |

## 自定义指纹

使用`fingerprintFromCanMessages`从实时CAN捕获生成指纹：

```ts
const frames: CanMessage[] = [];
Util.OnCan(true, (msg) => frames.push(msg));
await sleep(10000);  // Capture 10s
Util.OffCan(true, cb);
const fp = fingerprintFromCanMessages(frames);
```

## 真实硬件

在项目中用真实CAN设备替换SIMULATE_0。 确保`fuzz.ts`中的`DEVICE`与设备名称匹配。
