# 如何开发新适配器

`Lin` 适配器与 `Can` 适配器类似，因此您可以参考 `Can` 适配器进行开发。

## 参考拉取请求

您可以从这些 PR 中获取一些参考：

- [#137](https://github.com/ecubus/EcuBus-Pro/pull/137) - Vector Can

## 分步指南

您可以从[分步指南](./adapter/detail.md)获取详细步骤

## 先决条件

- [node-gyp](https://github.com/nodejs/node-gyp) - 用于构建原生模块
- [napi](https://nodejs.org/api/n-api.html) - Node.js 原生 API
- [swig](https://www.swig.org/) - 简化包装器和接口生成器

---

## 创建适配器文件夹

在以下目录中创建您的适配器：

```text
src/main/docan/${adapter_name}
```

## 目录结构

每个适配器目录应遵循此结构：

```text
${adapter_name}/
├── index.ts           # 主适配器实现文件
├── swig/             # SWIG 接口定义
│   ├── ${adapter_name}.i    # 主 SWIG 接口文件
│   ├── buffer.i            # 缓冲区处理接口
│   └── s.bat               # 构建脚本
├── inc/              # C/C++ 头文件
└── lib/              # 第三方库文件
```

---

## SWIG 接口实现

SWIG 接口对于桥接 JavaScript/TypeScript 和原生 C/C++ 代码至关重要。 以下是实现方法：

### 1. 主接口文件 (${adapter_name}.i)

在 `swig` 目录中创建主接口文件：

```swig
%module ${adapter_name}

%header %{
#include <windows.h>
#include <stdlib.h>
#include "your_native_header.h"
%}

%include <stdint.i>
%include <windows.i>
%include "your_native_header.h"

// Define typemaps for buffer handling
%include "./buffer.i"
%typemap(in) (void *data, size_t length) = (const void* buffer_data, const size_t buffer_len);

// Define pointer and array classes
%include <cpointer.i>
%pointer_class(unsigned long, JSUINT64)
%pointer_class(long, JSINT64)
%array_class(uint8_t, ByteArray);

%init %{
  // Add initialization code here
%}
```

### 2. 缓冲区接口 (buffer.i)

创建缓冲区接口文件以处理二进制数据：

```swig
%typemap(in) (const size_t buffer_len,const void* buffer_data) {
  if ($input.IsBuffer()) {
    Napi::Buffer<char> buf = $input.As<Napi::Buffer<char>>();
    $2 = reinterpret_cast<void *>(buf.Data());
    $1 = buf.ByteLength();
  } else {
    SWIG_exception_fail(SWIG_TypeError, "in method '$symname', argument is not a Buffer");
  }
}
```

### 3. 构建脚本 (s.bat)

创建构建脚本以生成 SWIG 包装器：

```batch
swig -I"./../inc" -c++ -javascript -napi -v ./${adapter_name}.i 
```

### SWIG 实现关键点

1. **类型映射**
   - 使用 `%typemap` 进行 C/C++ 到 JavaScript 的类型转换
   - 正确处理缓冲区和指针
   - 考虑二进制数据的字节序

2. **头文件包含**
   - 包含系统和库头文件
   - 使用 `%header %{ ... %}` 用于 C/C++ 代码
   - 使用 `%include` 用于 SWIG 接口

3. **错误处理**
   - 在类型映射中实现错误检查
   - 使用 `SWIG_exception_fail` 处理错误
   - 小心处理内存管理

4. **模块初始化**
   - 使用 `%init %{ ... %}` 用于设置代码
   - 如果需要，注册回调
   - 初始化全局变量

### 常用 SWIG 指令

```swig
%module name          // 定义模块名称
%include file         // 包含 SWIG 接口
%header %{ ... %}     // 包含 C/C++ 代码
%typemap(...) ...     // 定义类型映射
%pointer_class(...)   // 定义指针类
%array_class(...)     // 定义数组类
```

---

## 基类实现

所有适配器必须继承自 `CanBase` 抽象类并实现以下必需方法：

```typescript
abstract class CanBase {
  abstract info: CanBaseInfo;           // 适配器基本信息
  abstract log: CanLOG;                 // 日志记录对象
  abstract close(): void;               // 关闭适配器
  abstract readBase(...): Promise<...>; // 读取 CAN 消息
  abstract writeBase(...): Promise<...>;// 写入 CAN 消息
  abstract getReadBaseId(...): string;  // 获取读取 ID
  abstract setOption(...): void;        // 设置选项
  abstract event: EventEmitter;         // 事件发射器
}
```

## 必需静态方法

每个适配器类必须实现以下静态方法：

- `getValidDevices()`: 返回可用设备列表
- `getLibVersion()`: 返回库版本信息
- `getDefaultBitrate()`: 返回默认比特率配置

---

## 实现步骤

1. 创建适配器目录结构
2. 实现 SWIG 接口以包装原生库
3. 创建适配器类并继承自 `CanBase`
4. 实现所有必需的抽象方法
5. 实现静态方法
6. 添加错误处理和日志记录
7. 实现事件处理机制
8. 在 close() 方法中添加适当的清理
9. 实现适当的错误传播

---

## 示例：KVASER_CAN 适配器

参考 `kvaser` 适配器的实现：

```typescript
export class KVASER_CAN extends CanBase {
  event: EventEmitter;
  info: CanBaseInfo;
  handle: number;
  private closed: boolean = false;
  private readAbort: AbortController;

  constructor(info: CanBaseInfo) {
    super();
    this.info = info;
    this.event = new EventEmitter();
    this.readAbort = new AbortController();
    // Initialize native resources
  }

  async readBase(id: number, msgType: CanMsgType, timeout: number): Promise<{ data: Buffer; ts: number }> {
    // Implementation
  }

  async writeBase(id: number, msgType: CanMsgType, data: Buffer): Promise<number> {
    // Implementation
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.readAbort.abort();
    // Cleanup native resources
  }

  // ... other methods
}
```

适配器

## 测试

实现适配器后，您应在 `test/docan` 目录中创建一个测试文件（`${adapter_name}.test.ts`）。 以下是实现测试的方法：

### 1. 测试设置

```typescript
import { describe, it, beforeAll, afterAll, test } from 'vitest'
import * as path from 'path'

// Load native library
const dllPath = path.join(__dirname, '../../resources/lib')
YOUR_ADAPTER.loadDllPath(dllPath)

describe('adapter test', () => {
  let client!: YOUR_ADAPTER
  
  beforeAll(() => {
    // Initialize adapter with test configuration
    client = new YOUR_ADAPTER({
      handle: 0,
      name: 'test',
      id: 'adapter_name',
      vendor: 'vendor_name',
      canfd: false,
      bitrate: {
        freq: 250000,
        preScaler: 2,
        timeSeg1: 68,
        timeSeg2: 11,
        sjw: 11
      },
      bitratefd: {
        freq: 1000000,
        preScaler: 1,
        timeSeg1: 20,
        timeSeg2: 19,
        sjw: 19
      }
    })
  })

  afterAll(() => {
    // Clean up
    client.close()
  })
})
```

### 2. 测试用例

实现以下测试用例：

1. **基本操作**

   ```typescript
   test('basic operations', async () => {
     // Test adapter initialization
     expect(client.info).toBeDefined()
     expect(client.info.name).toBe('test')
     
     // Test device capabilities
     const devices = await YOUR_ADAPTER.getValidDevices()
     expect(devices.length).toBeGreaterThan(0)
     
     // Test version information
     const version = await YOUR_ADAPTER.getLibVersion()
     expect(version).toBeDefined()
   })
   ```

2. **消息传输**

   ```typescript
   test('message transmission', async () => {
     // Test single frame transmission
     const result = await client.writeBase(
       3, // CAN ID
       {
         idType: CAN_ID_TYPE.STANDARD,
         brs: false,
         canfd: false,
         remote: false
       },
       Buffer.alloc(8, 0)
     )
     expect(result).toBeDefined()
     
     // Test read operation
     const readResult = await client.readBase(3, {
       idType: CAN_ID_TYPE.STANDARD,
       brs: false,
       canfd: false,
       remote: false
     }, 1000)
     expect(readResult).toBeDefined()
     expect(readResult.data).toBeDefined()
   })
   ```

3. **多帧传输**

   ```typescript
   test('multi-frame transmission', async () => {
     const list = []
     for (let i = 0; i < 10; i++) {
       list.push(
         client.writeBase(
           3,
           {
             idType: CAN_ID_TYPE.STANDARD,
             brs: false,
             canfd: false,
             remote: false
           },
           Buffer.alloc(8, i)
         )
       )
     }
     const results = await Promise.all(list)
     expect(results.length).toBe(10)
     expect(results.every(r => r !== undefined)).toBe(true)
   })
   ```

4. **错误处理**

   ```typescript
   test('error handling', async () => {
     // Test invalid parameters
     await expect(client.writeBase(
       -1, // Invalid CAN ID
       {
         idType: CAN_ID_TYPE.STANDARD,
         brs: false,
         canfd: false,
         remote: false
       },
       Buffer.alloc(8, 0)
     )).rejects.toThrow()
     
     // Test closed adapter
     client.close()
     await expect(client.writeBase(
       3,
       {
         idType: CAN_ID_TYPE.STANDARD,
         brs: false,
         canfd: false,
         remote: false
       },
       Buffer.alloc(8, 0)
     )).rejects.toThrow()
   })
   ```

5. **事件处理**

   ```typescript
   test('event handling', async () => {
     const messageHandler = jest.fn()
     client.attachCanMessage(messageHandler)
     
     // Trigger some events
     await client.writeBase(3, {
       idType: CAN_ID_TYPE.STANDARD,
       brs: false,
       canfd: false,
       remote: false
     }, Buffer.alloc(8, 0))
     
     // Verify event handling
     expect(messageHandler).toHaveBeenCalled()
     
     client.detachCanMessage(messageHandler)
   })
   ```

### 3) 测试配置

确保使用不同的配置进行测试：

- 标准 CAN 与 CAN FD
- 不同的比特率
- 不同的消息类型（标准/扩展）
- 不同的数据长度
- 错误条件和恢复
- 超时场景
- 资源清理

### 4. 运行测试

使用以下命令运行测试：

```bash
npm test
# or
vitest test/docan/${adapter_name}.test.ts
```

请记住：

- 如果您的适配器支持多个平台，请在不同平台上进行测试
- 使用不同的硬件配置进行测试
- 测试错误条件和恢复场景
- 在高消息速率下测试性能
- 测试长时间运行操作的稳定性
- 测试资源清理和内存泄漏
- 测试并发操作
- 测试超时处理

---

## 在 UI 中添加

1. 在 `src/main/share/can.ts` 中编辑供应商

   ```typescript
   export type CanVendor = 'peak' | 'simulate' | 'zlg' | 'kvaser' |  'toomoss'| 'your_adapter_name'
   ```

2. 在 `src/main/docan/can.ts` 中添加设备
   您应编辑以下函数：
   - `openCanDevice`
   - `getCanVersion`
   - `getCanDevices`
   - `canClean`

3. 在 `src/renderer/src/views/uds/components/hardware.vue` 中添加设备

   ```typescript
   function buildTree() {
     const t: tree[] = []
     const zlg: tree = {
       label: 'ZLG',
       vendor: 'zlg',
       append: false,
       id: 'ZLG',
       children: []
     }
     t.push(zlg)
     addSubTree('zlg', zlg)
     // add your device here
     const your_device: tree = {
       label: 'your_device_name',
       vendor: 'your_adapter_name',
       append: false,
       id: 'your_device_id',
       children: []
     }
     t.push(your_device)
     addSubTree('your_adapter_name', your_device)
   }
   ```

4. 然后几乎完成，您可以在 `Device` 窗口中配置您的设备
