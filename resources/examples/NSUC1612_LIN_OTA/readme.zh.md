# NSUC1612 LIN OTA 示例

本示例演示了如何使用 LIN（本地互连网络）协议和基于 LIN-TP 的统一诊断服务（LIN-UDS）在 NSUC1612 ECU 上执行空中（OTA）固件更新。

> [!INFO]
> NSUC1612 系列是一款集成 4 通道/3 通道半桥驱动器的专用处理器芯片，适用于控制低功率电机。 它可以驱动有刷直流电机、无刷直流电机、步进电机等，并广泛应用于汽车行业。

## 概述

该示例包括：

- 用于通信的 LIN-TP
- 加载 dll 安全访问密钥生成
- 在 `tester.ts` 中计算固件 CRC 校验和

## 文件结构

```text
NSUC1612_LIN_OTA/
├── NSUC1612_LIN_OTA.ecb     # 主项目配置
├── tester.ts                # TypeScript 测试脚本
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

1. **硬件设置**：将您的 [LinCable](https://app.whyengineer.com/docs/um/hardware/lincable.html) 设备连接到 COM5（或更新配置）
2. **ECU 连接**：确保 NSUC1612 ECU 通过 LIN 总线连接
3. **运行测试**：执行测试脚本以执行 OTA 验证

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
