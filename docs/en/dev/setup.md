# Setup

If you are new to the JavaScript or TypeScript ecosystem, start with [JavaScript/TypeScript Learning Resources](./jslearn.md).

For a step-by-step Windows walkthrough with screenshots, see the [Detailed Windows Setup Guide](./detialSetup.md).

## Overview

EcuBus-Pro is an Electron + Vue + TypeScript project with several native modules built through `node-gyp`.
The typical local workflow is:

1. Install the required toolchain.
2. Install project dependencies.
3. Build native modules when needed.
4. Start the development app.

## Prerequisites

- `Node.js` 22.x
- `npm`
- `Python` and C/C++ build tools required by `node-gyp`

### Platform Notes

- On Windows, install the Visual Studio C++ build tools before compiling native modules.
- On Linux and macOS, make sure the platform toolchain required by `node-gyp` is already available.
- Native hardware adapter support differs by platform. Windows supports the widest adapter set in this repository.

## Installation

Clone the repository:

```bash
git clone https://github.com/ecubus/EcuBus-Pro.git
cd EcuBus-Pro
```

Install dependencies:

```bash
npm install
```

`npm install` will also run the project's `postinstall` step to install Electron app dependencies.

## Start Developing

Run the desktop app in development mode:

```bash
npm run dev
```

This is the main command most contributors need after the initial setup is complete.

## Build Native Modules

Some features depend on native modules. Build them when you change native code or when your environment does not already have compiled artifacts:

```bash
npm run native
```

This command builds:

- `docan`
- `dolin`
- `someip`

To build only the worker native dependency and bundle the worker output:

```bash
npm run worker
```

## Common Development Commands

### Documentation

Start the docs site locally:

```bash
npm run docs:dev
```

Build the docs site:

```bash
npm run docs:build
```

### Type Checking

Run all type checks:

```bash
npm run typecheck
```

### Linting and Formatting

Run ESLint:

```bash
npm run lint
```

Format the repository with Prettier:

```bash
npm run format
```

### Tests

Run the test suite:

```bash
npm run test
```

More test commands are documented in [Test](./test.md).

### API Documentation

Generate API documentation:

```bash
npm run api
```

## Build Outputs

Build the desktop application:

```bash
npm run build
```

Platform-specific package commands:

- Windows: `npm run build:win`
- macOS: `npm run build:mac`
- Linux: `npm run build:linux`

Build the CLI:

- Development mode: `npm run cli:dev`
- Cross-platform bundle: `npm run cli:build`
- Windows package: `npm run cli:build:win`
- Linux package: `npm run cli:build:linux`
- macOS package: `npm run cli:build:mac`

Build the SDK bundle:

```bash
npm run build:sdk
```

## Troubleshooting

- If native module compilation fails, first verify your `node-gyp`, Python, and C/C++ build toolchain setup.
- If you are developing on Windows and need a more guided setup flow, use the [Detailed Windows Setup Guide](./detialSetup.md).
- The GitHub workflow files in [`.github/workflows`](https://github.com/ecubus/EcuBus-Pro/tree/master/.github/workflows) are also a good reference for the commands used in CI.
