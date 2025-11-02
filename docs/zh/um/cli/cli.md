# EcuBus-Pro CLI

EcuBus-Pro 提供命令行界面（CLI），可在无 GUI 的情况下运行你的代码。
它适用于自动化、测试与调试。CLI 构建于 EcuBus-Pro 核心之上，
因此你可以复用与 GUI 中相同的脚本与插件。

## CLI 安装路径

`${InstallPath}/resources/app.asar.unpacked/resources/lib`
你可以将该路径添加到系统环境变量 `PATH`，以便在任意目录使用 `ecb_cli` 命令。

注意：Arch Linux 预装了 `/usr/bin/ecb_cli`，可直接使用 `ecb_cli`。

## 用法（Usage）

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

`pnpm` 是一款 JavaScript 包管理器，速度快、磁盘占用小，且对 monorepo 有优化。
更多信息见 [pnpm 文档](https://pnpm.io/)。我们已将 `pnpm` 集成到 EcuBus-Pro CLI，
因此你可以使用 `pnpm` 命令为项目安装依赖。

*通过 CLI 运行 pnpm。*

```bash
ecb_cli pnpm -h

ecb_cli pnpm init

ecb_cli pnpm install package_name
```

#### 示例（pnpm）

![alt text](./../script/SerialPort/pnpm.gif)

### Test 命令

*通过 CLI 运行测试。*

```bash
ecb_cli test -h
```

`test` 命令允许你在命令行中运行 EcuBus-Pro 项目中的测试配置。
这对于自动化测试、持续集成以及在不启动 GUI 的情况下进行回归测试非常有用。

#### 语法（Syntax）

```bash
ecb_cli test <project> <name> [options]
```

#### 参数（Arguments）

- `project`：EcuBus-Pro 项目文件（.ecb）的路径
- `name`：要运行的测试配置名称

#### 选项（Options）

- `-r, --report <report>`：指定报告文件名（HTML 格式）
- `-b, --build`：在运行测试前强制构建
- `--log-level <level>`：设置日志级别（error、warning、info、debug），默认 "info"
- `-h, --help`：显示帮助信息

#### 示例（test）

![alt text](test.gif)
