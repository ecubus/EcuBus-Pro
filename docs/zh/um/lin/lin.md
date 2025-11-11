# LIN

LIN是一种具有成本效益和确定性的通信协议，旨在将电子控制股与智能传感器、引导器和控制器连接起来。 EcuBus-Pro的LIN模块为按照LIN 2.x规格开发、分析和测试LIN网络提供了全面的功能。

## 添加设备

通过顶部菜单栏，选择 `Hardware`，然后点击支持LIN的设备右侧的 `+` 按钮添加设备。

![添加LIN设备](../../../media/um/lin/device.png)

支持的硬件：

| 制造商               | Protocols | 技能                          |
| ----------------- | --------- | --------------------------- |
| `EcuBus LinCable` | LIN       | 支持错误注入，可以进行符合性测试，并支持 PWM 输出 |
| 染料                | LIN       |                             |
| 克瓦塞尔              | LIN       |                             |
| Toomos            | LIN       | 支持 12v 电压输出/输入，5v 电压输出      |
| 镜头                | LIN       |                             |

## 配置设备

点击添加设备后，您需要输入设备设置：

1. 自定义设备名称
2. 设备频道
3. 工作模式、主或斯拉夫
4. 波特率
5. 绑定数据库(可选)

> [!IMPORTANT]
> 下面描述的一些功能可能需要导入LIN描述文件 (LDF)。 For more information about LDF, see the [database documentation](./../ldf).

![LIN设备配置](../../../media/um/lin/config.png)

## 计划表管理

> [!IMPORTANT]
> 当LIN作为主节点工作时可用。
> 相应的设备需要加载相应的数据库。

调度表管理允许定期执行地方发展基金数据库中的具体调度表。

### 添加LIN 交互方式

- 打开网络接口
- Click the `+` button under the `Interaction` tab in the `Lin` network on the left side of Network to add an interaction
  ![LIN Schedule Table Addition](../../../media/um/lin/image.png)

### 打开 LIN 互动

- 打开交互配置
  ![LIN设备配置](../../../media/um/lin/configIA.png)
- Configure the LIN device connected to the interaction
  ![LIN Interaction Device Connection](../../../media/um/lin/connect.png)
- Select the LIN device you want to connect
  ![Select LIN Device](../../../media/um/lin/connect1.png)
- 查看和管理现有的日程表。 您可以通过关闭活动暂时跳过计划表中的帧。
  ![打开LIN计划表](../../../media/um/lin/image-1.png)

## 节点模拟和信号编辑

> [!IMPORTANT]
> 相应设备需要加载相应的数据库。

配置和模拟LIN节点，测试网络行为并动态更新对应节点的信号值。

### 节点配置步骤

1. **添加节点**
   - 打开网络接口
   - 单击网络左侧的 "节点" 选项卡下的 "+" 按钮添加一个节点
     ![添加新节点](../../../media/um/lin/image-2.png)

2. **配置节点**
   - 打开节点配置
     ![Node Configuration](../../../media/um/lin/configNode.png)
   - 设置节点连接的设备
     ![节点配置](../../../media/um/lin/image-3.png)
   - 选择节点模拟的网络节点 (**需要选择相应的 LIN设备，相应的设备有一个绑定的数据库**)
     ！ 配置网络节点](../../../media/um/lin/netNode.png)

3. **信号值编辑器**
   - 当节点配置完成后，您可以编辑配置的节点
     的信号值！[信号值编辑器](../../../media/um/lin/editSig.png)
   - 修改信号值 (**只能修改配置节点发布的信号。 例如，在下图中，只有`Motor2`作为出版商的信号值可以被修改**)
     ![信号值编辑](../../../media/um/lin/image-4.png)

4. **节点模拟**
   使用网络节点配置后，它将自动模拟节点发送信号。
   例如，当设备Lin 在主模式下工作和节点1被配置为`Motor2`奴隶网络节点时， 当收到`Motor2`的请求时，节点1将自动响应这个框架并作出回应。


