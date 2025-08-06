# EcuBus-Pro CLI

EcuBus-Pro provides a command line interface (CLI) that allows you run your code without the GUI. It's useful for automation, testing, and debugging. The CLI is built on top of the EcuBus-Pro core, so you can use the same scripts and plugins that you use in the GUI.

## CLl Installed Path

`${InstallPath}/resources/app.asar.unpacked/resources/lib` you can add this path to your system environment variable `PATH` to use the `ecb_cli` command in any directory.

## Usage

```bash
ecb_cli -h
```

### Seq command

_run uds sequence by cli_

```bash
ecb_cli seq -h
```

#### Example:

```
ecb_cli seq xx.ecb Tester_1 --log-level=debug
```

![seq](./../../media/um/seq.png)

### PNPM command

`pnpm` is a package manager for JavaScript, which is a fast, disk space efficient, and optimized for monorepos. More details can be found [here](https://pnpm.io/).
We integrated `pnpm` into the EcuBus-Pro CLI, you can use the `pnpm` command to install the dependencies of your project.

_run pnpm command by cli_

```bash
ecb_cli pnpm -h

ecb_cli pnpm init

ecb_cli pnpm install package_name
```

#### Example:

![alt text](script/pnpm.gif)

### Test command

_run test by cli_

```bash
ecb_cli test -h
```

The test command allows you to run test configurations from your EcuBus-Pro project via the command line. This is useful for automated testing, continuous integration, and regression testing without launching the GUI.

#### Syntax:

```bash
ecb_cli test <project> <name> [options]
```

#### Arguments:

- `project`: Path to the EcuBus-Pro project file (.ecb)
- `name`: Name of the test configuration to run

#### Options:

- `-r, --report <report>`: Specify the report file name (HTML format)
- `-b, --build`: Force build before running the test
- `--log-level <level>`: Set the log level (error, warning, info, debug). Default is "info"
- `-h, --help`: Display help information

#### Example:
![alt text](test.gif)
