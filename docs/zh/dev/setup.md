# 安装设置

如果您是 JavaScript 或 TypeScript 生态系统的新手，请从 [JavaScript/TypeScript 学习资源](./jslearn.md) 开始。

如需包含截图的 Windows 分步演练，请参阅 [详细的 Windows 设置指南](./detialSetup.md)。

## 概述

EcuBus-Pro 是一个 Electron + Vue + TypeScript 项目，包含多个通过 `node-gyp` 构建的原生模块。
典型的本地工作流程是：

1. 安装所需的工具链。
2. 安装项目依赖项。
3. 在需要时构建原生模块。
4. 启动开发应用。

## 先决条件

- `Node.js` 22.x
- `npm`
- `node-gyp` 所需的 `Python` 和 C/C++ 构建工具

### 平台说明

- 在 Windows 上，编译原生模块之前请安装 Visual Studio C++ 构建工具。
- 在 Linux 和 macOS 上，请确保 `node-gyp` 所需的平台工具链已可用。
- 原生硬件适配器支持因平台而异。 Windows 支持此代码库中最广泛的适配器集。

## 安装

克隆代码库：

```bash
git clone https://github.com/ecubus/EcuBus-Pro.git
cd EcuBus-Pro
```

安装依赖项：

```bash
npm install
```

`npm install` 还将运行项目的 `postinstall` 步骤以安装 Electron 应用依赖项。

## 开始开发

在开发模式下运行桌面应用程序：

```bash
npm run dev
```

这是大多数贡献者在完成初始设置后需要的主要命令。

## 构建原生模块

某些功能依赖于原生模块。 当您更改原生代码或您的环境中尚未有编译产物时，请构建它们：

```bash
npm run native
```

此命令构建：

- `docan`
- `dolin`
- `someip`

要仅构建工作线程原生依赖项并打包工作线程输出：

```bash
npm run worker
```

## 常用开发命令

### 文档

在本地启动文档站点：

```bash
npm run docs:dev
```

构建文档站点：

```bash
npm run docs:build
```

### 类型检查

运行所有类型检查：

```bash
npm run typecheck
```

### 代码检查与格式化

运行 ESLint：

```bash
npm run lint
```

使用 Prettier 格式化代码库：

```bash
npm run format
```

### 测试

运行测试套件：

```bash
npm run test
```

更多测试命令记录在 [Test](./test.md) 中。

### API 文档

生成 API 文档：

```bash
npm run api
```

## 构建输出

构建桌面应用程序：

```bash
npm run build
```

特定于平台的打包命令：

- Windows：`npm run build:win`
- macOS：`npm run build:mac`
- Linux：`npm run build:linux`

构建 CLI：

- 开发模式：`npm run cli:dev`
- 跨平台打包：`npm run cli:build`
- Windows 包：`npm run cli:build:win`
- Linux 包：`npm run cli:build:linux`
- macOS 包：`npm run cli:build:mac`

构建 SDK 包：

```bash
npm run build:sdk
```

## 故障排除

- 如果原生模块编译失败，请首先验证您的 `node-gyp`、Python 和 C/C++ 构建工具链设置。
- 如果您在 Windows 上进行开发并且需要更详细的设置流程，请使用 [详细 Windows 设置指南](./detialSetup.md)。
- [`.github/workflows`](https://github.com/ecubus/EcuBus-Pro/tree/master/.github/workflows) 中的 GitHub 工作流文件也是 CI 中所用命令的良好参考。
