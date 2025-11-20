# 设置

如果您不熟悉 JavaScript/TypeScript，可以从 [JavaScript/TypeScript 学习资源](./jslearn.md) 获取一些学习资料

## 详细 Windows 设置指南

您可以从 [详细 Windows 设置指南](./detialSetup.md) 获取详细的设置步骤

## 先决条件

- Node.js (v22)
- npm
- Node-gyp

## 安装步骤

```bash
git clone https://github.com/ecubus/EcuBus-Pro.git
```

```bash
cd EcuBus-Pro
```

```bash
npm install
```

## 构建步骤

### 构建文档

```bash
npm run docs:build
```

### 构建原生模块

```bash
npm run native
```

### 构建工作器

```bash
npm run worker
```

### 构建 API

```bash
npm run api
```

### 构建 CLI (Windows)

```bash
npm run cli:build:win
```

### 运行开发

```bash
npm run dev
```

### 构建应用程序 (Windows)

```bash
npm run build:win
```

## 从 Github Action 获取

您也可以从 [Github Action](https://github.com/ecubus/EcuBus-Pro/tree/master/.github/workflows) 获取详细的设置步骤
