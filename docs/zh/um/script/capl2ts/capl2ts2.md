# 监视变量更改，发送LIN信号，并手动设置不正确的校验和

> 感谢Alex 提供示例

## CAPL 分析

提供的验证码示例如下：

```ts
关于envVar EnvChecksum Errors  
Power
  if (1 == getValue(EnvChecchsumError)) // 校验和err

     write("校验和错误");
    linSetManualChecksum(frmAC_1, linGetchecksum(frmAC_1) - 1)；
    /linSetManualChecksum(frmReq, linGetChecksum(frmReq) - 1)；
    
    /output(frmReq);
    output(frmAC_1);
  }
}
```

### CAPL 代码 Walk

此CAPL脚本的核心逻辑是：

1. **环境变量监听**: `on envVar EnvChecksumError` 监听器用于更改 `EnvChecchsumError` 环境变量
2. **条件检查**：当变量值为1时，触发错误注入逻辑。
3. **错误注入**：
   - `linGetChecksum(frmAC_1)` 获取正确的校验和值
   - `linSetManualChecksum(frmAC_1, 校验和 - 1)` 手动设置了一个不正确的校验和 (负1)
   - `output(frmAC_1)` 发送一个带有错误校验和的 LIN 消息

> [!注意]
>
> - **技术说明**：LIN总线校验和机制对于确保数据的完整性至关重要。 通过故意设置错误的校验和，您可以测试接收节点的错误处理能力。
> - **测试设备**：我们选择 [LinCable](https://app.whyengineer.com/zh/docs/um/hardware/lincable.html作为测试设备，因为它可以灵活注入各种LIN错误。

## EcuBus-Pro 变量配置

### 第 1 步：创建环境变量

要实现变量监视，首先在EcuBus-Pro中创建相应的环境变量。 环境变量是脚本和用户界面之间的重要桥梁。

> **路径**: Others → 添加变量

![创建变量](./../../../../media/um/script/var1.png)

#### 密钥变量设置

- **名称**: `EnvChecksumError` (必须匹配CAPL 脚本中的变量名称)
- **类型** ：整数
- **初始值**: 0 (普通状态)
- **范围**: 0-1 (0 = 普通, 1 = 触发错误)

### 第 2 步：验证变量

创建后，您可以查看和管理变量列表中的变量：

![查看变量](./../../../../media/um/script/var2.png)

在变量列表中，您可以：

- 查看变量的当前值
- 修改变量配置
- 删除不必要的变量
- 导出/导入变量配置

## 界面控制面板配置

### 第 3 步：创建控制面板

要动态控制测试期间的变量值，请创建一个用户界面板。 通过图形界面，测试者可以实时切换变量状态而不修改代码。

> **路径**：首页 -> 添加面板

![Create panel](./../../../../media/um/script/var3.png)

#### B. 小组设计建议

- 使用 **switch** 或 **teggle** 控制来表示0/1 状态
- 设置描述性按钮文本，如“发送校验和错误帧”
- 明确设置控制以确保直观操作

### 第 4 步：绑定变量

在创建面板控制后，将它与环境变量结合起来，在控制和变量之间建立双向数据联系。

![绑定变量](./../../../../media/um/script/var4.png)

#### 绑定设置

- **目标变量**：选择先前创建的 `EnvChecksum Error` 变量
- **控制类型**：布尔切换
- **映射**：OFF= 0 (正常)，ON = 1 (触发错误)

### 步骤 5：预览界面

配置后，您可以预览最终用户界面：

![Preview panel](./../../../../media/um/script/var5.png)

#### 界面高亮显示

- 实时显示当前变量状态
- 支持一次点击切换操作
- 提供直观的视觉反馈

## EcuyBus-Pro TypeScript 实现

### 步骤 6：写入 TypeScript 脚本

现在我们将CAPL逻辑转换为EcuBus-Pro TypeScript脚本脚本。 与CAPL相比，TypeScript 提供更好的类型安全和更好的开发体验。

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
                checkSum:3,// wrong checksum
            }
        }
        output(msg);
    }
});
```

### 详细的脚本走路

#### 1. 可变观察机制

```typescript
Util.OnVar("EnvChecksumError", ({ value }) => {
    // Callback, triggered when the variable value changes
});
```

- `Util.OnVar()` 是由EcuBus-Pro 提供的变量监视API
- 支持销毁作业以直接获取 `value` 参数
- 当变量值改变时，回调将自动触发

#### 2. LIN 消息设计

```typescript
const msg: LinMsg = Power
    frameId: 0x3c, // LIN 帧ID (hex)
    方向：链接方向。 结束, // 发送方向
    数据: 缓存. rom([...]), // Data byte 数组
    checksumType: Linchecksumtype. LASSIC, // 校验和类型
    lincable: Power
        checkSum: 3 // 手动设置不正确校验和
    }
}
```

#### 3. 关键参数描述

| 参数             | 描述                   | 示例                             |
| -------------- | -------------------- | ------------------------------ |
| `frameId`      | LIN frame identifier | `0x3c` (60) |
| `方向`           | 消息方向                 | `LinDirection.SEND`            |
| `data`         | 数据负载                 | 8字节数据阵列                        |
| `checksumType` | 校验和类型                | `CLASSIC`或`ENHANCED`           |
| `checkSum`     | 手动校验和                | `3` (故意不正确) |

#### 4. 错误注入原则

在正常情况下，LIN电文的校验和应根据数据内容自动计算。 在测试场景时，我们通过`lincable.checkSum`手动指定一个不正确的值(例如3)，模拟传输错误并测试接收节点的错误处理能力。

## 测试运行与验证

### 第 7 步：运行测试

完成所有配置后，运行测试。 使用界面上的切换按钮来控制变量值并观察LIN消息的发送。

![Run](./../../../../media/um/script/var1.gif)
