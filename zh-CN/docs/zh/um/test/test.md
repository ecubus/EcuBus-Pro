# Ecuadus Bus-Pro 测试结构

## 概览

Ecuadus Bus-Pro为自动ECU的发展和验证提供了一个强有力和灵活的测试框架。 测试架构允许开发者创建、执行和监视汽车通信自动化测试，确保汽车系统的可靠和一贯行为。

![Alt 文本](image-4.png)

## 关键功能

### 配置

使用方便的接口监视测试执行情况，显示实时结果
![备用文本](image.png)
![Alt text](image-2.png)

### 基于类型脚本的测试框架

使用熟悉的 TypeScript 语法和内置测试工具编写测试。 见 [Srcipt](./../script.md)。

Reused the node.js [test runner](https://nodejs.org/docs/latest/api/test.html)

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

生成带有时间和传输/失败信息的全面测试报告

![Alt 文本](image-3.png)

![Alt 文本](image-1.png)
