# Build Command

The `build` command compiles TypeScript script files in your EcuBus-Pro project into JavaScript. It uses the project's TypeScript configuration and esbuild to bundle and transpile your scripts. You can optionally minify and obfuscate the output for distribution.

## Syntax

```bash
ecb_cli build <project> <file> [options]
```

## Arguments

- **project**: Path to the EcuBus-Pro project file (`.ecb`). Can be absolute or relative to the current working directory.

- **file**: Path to the TypeScript script file to build (e.g. `node.ts`). If not absolute, it is resolved relative to the project directory first, then relative to the current working directory.

## Options

- **-m, --minify**: Minify and obfuscate the output code. This makes the code harder to read and reverse-engineer. Obfuscation includes control-flow flattening, string encoding, dead-code injection, and identifier mangling. Source maps are removed after obfuscation, so debugging the obfuscated output is not supported.

- **-o, --output &lt;dir&gt;**: Output directory for the compiled JavaScript file. Default is `.ScriptBuild` under the project root. The given path is relative to the project directory.

- **-l, --log-level &lt;level&gt;**: Set the log level (`error`, `warn`, `info`, `debug`). Default is `info`.

- **-h, --help**: Show help for the build command.

## Output

- The compiled file is written as `<basename>.js` in the output directory (default: `project/.ScriptBuild/`).
- A source map file `<basename>.js.map` is generated when not using `--minify`.
- When using `--output`, the built file and its source map (if any) are copied to the specified directory.

## Examples

### Basic build

Compile `node.ts` in the project:

```bash
ecb_cli build D:\path\to\project\Can.ecb node.ts
```

Or with a relative project path:

```bash
ecb_cli build ./resources/examples/can/Can.ecb node.ts
```

### Build with obfuscation

Compile and obfuscate the output:

```bash
ecb_cli build Can.ecb node.ts -m
```

### Build to a custom output directory

Put the compiled file in a `dist` folder under the project:

```bash
ecb_cli build Can.ecb node.ts -o dist
```

### Build with debug logging

```bash
ecb_cli build Can.ecb node.ts --log-level=debug
```


