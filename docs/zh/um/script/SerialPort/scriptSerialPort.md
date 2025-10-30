# 使用外部包

EcuBus-Pro 脚本基于 Node.js，因而你可以在脚本中使用任意 Node.js 包。
安装依赖有两种方式：

## 方法一：使用包管理器界面

首次在项目中使用包管理器前，需要先初始化 `package.json`。

EcuBus-Pro 提供图形化的包管理器界面，便于安装、管理与卸载依赖。

1. 新建项目时，你会看到 “No package.json found” 提示和
   “Initialize package.json” 按钮。点击按钮创建 `package.json` 文件。

2. 在主界面左侧导航中点击 “Packages”。
  ![Package Manager](package.png)

3. 在包管理器界面：
   * 输入要安装的包名
   * 选择安装类型（Dependencies 或 Dev Dependencies）
   * 点击 “Install” 按钮

4. 可在底部的 “Installed Packages” 区域查看并管理已安装的依赖。

## 方法二：使用 EcuBus-Pro CLI

也可以通过 EcuBus-Pro CLI 中的 `pnpm` 命令安装依赖。
更多细节参见
[EcuBus-Pro CLI](../../cli/cli.md)。

### 通过 CLI 安装

在项目根目录安装 `serialport` 包：

```bash
ecb_cli pnpm install serialport
```

![Installation Process](pnpm.gif)

## 用法示例

以下示例展示了如何在脚本中使用 `serialport` 包。
关于该包的更多信息，请参见
[serialport 官网](https://serialport.io/)。

### 代码示例

```typescript
import { SerialPort } from 'serialport'
// open port with path and baud rate
const port = new SerialPort({
  path: 'COM9',
  baudRate: 57600,
  autoOpen: true
})
// get port list
SerialPort.list()
  .then((ports) => {
    console.log(ports)
  })
  .catch((err) => {
    console.error(err)
  })
```

### 运行结果

![Running Result](serialPort.gif)
