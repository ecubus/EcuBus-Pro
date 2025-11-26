# UDS Bootloader 实现指南

## 概述

本指南演示了如何使用 EcuBus-Pro 与 S32K144 微控制器实现完整的 UDS（统一诊断服务）引导加载程序。 该示例涵盖了从初始配置到脚本实现的整个固件更新过程。

## 项目配置

### 硬件与通信设置

- 按如下方式配置硬件>设备接口，选择 Leaf V3。 其他 CAN 卡配置类似，只需确保波特率为 500K。

> [!NOTE]
> 所有支持的 CAN 设备：[CAN 设备](./../../can/can.md)

![硬件设备配置](../../../../media/um/uds/example/images/01-hardware-device-config.png)

- 您可以根据实际情况选择相应的采样点。

![采样点配置](../../../../media/um/uds/example/images/02-sampling-point-config.png)

- 设置寻址模式。 S32K144 官方 CAN UDS Bootloader 示例使用普通固定寻址，配置如下。

![寻址模式配置](../../../../media/um/uds/example/images/03-addressing-mode-config.png)

### 诊断服务配置

#### DiagnosticSessionControl（诊断会话控制）($10) 服务

- 进入扩展会话的配置：

![扩展会话配置](../../../../media/um/uds/example/images/04-extended-session-config.png)

- 进入编程会话的配置：

![编程会话配置](../../../../media/um/uds/example/images/05-programming-session-config.png)

#### ECUReset（ECU 复位）($11) 服务

- 硬件复位配置如下，此处使用硬件复位。

![硬件复位配置](../../../../media/um/uds/example/images/06-hardware-reset-config.png)

#### SecurityAccess（安全访问）($27) 服务

- 种子请求配置如下。 您需要进入响应接口并将 securitySeed 长度更改为 128 位，否则无法接收到 MCU 回复的完整种子数据。

![安全种子请求配置](../../../../media/um/uds/example/images/07-security-seed-request-config.png)

- 密钥响应配置如下。 数据段将在脚本中更改为 128 位，并填充计算出的密钥。

![安全密钥响应配置](../../../../media/um/uds/example/images/08-security-key-response-config.png)

#### CommunicationControl（通信控制）($28) 服务

- 禁用网络管理消息和正常消息收发器，配置如下。

![通信控制配置](../../../../media/um/uds/example/images/09-communication-control-config.png)

#### WriteDataByIdentifier（按标识符写入数据）($2E) 服务

- 写入指定的 DID。 S32K144 官方 CAN UDS Bootloader 示例使用 0xF15A，配置如下：

![按标识符写入数据配置](../../../../media/um/uds/example/images/10-write-data-by-identifier-config.png)

#### RoutineControl（例程控制）($31) 服务

- 使用 routineID 为 0x0202 的例程来通知 MCU 执行 CRC 验证，配置如下：

![例程控制 CRC 配置](../../../../media/um/uds/example/images/11-routine-control-crc-config.png)

- 使用 routineID 为 0xFF00 的例程来通知 MCU 执行 Flash 擦除，配置如下。

![Flash 擦除配置](../../../../media/um/uds/example/images/12-routine-control-flash-erase-config.png)

- 使用 routineID 为 0xFF01 的例程来通知 MCU 执行固件验证，配置如下：

![固件验证配置](../../../../media/um/uds/example/images/13-routine-control-firmware-check-config.png)

#### RequestDownload（请求下载）($34) 服务

- 请求下载配置如下。 存储地址和存储空间将在实际使用过程中在脚本中分配。

![请求下载配置](../../../../media/um/uds/example/images/14-request-download-config.png)

#### TransferData（传输数据）($36) 服务

- 传输数据配置如下。 在实际使用过程中，将在脚本中重复调用并赋值。

![传输数据配置](../../../../media/um/uds/example/images/15-transfer-data-config.png)

#### RequestTransferExit（请求传输退出）($37) 服务

- 停止传输配置如下。

![请求传输退出配置](../../../../media/um/uds/example/images/16-request-transfer-exit-config.png)

#### JobFunction

> 什么是 Job？ Job 是 EcuBus-Pro 中的抽象服务。 使用 Job 时，必须有相应的脚本。 通过脚本实现 Job 的返回。 Job 的返回要求是一个数组，可以是 0-N 个普通 UDS 服务或 Jobs。 Jobs 通常用于固件下载、上传以及其他需要多个未知数量的 0x36 服务的场景，但也可以用于您想要的任何其他情况。

添加空的 JobFunction0 和 JobFunction1，以便通过脚本组合下载相关服务。

![JobFunction 配置](../../../../media/um/uds/example/images/17-job-function-config.png)

### 序列配置

整个 UDS 升级过程配置如下图所示（仅供参考）：

![序列配置](../../../../media/um/uds/example/images/18-sequence-config.png)

主要分为三个阶段：

`预编程阶段：`

1. 通过 $10 服务进入扩展会话；
2. 通过 $28 服务禁用网络管理消息和正常消息收发器；

`编程阶段：`

1. 通过 $10 服务进入编程会话；
2. 通过 $27 服务请求种子并返回计算出的密钥，成功通过验证；
3. 通过 $2E 服务写入指定的 DID (0xF15A)；
4. 通过 $34 服务发起 Flash 驱动下载请求；
5. 通过 $36 服务传输 Flash 驱动；
6. 通过 $37 服务结束传输；
7. 通过 $31 服务通知 MCU 执行 CRC 验证和 Flash 擦除；
8. 通过 $34 服务发起 APP 下载请求；
9. 通过 $36 服务传输 APP；
10. 通过 $37 服务结束传输；
11. 通过 $31 服务通知执行 CRC 验证和固件检查；

`后编程阶段：`

1. 通过 $11 服务执行硬件复位

## 实现

### 开发环境设置

- 在项目目录中创建新的 ts 文件；

![Create New TS File](../../../../media/um/uds/example/images/19-create-ts-file.png)

- 将升级所需的文件放置在项目目录中；

![Place Files in Project Directory](../../../../media/um/uds/example/images/20-place-upgrade-files.png)

- 在 UDS Tester 中加载脚本文件并打开 VS Code 进行脚本编写；

![Load Script File in UDS Tester](../../../../media/um/uds/example/images/21-load-script-vscode.png)

### 脚本开发

#### 导入必要模块

```typescript
// Import necessary modules
import crypto from 'crypto'
import { CRC, DiagRequest, DiagResponse } from 'ECB'
import path from 'path'
import fs from 'fs/promises'
```

#### 准备所需的 CRC 算法及相关变量

```typescript
// Create CRC instance, configure parameters: type 'self', 16 bits, polynomial 0x3d65, initial value 0, XOR value 0xffff, input/output reflection
const crc = new CRC('self', 16, 0x3d65, 0, 0xffff, true, true)
// Initialize maximum chunk size, initial value undefined
let maxChunkSize: number | undefined = undefined
// Initialize file content buffer, initial value undefined
let content: undefined | Buffer = undefined
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

#### JobFunction0 实现 - 下载请求和 CRC 验证

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

#### JobFunction1 实现 - 数据传输和完成

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

\*此示例为在汽车应用中实现 UDS 引导加载程序奠定了基础。 \*请根据您的具体项目需求自定义配置和脚本。
