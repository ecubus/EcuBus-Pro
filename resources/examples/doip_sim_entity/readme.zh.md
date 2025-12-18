# DoIP 模拟实体示例

本示例演示如何使用 DoIP 协议与 ECU 通信。 使用脚本模拟一个实体并向测试仪发送 UDS 响应帧。

## 设备

使用环回通道
![device](device.png)

## 节点

添加一个节点项并附加脚本(`node.ts`)

![alt text](image-1.png)

```typescript
import { DiagResponse } from 'ECB'

Util.On('Tester_eth_1.DiagnosticSessionControl160.send', async (req) => {
  console.log('Received Diag request')
  const resp = DiagResponse.fromDiagRequest(req)
  await resp.outputDiag()
})


```

## 测试仪

地址信息需要与您注册的实体相同

- 测试仪地址：200
- 网关地址：100
- 模拟方式：选择 `sim_entity`，即节点名称。
  ![alt text](image-2.png)

## 执行

启动序列并打开跟踪窗口以查看所有帧。 或者，使用 Wireshark 捕获这些帧。
![trace](image.png)
