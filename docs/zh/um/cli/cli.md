# EcuBus-Pro CLI

EcuBus-Pro 提供了一个命令行界面（CLI），允许您在没有 GUI 的情况下运行代码。 它对于自动化、测试和调试非常有用。 CLI 构建在 EcuBus-Pro 核心之上，因此您可以使用在 GUI 中使用的相同脚本和插件。

## CLI 安装路径

`${InstallPath}/resources/app.asar.unpacked/resources/lib` 您可以将此路径添加到系统环境变量 `PATH` 中，以便在任何目录中使用 `ecb_cli` 命令。

注意：Arch Linux 预装了 `/usr/bin/ecb_cli`，允许您直接使用 `ecb_cli`。

## 用法

```bash
ecb_cli -h
```

### Seq 命令

通过 CLI 运行 UDS 序列。

```bash
ecb_cli seq -h
```

#### 示例（seq）

```bash
ecb_cli seq xx.ecb Tester_1 --log-level=debug
```

![seq](./../../../media/um/seq.png)

### PNPM 命令

`pnpm` 是一个 JavaScript 包管理器，速度快、磁盘空间效率高，并针对 monorepo 进行了优化。 更多详情请参阅 [pnpm 文档](https://pnpm.io/)。 我们将 `pnpm` 集成到 EcuBus-Pro CLI 中，因此您可以使用 `pnpm` 命令安装项目的依赖项。

_通过 CLI 运行 pnpm。_

```bash
ecb_cli pnpm -h

ecb_cli pnpm init

ecb_cli pnpm install package_name
```

#### 示例（pnpm）

![alt text](../../../media/um/script/SerialPort/pnpm.gif)

### Test 命令

_通过 CLI 运行测试。_

```bash
ecb_cli test -h
```

test 命令允许您通过命令行从 EcuBus-Pro 项目运行测试配置。 这对于无需启动 GUI 的自动化测试、持续集成和回归测试非常有用。

#### 语法

```bash
ecb_cli test <project> <name> [options]
```

#### 参数

- `project`：EcuBus-Pro 项目文件（.ecb）的路径
- `name`：要运行的测试配置的名称

#### 选项

- `-r, --report <report>`：指定报告文件名（HTML 格式）
- `-b, --build`：在运行测试前强制构建
- `--log-level <level>`：设置日志级别（error、warning、info、debug）。
  默认为 "info"
- `-h, --help`：显示帮助信息

#### 示例（test）

![alt text](../../../media/um/cli/test.gif)
