# 简单测试

关于测试框架，请参阅用户手册 [测试](../../../docs/um/test/test.md)

- 接口：`CAN`
- 供应商设备：`Simulate`
- 测试脚本：test.ts

```typescript
import { describe, test, assert, CanMessage, DiagResponse, DiagRequest } from 'ECB'

/**
 * Utility function to wait for a specific CAN message
 * @param id - The CAN message ID to wait for, or true to accept any message
 * @param timeout - Maximum time to wait in milliseconds (defaults to 1000ms)
 * @returns Promise that resolves with the received CAN message
 */
const TestWaitForMessage = async (id: number | true, timeout: number = 1000) => {
  return new Promise<CanMessage>((resolve, reject) => {
    // Set timeout to reject the promise if no message is received
    const timer = setTimeout(() => {
      reject(new Error('timeout'))
    }, timeout)
    // Register one-time handler for the specified CAN message ID
    Util.OnCanOnce(id, (msg) => {
      clearTimeout(timer)
      console.log(
        `ID: ${msg.id}, DLC: ${msg.data.length}, Data: ${msg.data.toString('hex').toUpperCase()}`
      )
      resolve(msg)
    })
  })
}

/**
 * Utility function to wait for UDS response message
 * @param timeout - Maximum time to wait in milliseconds (defaults to 1000ms)
 * @returns Promise that resolves with the received DiagResponse
 */
const TestWaitForUDSRespMessage = async (timeout: number = 1000) => {
  return new Promise<DiagResponse>((resolve, reject) => {
    // Set timeout to reject the promise if no message is received
    const timer = setTimeout(() => {
      reject(new Error('timeout'))
    }, timeout)
    // Register one-time handler for the specified CAN message ID
    Util.OnOnce('Tester_can_0.*.recv', (msg) => {
      clearTimeout(timer)
      console.log(`Receive UDS Message: ${msg.diagGetRaw().toString('hex').toUpperCase()}`)
      resolve(msg)
    })
  })
}

// CAN test suite
describe('CAN Test', () => {
  test('Wait for a specific CAN message with ID 0x1', async () => {
    await TestWaitForMessage(0x1, 3000)
    assert(true)
  })

  // Test case that waits for any CAN message and verifies its ID is 0x2
  test('Wait for any CAN message, and verify its ID is 0x2', async () => {
    const msg = await TestWaitForMessage(true, 3000)
    assert(msg.id == 0x2)
  })

  // Skipped test case that would otherwise pass immediately
  test.skip('Skip test example', async () => {
    assert(true)
  })
})

// UDS test suite
describe('UDS Test', () => {
  // UDS diagnostic test case
  test('DiagnosticSessionControl160 test', async () => {
    const diagReq = DiagRequest.from('Tester_can_0.DiagnosticSessionControl160')
    await diagReq.outputDiag()
    console.log('DiagnosticSessionControl160 send out')
    const msg = await TestWaitForUDSRespMessage(3000)
    //compare with hoped
    const recvData = msg.diagGetRaw()
    const hoped = Buffer.from([0x50, 0x01, 0x0])
    assert(recvData.equals(hoped))
  })
})
```

- CAN-IA
  - ID (1)，按 a 发送
  - ID (2)，按 b 发送
    ![alt text](image.png)

## 测试特性

此测试示例演示：

1. **CAN 报文测试**：等待特定 CAN 报文并验证其属性
2. **UDS 诊断测试**：发送 UDS 诊断请求并验证响应
3. **测试工具**：具有超时支持的可复用消息处理函数

## 成功示例

对于 CAN 测试：

- 在 `Wait for a specific CAN message with ID 0x1` 中按 'a'
- 在 `Wait for any CAN message, and verify its ID is 0x2` 中按 'b'

对于 UDS 测试：

- DiagnosticSessionControl160 测试将自动发送诊断请求并等待预期响应

![alt text](ok.gif)
![alt text](image-1.png)

## 失败示例

不按任何键，将在 `Wait can frame` 中超时
![alt text](fail.gif)
![alt text](image-2.png)
