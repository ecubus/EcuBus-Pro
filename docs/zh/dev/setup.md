# 安装设置

如果您刚接触 JavaScript 或 TypeScript 生态，可以先阅读 [JavaScript/TypeScript 学习资源](./jslearn.md)。

如果您需要带截图的 Windows 图文安装说明，请参考 [详细 Windows 安装指南](./detialSetup.md)。

## 概览

EcuBus-Pro 是一个基于 Electron、Vue 和 TypeScript 的项目，并且包含多个通过 `node-gyp` 构建的原生模块。
典型的本地开发流程如下：

1. 安装所需工具链。
2. 安装项目依赖。
3. 在需要时构建原生模块。
4. 启动开发环境。

## 前置依赖

- `Node.js` 22.x
- `npm`
- `node-gyp` 所需的 `Python` 与 C/C++ 构建工具链

### 平台说明

- 在 Windows 上，建议先安装 Visual Studio C++ Build Tools，再编译原生模块。
- 在 Linux 和 macOS 上，请先准备好 `node-gyp` 所需的平台编译环境。
- 仓库中的硬件适配器支持因平台而异，其中 Windows 支持的适配器最完整。

## 安装

克隆仓库：

```bash
git clone https://github.com/ecubus/EcuBus-Pro.git
cd EcuBus-Pro
```

安装依赖：

```bash
npm install
```

执行 `npm install` 时，还会自动运行项目的 `postinstall` 步骤，用于安装 Electron 应用依赖。

## 启动开发环境

运行以下命令启动桌面应用开发模式：

```bash
npm run dev
```

对于大多数贡献者来说，完成初始化安装后，这就是最常用的开发命令。

## 构建原生模块

部分功能依赖原生模块。如果您修改了原生代码，或者当前环境还没有可用的编译产物，请执行：

```bash
npm run native
```

该命令会构建以下模块：

- `docan`
- `dolin`
- `someip`

如果您只需要构建 worker 依赖并打包 worker 输出，可以执行：

```bash
npm run worker
```

## 常用开发命令

### 文档

本地启动文档站点：

```bash
npm run docs:dev
```

构建文档站点：

```bash
npm run docs:build
```

### 类型检查

执行全部类型检查：

```bash
npm run typecheck
```

### 代码检查与格式化

运行 ESLint：

```bash
npm run lint
```

使用 Prettier 格式化整个仓库：

```bash
npm run format
```

### 测试

运行测试套件：

```bash
npm run test
```

更多测试命令请参考 [测试](./test.md)。

### API 文档

生成 API 文档：

```bash
npm run api
```

## 构建产物

构建桌面应用：

```bash
npm run build
```

平台打包命令：

- Windows：`npm run build:win`
- macOS：`npm run build:mac`
- Linux：`npm run build:linux`

构建 CLI：

- 开发模式：`npm run cli:dev`
- 通用构建：`npm run cli:build`
- Windows 打包：`npm run cli:build:win`
- Linux 打包：`npm run cli:build:linux`
- macOS 打包：`npm run cli:build:mac`

构建 SDK：

```bash
npm run build:sdk
```

## 排查问题

- 如果原生模块编译失败，请先检查 `node-gyp`、Python 和 C/C++ 构建工具链是否安装完整。
- 如果您在 Windows 上开发，并且需要更细致的安装说明，请参考 [详细 Windows 安装指南](./detialSetup.md)。
- [`.github/workflows`](https://github.com/ecubus/EcuBus-Pro/tree/master/.github/workflows) 中的 CI 配置也可以作为命令和构建流程的参考。
