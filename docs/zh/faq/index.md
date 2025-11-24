# 常见问题

## 如何将UDS报文长度配置为8字节？

:::details 答案
您可以通过进入UDS Tester -> Tp Base -> Padding Enable来启用填充。 您也可以设置自己的填充值，默认为0x00。
![1](../../media/faq/1.png)
:::

## ZLG打开设备提示设置波特率失败？

:::details 答案
这是一个已知问题，请将EcuBus-Pro安装在非C盘的其他磁盘分区上即可解决。
:::

## 当使用序列器通过LIN发送ID为0x3C且NAD为0x55的UDS服务时，为什么之后不发送ID为0x3D的LIN报文让从节点响应？

:::details 答案
这是由于LIN调度表的实现方式。 您应该首先启动任何调度表。
![2](../../media/faq/2.png)
然后您可以发送ID为0x3D的LIN报文。
![3](../../media/faq/3.png)
:::

## 如何计算报文的CRC值？

:::details 答案
您可以在脚本中使用内置的[CRC](https://app.whyengineer.com/scriptApi/classes/CRC.html) API计算CRC值。 该API支持多种CRC算法，包括CRC8、CRC16和CRC32，且参数可配置。

:::

## 如何实现周期性报文的循环计数？

:::details 答案

**如果您有数据库并希望定期更新信号值：**

1. 首先需要将报文配置为周期性。
2. 然后需要使用[OnCan](https://app.whyengineer.com/scriptApi/classes/UtilClass.html#oncan) API监听报文的发送/接收。
3. 使用[setSignal](https://app.whyengineer.com/scriptApi/functions/setSignal.html) API更新信号值。

```ts
import { setSignal } from 'ECB'
let val = 0

Util.OnCan(0x142, (data) => {
   setSignal('Model3CAN.VCLEFT_liftgateLatchRequest', val++ % 5)
})
```

![demo](../../media/faq/loop.gif)

**没有数据库：**

1. 只需使用[output](https://app.whyengineer.com/scriptApi/functions/output.html) API输出具有任意所需值的帧。

```ts
import { output,CanMessage,CAN_ID_TYPE} from 'ECB'
setInterval(() => {
  const canMsg:CanMessage = {
      id: 0x111,
      data: Buffer.from([0,1,2,3,4,5,6,7]),
      dir: 'OUT',
      msgType:{
        idType: CAN_ID_TYPE.STANDARD,
        remote: false,
        brs: false,
        canfd: false,
      }
    }
   output(canMsg)
}, 1000)
```

:::
