# SOME/IP

EcuBus-Pro 支持 SOME/IP 协议，可用于开发和测试支持 SOME/IP 的设备。

## 配置

> EcuBus-Pro 的 SOME/IP 功能基于 [vSomeIP](https://github.com/GENIVI/vsomeip)。 有关不清楚的配置细节，请参阅 [vSomeIP 配置文档](https://github.com/COVESA/vsomeip/blob/master/documentation/vsomeipConfiguration.md)。

### 添加 SOME/IP 配置

通过点击 `SOA -> SOA 配置 -> 添加 SOME/IP 配置` 来添加一个 SOME/IP 配置。

![添加 SOME/IP 配置](../../../media/um/someip/add.png)

### 配置 SOME/IP

点击一个 SOME/IP 配置项以打开其设置。

![SOME/IP 配置](../../../media/um/someip/config.png)

#### 设备配置

每个 SOME/IP 配置必须绑定到一个以太网设备。

- 选择用于 SOME/IP 通信的网卡。
- 验证目标 ECU/服务可以访问本地 IP 和子网。
- 在多网卡环境中，请明确绑定到用于测试流量的网卡。

#### 应用程序配置

每个 SOME/IP 配置对应一个应用程序，并需要一个应用程序 ID。 应用程序 ID 是应用程序的唯一标识符，范围为 1-65535。

- 应用程序 ID 范围：`1` 到 `65535`
- 该值在同一运行时上下文中必须是唯一的。
- 在与外部服务集成时，它应匹配您的 vSomeIP 运行时预期。

#### 服务发现配置

此部分控制是否启用 SOME/IP 服务发现。

如果启用了服务发现，请配置组播和定时设置（例如组播地址、服务发现端口、提供/请求定时和生存时间）。

> [!TIP]
> 如果启用了服务发现，您可能需要在计算机上配置组播路由/防火墙。

#### 服务配置

![SOME/IP 服务配置](../../../media/um/someip/service.png)

对于每个服务，配置：

1. 服务 ID - 服务的唯一标识符，范围为 1-65535
2. 服务实例 ID - 服务实例的唯一标识符，范围为 1-65535
3. 是否启用 TCP 可靠传输及对应的端口号
4. 是否启用 UDP 不可靠传输及对应的端口号

## SOME/IP 交互器

使用 SOME/IP 交互器快速发送 SOME/IP 操作并检查响应/消息。

![SOME/IP 交互器](../../../media/um/someip/ia.png)

### 交互器配置

将鼠标悬停在交互器块上并点击 **编辑**。

#### 连接配置

![SOME/IP 交互器连接配置](../../../media/um/someip/connect1.png)
![SOME/IP 交互器连接配置](../../../media/um/someip/connect2.png)

#### 编辑请求

> [!TIP]
> 目前不支持从数据库中选择请求。

![SOME/IP 交互器请求配置](../../../media/um/someip/frame.png)

### Common Action Flow (Subscribe Before Notify)

For event-based communication, use this sequence:

1. Configure a `subscribe` action (`someipOp=subscribe`) for the target Service/Instance/Event Group.
2. Execute the subscribe action first and confirm subscription succeeds.
3. Trigger or wait for remote notify messages.
4. Observe messages in Trace or in the Interactor response area.

> [!IMPORTANT]
> If you do not subscribe first, notify messages are typically not delivered to the client.

![Subscribe Action Screenshot](../../../media/um/someip/sub.png)

![Notify Reception Screenshot](../../../media/um/someip/notify.png)

### Recommended Validation Checklist

- Service/Instance/Method/Event Group IDs match on both sides.
- Local NIC/IP binding is correct.
- UDP/TCP ports are consistent with remote service.
- Service Discovery multicast settings are reachable.
- Firewall allows SOME/IP and SD traffic.

## SOME/IP 脚本

### [Util.OnSomeipMessage](https://app.whyengineer.com/scriptApi/classes/UtilClass.html#onsomeipmessage) 监听 SOME/IP 消息

监听 SOME/IP 消息。 当接收到 SOME/IP 消息时，将调用回调函数。

```typescript
// Listen to all SOME/IP messages
Util.OnSomeipMessage(true, (msg) => {
  console.log('Received SOMEIP message:', msg);
});

// Listen to SOME/IP messages for a specific service/instance/method
Util.OnSomeipMessage('0034.5678.90ab', (msg) => {
  console.log('Received specific SOMEIP message:', msg);
});

// Listen to SOME/IP messages for a specific service with wildcards
Util.OnSomeipMessage('0034.*.*', (msg) => {
  console.log('Received specific SOMEIP message:', msg);
});
```

### [output](https://app.whyengineer.com/scriptApi/functions/output.html) 输出 SOME/IP 消息

输出 SOME/IP 消息。 您可以输出 SOME/IP 请求和 SOME/IP 响应。

```typescript
import { SomeipMessageRequest, SomeipMessageResponse, output } from 'ECB'

Util.OnSomeipMessage('1234.*.*', async (msg) => {
  if (msg instanceof SomeipMessageRequest) {
    const response = SomeipMessageResponse.fromSomeipRequest(msg)
    await output(response)
  }
})
```
