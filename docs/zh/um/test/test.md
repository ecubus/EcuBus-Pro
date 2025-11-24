# EcuBus-Pro 测试架构

## 概述

EcuBus-Pro 为汽车 ECU 开发和验证提供了一个强大而灵活的测试框架。 该测试架构允许开发人员为总线通信创建、执行和监控自动化测试，确保汽车系统的可靠和一致行为。 该测试架构允许开发人员为总线通信创建、执行和监控自动化测试，确保汽车系统的可靠和一致行为。

![alt text](../../../media/um/test/image-4.png)

## 主要特性

### 配置

通过显示实时结果的用户友好界面监控测试执行
![alt text](../../../media/um/test/image.png)
![alt text](../../../media/um/test/image-2.png)

### 基于 TypeScript 的测试框架

使用熟悉的 TypeScript 语法和内置测试工具编写测试。 参见 [Srcipt](./../script.md)。 参见 [Srcipt](./../script.md)。

重用了 node.js [测试运行器](https://nodejs.org/docs/latest/api/test.html)

#### 示例

```typescript
 describe('Test Suite', () => {


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

// Second test suite
describe('Test Suite 2', () => {
  // Simple test case that passes immediately
  test('Fail test example', () => {
    assert(false)
  })
})
```

### 详细测试报告

生成包含时间和通过/失败信息的全面测试报告

![alt text](../../../media/um/test/image-3.png)

![alt text](../../../media/um/test/image-1.png)
