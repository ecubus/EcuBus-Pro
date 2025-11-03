# SOME/IP

Ecuador Bus-Pro 支持SOME/IP协议，并可用来开发和测试SOME/IP-启用的设备。

## 配置

> EcuaduBus-Pro's SOME/IP 功能基于 [vSomeIP](https://github.com/GENIVI/vsomeip)。 如果配置细节不清楚，请参阅[vBotoIP配置文件](https://github.com/COVESA/vsomeip/blob/master/documentation/vsomeipConfiguration.md)。

### 添加 SOME/IP 配置

点击 SOA->SOA Config->添加 SOME/IP 配置来添加 SOME/IP 配置。

![添加 SOME/IP 配置](../../../media/um/someip/add.png)

### 配置 SOME/IP

点击SOME/IP配置来配置它。

![SOME/IP 配置](../../../media/um/someip/config.png)

#### 设备配置

每个SOME/IP配置必须包含以太网设备。

#### 应用程序配置

每个SOME/IP配置都对应于一个应用程序，并且需要一个应用程序 ID。 应用程序ID是应用程序的唯一标识符，范围介于1-65535之间。

#### 服务发现配置

控制是否启用服务发现。 如果启用服务发现功能，您需要配置与服务发现相关的设置。

> [!提示]
> 如果启用了服务发现，您可能需要在您的计算机上配置多播客相关设置。

#### 服务配置

![SOME/IP 服务配置](../../../media/um/someip/service.png)

> [!警告]
> 目前只支持简单的服务。 将来会添加对事件和事件组的支持。

每个服务都需要配置：

1. 服务 ID - 服务的独特标识符，范围介于1-65535
2. 服务实例 ID - 服务实例的唯一标识符，范围介于1-65535
3. 是否启用 TCP 可靠传输和相应的端口号
4. 是否启用 UDP不可靠的传输和相应的端口号

## SOME/IP 交互器

点击SOME/IP 交互器来快速启动 SOME/IP 请求并查看SOME/IP 请求的响应。

![SOME/IP Interactor](../../../media/um/someip/ia.png)

### 交互式配置

悬停在交互方块上，然后点击编辑按钮来配置交互方。

#### 连接配置

![SOME/IP Interactor Connection Configuration](../../../media/um/someip/connect1.png)
![SOME/IP Interactor Connection Configuration](../../../media/um/someip/connect2.png)

#### 编辑请求

> [!TIP]
> 目前不支持从数据库选择请求。

![SOME/IP Interactor Request Configuration](../../../media/um/someip/frame.png)

## SOME/IP 脚本

### [Util.OnSomeipMessage](https://app.whyengineer.com/scriptApi/classes/UtilClass.html#onsomeipmessage) 监听SOME/IP 消息

监听SOME/IP 消息。 当收到SOME/IP消息时，回调函数将被调用。

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

输出 SOME/IP 消息。 您可以输出 SOME/IP 请求和SOME/IP 响应。

```typescript
从 'ECB'

实用程序导入 { SomeipMessageRequest, SomeipMessageResponse, output } ('1234.*). ', async (msg) => Power
  if (msg instanceof bomiipMessageRequest) Power
    const response = OwipMessageResponse. romhyipRequest(msg)
    等待输出(响应)
  }
})
```
