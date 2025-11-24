# EcuBus-Pro CLI

EcuBus-Pro provides a command line interface (CLI) that allows you run your
code without the GUI. It's useful for automation, testing, and debugging. The
CLI is built on top of the EcuBus-Pro core, so you can use the same scripts and
plugins that you use in the GUI.

## CLI Installed Path

`${InstallPath}/resources/app.asar.unpacked/resources/lib` you can add this
path to your system environment variable `PATH` to use the `ecb_cli` command in
any directory.

Note: Arch Linux comes with `/usr/bin/ecb_cli` pre-installed, allowing you to
use `ecb_cli` directly.

## Usage

```bash
ecb_cli -h
```

### Seq command

Run UDS sequence via CLI.

```bash
ecb_cli seq -h
```

#### Example (seq)

```bash
ecb_cli seq xx.ecb Tester_1 --log-level=debug
```

![seq](./../../../media/um/seq.png)

### PNPM command

`pnpm` is a package manager for JavaScript, which is fast, disk-space
efficient, and optimized for monorepos. More details can be found in the
[pnpm documentation](https://pnpm.io/). We integrated `pnpm` into the
EcuBus-Pro CLI, so you can use the `pnpm` command to install the dependencies
of your project.

_run pnpm via CLI._

```bash
ecb_cli pnpm -h

ecb_cli pnpm init

ecb_cli pnpm install package_name
```

#### Example (pnpm)

![alt text](../../../media/um/script/SerialPort/pnpm.gif)

### Test command

_run test via CLI._

```bash
ecb_cli test -h
```

The test command allows you to run test configurations from your EcuBus-Pro
project via the command line. This is useful for automated testing, continuous
integration, and regression testing without launching the GUI.

#### Syntax

```bash
ecb_cli test <project> <name> [options]
```

#### Arguments

- `project`: Path to the EcuBus-Pro project file (.ecb)
- `name`: Name of the test configuration to run

#### Options

- `-r, --report <report>`: Specify the report file name (HTML format)
- `-b, --build`: Force build before running the test
- `--log-level <level>`: Set the log level (error, warning, info, debug).
  Default is "info"
- `-h, --help`: Display help information

#### Example (test)

![alt text](../../../media/um/cli/test.gif)
