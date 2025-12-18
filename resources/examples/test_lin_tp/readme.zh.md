# LIN 传输层测试示例

底层 LIN TP 测试，手动构建连续帧并在其间插入功能请求以测试协议行为。

## 测试用例

### 测试 1：物理寻址

基本多帧传输测试：

```typescript
// First Frame: NAD=2, PCI=0x10, Length=0x11
msg1: [0x02, 0x10, 0x11, 0x10, 0x01, 0x3, 0x4, 0x5]

// Consecutive Frame 1: NAD=2, PCI=0x21  
msg3: [0x02, 0x21, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]

// Consecutive Frame 2: NAD=2, PCI=0x22
msg5: [0x02, 0x22, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11]

// Wait for response on frame 0x3D
```

### 测试 2：功能寻址干扰测试

测试功能请求不会中断正在进行的物理传输：

```typescript
// Same 3-frame sequence as Test 1, but with functional frames inserted:
msg1 -> msg2 (functional) -> msg3 -> msg4 (functional) -> msg5 -> response

// Functional frames: NAD=0x7E, SID=0x02, Data=0x3e80
msg2/msg4: [0x7E, 0x02, 0x3e, 0x80, 0xAA, 0xAA, 0xAA, 0xAA]
```

## 帧详细信息

- **请求帧 ID**：0x3C
- **响应帧 ID**：0x3D
- **物理 NAD**：0x02（Motor1）
- **功能 NAD**：0x7E（广播）
- **校验和**：经典
- **超时时间**：1000ms

## 预期结果

1. **测试 1**：ECU 在接收到所有 3 个连续帧后响应
2. **测试 2**：功能请求在物理传输期间被忽略；ECU 仅响应物理序列

## 使用方法

1. 加载 `test_lin_tp.ecb`
2. 将 LIN 硬件连接到 COM8（19200 波特率）
3. 运行测试以验证 LIN TP 协议合规性
