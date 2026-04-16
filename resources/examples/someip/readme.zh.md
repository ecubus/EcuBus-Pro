# SOME/IP 请求/响应 + 事件演示

本演示展示了如何在 EcuBus-Pro 环境中使用 SOME/IP 协议。

## 概述

此示例展示了一个基本的 SOME/IP 设置，包括：

- 两个配置用于通信的 SOME/IP 设备（客户端和服务器）
  - **客户端应用 ID**：0x6301
  - **服务器应用 ID**：0x6302
- 一个提供服务与事件的服务器端
  - **服务 ID**：0x1234
  - **实例 ID**：0x1111
  - **方法 ID**：0x1002（请求/响应）
  - **事件 ID**：0x8777（通知/事件发布）
  - **端口**：30510（可靠的 TCP 连接）

## 脚本行为

TypeScript 脚本（`someip.ts`）运行在 **Node 1**（绑定 **SomeIP_1**，应用 `0x6302`），实现：

- 接收针对服务 `0x1234` 的 SOME/IP 请求并回显响应
- 周期调用 `someipNotify`，发布事件 `0x8777`

订阅示例脚本（`sub.ts`）运行在客户端侧，通过以下方式接收事件：

- `Util.OnSomeipMessage('1234.*.*', ...)`
- `msg instanceof SomeipMessageEvent` 处理通知/事件消息

如果没有先成功订阅，SomeIP_0 不会收到通知。

## 运行步骤

1. 启动工程，确保两个 SOME/IP 设备在线。
2. 在服务端节点运行 `someip.ts`（SomeIP_1 / app `0x6302`）。
3. 在客户端节点运行 `sub.ts`（SomeIP_0 / app `0x6301`）。
4. 在 SomeIP_0 的 IA 页面执行手动 `subscribe`：
   - service `0x1234`
   - instance `0x1111`
   - event group `0x0001`
   - event `0x8777`
5. 在订阅端查看事件日志输出。

## 网络设置

该演示使用 localhost（127.0.0.1）进行测试，无需额外网络配置即可运行。两个 SOME/IP 应用使用不同应用 ID，通过同一以太网接口通信。
