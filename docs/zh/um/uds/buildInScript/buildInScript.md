# 内置脚本

内置脚本系统为常见 UDS 操作提供预配置的诊断服务。本文档介绍可用的内置脚本及其功能。

## 支持的内置脚本

### [SecureAccessGenerateKeyEx](https://github.com/ecubus/EcuBus-Pro/tree/master/resources/buildInScript/SecureAccessGenerateKeyEx)

此脚本用于在 SecurityAccess 流程中生成密钥。参见 [GenerateKeyEx](https://cdn.vector.com/cms/content/know-how/_application-notes/AN-IDG-1-017_SecurityAccess.pdf)。

```c
VKeyGenResultEx GenerateKeyEx (
  const unsigned char* ipSeedArray,
  unsigned int iSeedArraySize,
  const unsigned int iSecurityLevel,
  const char* ipVariant,
  unsigned char* iopKeyArray,
  unsigned int iMaxKeyArraySize,
  unsigned int& oActualKeyArraySize
);
```

![GenerateKeyEx](./images/GenerateKeyEx.png)

#### GenerateKeyEx接口参数

- **dllFile**
  - DLL 文件路径。该 DLL 必须为 64 位，并且包含 GenerateKeyEx 函数。

```c
VKeyGenResultEx GenerateKeyEx (
  const unsigned char* ipSeedArray,
  unsigned int iSeedArraySize,
  const unsigned int iSecurityLevel,
  const char* ipVariant,
  unsigned char* iopKeyArray,
  unsigned int iMaxKeyArraySize,
  unsigned int& oActualKeyArraySize
);
```

- **requestSeed**
  - 种子请求子功能，取值为 1,3,5,7,9,11,13,15
  - 默认：0x01

- **sendKey**
  - 发送密钥子功能，取值为 2,4,6,8,10,12,14,16
  - 默认：0x02

- **securityLevel**
  - 要解锁的目标安全等级

- **variant**
  - 安全访问流程的变体(或者说是目标ECU的名称)

- **maxKeyArraySize**
  - Key 数组的最大长度

- **securityAccessDataRecord**
  - 在安全访问过程的请求 Seed 阶段，诊断请求中包含的安全访问数据记录通过 RequestSeed 子功能传输至 ECU

### [SecureAccessGenerateKeyExOpt](https://github.com/ecubus/EcuBus-Pro/tree/master/resources/buildInScript/SecureAccessGenerateKeyExOpt)

此脚本用于在 SecurityAccess 流程中生成密钥。参见 [GenerateKeyExOpt](https://cdn.vector.com/cms/content/know-how/_application-notes/AN-IDG-1-017_SecurityAccess.pdf)。

![GenerateKeyExOpt](./images/GenerateKeyExOpt.png)

#### GenerateKeyExOpt接口参数

- **dllFile**
  - DLL 文件路径。该 DLL 必须为 64 位，并且包含 GenerateKeyExOpt 函数。

```c
VKeyGenResultExOpt GenerateKeyExOpt (
  const unsigned char* ipSeedArray,
  unsigned int iSeedArraySize,
  const unsigned int iSecurityLevel,
  const char* ipVariant,
  const char* ipOptions,
  unsigned char* iopKeyArray,
  unsigned int iMaxKeyArraySize,
  unsigned int& oActualKeyArraySize
);
```

- **requestSeed**
  - 种子请求子功能，取值为 1,3,5,7,9,11,13,15
  - 默认：0x01

- **sendKey**
  - 发送密钥子功能，取值为 2,4,6,8,10,12,14,16
  - 默认：0x02

- **securityLevel**
  - 要解锁的目标安全等级

- **variant**
  - 安全访问流程的变体(或者说是目标ECU的名称)

- **options**
  - 安全访问流程的可选参数

- **maxKeyArraySize**
  - Key 数组的最大长度

- **securityAccessDataRecord**
  - 在安全访问过程的请求 Seed 阶段，诊断请求中包含的安全访问数据记录通过 RequestSeed 子功能传输至 ECU

### [RequestDownloadBin](https://github.com/ecubus/EcuBus-Pro/tree/master/resources/buildInScript/RequestDownloadBin)

一个组合服务，通过组合 UDS 服务 0x34（RequestDownload）、0x36（TransferData）与 0x37（TransferExit）,完成完整的Bin文件下载流程。

![RequestDownloadBin](./images/RequestDownloadBin.png)

#### 描述

此脚本将二进制文件下载到 ECU 的流程自动化：

1. 发起下载请求
2. 按合适的分片大小传输数据
3. 完成传输

#### Bin文件下载参数

- **dataFormatIdentifier**（8 位）
  - 待传输数据的格式标识
  - 默认：0x00

- **addressAndLengthFormatIdentifier**（8 位）
  - 指定内存地址与长度的格式
  - 默认：0x44(地址 4 字节，长度 4 字节)

- **memoryAddress**（取决于 addressAndLengthFormatIdentifier）
  - 下载的目标内存地址
  - 默认：0x00000000

- **binFile**
  - 待下载的二进制文件，内存大小会自动根据文件调整

## 创建自定义脚本

可以创建自定义脚本以扩展诊断系统功能。你可以创建并保存自己的脚本，供后续复用。

创建步骤如下：

### 脚本结构

1. **目录准备**
   - 在 `${App Install Path}/resources/app.asar.unpacked/resources/buildInScript/` 下创建新目录
   - 按脚本功能命名（例如 `MyCustomScript`）

2. **必需文件**
   - `plugin.json`：配置文件
   - `index.js`：实现文件

### plugin.json 配置

```json
{
  "service": {
    "name": "MyCustomScript",
    "fixedParam": true,
    "buildInScript": "index.js",
    "hasSubFunction": false,
    "desc": "Description of your script's functionality",
    "defaultParams": [
      {
        "param": {
          "id": "parameterName",
          "name": "parameterName",
          "bitLen": 8,
          "deletable": false,
          "editable": true,
          "type": "NUM",
          "phyValue": "00"
        }
      }
    ],
    "defaultRespParams": []
  }
}
```

### index.js 实现

```javascript
const ECB = require('../../lib/js');

Util.Init(() => {
  const testerName = Util.getTesterName();

  // Register main function
  Util.Register(`${testerName}.MyCustomScript`, async function(parameters) {
    // Create diagnostic requests
    const request = new ECB.DiagRequest(testerName, {
      id: "",
      name: "",
      serviceId: "0xXX",  // Your service ID
      params: [],
      respParams: []
    });

    // Implement your logic here
    
    return [request];
  });
});
```

### 最佳实践

1. **参数定义**
   - 在 plugin.json 中清晰定义参数结构
   - 支持合适的数据类型（NUM、HEX、ASCII、BUFFER、FILE）
   - 设置合理的位长度与可编辑性

2. **响应处理**
   - 定义期望的响应参数
   - 实现响应校验
   - 处理不同的响应场景

### 示例：简单计数脚本

```javascript
// index.js
const ECB = require('../../lib/js');

Util.Init(() => {
  const testerName = Util.getTesterName();

  Util.Register(`${testerName}.CounterScript`, async function(startValue, increment) {
    const request = new ECB.DiagRequest(testerName, {
      id: "counter",
      name: "Counter Service",
      serviceId: "0x22",
      params: [],
      respParams: []
    });

    request.diagSetRaw(Buffer.from([startValue, increment]));
    return [request];
  });
});
```
