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

![Write Data By Identifier Configuration](images/10-write-data-by-identifier-config.png)

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

![Load Script File in UDS Tester](images/21-load-script-vscode.png)

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
// Define file list, containing start address and file path for each file
const fileList: {
  addr: number
  file: string
}[] = [
  {
    // Start address of the first file
    addr:0x1FFF8010,
    // Path of the first file, joined from project root directory, bin folder and filename
    file: path.join(process.env.PROJECT_ROOT, 'bin', 'flash_api.bin')
  },
  {
    // Start address of the second file
    addr:0x00014200,
    // Path of the second file, joined from project root directory, bin folder and filename
    file: path.join(process.env.PROJECT_ROOT, 'bin', 'S32k144_UDS_Bootloader_App_Test.bin')
  }
]
```

#### 安全访问实现

```typescript
/**
 * Listen to security access response event, encrypt received security seed and send response request
 * @param v - Security access response object
 */
Util.On('S32K144_CAN_UDS_Bootloader.SecurityAccess390.recv', async (v) => { 
  // Get security seed data from response
  const data = v.diagGetParameterRaw('securitySeed')
  // Create AES-128-CBC cipher with fixed key and zero initialization vector
  const cipher = crypto.createCipheriv(
    'aes-128-cbc',
    Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
    Buffer.alloc(16, 0)
  )
  // Encrypt security seed data
  const encrypted = cipher.update(data)
  // Complete encryption operation
  cipher.final()
  // Create security access response request object
  const req = DiagRequest.from('S32K144_CAN_UDS_Bootloader.SecurityAccess391')
  // Set request parameter 'data' raw value to encrypted data
  req.diagSetParameterRaw('data', encrypted)
  // Initiate service change request
  await req.changeService()
})
```

#### 作业功能0 实现 - 下载请求和 CRC 验证

```typescript
/**
 * Register job function 0, handle file download requests and CRC verification requests
 */
Util.Register('S32K144_CAN_UDS_Bootloader.JobFunction0', async () => {
  // Take the first file item from the file list
  const item = fileList.shift()
  if (item) {
    // Create request download diagnostic request object
    const r34 = DiagRequest.from('S32K144_CAN_UDS_Bootloader.RequestDownload520')
    // Create 4-byte buffer to store memory address
    const memoryAddress = Buffer.alloc(4)
    // Write file start address to buffer in big-endian byte order
    memoryAddress.writeUInt32BE(item.addr)
    // Set request parameter 'memoryAddress' raw value to memory address buffer
    r34.diagSetParameterRaw('memoryAddress', memoryAddress)
    // Asynchronously read file content to buffer
    content = await fs.readFile(item.file)
    // Calculate CRC value of file content
    const crcResult = crc.compute(content)
    // Create routine control diagnostic request object for CRC verification
    const crcReq = DiagRequest.from('S32K144_CAN_UDS_Bootloader.RoutineControl490')
    // Create 4-byte buffer to store CRC result
    const crcBuffer = Buffer.alloc(4)
    // Write CRC result to the last 2 bytes of buffer in big-endian byte order
    crcBuffer.writeUInt16BE(crcResult, 2)
    // Set routine control option record parameter size to 4 bytes (32 bits)
    crcReq.diagSetParameterSize('routineControlOptionRecord', 4 * 8)
    // Set routine control option record parameter raw value to CRC result buffer
    crcReq.diagSetParameterRaw('routineControlOptionRecord', crcBuffer)
    // Initiate routine control service request
    await crcReq.changeService()

    // Set request download diagnostic request object 'memorySize' parameter to file content length
    r34.diagSetParameter('memorySize', content.length)
    // Listen to request download diagnostic request response event
    r34.On('recv', (resp) => {
      // Get maximum block length parameter from response and read its first byte as maximum chunk size
      maxChunkSize = resp.diagGetParameterRaw('maxNumberOfBlockLength').readUint8(0)
    })
    // Return array containing request download diagnostic request object
    return [r34]
  } else {
    // If file list is empty, return empty array
    return []
  }
})
```

#### JobFunction1 Implementation - Data Transfer and Completion

```typescript
/**
 * Register job function 1, handle file chunk transfer requests and transfer exit requests
 */
Util.Register('S32K144_CAN_UDS_Bootloader.JobFunction1', () => {
  // Check if maximum chunk size is undefined or too small
  if (maxChunkSize == undefined || maxChunkSize <= 2) {
    // If condition not met, throw error
    throw new Error('maxNumberOfBlockLength is undefined or too small')
  }
  if (content) {
    // Subtract 2 from maximum chunk size
    maxChunkSize -= 2
    // Ensure maximum chunk size is multiple of 8
    if (maxChunkSize & 0x07) {
      maxChunkSize -= maxChunkSize & 0x07
    }
    // Calculate number of chunks needed for file content
    const numChunks = Math.ceil(content.length / maxChunkSize)
    // Initialize array to store transfer request objects
    const list = []
    // Loop to generate transfer request for each chunk
    for (let i = 0; i < numChunks; i++) {
      // Calculate start position of current chunk
      const start = i * maxChunkSize
      // Calculate end position of current chunk, not exceeding file content length
      const end = Math.min(start + maxChunkSize, content.length)
      // Extract current chunk from file content
      const chunk = content.subarray(start, end)

      // Create transfer data diagnostic request object
      const transferRequest = DiagRequest.from('S32K144_CAN_UDS_Bootloader.TransferData540')
      // Set transfer request parameter record size to current chunk byte count
      transferRequest.diagSetParameterSize('transferRequestParameterRecord', chunk.length * 8)
      // Set transfer request parameter record raw value to current chunk
      transferRequest.diagSetParameterRaw('transferRequestParameterRecord', chunk)

      // Calculate block sequence number (starting from 1)
      const blockSequenceCounter = Buffer.alloc(1)
      // Use cyclic count 1-255, write block sequence number to buffer
      blockSequenceCounter.writeUInt8((i + 1) & 0xff) 
      // Set block sequence counter parameter raw value to block sequence number buffer
      transferRequest.diagSetParameterRaw('blockSequenceCounter', blockSequenceCounter)

      // Add transfer request object to array
      list.push(transferRequest)
    }
    // Create request transfer exit diagnostic request object
    const r37 = DiagRequest.from('S32K144_CAN_UDS_Bootloader.RequestTransferExit550')
    // Set transfer request parameter record size to 0
    r37.diagSetParameterSize('transferRequestParameterRecord', 0)
    // Add request transfer exit diagnostic request object to array
    list.push(r37)
    // Clear file content buffer
    content = undefined
    // Reset maximum chunk size to undefined
    maxChunkSize = undefined
    // Return array containing all transfer requests and transfer exit request
    return list
  } else {
    // If file content buffer is empty, return empty array
    return []
  }
})
```

---

- 这一例子是在汽车应用中安装UDS引导器的基础。 根据您特定的项目要求自定义配置和脚本。\*
