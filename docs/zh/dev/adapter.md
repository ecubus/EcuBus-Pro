# 如何开发新的适配器

`Lin` 适配器与 `Can` 适配器类似，因此您可以参考 `Can` 适配器进行开发。

## 参考 Pull Request

您可能可以从以下 PR 中获得一些参考：

- [#137](https://github.com/ecubus/EcuBus-Pro/pull/137) - Vector Can

## 傻瓜式教程

详细步骤请参见：[分步开发指南](./adapter/detail.md)

## 前置条件

- [node-gyp](https://github.com/nodejs/node-gyp)：用于构建原生模块
- [napi](https://nodejs.org/api/n-api.html)：Node.js 原生 API
- [swig](https://www.swig.org/)：简化封装和接口生成器（Simplified Wrapper and Interface Generator）

---

## 创建适配器文件夹

请将您的适配器创建在以下目录中：

```text
src/main/docan/${adapter_name}
```

## 目录结构

每个适配器目录应遵循以下结构：

```text
${adapter_name}/
├── index.ts           # 主要的适配器实现文件
├── swig/              # SWIG 接口定义
│   ├── ${adapter_name}.i    # 主 SWIG 接口文件
│   ├── buffer.i             # 缓冲区处理接口
│   └── s.bat                # 构建脚本
├── inc/               # C/C++ 头文件
└── lib/               # 第三方库文件
```

---

## SWIG 接口实现

SWIG 接口是连接 JavaScript/TypeScript 与原生 C/C++ 代码的关键。以下是实现方法：

### 1. 主接口文件 (`${adapter_name}.i`)

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

// 定义缓冲区处理的类型映射
%include "./buffer.i"

%typemap(in) (void *data, size_t length) = (const void* buffer_data, const size_t buffer_len);

// 定义指针和数组类
%include <cpointer.i>
%pointer_class(unsigned long, JSUINT64)
%pointer_class(long, JSINT64)
%array_class(uint8_t, ByteArray);

%init %{
  // 添加初始化代码
%}
```

### 2. 缓冲区接口 (`buffer.i`)

创建用于处理二进制数据的缓冲区接口文件：

```swig
%typemap(in) (const size_t buffer_len, const void* buffer_data) {
  if ($input.IsBuffer()) {
    Napi::Buffer<char> buf = $input.As<Napi::Buffer<char>>();
    $2 = reinterpret_cast<void *>(buf.Data());
    $1 = buf.ByteLength();
  } else {
    SWIG_exception_fail(SWIG_TypeError, "在方法 '$symname' 中，参数不是 Buffer");
  }
}
```

### 3. 构建脚本 (`s.bat`)

创建用于生成 SWIG 封装代码的构建脚本：

```bat
swig -I"./../inc" -c++ -javascript -napi -v ./${adapter_name}.i
```

## SWIG 实现要点

1. **类型映射**
   - 使用 `%typemap` 实现 C/C++ 与 JavaScript 之间的类型转换
   - 正确处理缓冲区和指针
   - 考虑二进制数据的字节序（endianness）
  
2. **头文件包含**
   - 包含系统和库的头文件
   - 使用 `%header %{ ... %}` 插入 C/C++ 代码
   - 使用 `%include` 包含 SWIG 接口文件

3. **错误处理(SWIG)**
   - 在 `typemap` 中实现错误检查
   - 使用 `SWIG_exception_fail` 抛出错误
   - 谨慎处理内存管理

4. **模块初始化**

   - 使用 `%init %{ ... %}` 进行初始化
   - 注册回调函数（如有需要）
   - 初始化全局变量

### 常用 SWIG 指令

| 指令 | 说明 |
|------|------|
| `%module name` | 定义模块名称 |
| `%include file` | 包含 SWIG 接口文件 |
| `%header %{ ... %}` | 插入 C/C++ 代码 |
| `%typemap(...)` | 定义类型映射 |
| `%pointer_class(...)` | 定义指针类 |
| `%array_class(...)` | 定义数组类 |

---

## 基类实现

所有适配器必须继承自 `CanBase` 抽象类，并实现以下必需方法：

```ts
abstract class CanBase {
  abstract info: CanBaseInfo;           // 适配器基本信息
  abstract log: CanLOG;                 // 日志对象
  abstract close(): void;               // 关闭适配器
  abstract readBase(...): Promise<...>; // 读取 CAN 消息
  abstract writeBase(...): Promise<...>;// 写入 CAN 消息
  abstract getReadBaseId(...): string;  // 获取读取 ID
  abstract setOption(...): void;        // 设置选项
  abstract event: EventEmitter;         // 事件发射器
}
```

### 必需的静态方法

每个适配器类必须实现以下静态方法：

- `getValidDevices()`：返回可用设备列表
- `getLibVersion()`：返回库版本信息
- `getDefaultBitrate()`：返回默认波特率配置

---

## 实现步骤

1. 创建适配器目录结构
2. 实现 SWIG 接口以封装原生库
3. 创建适配器类并继承 `CanBase`
4. 实现所有必需的抽象方法
5. 实现静态方法
6. 添加错误处理和日志记录
7. 实现事件处理机制
8. 在 `close()` 方法中实现正确清理
9. 实现完善的错误传播机制

---

## 示例：KVASER_CAN 适配器

```ts
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
    // 实现读取逻辑
  }

  async writeBase(id: number, msgType: CanMsgType, data: Buffer): Promise<number> {
    // 实现写入逻辑
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

---

## 测试

实现适配器后，应在 `test/docan` 目录下创建测试文件 `${adapter_name}.test.ts`。以下是测试实现方式：

### 1. 测试准备

```ts
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
    // 清理资源
    client.close()
  })
})
```

### 2. 测试用例

执行以下测试用例：

#### 1. 基本操作

```ts
test('基本操作', async () => {
  // 测试适配器初始化
  expect(client.info).toBeDefined()
  expect(client.info.name).toBe('test')

  // 测试设备能力
  const devices = await YOUR_ADAPTER.getValidDevices()
  expect(devices.length).toBeGreaterThan(0)

  // 测试版本信息
  const version = await YOUR_ADAPTER.getLibVersion()
  expect(version).toBeDefined()
})
```

#### 2. 消息传输

```ts
test('消息传输', async () => {
  // 测试单帧传输
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

  // 测试读取操作
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

#### 3. 多帧传输

```ts
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

#### 4. 错误处理

```ts
test('错误处理', async () => {
  // 测试无效参数
  await expect(client.writeBase(
    -1, // 无效的 CAN ID
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

#### 5. 事件处理

```ts
test('事件处理', async () => {
  const messageHandler = jest.fn()
  client.attachCanMessage(messageHandler)

  // 触发一些事件
  await client.writeBase(3, {
    idType: CAN_ID_TYPE.STANDARD,
    brs: false,
    canfd: false,
    remote: false
  }, Buffer.alloc(8, 0))

  // 验证事件是否被处理
  expect(messageHandler).toHaveBeenCalled()
  client.detachCanMessage(messageHandler)
})
```

### 3. 测试配置

确保测试以下不同配置：

- 标准 CAN vs CAN FD
- 不同波特率
- 不同消息类型（标准/扩展）
- 不同数据长度
- 错误情况与恢复
- 超时场景
- 资源清理

### 4. 运行测试

运行测试命令：

```bash
npm test
# 或
vitest test/docan/${adapter_name}.test.ts
```

### 测试注意事项

- 如果适配器支持多平台，请在不同平台上测试
- 测试不同硬件配置
- 测试错误条件与恢复场景
- 测试高消息速率下的性能
- 测试长时间运行的稳定性
- 测试资源清理和内存泄漏
- 测试并发操作
- 测试超时处理

---

## 添加到 UI

### 1. 编辑厂商列表

在 `src/main/share/can.ts` 中添加您的适配器名称：

```ts
export type CanVendor = 'peak' | 'simulate' | 'zlg' | 'kvaser' | 'toomoss' | 'your_adapter_name'
```

### 2. 添加设备支持

在 `src/main/docan/can.ts` 中编辑以下函数：

- `openCanDevice`
- `getCanVersion`
- `getCanDevices`
- `canClean`

### 3. 添加设备到 UI 树

在 `src/renderer/src/views/uds/components/hardware.vue` 中修改 `buildTree()` 函数：

```ts
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

  // 添加您的设备
  const your_device: tree = {
    label: 'your_device_name',
    vendor: 'your_adapter_name',
    append: false,
    id: 'your_device_id',
    children: []
  }
  t.push(your_device)
  addSubTree('your_adapter_name', your_device)

  return t
}
```

完成以上步骤后，您就可以在`设备`窗口中配置您的设备了。
