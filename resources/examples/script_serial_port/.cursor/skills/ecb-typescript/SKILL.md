---
name: ecb-typescript
description: Write TypeScript code for EcuBus-Pro (ECB) automotive diagnostics. Provides API reference for UDS, CAN, LIN, DoIP, SOME/IP, CRC, Crypto, SerialPort, and test framework. Use when writing ECB scripts, working with automotive protocols, or developing diagnostic services.
---

# ECB TypeScript Development

## API Reference

**Read the type definitions from `node_modules/@types/ECB/` to get accurate API information and code examples.**

### Type Definition Files

| File | Content |
|------|---------|
| `index.d.ts` | Main exports, global `Util` instance |
| `uds.d.ts` | UDS services (DiagRequest, DiagResponse), CAN/LIN/DoIP/SOMEIP types, test framework, signals, variables, SerialPort |
| `crc.d.ts` | CRC class and built-in CRC algorithms |
| `cryptoExt.d.ts` | CMAC function |
| `secureAccess.d.ts` | SecureAccessDll class for security key generation |
| `utli.d.ts` | HexMemoryMap and S19MemoryMap classes |

### Workflow

1. Read the relevant `.d.ts` files to understand available APIs and see JSDoc examples
2. Write code based on the type definitions
3. Import from `'ECB'` module

### Key Points

- Use `Util.Init(fn)` for initialization code
- Use `Util.End(fn)` for cleanup code  
- Use `Util.Register(jobName, fn)` to register job handlers
- Use `Util.On*()` methods for event handling (CAN, LIN, Signal, Key, Var)
- `process.env.PROJECT_ROOT` provides the ECB project root path
- Service/Job names follow `TesterName.ServiceName` format
