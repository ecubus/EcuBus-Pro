# 监听变量的变化，发送Lin信号并手动设置错误的CheckSum

> 感谢Alex提供示例

## CAPL分析
给到的CAPL示例如下：
```ts
on envVar EnvChecksumError  
{
  if (1 == getValue(EnvChecksumError))  // Checksum err
  {
     write("Checksum err");
    linSetManualChecksum(frmAC_1, linGetChecksum(frmAC_1) - 1);
    //linSetManualChecksum(frmReq, linGetChecksum(frmReq) - 1);
    
    //output(frmReq);
    output(frmAC_1);
  }
}
```

### CAPL代码解析

这段CAPL脚本的核心逻辑如下：

1. **环境变量监听**：`on envVar EnvChecksumError` 监听名为 `EnvChecksumError` 的环境变量变化
2. **条件判断**：当变量值为1时，触发错误注入逻辑
3. **错误注入**：
   - `linGetChecksum(frmAC_1)` 获取正确的CheckSum值
   - `linSetManualChecksum(frmAC_1, checksum - 1)` 手动设置一个错误的CheckSum（减1）
   - `output(frmAC_1)` 发送带有错误CheckSum的Lin消息

> [!NOTE]
> - **技术要点**：Lin总线的CheckSum机制是保证数据完整性的重要手段。通过故意设置错误的CheckSum，可以测试接收节点的错误处理能力。
> - **测试设备**：这里我们选择[LinCable](https://app.whyengineer.com/zh/docs/um/hardware/lincable.html)作为测试设备，因为它可以灵活的注入各种LIN错误。

## EcuBus-Pro中的变量配置

### 第一步：创建环境变量

要实现变量监听功能，首先需要在EcuBus-Pro中创建对应的环境变量。环境变量是脚本与用户界面交互的重要桥梁。

> **操作路径**：Others → Variable → Add Variable

![创建变量](./../../../media/um/script/var1.png)

**变量配置要点**：
- **变量名称**：`EnvChecksumError`（需与CAPL脚本中的变量名保持一致）
- **变量类型**：整型（Integer）
- **初始值**：0（表示正常状态）
- **取值范围**：0-1（0=正常，1=触发错误）

### 第二步：验证变量创建

创建完成后，可以在变量列表中查看和管理已创建的变量：

![查看变量](./../../../media/um/script/var2.png)

在变量列表中，您可以：
- 查看变量的当前值
- 修改变量配置
- 删除不需要的变量
- 导出/导入变量配置


## 用户界面控制面板配置

### 第三步：创建控制面板

为了方便在测试过程中动态控制变量值，我们需要创建一个用户界面面板。通过图形化界面，测试人员可以实时切换变量状态，无需修改代码。

> **操作路径**：Home → Panel → Add Panel

![创建面板](./../../../media/um/script/var3.png)

**面板设计建议**：
- 使用**开关按钮**或**切换按钮**来控制0/1状态
- 按钮文字设置为"发送CheckSum错误帧"等描述性文字
- 合理布局，确保操作直观易懂

### 第四步：变量绑定

创建面板控件后，需要将其与环境变量进行绑定，建立控件与变量之间的双向数据关联。

![绑定变量](./../../../media/um/script/var4.png)

**绑定配置**：
- **目标变量**：选择之前创建的 `EnvChecksumError` 变量
- **控件类型**：布尔型开关（Boolean Switch）
- **映射关系**：OFF=0（正常），ON=1（触发错误）

### 第五步：界面预览

配置完成后，可以预览最终的用户界面效果：

![查看面板](./../../../media/um/script/var5.png)

**界面特点**：
- 实时显示当前变量状态
- 支持一键切换操作
- 直观的视觉反馈

## EcuBus-Pro TypeScript脚本实现

### 第六步：编写TypeScript脚本

现在我们将CAPL逻辑转换为EcuBus-Pro的TypeScript脚本。相比CAPL，TypeScript提供了更好的类型安全和开发体验。

```typescript
Util.OnVar("EnvChecksumError", ({ value }) => {
    if (value == 1) {
        console.log("Checksum err");
        const msg: LinMsg =
        {
            frameId: 0x3c,
            direction: LinDirection.SEND,
            data: Buffer.from([0x60, 0x01, 0xb5, 0xff, 0xff, 0xff, 0xff, 0xff]),
            checksumType: LinChecksumType.CLASSIC,
            lincable:{
                checkSum:3,//错误的校验和
            }
        }
        output(msg);
    }
});
```

### 脚本详细解析

**1. 变量监听机制**
```typescript
Util.OnVar("EnvChecksumError", ({ value }) => {
    // 回调函数，当变量值改变时触发
});
```
- `Util.OnVar()` 是EcuBus-Pro提供的变量监听API
- 支持解构赋值语法，直接获取 `value` 参数
- 回调函数在变量值发生变化时自动触发

**2. Lin消息构造**
```typescript
const msg: LinMsg = {
    frameId: 0x3c,              // Lin帧ID（十六进制）
    direction: LinDirection.SEND, // 发送方向
    data: Buffer.from([...]),    // 数据字节数组
    checksumType: LinChecksumType.CLASSIC, // 校验和类型
    lincable: {
        checkSum: 3             // 手动设置的错误校验和
    }
}
```

**3. 关键参数说明**

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `frameId` | Lin帧标识符 | `0x3c` (60) |
| `direction` | 消息方向 | `LinDirection.SEND` |
| `data` | 数据负载 | 8字节数据数组 |
| `checksumType` | 校验类型 | `CLASSIC` 或 `ENHANCED` |
| `checkSum` | 手动校验和 | `3`（故意设置错误值） |

**4. 错误注入原理**

正常情况下，Lin消息的CheckSum应该根据数据内容自动计算。但在测试场景中，我们通过 `lincable.checkSum` 手动指定一个错误的值（如3），从而模拟传输错误，测试接收节点的错误处理能力。

## 测试运行与验证

### 第七步：运行测试

完成所有配置后，就可以运行测试了。通过界面上的开关按钮控制变量值，观察Lin消息的发送情况。

![运行](./../../../media/um/script/var1.gif)