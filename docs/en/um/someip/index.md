# SOME/IP

EcuBus-Pro supports the SOME/IP protocol and can be used for developing and testing SOME/IP-enabled devices.

## Configuration

> EcuBus-Pro's SOME/IP functionality is based on [vSomeIP](https://github.com/GENIVI/vsomeip). For configuration details that are unclear, please refer to the [vSomeIP Configuration Documentation](https://github.com/COVESA/vsomeip/blob/master/documentation/vsomeipConfiguration.md).

### Add SOME/IP Configuration

Add SOME/IP configuration by clicking SOA->SOA Config->Add SOME/IP Configuration.

![Add SOME/IP Configuration](../../../media/um/someip/add.png)

### Configure SOME/IP

Click on the SOME/IP configuration to configure it.

![SOME/IP Configuration](../../../media/um/someip/config.png)

#### Device Configuration

Each SOME/IP configuration must include an Ethernet device.

#### Application Configuration

Each SOME/IP configuration corresponds to an application and requires an Application ID. The Application ID is the unique identifier for the application and ranges from 1-65535.

#### Service Discovery Configuration

Controls whether service discovery is enabled. If service discovery is enabled, you need to configure the service discovery-related settings.

> [!TIP]
> If service discovery is enabled, you may need to configure multicast-related settings on your computer.

#### Service Configuration

![SOME/IP Service Configuration](../../../media/um/someip/service.png)

> [!WARNING]
> Currently, only simple services are supported. Support for events and event groups will be added in the future.

Each service needs to be configured with:

1. Service ID - The unique identifier for the service, ranging from 1-65535
2. Service Instance ID - The unique identifier for the service instance, ranging from 1-65535
3. Whether to enable TCP reliable transmission and the corresponding port number
4. Whether to enable UDP unreliable transmission and the corresponding port number

## SOME/IP Interactor

Click on the SOME/IP Interactor to quickly initiate SOME/IP requests and view the responses to SOME/IP requests.

![SOME/IP Interactor](../../../media/um/someip/ia.png)

### Interactor Configuration

Hover over the interactor block and click the edit button to configure the interactor.

#### Connection Configuration

![SOME/IP Interactor Connection Configuration](../../../media/um/someip/connect1.png)
![SOME/IP Interactor Connection Configuration](../../../media/um/someip/connect2.png)

#### Edit Request

> [!TIP]
> Selecting requests from the database is not currently supported.

![SOME/IP Interactor Request Configuration](../../../media/um/someip/frame.png)

## SOME/IP Script

### [Util.OnSomeipMessage](https://app.whyengineer.com/scriptApi/classes/UtilClass.html#onsomeipmessage) Listen to SOME/IP Messages

Listen to SOME/IP messages. When a SOME/IP message is received, the callback function will be called.

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

### [output](https://app.whyengineer.com/scriptApi/functions/output.html) Output SOME/IP Messages

Output SOME/IP messages. You can output SOME/IP requests and SOME/IP responses.

```typescript
import { SomeipMessageRequest, SomeipMessageResponse, output } from 'ECB'

Util.OnSomeipMessage('1234.*.*', async (msg) => {
  if (msg instanceof SomeipMessageRequest) {
    const response = SomeipMessageResponse.fromSomeipRequest(msg)
    await output(response)
  }
})
```
