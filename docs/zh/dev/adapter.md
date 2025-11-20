# 如何开发新的适配器

`Lin`适配器类似于`Can`适配器，所以你可以引用`Can`适配器来促进发展。

## 引用拉取请求

您也许能够从这些PR中获得一些引用：

- [#137](https://github.com/ecubus/EcuBus-Pro/pull/137) - 矢量can

## 一步一步指南

您可以从[分步指南](./adapter/detail.md)中获取详细步骤

## 必备条件

- [node-gyp](https://github.com/nodejs/node-gyp) - 构建本机模块
- [napi](https://nodejs.org/api/n-api.html) - Node.js 本机API
- [swig](https://www.swig.org/) - 简化包装器和接口生成器

---

## 创建适配器文件夹

在以下目录创建您的适配器：

```text
src/main/docan/${adapter_name}
```

## 目录结构

每个适配器目录应遵循此结构：

```text
${adapter_name}/
├── index.ts           # 主适配器实现文件
├── swig/             # SWIG 接口定义
│   ├── ${adapter_name}.i    # 主SWIG接口文件
│   ├── buffer.i            # 缓冲区处理接口
│   └── s.bat               # 构建脚本
├── inc/              # C/C++头文件
└── lib/              # 第三方库文件
```

---

## SWIG 界面实现

SWIG 接口对于连接JavaScript/TypeScript和原生的 C/C++ 代码至关重要。 下面是如何实现它：

### 1. 主接口文件 (${adapter_name}.i)

在 `swig` 目录中创建一个主接口文件：

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

// 为缓冲区处理定义类型映射
%include "./buffer.i"
%typemap(in) (void *data, size_t length) = (const void* buffer_data, const size_t buffer_len);

// 定义指针和数组类
%include <cpointer.i>
%pointer_class(unsigned long, JSUINT64)
%pointer_class(long, JSINT64)
%array_class(uint8_t, ByteArray);

%init %{
  // 在此处添加初始化代码
%}
```

### 2. 缓冲接口 (buffer.i)

创建处理二进制数据的缓冲界面文件：

```swig
%typemap(in) (const size_t buffer_len,const void* buffer_data) {
  if ($input.IsBuffer()) {
    Napi::Buffer<char> buf = $input.As<Napi::Buffer<char>>();
    $2 = reinterpret_cast<void *>(buf.Data());
    $1 = buf.ByteLength();
  } else {
    SWIG_exception_fail(SWIG_TypeError, "在方法 '$symname' 中，参数不是 Buffer");
  }
}
```

### 3. 编译脚本 (s.bat)

创建一个构建脚本以生成 SWIG 包装器：

```batch
swig -I"./../inc" -c++ -javascript -napi -v ./${adapter_name}.i 
```

### SWIG 实施工作的关键要点

1. **输入映射**
   - 使用 %typemap\` 进行C/C++ 到 JavaScript 类型转换
   - 正确处理缓冲区和指针
   - 考虑二进制数据的耐力

2. **标题包含**
   - 包括系统和库标题
   - 使用%header %}... %}\` c/C++ 代码
   - 在 SWIG 接口中使用%inclande\`

3. **错误处理**
   - 在键盘中实现错误
   - 使用 `SWIG_exception_fail` 作为错误
   - 认真处理内存管理

4. **Module Initialization**
   - 使用%init %□ ... %}\` 用于设置代码
   - 必要时注册回调
   - 初始化全局变量

### 共同的 SWIG 指令

```swig
%module name          // 定义模块名称
%include file         // 包含SWIG接口
%header %{ ... %}     // 包含C/C++代码
%typemap(...) ...     // 定义类型映射
%pointer_class(...)   // 定义指针类
%array_class(...)     // 定义数组类
```

---

## 基础类实现

所有适配器必须继承`CanBase`抽象类，并执行以下所需方法：

```typescript
abstract class CanBase {
  abstract info: CanBaseInfo;           // 适配器基本信息
  abstract log: CanLOG;                 // 日志对象
  abstract close(): void;               // 关闭适配器
  abstract readBase(...): Promise<...>; // 读取CAN消息
  abstract writeBase(...): Promise<...>;// 写入CAN消息
  abstract getReadBaseId(...): string;  // 获取读取ID
  abstract setOption(...): void;        // 设置选项
  abstract event: EventEmitter;         // 事件发射器
}
```

## 所需静态方法

每个适配器类必须实现以下静态方法：

- `getValidDevices()`: 返回可用设备列表
- `getLibVersion()`: 返回库版本信息
- `getDefaultBitrate()`: 返回默认比特率配置

---

## 执行步骤

1. 创建适配器目录结构
2. 实现 SWIG 接口来包装本地库
3. 创建适配器类并继承`CanBase`
4. 执行所有所需的抽象方法
5. 实现静态方法
6. 添加错误处理和日志记录
7. 实现事件处理机制
8. 在 close() 方法中添加适当的清理
9. 进行适当的错误传播

---

## 示例： KVASER_CAN 适配器

来自 `kvaser` 适配器的参考实现：

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
    // 初始化原生资源
  }

  async readBase(id: number, msgType: CanMsgType, timeout: number): Promise<{ data: Buffer; ts: number }> {
    // 实现
  }

  async writeBase(id: number, msgType: CanMsgType, data: Buffer): Promise<number> {
    // 实现
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.readAbort.abort();
    // 清理原生资源
  }

  // ... 其他方法
}
```

适配器

## 测试

实现适配器后，您应该在 `test/docan` 目录中创建一个测试文件(`${adapter_name}.test.ts`)。 下面是如何实现测试：

### 1. 测试设置

```typescript
import { describe, it, beforeAll, afterAll, test } from 'vitest'
import * as path from 'path'

// 加载原生库
const dllPath = path.join(__dirname, '../../resources/lib')
YOUR_ADAPTER.loadDllPath(dllPath)

describe('适配器测试', () => {
  let client!: YOUR_ADAPTER
  
  beforeAll(() => {
    // 使用测试配置初始化适配器
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
    // 清理
    client.close()
  })
})
```

### 2. 测试案件

执行以下测试案例：

1. **基本操作**

   ```typescript
   test('basic operations', async () => Power
     // Test adapter initialization
     expect(client.info).toBeDefined()
     expect(client). nfo.name).toBe('test')
     
     // 测试设备能力
     const 设备 = 等待YOUR_ADAPTER。 etValidDevices()
     exped(devices.length).toBeGreaterThan(0)
     
     // 测试版本信息
     const version = 等待YOUR_ADAPTER。 etLibVersion()
     exped(version).toBeDefined()
   })
   ```

2. **消息传送**

   ```typescript
   test('message transmission', async () => Power
     // 测试单帧transmission
     const results = 等待客户端。 ReteBase(
       3, // CAN ID
       *
         idType: CAN_ID_TYPE。 TANDARD,
         brs: false,
         can false,
         远程: false
       },
       缓存。 lloc(8, 0)
     (
     预期(结果)。 oBeDefined()
     
     // 测试读取操作
     const readresult = 等待客户端。 eadBase(3, por
       idType: CAN_ID_TYPE. TANDARD,
       brs: false,
       can false,
       远程: false
     }, 1000)
     预期(readResult)。 oBeDefined()
     exped(readResult.data).toBeDefined()
   })
   ```

3. **多帧传输**

   ```typescript
   test('多帧传输', async () => {
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
   test('错误处理', async () => {
     // 测试无效参数
     await expect(client.writeBase(
       -1, // 无效的CAN ID
       {
         idType: CAN_ID_TYPE.STANDARD,
         brs: false,
         canfd: false,
         remote: false
       },
       Buffer.alloc(8, 0)
     )).rejects.toThrow()
     
     // 测试已关闭的适配器
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
   test('event handling', async () => Power
     const messageHandler = jest.fn()
     client. tachCanMessage(messageHandler)
     
     // 触发一些事件
     正在等待client.writeBase(3, vol.
       idType: CAN_ID_TYPE。 TANDARD,
       brs: false,
       can false,
       远程: false
     }, 缓存. lloc(8, 0))
     
     // 验证处理
     expected (messageHandler) oHaveBeenCalled()
     
     client.detachCanMessage(messageHandler)
   })
   ```

### 3) 测试配置

请确保测试不同的配置：

- 标准CAN vs CAN FD
- 不同比特率
- 不同的消息类型 (标准/扩展)
- 不同的数据长度
- 错误条件和恢复
- 超时场景
- 资源清理

### 4. 正在运行测试

运行测试使用：

```bash
npm test
# 或
vitest test/docan/${adapter_name}.test.ts
```

记住：

- 如果您的适配器支持多个平台，请在不同平台上测试
- 测试使用不同的硬件配置
- 测试错误条件和恢复方案
- 测试性能高消息率
- 测试长期的稳定性操作
- 测试资源清理和内存丢失
- 测试并行操作
- 测试超时处理

---

## 在界面中添加

1. 编辑`src/main/shar/can.ts`

   ```typescript
   导出类型 CanVendor = '高峰' | '模拟' | 'zlg' | 'kvaser' | 'toomoss'| 'your_adapter_name'
   ```

2. 在 `src/main/docan/can.ts` 中添加设备
   您应该编辑这些函数：
   - `openCanDevice`
   - `getCanVersion`
   - `getCanDevices`
   - `canClean`

3. 在 `src/rc/views/uds/components/hardware.vue` 中添加设备

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
     // 在此处添加您的设备
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

4. 然后几乎完成了，你可以在 `Device` 窗口中配置你的设备
