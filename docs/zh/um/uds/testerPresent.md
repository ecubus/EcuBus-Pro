# Tester Present（测试器在线）

Tester Present（服务 ID 0x3E）是一种诊断服务，用于指示 ECU：诊断客户端（测试器）仍然在线，从而保持诊断会话处于活动状态。

Tester Present 的主要目的：

- 通过周期性发送消息，维持非默认诊断会话为激活状态
- 防止诊断会话超时（S3 超时）
- 保持测试器与 ECU 之间的通信

> [!NOTE]
> 当前 Tester Present 仅支持 CAN。

## 配置

在 EcuBus-Pro 中，可在 `UDS Tester` 窗口配置 Tester Present：

![Tester Present Configuration](./tp.png)


### S3 Time [M]

S3 Time 表示 S3 Client 超时时间，即两次 Tester Present 消息之间允许的最大间隔。

### Tester Present Address [M]

Tester Present 消息的地址，可配置为物理地址或功能地址。

### From Speical Serivce [O]

Tester Present 的默认消息为 `0x3E 0x00`；若需要使用特殊服务，可在服务列表中选择一个。







