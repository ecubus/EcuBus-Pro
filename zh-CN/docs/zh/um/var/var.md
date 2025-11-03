# 变量系统

## 概览

变量系统是一个强大的功能，用户可以在Ecubus Pro 平台上创建、管理和使用动态值。 变量函数，如通过内部系统流动的虚拟信号，在不同的组件和节点之间传递信息。 这些虚拟信号可以被捕获、转换和路由，以建立灵活和相互关联的系统，使一个地区的变化能够自动传播到其他地区。
![VarArch](./image-4.png)

## 功能

- [Script](./../script/script.md) 或 [详情API](https://app.whyengineer.com/scriptApi/classes/UtilClass.html#onVar)
- 在 [Graph](./../graph/graph.md 中显示变量
- 默认系统变量

## 系统变量

系统变量是预定义的变量，提供系统性能和连接设备的实时信息。 这些变量由系统自动更新，可以访问，但用户不能直接修改。

### 性能监测变量

该系统提供性能监测变量，帮助跟踪应用程序的事件循环性能：

| 变量 ID                | 描述                       | 1 D-1, 1 P-5, 1 P-4, 1 P-3, |
| -------------------- | ------------------------ | --------------------------- |
| `EventLoopDelay.min` | 最小事件循环延迟 - 较低的值表示性能较好    | 毫秒                          |
| `EventLoopDelay.max` | 最大事件循环延迟 - 更高的值表示潜在的性能问题 | 毫秒                          |
| `EventLoopDelay.avg` | 平均事件循环延迟 - 性能和稳定性之间的良好平衡 | 毫秒                          |

这些变量对于监测应用程序的响应性和性能至关重要。 高事件循环延迟值可能表明处理瓶颈可能影响系统的反应能力。

### 设备统计变量

对于每个已连接的 CAN 设备，系统自动创建一组统计变量：

| 变量 ID 模式                                | 描述          | 1 D-1, 1 P-5, 1 P-4, 1 P-3, |
| --------------------------------------- | ----------- | --------------------------- |
| `Statistics.{deviceName}.BusLoad`       | 当前指定设备的总线负载 | %                           |
| `Statistics.{deviceName}.BusLoadMin`    | 记录的最小总线负载   | %                           |
| `Statistics.{deviceName}.BusLoadMax`    | 最大总线负载      | %                           |
| `Statistics.{deviceName}.BusLoadAvg`    | 平均公共汽车负载    | %                           |
| `Statistics.{deviceName}.FrameSentFreq` | 发送帧的频率      | /秒                          |
| `Statistics.{deviceName}.FrameRecvFreq` | 接收帧的频率      | /秒                          |
| `Statistics.{deviceName}.FrameFreq`     | 总帧频率        | /秒                          |

![system var](./image-2.png)

## 用户变量

用户变量是您可以根据您的具体需要创建、修改和删除的自定义变量。 这些变量可以在应用程序中用于存储值、跟踪状态和创建动态工作流。

### 支持的数据类型

用户变量支持以下数据类型：

- **数字**：可选最小/最大边界和单位规格的数字值
- **字符串**：用于存储名称、消息或任何字母数字内容的文本值
- **数组**：以列表格式编排的数值集合

### 创建用户变量

要创建一个新的用户变量：

1. 导航到变量管理器中的 **用户变量** 选项卡
2. 点击“添加变量”按钮(文件图标)
3. 填写变量详细信息：

   - **Namespace**: (可选) 将你的变量按逻辑分组
   - **名称**：变量的唯一标识符 (只有字母、数字和下划线)
   - **描述**: (可选) 关于变量目的的附加信息
   - **Data Type**: 选择数字、 字符串或数组
   - **初始值**：变量的起始值
   - 对于号码类型：
   - **Minimum**：可选的下限
   - **Maximum**：可选上限绑定
   - **单位**：可选测量单位（如“毫秒”、“°C”、“rpm”）

![User Variables Interface](./image-3.png)
![UsrVar](./image-1.png)

## 示例

使用 Graph-Line 来记录 `BusLoad` 和 `Frameworq`

```typescript
Util.OnKey('b', async () => {
  const pl = []
  const start = Date.now()
  for (let i = 0; i < 5000; i++) {
    const msg: CanMessage = {
      dir: 'OUT',
      data: Buffer.alloc(8).fill(i % 255),
      id: 1,
      msgType: {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: false,
        remote: false
      }
    }
    pl.push(output(msg))
  }
  await Promise.any(pl)
  const end = Date.now()
  console.log(`send ${pl.length} messages cost ${end - start}ms`)
})
```

![busload](./image.png)
