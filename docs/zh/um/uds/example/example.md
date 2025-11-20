# UDS启动加载器实施指南

## 概览

本指南展示了如何使用EcuBus-Pro和S32K144微控制器实现完整的 UDS (统一诊断服务) 引导器。 示例覆盖从初始配置到脚本实现的整个固件更新过程。

## 项目配置

### 硬件和通信设置

- 配置下面的硬件>设备接口，选择叶V3。 其他CAN 卡配置相似，只需确保波特率为500K。

> [!注意]
> 所有支持的 CAN 设备: [CAN 设备](./../../can/can.md)

![硬件设备配置](images/01-hardware-device-config.png)

- 您可以根据实际条件选择相应的取样点。

![采样点配置](images/02-sampling-point-config.png)

- 设置地址模式。 S32K144 Official CAN UDS Bootloader 示例使用正常固定地址，配置如下。

![处理模式配置](images/03-addressing-mode-config.png)

### 诊断服务配置

#### 诊断会话控制 (诊断会话控制) (10) 服务

- 输入扩展会话的配置：

![扩展会话配置](images/04-extended-session-config.png)

- 输入编程会话的配置：

![编程会话配置](images/05-programming-session-config.png)

#### ECUReset (ECU Reset) ($11) Service

- 硬件重置配置如下, 在这里使用硬件重置.

![硬件重置配置](images/06-hardware-reset-config.png)

#### 安全进入（安全存取）（27美元）

- 种子请求配置如下。 您需要输入响应接口并将安全种子长度更改为128比特， 否则您将无法收到MCU回复的完整种子数据。

![安全种子请求配置](images/07-security-seed-request-config.png)

- 密钥响应配置如下。 数据段的大小将在脚本中更改为128位并填充计算出来的密钥。

![安全密钥响应配置](images/08-security-key-response-config.png)

#### 通信控制（通信控制）（28美元）

- 禁用网络管理消息和正常消息收发器，配置如下。

![通信控制配置](images/09-communication-control-config.png)

#### WriteDataBIdentifier (Wriite Data by Identifier) (2E) 服务

- 写入指定的DID。 S32K144 官方CAN UDS Bootloader 示例使用0xF15A, 配置如下：

![按标识符写入数据配置](images/10-write-data-by-identifier-config.png)

#### 经常控制（经常管控）（31）

- 例行ID 0x0202的常规用于通知MCU 以进行 CRC 验证，配置如下：

![常规控制配置](images/11-routine-control-crc-config.png)

- 例行ID 0xFF00的常规用于通知 MCU 执行Flasher，配置如下。

![Flash 擦除配置](images/12-routine-control-flash-erase-config.png)

- 例行ID 0xFF01用于通知MCU 以进行固件验证，配置如下：

![固件验证配置](images/13-routine-control-firmware-check-config.png)

#### 请求下载 (请求下载) (34) 服务

- 请求下载配置如下。 在实际使用期间，存储地址和存储空间将在脚本中分配。

![请求下载配置](images/14-request-download-config.png)

#### 传输数据(传输数据)(36美元)

- 传输数据配置如下。 在实际使用期间，它将在脚本中反复被调用和分配值。

![传输数据配置](images/15-transfer-data-config.png)

#### 请求转出出境(请求转出出境)(37)

- 停止传输配置如下。

![请求转移退出配置](images/16-request-transfer-exit-config.png)

#### 作业功能

> 什么是工作？ 职位是一种在EcuBus-Pro的抽象服务。 当使用作业时，必须有相应的脚本。 通过脚本，作业返回已实现。 作业返回要求是一个数组，它可以是 0-N 正常的UDS服务或工作。 Jobs通常用于固件下载、上传和其他需要多个未知数量0x36服务的场景。 但也可以用于你想要的任何其他情况。

添加空的 JobFunction0 和 JobFunction1 以便于通过脚本合并与下载相关的服务。

![JobFunction 配置](images/17-job-function-config.png)

### 序列配置

整个UDS升级过程已配置为如下图表所示(仅供参考)：

![序列配置](images/18-sequence-config.png)

主要分为三个阶段：

`编程前阶段：`

1. 输入延伸会话通过 $10 服务;
2. 通过 $28 服务禁用网络管理消息和正常消息收发器

`编程阶段：`

1. 通过10美元服务进入编程会话；
2. 通过 $27 服务请求种子和返回计算的密钥，成功通过验证；
3. 通过 $2 E 服务写入指定的DID (0xF15A)
4. 通过 $34服务启动闪存驱动程序下载请求；
5. 通过$36服务传输闪存驱动程序。
6. 通过37美元服务结束转账；
7. 通知 MCU 通过 $31 服务进行CRC 验证和闪光擦除
8. 通过 $34 服务启动APP 下载请求；
9. 将APP转账到36美元服务；
10. 通过37美元服务结束转账；
11. 通过 $31 服务通知进行CRC 验证和固件检查；

`编程后阶段：`

1. 执行硬件重置到 $11 服务

## 二． 执行情况

### 开发环境设置

- 在项目目录中创建一个新的 ts文件;

![创建新TS 文件](images/19-create-ts-file.png)

- 将升级所需的文件放入项目目录；

![将文件放入项目目录](images/20-place-upgrade-files.png)

- 在 UDS 测试程序中加载脚本文件，并为脚本写入打开VS 代码；

![在UDS测试器中加载脚本文件](images/21-load-script-vscode.png)

### 脚本开发

#### 导入必要的模块

```typescript
// 导入必要模块
从 'crypto'
导入 { CRC, DiagRequest, DiagResponse } 从 'ECB'
导入路径从 'path'
从 'fs/promotes' 导入fs
```

#### 准备所需的 CRC 算法和相关变量

```typescript
// 创建 CRC 实例, 配置参数: 输入 'self', 16 位, 多项, 初始值0x3d65, 初始值, XOR 值 0xff, input/output reference
const crc = new CRC('self', 16, 0x3d65, 0, 0xff, true true)
// 初始化最大区块大小，初始值未定义的
let maxChunkSize: 数字 | 未定义的
// 初始化文件内容缓冲区， 初始值未定义
让内容：未定义 | 缓存= 未定义
```

#### 固件文件配置

```typescript
// 定义文件列表，包含每个文件的起始地址和文件路径
const fileList: {
  addr: number
  file: string
}[] = [
  {
    // 第一个文件的起始地址
    addr:0x1FFF8010,
    // 第一个文件的路径，从项目根目录、bin文件夹和文件名拼接而成
    file: path.join(process.env.PROJECT_ROOT, 'bin', 'flash_api.bin')
  },
  {
    // 第二个文件的起始地址
    addr:0x00014200,
    // 第二个文件的路径，从项目根目录、bin文件夹和文件名拼接而成
    file: path.join(process.env.PROJECT_ROOT, 'bin', 'S32k144_UDS_Bootloader_App_Test.bin')
  }
]
```

#### 安全访问实现

```typescript
/**
 * 监听安全访问响应事件，加密接收到的安全种子并发送响应请求
 * @param v - 安全访问响应对象
 */
Util.On('S32K144_CAN_UDS_Bootloader.SecurityAccess390.recv', async (v) => { 
  // 从响应中获取安全种子数据
  const data = v.diagGetParameterRaw('securitySeed')
  // 使用固定密钥和零初始化向量创建AES-128-CBC密码器
  const cipher = crypto.createCipheriv(
    'aes-128-cbc',
    Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
    Buffer.alloc(16, 0)
  )
  // 加密安全种子数据
  const encrypted = cipher.update(data)
  // 完成加密操作
  cipher.final()
  // 创建安全访问响应请求对象
  const req = DiagRequest.from('S32K144_CAN_UDS_Bootloader.SecurityAccess391')
  // 将请求参数'data'的原始值设置为加密数据
  req.diagSetParameterRaw('data', encrypted)
  // 发起服务变更请求
  await req.changeService()
})
```

#### 作业功能0 实现 - 下载请求和 CRC 验证

```typescript
/**
 * 注册作业函数0，处理文件下载请求和CRC验证请求
 */
Util.Register('S32K144_CAN_UDS_Bootloader.JobFunction0', async () => {
  // 从文件列表中取出第一个文件项
  const item = fileList.shift()
  if (item) {
    // 创建请求下载诊断请求对象
    const r34 = DiagRequest.from('S32K144_CAN_UDS_Bootloader.RequestDownload520')
    // 创建4字节缓冲区来存储内存地址
    const memoryAddress = Buffer.alloc(4)
    // 以大端字节序将文件起始地址写入缓冲区
    memoryAddress.writeUInt32BE(item.addr)
    // 将请求参数'memoryAddress'的原始值设置为内存地址缓冲区
    r34.diagSetParameterRaw('memoryAddress', memoryAddress)
    // 异步读取文件内容到缓冲区
    content = await fs.readFile(item.file)
    // 计算文件内容的CRC值
    const crcResult = crc.compute(content)
    // 为CRC验证创建例程控制诊断请求对象
    const crcReq = DiagRequest.from('S32K144_CAN_UDS_Bootloader.RoutineControl490')
    // 创建4字节缓冲区来存储CRC结果
    const crcBuffer = Buffer.alloc(4)
    // 以大端字节序将CRC结果写入缓冲区的最后2个字节
    crcBuffer.writeUInt16BE(crcResult, 2)
    // 将例程控制选项记录参数大小设置为4字节（32位）
    crcReq.diagSetParameterSize('routineControlOptionRecord', 4 * 8)
    // 将例程控制选项记录参数的原始值设置为CRC结果缓冲区
    crcReq.diagSetParameterRaw('routineControlOptionRecord', crcBuffer)
    // 发起例程控制服务请求
    await crcReq.changeService()

    // 将请求下载诊断请求对象的'memorySize'参数设置为文件内容长度
    r34.diagSetParameter('memorySize', content.length)
    // 监听请求下载诊断请求响应事件
    r34.On('recv', (resp) => {
      // 从响应中获取最大块长度参数，并将其第一个字节读取为最大分块大小
      maxChunkSize = resp.diagGetParameterRaw('maxNumberOfBlockLength').readUint8(0)
    })
    // 返回包含请求下载诊断请求对象的数组
    return [r34]
  } else {
    // 如果文件列表为空，返回空数组
    return []
  }
})
```

#### JobFunction1 Implementation - Data Transfer and Completion

```typescript
/**
 * 注册作业函数1，处理文件分块传输请求和传输退出请求
 */
Util.Register('S32K144_CAN_UDS_Bootloader.JobFunction1', () => {
  // 检查最大分块大小是否未定义或太小
  if (maxChunkSize == undefined || maxChunkSize <= 2) {
    // 如果条件不满足，抛出错误
    throw new Error('maxNumberOfBlockLength未定义或太小')
  }
  if (content) {
    // 从最大分块大小中减去2
    maxChunkSize -= 2
    // 确保最大分块大小是8的倍数
    if (maxChunkSize & 0x07) {
      maxChunkSize -= maxChunkSize & 0x07
    }
    // 计算文件内容所需的分块数量
    const numChunks = Math.ceil(content.length / maxChunkSize)
    // 初始化数组来存储传输请求对象
    const list = []
    // 循环为每个分块生成传输请求
    for (let i = 0; i < numChunks; i++) {
      // 计算当前分块的起始位置
      const start = i * maxChunkSize
      // 计算当前分块的结束位置，不超过文件内容长度
      const end = Math.min(start + maxChunkSize, content.length)
      // 从文件内容中提取当前分块
      const chunk = content.subarray(start, end)

      // 创建传输数据诊断请求对象
      const transferRequest = DiagRequest.from('S32K144_CAN_UDS_Bootloader.TransferData540')
      // 将传输请求参数记录大小设置为当前分块字节数
      transferRequest.diagSetParameterSize('transferRequestParameterRecord', chunk.length * 8)
      // 将传输请求参数记录的原始值设置为当前分块
      transferRequest.diagSetParameterRaw('transferRequestParameterRecord', chunk)

      // 计算块序列号（从1开始）
      const blockSequenceCounter = Buffer.alloc(1)
      // 使用循环计数1-255，将块序列号写入缓冲区
      blockSequenceCounter.writeUInt8((i + 1) & 0xff) 
      // 将块序列计数器参数的原始值设置为块序列号缓冲区
      transferRequest.diagSetParameterRaw('blockSequenceCounter', blockSequenceCounter)

      // 将传输请求对象添加到数组
      list.push(transferRequest)
    }
    // 创建请求传输退出诊断请求对象
    const r37 = DiagRequest.from('S32K144_CAN_UDS_Bootloader.RequestTransferExit550')
    // 将传输请求参数记录大小设置为0
    r37.diagSetParameterSize('transferRequestParameterRecord', 0)
    // 将请求传输退出诊断请求对象添加到数组
    list.push(r37)
    // 清除文件内容缓冲区
    content = undefined
    // 将最大分块大小重置为未定义
    maxChunkSize = undefined
    // 返回包含所有传输请求和传输退出请求的数组
    return list
  } else {
    // 如果文件内容缓冲区为空，返回空数组
    return []
  }
})
```

---

- 这一例子是在汽车应用中安装UDS引导器的基础。 根据您特定的项目要求自定义配置和脚本。\*
