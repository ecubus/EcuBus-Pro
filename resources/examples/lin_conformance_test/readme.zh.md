# LIN 一致性测试示例

本示例展示了如何使用 EcuBus-Pro 与 LinCable，按照 ISO/DIS 17987-6 标准开展完整的 LIN 一致性测试。测试套件通过高级故障注入技术，验证 LIN 协议合规性、定时参数以及错误处理能力。

## 概述

该 LIN 一致性测试示例提供了一套完整的测试框架，用于依据汽车行业标准验证 LIN 网络组件。它利用 LinCable 的高级故障注入能力，模拟多种错误条件，并验证 LIN 从设备在面对错误时的正确处理。

用户可以自行修改测试脚本来完成自己的额外的测试需求。

## 使用的设备

- **[EcuBus-LinCable](https://app.whyengineer.com/zh/docs/um/hardware/lincable.html)**：具备高级故障注入能力的 USB 转 LIN 适配器（进行错误注入测试时必需）

> [!NOTE]
> 故障注入测试需要使用 EcuBus-LinCable，因为它是唯一能够执行错误注入操作的设备。标准 LIN 适配器无法完成这些高级测试功能。


## 测试数据库

一致性的测试依赖Lin的LDF文件。LDF文件是Lin的配置文件，用于定义Lin的网络拓扑、节点信息、信号定义等。

测试数据库位于 [LINdb.ldf](https://github.com/ecubus-pro/ecubus-pro/blob/main/resources/examples/lin_conformance_test/LINdb.ldf) 文件。

## 用户变量

尽管我们已经有了数据库，我们还是自定义一些额外的用户变量来辅助我们自动化测试。

| 变量名 | 类型 | 默认值 | 取值范围 | 用途说明 |
|---|---|---|---|---|
| InitialNAD | number | 2 | 0–255 | 从节点初始 NAD（Node Address）。用于诊断寻址与配置前的通信。|
| ConfiguredNAD | number | 2 | 0–255 | 配置后的 NAD。用于验证配置流程和后续通信是否使用期望的地址。|
| SupplierID | number | 0x1e | 0–65535 | 供应商标识，用于一致性测试中的标识读取校验。|
| FunctionID | number | 1 | 0–65535 | 功能标识，用于从节点身份/功能一致性相关测试。|
| Variant | number | 0 | 0–255 | 变体号，用于区分从节点固件/配置变体的测试场景。|
| StatusFrameName | string | "Motor1State_Cycl" | - | 状态帧名称，用于周期性读取从节点状态。与 LDF 中状态帧对应。|
| TxFrameName | string | "Motor1_Dynamic" | - | 主机发送的帧名称（Master Transmit）。用于向从节点下发动态数据/命令。|
| RxFrameName | string | "MotorControl" | - | 主机接收/控制帧名称（Master 请求，从机响应）。用于控制与回读配合测试。|
| EventFrameName | string | "ETF_MotorStates" | - | 事件触发帧名称，用于事件触发与冲突消解相关测试。|
| StatusSignalOffset | number | 40 | 0–100 | 状态位在状态帧中的比特偏移（bit）。用于定位如 `response_error` 等状态信号的位置。|
| UnknownId | number | 1 | 0–100 | 非法/未知 ID 测试参数，用于异常帧 ID 行为及错误处理验证。|

![variables](./image1.png)


## 测试脚本

测试脚本位于 [test.ts](https://github.com/ecubus-pro/ecubus-pro/blob/main/resources/examples/lin_conformance_test/test.ts) 文件。

![test](./image.png)

## 测试视频

<iframe style="width:100%;height:500px" src="//player.bilibili.com/player.html?isOutside=true&aid=114998168788309&bvid=BV1u2tbzQEdm&cid=31586780126&p=1" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe>

## 测试报告

导出的测试报告：

![test](./report.jpg)


