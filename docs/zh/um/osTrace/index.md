
# OSEK OS追踪

OSEK OS追踪是通过外部接口实时获取OSEK OS的运行状态，并将其转换为可视化的图形界面。

> [!NOTE]
> 此功能需要OS提供对应的ORTI文件, 并在对应的HOOK插入相关代码记录相关信息,然后通过数据接口传输给EcuBus-Pro

## 导入ORTI文件

通过点击`Others->Database->Add OS(ORTI)`导入ORTI文件, 也可以查看已经导入的ORTI文件
![orti](orti.png)

## 配置ORTI

> [!NOTE]
> 导入ORTI文件后，仍然允许用户手动修改配置信息

导入成功ORTI文件后，可以看到从ORTI文件中解析出来的配置信息

### TASK/ISR

1. 设置Name
2. 设置CPU真正的运行频率（取悦于你的timestamp格式，如果你的timestamp已经是us，那么CPU频率可以是1）

![task](task.png)


### Resource

![resource](resource.png)


### Service

![service](service.png)


### Hook

![hook](hook.png)

### Connector配置

Connector用于决定你是从哪里获取TRACE数据，目前支持以下几种方式：

#### 串口（SerialPort）

通过串口实时接收OS Trace数据

**配置项：**
- **Device**: 选择串口设备（如COM1、/dev/ttyUSB0等）
- **Baud Rate**: 波特率（如115200、921600等）
- **Data Bits**: 数据位（5、6、7、8）
- **Stop Bits**: 停止位（1、1.5、2）
- **Parity**: 校验位（None、Even、Odd、Mark、Space）

**数据格式：** 16字节二进制数据（大端序）

| 字段 | 长度 | 说明 |
|------|------|------|
| frame header | 1 byte | 帧头 (0x5A) |
| index | 4 bytes | 事件索引（MSB） |
| timestamp | 4 bytes | 时间戳（MSB） |
| type | 1 byte | 事件类型 |
| type id | 2 bytes | 对象ID（MSB） |
| type status | 2 bytes | 状态/参数（MSB） |
| coreID | 1 byte | 核心ID |
| CRC8 | 1 byte | CRC8校验码 |

> [!NOTE]
> CRC8校验码是对前14字节数据计算得出

![serialPort](serialPort.png)

#### 二进制文件（BinaryFile）

从二进制文件读取OS Trace数据，数据格式与串口相同（16字节二进制数据）

**配置项：**
- **File**: 选择二进制文件路径（支持相对路径）

**数据格式：** 与串口相同，16字节二进制数据

#### CSV文件（CSVFile）

从CSV文件读取OS Trace数据

**配置项：**
- **File**: 选择CSV文件路径（支持相对路径）

**数据格式：** CSV格式，每行一个事件

> [!NOTE]
> CSV文件的格式为：timestamp,type,id,status,不能包含表头，时间戳单位为us

```csv

1000,1,0,0
1500,1,0,1
2000,2,1,0
```

**字段说明：**
- **timestamp**: 时间戳(us)
- **type**: 事件类型（0=TASK, 1=ISR, 2=RESOURCE, 3=SERVICE, 4=HOOK, 5=SPINLOCK）
- **id**: 对象ID
- **status**: 状态值

#### CAN/ETH

> [!NOTE]
> CAN和ETH接口暂未实现，敬请期待

### Record File

Record File用于决定将TRACE数据写入到本地文件中，写入的数据格式为CSV格式。

> [!NOTE]
> 每行一个事件，格式为：timestamp,type,id,status，时间戳单位为us

![recordFile](record.png)



## 查看OS的数据和统计值

OS的发生过来的数据可以用过`Trace`窗口进行查看

![trace](trace.png)


当配置好ORTI后，ORTI的数据会自动生成为内置系统变量，可以通过`Others->Variables->System Variables`查看

![var](var.png)

用户可以根据自己的需求，选择用LINE，Gauge，Data等组件来展示这些变量。




