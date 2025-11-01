# NSUC1612 LIN OTA 示例

本示例演示如何在NSUC1612 ECU上使用LIN（本地互连网络）协议和LIN-UDS（基于LIN-TP的统一诊断服务）执行空中升级（OTA）固件更新。

> [!INFO]
> NSUC1612系列 是一款集成了 4路/3路半桥驱动器的专用处理器芯片，可用于控制小功率电机。它可以驱动有> 刷直流电机、无刷直流电机、步进电机等，在汽车领域得到广泛应用。

## 概述

示例包含：

- 使用LIN-TP进行通信
- 加载动态库安全访问密钥生成
- 在`tester.ts`中计算固件CRC校验和

## 文件结构

```text
NSUC1612_LIN_OTA/
├── NSUC1612_LIN_OTA.ecb     # 主项目配置文件
├── tester.ts                # TypeScript 测试脚本
├── readme.md                # 说明文档
├── firmware/
│   └── project_rom_boot.bin # 固件二进制文件
├── algorithm/
│   └── GenerateKeyEx.dll    # 安全访问密钥生成库
└── System32/
    ├── ucrtbased.dll        # 运行时库
    └── vcruntime140d.dll
```

## 使用方法

1. **硬件设置**：将[LinCable](https://app.whyengineer.com/docs/um/hardware/lincable.html)设备连接到COM5（或更新配置）
2. **ECU连接**：确保NSUC1612 ECU通过LIN总线连接
3. **运行测试**：执行测试脚本进行OTA验证

## 代码示例

```typescript
// 读取固件文件
const fw = path.join(process.env.PROJECT_ROOT, 'firmware', 'project_rom_boot.bin')
const content = await fs.readFile(fw)

// 计算CRC32_JAMCRC校验和
const crc = CRC.buildInCrc('CRC32_JAMCRC')
const crcValue = crc.computeBuffer(content)

// 创建并执行诊断服务
const service = DiagRequest.from('NSUC1612_LIN_UDS_Tester.RoutineControl_routineID$F001')
service.diagSetParameterRaw('routineControlOptionRecord', crcValue)
await service.changeService()
```
