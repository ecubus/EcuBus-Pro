# 构建命令

`build` 命令将您的 EcuBus-Pro 项目中的 TypeScript 脚本文件编译为 JavaScript。 它使用项目的 TypeScript 配置和 esbuild 来打包和转译您的脚本。 您可以选择对输出进行压缩和混淆以便分发。

## 语法

```bash
ecb_cli build <project> <file> [options]
```

## 参数

- **project**: EcuBus-Pro 项目文件（`.ecb`）的路径。 可以是绝对路径，也可以是相对于当前工作目录的相对路径。

- **file**: 要构建的 TypeScript 脚本文件的路径（例如 `node.ts`）。 如果不是绝对路径，则首先相对于项目目录解析，然后相对于当前工作目录解析。

## 选项

- **-m, --minify**: 压缩并混淆输出代码。 这会使代码更难以阅读和逆向工程。 混淆包括控制流扁平化、字符串编码、死代码注入和标识符混淆。 混淆后会移除源映射，因此不支持调试混淆后的输出。

- **-o, --output &lt;dir&gt;**：编译后 JavaScript 文件的输出目录。 默认为项目根目录下的 `.ScriptBuild`。 给定路径相对于项目目录。

- **-l, --log-level &lt;level&gt;**：设置日志级别（`error`、`warn`、`info`、`debug`）。 默认为 `info`。

- **-h, --help**：显示 build 命令的帮助信息。

## 输出

- 编译后的文件以 `<basename>.js` 的形式写入输出目录（默认：`project/.ScriptBuild/`）。
- 当不使用 `--minify` 时，会生成源映射文件 `<basename>.js.map`。
- 当使用 `--output` 时，构建的文件及其源映射（如果有）将被复制到指定目录。

## 示例

### 基本构建

编译项目中的 `node.ts`：

```bash
ecb_cli build D:\path\to\project\Can.ecb node.ts
```

或使用相对项目路径：

```bash
ecb_cli build ./resources/examples/can/Can.ecb node.ts
```

### 使用混淆进行构建

编译并混淆输出：

```bash
ecb_cli build Can.ecb node.ts -m
```

### 构建到自定义输出目录

将编译后的文件放入项目下的 `dist` 文件夹：

```bash
ecb_cli build Can.ecb node.ts -o dist
```

### 使用调试日志进行构建

```bash
ecb_cli build Can.ecb node.ts --log-level=debug
```


