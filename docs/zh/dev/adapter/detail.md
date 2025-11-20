# 如何开发新适配器

EcuaduBus-Pro 目前支持许多主流的 CAN 通信箱，但您可能有来自不同制造商的其他CAN 箱，具有不同的模型和接口。 从官方网站[如何开发新的适配器](../adapter)，您可以向EcuadBus-Pro 添加基本驱动程序进行适应。  
为此目的，我在现有基础上添加了一些矢量驱动器。 由于这是我第一次从事这些技术的工作，下面记录的步骤仅供参考。

## 1. 基本知识

1. 根据手动步骤使用ZLG CAN框作为示例。 CAN box 驱动程序和 Electron 客户端之间的交互原则大致如下：CAN box lib 库 + 。 头文件 + .i 接口文件使用 SWIG 生成 zlg_wrawraw.cxxx, 。 xx 文件通过node-gyp编译成zlg.node ，在导入.node, 设备初始化，CAN 传输/接收以及其他函数在索引中实现。 s，并最终用于Electron的基础实现和 zlg.test.ts 测试。

SWIG 的作用是将驱动 API C/C++ 语言转换为 Javascript，使其他语言能够访问此 API 声明并呼叫Lib 接口。

Node-gyp 构建已转换为 Javascript 和 Lib的节点模块以进行跨平台分配。

The role of each file:  
zlg.i: SWIG interface file, defines how C/C++ is converted to Javascript standards  
s.bat: Script to convert C/C++ code to Javascript code, used to generate zlg_wrap.cxx  
zlg_wrap.cxx: Generated Javascript code  
buffer.i, buffer1.i: Buffer interfaces, generally unchanged  
tsfn.cxx: Thread-safe file, entry point for CAN transmission/reception threads  
zlg.node: Compiled node module, can be used in .ts files  
![1](../../../media/dev/adapter/1.png)
2. 遵循此进程需要掌握基本的 JavaScript/类型语法知识。 对于仅知道C/C++的用户来说，快速学习打字的方法是通过 [TypeScript 教程](../jslearn) 在 rookie 教程网站。 跟随教程中的每个示例花费1-2天将帮助您掌握基本语法和语言功能。 对于更高级的应用程序和执行方法，您可以在编写实际相关代码时查找材料。
3. 对于SWIG，我们只需要知道它是一个跨语言的编译器，可以为驱动 API C/C++ 声明创建包装器。 允许打字稿和其他语言访问这些声明。 SWIG 非常强大和复杂，但我们可以暂时忽略其他功能，只能通过一个简单的例子理解SWIG的工作原则。 比如引用这个 [SWIG Introduction and Getting Started Guide](https://www.cnblogs.com/xiaoqi/p/17973315/SWIG)

## 2. 更换和构建

由于上述基本知识，基于现有驱动程序添加新的 CAN 框驱动程序变得更加简单。 最好的方法是模仿和逐渐取代现有的程序。 如果您已经在其他语言中安装了开发出来的新的 CAN 框驱动程序， 您只需要将设备初始化、CAN 传输/接收和其他函数转换为打字语言。 转换工作可由大赦国际进行。  
如果您之前没有实现一个 CAN 框驱动程序，您可以引用CAN 框制造商提供的官方示例， 它也实现了各种语言的 API 进程，并且同样将它们转换为打字脚本。  
兹尔格之后执行矢量驱动程序的过程如下：

1. 复制.\docan\zlg目录下的文件夹并创建矢量文件夹

   ```text
   <\zlg>  
   ├index.ts  
   ├<\inc>  
   │  ├canframe.h  
   │  ├config.h  
   │  ├typedef.h  
   │  └zlgcan.h  
   ├<\lib>  
   │  └zlgcan.lib  
   ├<\swig>  
   │  ├buffer.i  
   │  ├buffer1.i  
   │  ├s.bat  
   │  ├tsfn.cxx  
   │  ├zlg.i  
   │  └zlg_wrap.cxx

   <\vector>  
   ├index.ts  
   ├<\inc>  
   │  └vxlapi.h  
   ├<\lib>  
   │  └vxlapi64.lib  
   ├<\swig>  
   │  ├buffer.i  
   │  ├buffer1.i  
   │  ├s.bat  
   │  ├tsfn.cxx  
   │  ├vector.i  
   │  └vector_wrap.cxx
   ```

   用矢量文件替换.h 和 .lib 文件，保持其它文件目前的不变，并将所有文件重命名为矢量。

2. 修改 SWIG 接口接口文件vector.i, 用矢量替换模块名称和包含头文件，暂时禁用所有 pointer_class，array_class等。 因为这些定义和映射来自.h 文件，新的 vxlapi.h 可能不包含它们。 如果需要，稍后添加它们，确保.i 不包含原始zlgcan.h 内容。  
   保持其他线程安全函数，如CreateTSFN保持不变。

   ```plain
   %module向量
   ...
   %header %@
   ...
   #include "vxlapi.h"
   ...
   // %array_class(uint32_t, U32Aray);
   // %array_class(BYTE, ByteArray);
   // %arrray_class(ZCAN_Receive_Data, receiveDataArray);
   // %array_class(ZCAN_ReceiveFD_Data, ReceiveFDDataArray);
   . .
   %}
   ```

3. 将矢量的 s.bat 更改为

    ```bat
    滑动-I"./../inc" -c++ -javascript -napi -v ./vector.i 
    ```

   在 cmd 中执行上述命令。\docan\vector\swig目录下，该目录将生成vxlapi.h 页眉文件的 vector_wrawraw.cxx 。  
   ![2](../../../media/dev/adapter/2.png)  
   If cmd reports an error, it means some code in vxlapi.h cannot be converted to .cxx and needs to be disabled or modified according to the prompts until .cxx is successfully generated. 在这一点上，各种文件实际上可以使用 vector_wrawraw.cxx 访问 Lib API，但要实现跨平台兼容，需要进一步生成 .node 模块。

4. 修改安全线程的 tsfn.cxx 文件，替换包含 zlgcan 文件。 也有关于ZLG API的实现功能，暂时禁用它们，稍后替换它们，确保.cxx不包含原始zlgcan.h 内容。

   ```plain
   #include "vxlapi.h"
   ...
      // numCan=ZCAN_GetReceiveNum(context->channel,TYPE_CAN);
      // numCanFd=ZCAN_GetReceiveNum(context->channel,TYPE_CANFD);
      // ZCAN_CHANNEL_ERR_INFO err;
      // ZCAN_ReadChannelErrInfo(context->channel,&err);
      // ZCAN_ResetCAN(context->channel);
   ...

   ```

5. 在这个步骤中，滑动目录中的程序不再包含原始的 ZLG 代码内容，因此您可以构建矢量节点。 修改 .\docan\binding. 输入“target_name”之后：'zlg'，添加'target_name'：'vector' contents，并禁用其他设备的构建指令。 这样npx node-gyp 重建不会每次重复建造峰值、 kvaser 和其他司机。  
   'target_name': 'vector' 需要指定 vxlapi64.lib 和 vector_wraw.cxxx, tsfn.cxx 的正确路径。

```json
# 'target_name': 'peak',
# 'target_name': 'kvaser',
# 'target_name': 'zlg',
# 'target_name': 'toomoss',
{
   'target_name': 'vector',
   'conditions': [
      ['OS=="win"', {
         'include_dirs': [
             './vector/inc',
             "<!@(node -p \"require('node-addon-api').include\")"
         ],
         'configurations': { },
         'defines': [
             '__EXCEPTIONS'
         ],
         'sources': [
             './vector/swig/vector_wrap.cxx',
             './vector/swig/tsfn.cxx'
         ],
         'cflags': [ ],
         'cflags_cc': [ ],
         'libraries': ['<(module_root_dir)/vector/lib/vxlapi64.lib'],
         'defines': [ 'DELAYLOAD_HOOK' ],
         'msvs_settings': {
             'VCCLCompilerTool': {
                 'AdditionalOptions': [ '/DELAYLOAD:vxlapi64.dll' ],
                 'ExceptionHandling':1
             }
         },
         'link_settings': {
             'libraries': [ '-DELAYLOAD:vxlapi64.dll' ]
         }
      },
      ...
      ]
}
```

在终端中执行 npx node-gyp 重建，这将产生矢量。节点在 \docan\building\R弹性。 此刻，C/C++ 和 Lib 已被编译并编入节点模块，可被种子文件使用。 如果构建失败，根据错误进行修改。

```plain
cd src/main/docan
npx node-gyp 重建
```

![3](../../../media/dev/adapter/3.png)

---

## 3. 端口和测试

1. CAN设备初始化和传输/接收功能都实现在 index.ts 文件中。 更改原始导入 ZLG 以导入 VECTOR，将所有 ZLG 实现方法更改为VECTOR 实现方法。 简单替换已足够，VECTOR中不存在的所有方法都可以暂时禁用。 导入之前生成的矢量节点后，您可以使用所有矢量API。

    ```plain
    import VECTOR from './../build/Release/vector.node'
    ...
    export class VECTOR_CAN extends CanBase 
    ...
    const devices = VECTOR_CAN.getValidDevices()
    ...
    ```

   索引中的构造器方法。 s 继承自 CanBaseInfo，其中包括在 Electron UI 中选择设备的信息。 通过覆盖 getValidDevices 方法，可用设备列表也被添加到UI 下拉菜单中。

    ```ts
      //New constructor method
      constructor(info: CanBaseInfo) {
        super()
        this.id = info.id //Current subclass uses = property in parent class
        this.info = info
    
        const devices = VECTOR_CAN.getValidDevices() //Method to get device list
    
        const target = devices.find((item) => item.handle == info.handle) //Get handle in device list == handle selected in dropdown
        if (!target) {
          throw new Error('Invalid handle') //Invalid handle, invalid device
        }
    
        this.event = new EventEmitter() //Create an EventEmitter object, then use its methods to emit and listen to events
        this.log = new CanLOG('VECTOR', info.name, this.event) //
    
        //'0:0' = Which bus: channel index
        this.index = parseInt(info.handle.split(':')[1]) //Channel index: :0
        this.deviceType = parseInt(info.handle.split('_')[0]) //Device type in parent class: XL_HWTYPE_VN1611
        this.deviceIndex = parseInt(info.handle.split('_')[2]) //Channel index: _0
    ```

   在索引中添加设备初始化代码后，您可以直接调试索引。 s，但由于最终使用的参数是从UI选择传递的，确保正确的参数传递信息也是至关重要的。  
   在下面创建 vector.test.ts. 下面的\t请\docan 跟随zlg.test.ts. 通过调试.test.ts文件来调试索引文件, 你可以模拟UI中不同的参数设置。 只要.test.ts 测试通行证，Electron的UI参数通过也将确保正确。  
   在 vscode的 launch.json 中添加以下配置来调试.test：

    ```json
    {
        "type": "node",
        "request": "launch",
        "name": "Debug Current test.ts File",
        "autoAttachChildProcesses": true,
        "skipFiles": ["<node_internals>/**", "**/node_modules/**"],
        "program": "${workspaceRoot}/node_modules/vitest/vitest.mjs",
        "args": ["run", "${relativeFile}"],
        "smartStep": true,
        "console": "integratedTerminal"
    },
    ```

2. 下面是如何调试索引的一个例子。 如果Lib 有一个用于查询设备信息的API，您可以首先实现 getValidDevices 功能。 在 vector.test.ts 中创建一个新的测试以实现getValidDevices 方法，并暂时禁用其他关于CAN 传输/接收的测试。

    ```ts
    import { VECTOR_CAN } from '../../src/main/docan/vector'
    ...
    const dllPath = path.join(__dirname, '../../resources/lib')
    VECTOR_CAN.loadDllPath(dllPath)
    ...
    test('vector devices', () => {
    const devices = VECTOR_CAN.getValidDevices()
    console.log(devices)
    })
    ```

   跳转到索引以实现此方法。 例如，矢量获取设备信息的API是 xlGetDriverConfig。 对于API参数所需的数据类型，您可以直接使用 vxlapi.h 中的数据。

    ```ts
      static override getValidDevices(): CanDevice[] {
        //Override getValidDevices method, return value is CanDevice, returns list of available devices
        const devices: CanDevice[] = []
        if (process.platform === 'win32') {
          const deviceHandle = new VECTOR.XL_DRIVER_CONFIG()
          const ret = VECTOR.xlGetDriverConfig(deviceHandle) //Get/print hardware configuration g_xlDrvConfig
          if (ret === 0) {
            ...
              devices.push({
                label: `${channelName}${busType}`, //'VN1640A Channel 1#LIN' = channel name#bus type
                id: `VECTOR_${num}_${busType}`, //'VECTOR_0_#LIN' = channel index_#bus type
                handle: `${channel.hwChannel}:${num}`, //'0:0' = which bus: channel index
                serialNumber: channel.serialNumber
              })
            }
          }
        }
        return devices
      }
    ```

   如果在终端中打印正确的设备信息，它意味着.ts可以正确访问 .Lib API，所有以前的转换步骤都是正确的。  
   ![4](../../../media/dev/adapter/4.png)

   如果.Lib没有获取设备信息的API，您可以使用其他API进行简单测试以测试是否。 ib 正确使用 .ts。 如果您在调试过程中无法访问 API 或 API 错误， 您需要回到先前的步骤并检查生成时是否有错误。 xx 和 .node。 对于getValidDevices，您可以按照.\zlg\index.ts返回一个固定标识符并根据设备特性进行处理。

    ```ts
      static override getValidDevices(): CanDevice[] {
        if (process.platform == 'win32') {
          const zcanArray: CanDevice[] = [
            {
              label: 'ZCAN_USBCANFD_200U_INDEX_0_CHANNEL_0',
              id: 'ZCAN_USBCANFD_200U_INDEX_0_CHANNEL_0',
              handle: `${ZLG.ZCAN_USBCANFD_200U}_0_0`
            },
    ```

3. .LibAPI后可以在.ts中正确使用，请在vector.test中创建矢量设备初始化测试。 这里设定的参数将与信息一起传递到构造函数方法。

    ```ts
    描述('矢量测试', () => *
      let client! VECTOR_CAN
      preall(() => Power
        client = new VECTOR_CAN(*
          handle: '3:3',
          名: 'test',
          id: 'VECTOR_3_#CAN',
          供应商: 'vector',
          可以: true
          比特率:
            sjw: 1,
            时间Seg1: 13,
            时间Seg2: 2,
            预缩放: 10,
            freq: 500000,
            时钟: '80'
          },
          bitratefdd：vol.
            sjw：1。
            timeSeg1: 7,
            时间Seg2: 2,
            预缩放: 4,
            频率： 2000000，
            时钟: '80'
          }
        })
    })
    ```

   在 index.ts 中，传递的参数信息索引将确定通过getValidDevices 返回的设备通道。 在频道匹配后，将进一步执行其他初始化功能。

    ```ts
      constructor(info: CanBaseInfo) {
        const devices = VECTOR_CAN.getValidDevices() //Method to get device list
        this.index = parseInt(info.handle.split(':')[1]) //Channel index: :0
    
        const DrvConfig = new VECTOR.XL_DRIVER_CONFIG()
        let xlStatus = VECTOR.xlGetDriverConfig(DrvConfig) //Get/print hardware configuration g_xlDrvConfig
    
        const channles = VECTOR.CHANNEL_CONFIG.frompointer(DrvConfig.channel) //Channel configuration
        this.channelConfig = channles.getitem(this.index) //Channel number
    
        // Channel mask calculation
        this.channelMask = VECTOR.xlGetChannelMask(
          this.channelConfig.hwType,
          this.channelConfig.hwIndex,
          this.channelConfig.hwChannel
        )
        ....
        xlStatus = VECTOR.xlOpenPort(
            this.PortHandle.cast(),
            'EcuBus-Pro',
            this.channelMask,
            this.PermissionMask.cast(),
            16384,
            4,
            1
        )
    ```

   ![5](../../../media/dev/adapter/5.png)

   不同的设备具有截然不同的初始化过程，这里不会被描述。 根据实际情况将它们添加到构造器方法中。 对于CAN 传输/接收功能，您可以首先在构造器中实现它们，确保传输/接收正常， 然后将发送函数移植到 _writeBase，接收函数以回调，回调，并执行其他方法，如关闭，getError等。 同样的方式。 也在vector.test中测试传输/接收。

    ```ts
      test.skip('write multi frame', async () => Power
    
      test('read frame', async () => Power
    
      test('write framecan-fd', async () =>
    ```

   ![6](../../../media/dev/adapter/6.png)

   最后，tsfn.cxx 也有一些API实现，而只是替换原始相应的功能实现。

4. 许多.Lib API 参数必须使用特定的数据类型，否则发生错误。 TypeScript 没有这种丰富的基本类型，因此您需要重新封装vxlapi.h 类型的矢量.i 中的.ts 使用。 以下是常见情况：

参数是指针类型，需要定义指针类：

```plain
vxlapi.h
    typef XLlong XLportHandle;
vector.
    %pointer_class(XLportHandle, XLPORTHANDLE)
    %pointer_class(未签名, UINT32)
    %pointer_class(无符号短，UINT16)
索引。 s
    private PortHandle = new VECTOR.XLPORTHANDLE()
    this.PortHandle ASt(),
    const cntSent = new VECTOR.UINT32()
    cntSent.assignment(1)
    cntSent.cast()
```

参数是数组结构指针类型，需要定义数组类别：

```plain
vxlapi.h
    typedef struct {
    ...
    XL_CAN_RX_EVENT_UNION tagData;
    } XLcanRxEvent;
vector.i
    %array_class(XLcanRxEvent, XLCANRXEVENT);
index.ts
    const frames = new VECTOR.XLCANRXEVENT(1)
    xlStatus = VECTOR.xlCanReceive(this.PortHandle.value(), frames.cast())
```

CAN 传输/接收接口参数具有多个结构类型，需要定义访问数组类别：

```plain
vxlapi.h
    struct s_xl_can_msg {
    ...
    unsigned char  data[MAX_MSG_LEN];
    };

    union s_xl_tag_data {
    struct s_xl_can_msg                  msg;
    ...
    };

    struct s_xl_event {
    XLeventTag     tag;
    ...
    union s_xl_tag_data tagData;
    };

vector.i
    %array_class(unsigned char, UINT8ARRAY)

index.ts
    const framedata = new VECTOR.s_xl_event()
    framedata.tag = 10
    const dataPtr = VECTOR.UINT8ARRAY.frompointer(framedata.tagData.msg.data)
    for (let i = 0; i < data.length; i++) {
        dataPtr.setitem(i, data[i])
    }
```

vxlapi.h的一些结构需要提取：

```plain
typedef struct {
    ...
} XL_CAN_TX_MSG;

typedef struct {
  unsigned short     tag;              //  2 - type of the event
  unsigned short     transId;          //  2
  unsigned char      channelIndex;     //  1 - internal has to be 0
  unsigned char      reserved[3];      //  3 - has to be zero 

  union {
    XL_CAN_TX_MSG   canMsg;
  } tagData;
} XLcanTxEvent;
```

例如，成员canMsg 需要重新定义为 XL_CAN_TX_MSG_UNION，否则.ts 无法访问它：

```plain
typedef union {
  XL_CAN_TX_MSG   canMsg;
} XL_CAN_TX_MSG_UNION;


typedef struct {
  unsigned short     tag;              //  2 - type of the event
  unsigned short     transId;          //  2
  unsigned char      channelIndex;     //  1 - internal has to be 0
  unsigned char      reserved[3];      //  3 - has to be zero 

  XL_CAN_TX_MSG_UNION tagData;
} XLcanTxEvent;
```

每次您修改 vxlapi.h 和 vector.i 时，您需要重新运行 s。 在 npx node-gyp 重建以重新生成 .node 以确保它在 .ts 中生效。

在vector.test.ts 测试通行证后，添加到UI中提及[在UI中添加](../adapter#add-in-ui)，此处不作描述。
