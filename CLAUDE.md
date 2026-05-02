# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EcuBus-Pro is an open-source automotive ECU (Electronic Control Unit) development and testing tool built with Electron. It serves as an alternative to commercial tools like CAN-OE.

**Key Features:**
- Cross-platform (Windows, Linux, macOS)
- Multi-hardware support (PEAK, Kvaser, Vector, ZLG, Toomotss, EcuBus-LinCable, SLCAN, GS_USB)
- Protocol support: CAN/CAN-FD, LIN, DoIP, SOME/IP
- UDS diagnostic capabilities
- TypeScript-based scripting and HIL testing framework
- DBC/LDF database support
- Panel builder for custom UI creation

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Build production version (runs typecheck first) |
| `npm run start` | Preview production build |
| `npm run test` | Run all tests with Vitest |
| `npm run test -- test/util/hexParse.spec.ts` | Run single test file |
| `npm run test -- test/util/hexParse.spec.ts -t "test name"` | Run single test by name pattern |
| `npm run lint` | Run ESLint with auto-fix |
| `npm run format` | Run Prettier format |
| `npm run typecheck` | Run TypeScript type checks (node + web) |
| `npm run typecheck:node` | Type-check main/preload/CLI/tests only |
| `npm run typecheck:web` | Type-check renderer only |
| `npm run worker:js` | **Build worker scripts (JS only) - MUST RUN after any changes to `src/main/worker/`** |
| `npm run worker` | Build worker bundle including native secure-access addon |
| `npm run native` | Build all native modules (docan, dolin, someip) |
| `npm run docan` / `dolin` / `someip` | Build individual native modules |
| `npm run build:win` / `build:linux` / `build:mac` | Platform-specific builds |
| `npm run docs:dev` / `docs:build` | VitePress documentation |
| `npm run cli:build` | Build CLI |

**Note:** Native module builds require Python and platform build tools (Visual Studio on Windows, gcc on Linux).

## Architecture

This is an Electron application with clear separation between processes:

**Main Process (`src/main/`):**
- `index.ts` - Creates frameless BrowserWindow, registers `local-resource://` protocol, initializes logging/analytics/i18n
- `docan/`, `dolin/` - CAN/LIN protocol native modules (C++ with SWIG bindings)
- `doip/`, `uds/`, `vsomeip/` - DoIP, UDS, SOME/IP protocol implementations
- `worker/` - **Public worker script API provided to users** (must run `npm run worker:js` after changes)
- `workerClient.ts` - Runs user scripts in Node `worker_threads`, handles RPC/event messages
- `ipc/*.ts` - IPC handlers registered via side-effect imports in `ipc/index.ts`
- `multiWin.ts` - Manages extra Electron windows with MessageChannelMain for log sharing
- `share/` - Shared types and utilities accessible via `nodeCan/*` alias

**Preload (`src/preload/`):**
- Exposes `window.electron`, `window.api`, `window.store`, `window.path`, `window.dataParseWorker`
- Renderer must use these bridges instead of importing Electron/Node APIs directly

**Renderer (`src/renderer/src/`):**
- Vue 3 + Pinia + Vue Router (memory history) + Element Plus + VXE components
- `stores/` - `project.ts` (project metadata), `data.ts` (ECU/device/data), `runtime.ts` (runtime flags)
- `views/uds/layout.ts` - UDS workspace panels declared as `layoutMap` items
- State sync between windows uses `BroadcastChannel` pattern in `main.ts`

**CLI (`src/cli/`):** Automation CLI with separate Electron Vite config (`cli.vite.ts`)

## Path Aliases

| Alias | Target |
|-------|--------|
| `src/*` | Repository source root |
| `@r/*` | `src/renderer/src/` |
| `nodeCan/*` | `src/main/share/` |

Use existing aliases instead of long relative paths.

## Key Configuration Files

- `package.json` - Dependencies, scripts, vendor hardware support under `ecubusPro.vendor`
- `electron-builder.yml` - Electron builder configuration
- `electron.vite.config.ts` - Vite configuration for Electron
- `vitest.config.ts` - Vitest test configuration with path aliases
- `webpack.config.js` - Webpack config for worker bundling

## Repository Conventions

**UI Components:** Prefer Element Plus. Use `el-table` for simple tables, `vxe-table` for complex tables.

**Theme:** Dark mode maps to `VxeUI.setTheme('dark')` via `useDark()` watcher in `App.vue`.

**Plugin State Sync:** Use Wujie `bus` events (`update:dataStore`, `update:dataStore:fromMain`, `update:globalStart:fromMain`).

**Worker API Documentation:** Keep `src/main/worker/` documented with TSDoc (`@param`, `@returns`, `@throws`, `@example`, `@category`). This is shipped to users via TypeDoc.

**Formatter:** Single quotes, no semicolons, print width 100, no trailing commas.

**SWIG Generated Files:** Never edit `*_wrap.cxx` files - they are generated from `.i` interface files.

## Tests

Tests live under `test/` and run with Vitest.

- Hardware-dependent: `test/docan/`, `test/dolin/`, `test/pwm/` (require matching devices)
- Hardware-independent: `test/util/*.spec.ts`, `test/dbc/`, `test/odx/`, `test/viewer/` (good smoke tests)

## Internationalization

i18next-based. App translations in `resources/locales/<lang>/translation.json`. Plugin translations loaded from `locales/<lang>/translation.json` and merged via IPC.

## MCP Servers

Workspace MCP config in `.vscode/mcp.json`. The `playwright` server (`npx -y @playwright/mcp@latest`) is useful for browser-based UI exploration when dev server is running.