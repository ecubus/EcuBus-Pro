# 使用外部包

由于 EcuBus-Pro 脚本基于 Node.js，您可以在脚本中使用任何 Node.js 包。 有两种安装包的方式： 有两种安装包的方式：

## 方法 1：使用包管理器界面

首次使用项目时，您需要在安装包之前初始化 package.json 文件。

EcuBus-Pro 提供了一个图形化的包管理器界面，方便安装、管理和卸载包。

1. 对于新项目，您会看到一条消息“未找到 package.json”和一个“初始化 package.json”按钮。 点击此按钮以创建新的 package.json 文件。 点击此按钮以创建新的 package.json 文件。

2. 在主界面的左侧导航栏中点击“Packages”选项
   ![包管理器](../../../../media/um/script/SerialPort/package.png)

3. 在包管理器界面中：
   - 输入您要安装的包的名称
   - 选择安装类型（依赖项或开发依赖项）
   - 点击“安装”按钮

4. 您可以在底部的“已安装包”部分查看和管理已安装的包

## 方法 2：使用 EcuBus-Pro CLI

您也可以在 EcuBus-Pro CLI 中使用 `pnpm` 命令安装包。 详情请参阅 [EcuBus-Pro CLI](cli.md)。 详情请参阅 [EcuBus-Pro CLI](cli.md)。

### 通过 CLI 安装

在您的项目根目录中安装 `serialport` 包。

```bash
ecb_cli pnpm install serialport
```

![安装过程](../../../../media/um/script/SerialPort/pnpm.gif)

## 使用示例

以下是如何在脚本中使用 `serialport` 包的示例。
有关 `serialport` 包的更多信息，请参阅 [serialport 网站](https://serialport.io/)。
有关 `serialport` 包的更多信息，请参阅 [serialport 网站](https://serialport.io/)。

### 代码示例

```typescript
import { SerialPort } from 'serialport'
//open port with path and baudrate
const port = new SerialPort({
  path: 'COM9',
  baudRate: 57600,
  autoOpen: true
})
//get port list
SerialPort.list()
  .then((ports) => {
    console.log(ports)
  })
  .catch((err) => {
    console.error(err)
  })
```

### 运行结果

![运行结果](../../../../media/um/script/SerialPort/serialPort.gif)

