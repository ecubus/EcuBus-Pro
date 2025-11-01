# EcuBus-Pro 测试架构

## 概述

EcuBus-Pro 提供强大且灵活的测试框架，用于汽车 ECU 的开发与验证。该测试架构支持开发者为总线通信创建、执行与监控自动化测试，从而确保车载系统行为的可靠性与一致性。

![测试架构示意](image-4.png)

## 关键特性

### 配置（Config）

通过友好的界面监控测试执行并实时展示结果。
![配置界面](image.png)
![执行监控](image-2.png)

### 基于 TypeScript 的测试框架

使用熟悉的 TypeScript 语法与内置测试工具编写测试。详见 [Script](./../script.md)。

复用 Node.js 的 [test runner](https://nodejs.org/docs/latest/api/test.html)。

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

生成包含时序与通过/失败信息的完整测试报告。

![报告示例1](image-3.png)

![报告示例2](image-1.png)
