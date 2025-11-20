# 内置脚本

内置脚本系统为常见的UDS操作提供预配置的诊断服务。 本文档涵盖可用的内置脚本及其功能。

## 支持的内置脚本

### [SecureAccessGenerateKeyEx](https://github.com/ecubus/EcuBus-Pro/tree/master/resources/buildInScript/SecureAccessGenerateKeyEx)

此脚本用于为安全访问过程生成密钥。 参见[GenerateKeyEx](https://cdn.vector.com/cms/content/know-how/_application-notes/AN-IDG-1-017_SecurityAccess.pdf)。

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

#### 参数 - SecureAccessGenerateKeyEx

- **dllFile**

  - DLL文件的路径，该DLL必须是64位DLL文件并包含GenerateKeyEx函数。

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
  - 请求种子子功能，1,3,5,7,9,11,13,15
  - 默认值：0x01

- **sendKey**
  - 发送密钥子功能，2,4,6,8,10,12,14,16
  - 默认值：0x02

- **securityLevel**
  - 要更改到的安全级别

- **variant**
  - 安全访问过程的变体（诊断接收器ECU的名称）

- **maxKeyArraySize**
  - 最大密钥数组大小

- **securityAccessDataRecord**
  - 请求种子DiagRequest中的安全访问数据记录，该数据将在请求种子子功能中发送到ECU。

### [SecureAccessGenerateKeyExOpt](https://github.com/ecubus/EcuBus-Pro/tree/master/resources/buildInScript/SecureAccessGenerateKeyExOpt)

此脚本用于为安全访问过程生成密钥。 参见[GenerateKeyExOpt](https://cdn.vector.com/cms/content/know-how/_application-notes/AN-IDG-1-017_SecurityAccess.pdf)。

![GenerateKeyExOpt](./images/GenerateKeyExOpt.png)

#### 参数 - SecureAccessGenerateKeyExOpt

- **dllFile**
  - DLL文件的路径，该DLL必须是64位DLL文件并包含GenerateKeyExOpt函数。

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
  - 请求种子子功能，1,3,5,7,9,11,13,15
  - 默认值：0x01

- **sendKey**
  - 发送密钥子功能，2,4,6,8,10,12,14,16
  - 默认值：0x02

- **securityLevel**
  - 要更改到的安全级别

- **variant**
  - 安全访问过程的变体（诊断接收器ECU的名称）

- **options**
  - 安全访问过程的选项

- **maxKeyArraySize**
  - 最大密钥数组大小

- **securityAccessDataRecord**
  - 请求种子DiagRequest中的安全访问数据记录，该数据将在请求种子子功能中发送到ECU。

### [RequestDownloadBin](https://github.com/ecubus/EcuBus-Pro/tree/master/resources/buildInScript/RequestDownloadBin)

一个组合服务，通过编排UDS服务0x34（RequestDownload）、0x36（TransferData）和0x37（TransferExit）来处理完整的二进制下载过程。

![RequestDownloadBin](./images/RequestDownloadBin.png)

#### 描述

此脚本通过以下方式自动化将二进制文件下载到ECU的过程：

1. 发起下载请求
2. 以适当的数据块传输数据
3. 完成传输过程

#### 参数 - RequestDownloadBin

- **dataFormatIdentifier** (8位)
  - 要传输数据的格式标识符
  - 默认值：0x00

- **addressAndLengthFormatIdentifier** (8位)
  - 指定内存地址和长度的格式
  - 默认值：0x44（地址4字节，长度4字节）

- **memoryAddress** (取决于addressAndLengthFormatIdentifier)
  - 下载的目标内存地址
  - 默认值：0x00000000

- **binFile**
  - 要下载的二进制文件，将自动更改内存大小

## 创建自定义脚本

可以创建自定义脚本来扩展诊断系统的功能。 您可以创建并保存自己的脚本，并在将来使用。

以下是创建自定义脚本的方法：

### 脚本结构

1. **目录设置**
   - 在 `${App Install Path}/resources/app.asar.unpacked/resources/buildInScript/` 下创建新目录
   - 根据脚本功能命名（例如 `MyCustomScript`）

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
   - 在 plugin.json 中定义清晰的参数结构
   - 支持适当的数据类型（NUM、HEX、ASCII、BUFFER、FILE）
   - 设置适当的位长度和可编辑性

2. **响应处理**
   - 定义预期的响应参数
   - 实现响应验证
   - 处理不同的响应场景

### 示例：简单计数器脚本

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
