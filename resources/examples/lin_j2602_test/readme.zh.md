# LIN SAE J2602 测试示例

本示例演示了使用 EcuBus-Pro 和 LinCable 进行全面的 LIN SAE J2602 测试，遵循 SAE J2602-2 标准。 该测试套件通过先进的故障注入技术验证 LIN 协议合规性、时序参数和错误处理能力。

## 概述

LIN SAE J2602 测试示例提供了一个完整的测试框架，用于根据汽车行业标准验证 LIN 网络组件。 它利用 LinCable 的先进故障注入能力来模拟各种错误条件，并验证 LIN 从节点中的正确错误处理。

您可以修改测试脚本来实现您自己的额外测试要求。

## 使用的设备

- **[EcuBus-LinCable](https://app.whyengineer.com/docs/um/hardware/lincable.html)**：具有先进故障注入能力的 USB 转 LIN 适配器（错误注入测试所需）

> [!注意]
> 故障注入测试需要 EcuBus-LinCable，因为它是唯一能够执行错误注入操作的设备。 标准 LIN 适配器无法执行这些高级测试功能。

## 测试数据库

测试数据库位于 [LINdb.ldf](https://github.com/ecubus-pro/ecubus-pro/blob/main/resources/examples/lin_j2602_test/J2602_VectorExample.ldf) 文件中。
