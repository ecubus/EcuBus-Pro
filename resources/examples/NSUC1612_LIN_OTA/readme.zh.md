# NSUC1612 LIN OTA 示例

本示例演示如何使用基于LIN-TP的LIN-UDS（统一诊断服务）协议，通过LIN（本地互连网络）在NSUC1612 ECU上执行空中固件更新。

> [!INFO]
> NSUC1612系列是一款专用处理器芯片，集成了4通道/3通道半桥驱动器，适用于控制低功率电机。 它可以驱动有刷直流电机、无刷直流电机、步进电机等，在汽车行业广泛应用。

## 概述

本示例包括：

- 用于通信的LIN-TP
- 加载dll安全访问密钥生成
- 在 `tester.ts` 中计算固件CRC校验和

## 文件结构

```text
NSUC1612_LIN_OTA/
├── NSUC1612_LIN_OTA.ecb     # 主项目配置
├── tester.ts                # TypeScript测试脚本
├── readme.md                # 本文档
├── firmware/
│   └── project_rom_boot.bin # 固件二进制文件
├── algorithm/
│   └── GenerateKeyEx.dll    # 安全访问密钥生成
└── System32/
    ├── ucrtbased.dll        # 运行时库
    └── vcruntime140d.dll
```

## 使用方法

1. **硬件设置**：将您的[LinCable](https://app.whyengineer.com/docs/um/hardware/lincable.html)设备连接到COM5（或更新配置）
2. **ECU连接**：确保NSUC1612 ECU通过LIN总线连接
3. **运行测试**：执行测试脚本以执行OTA验证

## 代码示例

```typescript
// Read firmware file
const fw = path.join(process.env.PROJECT_ROOT, 'firmware', 'project_rom_boot.bin')
const content = await fs.readFile(fw)

// Calculate CRC32_JAMCRC checksum
const crc = CRC.buildInCrc('CRC32_JAMCRC')
const crcValue = crc.computeBuffer(content)

// Create and execute diagnostic service
const service = DiagRequest.from('NSUC1612_LIN_UDS_Tester.RoutineControl_routineID$F001')
service.diagSetParameterRaw('routineControlOptionRecord', crcValue)
await service.changeService()
```
