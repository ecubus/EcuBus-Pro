# SOME/IP

EcuBus-Pro 支持 SOME/IP 协议，可用于开发和测试支持 SOME/IP 的设备。

## 配置

> EcuBus-Pro 的 SOME/IP 功能基于 [vSomeIP](https://github.com/GENIVI/vsomeip)。 有关不明确的配置细节，请参阅 [vSomeIP 配置文档](https://github.com/COVESA/vsomeip/blob/master/documentation/vsomeipConfiguration.md)。

### 添加 SOME/IP 配置

通过点击 SOA->SOA 配置->添加 SOME/IP 配置来添加 SOME/IP 配置。

![添加 SOME/IP 配置](../../../media/um/someip/add.png)

### 配置 SOME/IP

点击 SOME/IP 配置以进行配置。

![SOME/IP 配置](../../../media/um/someip/config.png)

#### 设备配置

每个 SOME/IP 配置必须包含一个以太网设备。

#### 应用程序配置

每个 SOME/IP 配置对应一个应用程序，并需要一个应用程序 ID。 应用程序 ID 是应用程序的唯一标识符，范围为 1-65535。

#### 服务发现配置

控制是否启用服务发现。 如果启用了服务发现，您需要配置与服务发现相关的设置。

> [!TIP]
> 如果启用了服务发现，您可能需要在计算机上配置多播相关设置。

#### 服务配置

![SOME/IP 服务配置](../../../media/um/someip/service.png)

> [!WARNING]
> 目前仅支持简单服务。 未来将添加对事件和事件组的支持。

每个服务需要配置：

1. 服务 ID - 服务的唯一标识符，范围为 1-65535
2. 服务实例 ID - 服务实例的唯一标识符，范围为 1-65535
3. 是否启用 TCP 可靠传输及相应的端口号
4. 是否启用 UDP 不可靠传输及相应的端口号

## SOME/IP 交互器

点击 SOME/IP 交互器可快速发起 SOME/IP 请求并查看 SOME/IP 请求的响应。

![SOME/IP 交互器](../../../media/um/someip/ia.png)

### 交互器配置

将鼠标悬停在交互器块上并点击编辑按钮以配置交互器。

#### 连接配置

![SOME/IP 交互器连接配置](../../../media/um/someip/connect1.png)
![SOME/IP 交互器连接配置](../../../media/um/someip/connect2.png)

#### 编辑请求

> [!TIP]
> 目前不支持从数据库中选择请求。

![SOME/IP 交互器请求配置](../../../media/um/someip/frame.png)

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
