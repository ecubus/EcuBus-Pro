# UDS DoIP 大文件传输

本示例演示了如何使用 UDS（统一诊断服务）通过 DoIP 协议向 ECU 传输大型二进制文件，采用 **流式文件读取** 方式。这种方法针对处理超大文件进行了优化，无需一次性将整个文件加载到内存中。

## 概述

本示例使用以下 UDS 服务实现大文件传输序列：

- **RequestDownload (0x34)** - 启动下载过程
- **TransferData (0x36)** - 按序传输数据块
- **RequestTransferExit (0x37)** - 完成传输过程

## 核心创新：流式读取 vs 传统方式

### 传统方式（之前的示例）

```typescript
// 旧方式：一次性将整个文件加载到内存
const hexStr = await fsP.readFile(hexFile, 'utf8')
const map = HexMemoryMap.fromHex(hexStr)
for (const [addr, data] of map) {
  pendingBlocks.push({ addr, data }) // 所有数据都加载到内存中
}
```

**局限性：**

- ❌ 大文件的高内存消耗
- ❌ 多 GB 文件存在内存不足的风险
- ❌ 大文件启动时间较慢
- ❌ 无法处理超过可用 RAM 大小的文件

### 流式方式（本示例）

```typescript
// 新方式：打开文件句柄进行流式读取
fHandle = await fsP.open(hexFile, 'r')

// 只读取当前传输所需的数据
const data = Buffer.alloc(maxChunkSize)
const { bytesRead } = await fHandle.read(data)
```

**优势：**

- ✅ **内存高效**：一次只加载小块数据
- ✅ **可扩展**：可处理任意大小的文件（GB+）
- ✅ **快速启动**：立即开始传输
- ✅ **实时处理**：按需读取数据
- ✅ **低资源占用**：最小内存占用

## 架构与流程

![流程图](flow.png)

传输过程遵循以下序列：

1. **JobFunction0**：启动下载请求并接收 ECU 能力信息
2. **"Still Need Read" 判断**：确定是否还有更多数据需要传输
3. **JobFunction1**：使用流式读取执行分块数据传输
4. **顺序处理**：持续进行直到整个文件传输完成

## 实现细节

### 文件流设置

```typescript
let fHandle: fsP.FileHandle | undefined

Util.Init(async () => {
  const hexFile = path.join(process.env.PROJECT_ROOT, 'large.bin')
  fHandle = await fsP.open(hexFile, 'r')  // 打开用于流式读取
})

Util.End(async () => {
  if (fHandle) {
    await fHandle.close()  // 正确清理资源
  }
})
```

### JobFunction0 - 下载初始化

为 ECU 接收数据做准备并协商传输参数：

```typescript
Util.Register('Tester.JobFunction0', async () => {
  if (fHandle) {
    const fileState = await fHandle.stat()
    console.log('File size:', fileState.size)
    
    const r34 = DiagRequest.from('Tester.RequestDownload520')
    const memoryAddress = Buffer.alloc(4)
    memoryAddress.writeUInt32BE(0)
    r34.diagSetParameterRaw('memoryAddress', memoryAddress)
    r34.diagSetParameter('memorySize', fileState.size)
    
    r34.On('recv', (resp) => {
      // 从 ECU 响应中获取最大块大小
      maxChunkSize = resp.diagGetParameterRaw('maxNumberOfBlockLength').readUint32BE(0)
      maxChunkSize -= 2  // 为序列计数器预留空间
      
      // 对齐到 8 字节边界以优化传输
      if (maxChunkSize & 0x07) {
        maxChunkSize -= maxChunkSize & 0x07
      }
    })
    return [r34]
  }
  return []
})
```

### JobFunction1 - 流式数据传输

使用流式读取执行实际的文件传输：

```typescript
Util.Register('Tester.JobFunction1', async () => {
  if (fHandle) {
    const list = []
    const data = Buffer.alloc(maxChunkSize)  // 可重用缓冲区
    
    // 每批传输多个块（combine36 = 6）
    for (let i = 0; i < combine36; i++) {
      const { bytesRead } = await fHandle.read(data)  // 流式读取
      
      const transferRequest = DiagRequest.from('Tester.TransferData540')
      transferRequest.diagSetParameterSize('transferRequestParameterRecord', bytesRead * 8)
      transferRequest.diagSetParameterRaw(
        'transferRequestParameterRecord',
        data.subarray(0, bytesRead)  // 只发送实际数据
      )
      
      // 块序列计数器（1-255 循环）
      const blockSequenceCounter = Buffer.alloc(1)
      blockSequenceCounter.writeUInt8(cnt & 0xff)
      transferRequest.diagSetParameterRaw('blockSequenceCounter', blockSequenceCounter)
      cnt++
      
      list.push(transferRequest)
      
      // 检查是否还有更多数据
      if (bytesRead == maxChunkSize) {
        if (i == combine36 - 1) {
          // 继续下一批
          list.push(DiagRequest.from('Tester.JobFunction1'))
        }
      } else {
        // 到达文件末尾
        console.log(`Read ${bytesRead} bytes, no more data to read.`)
        
        // 发送传输退出请求
        const r37 = DiagRequest.from('Tester.RequestTransferExit550')
        r37.diagSetParameterSize('transferRequestParameterRecord', 0)
        list.push(r37)
        
        // 清理资源
        await fHandle.close()
        fHandle = undefined
        break
      }
    }
    return list
  }
  return []
})
```

## 内存使用对比

| 方式 | 1GB 文件 | 4GB 文件 | 10GB 文件 |
|------|----------|----------|-----------|
| **传统方式** | ~1GB RAM | ~4GB RAM | ~10GB RAM |
| **流式方式** | ~4KB RAM | ~4KB RAM | ~4KB RAM |

## 使用场景

这种流式方法适用于：

- **ECU 固件更新**：大型二进制文件
- **标定数据传输**：汽车应用
- **软件部署**：嵌入式系统
- **数据记录**：诊断信息传输
- **任何需要内存高效大文件传输的场景**

这种实现相比传统方法有显著改进，能够在资源受限的环境中可靠地传输超大文件。
