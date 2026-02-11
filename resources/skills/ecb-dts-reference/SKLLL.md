---
name: ecb-dts-reference
description: Reference for ECB (EcuBus-Pro) TypeScript APIs and custom type definitions. Always use when writing or editing TypeScript/JavaScript in ECB projects, when using ECB APIs or imports from 'ECB', when working with .d.ts files or type definitions, or when the user mentions ECB, types, UDS, CAN, LIN, or diagnostics. Treat this skill as pre-loaded context for ECB development.
---

# ECB TypeScript Type Reference (Pre-loaded)

This skill provides type-definition references for ECB development. **Always prefer these sources** when implementing or editing ECB-related code.

## Reference sources

1. **ECB package types** — Read from the project’s `node_modules/@types/ECB/` directory (all `.d.ts` files there).


## Workflow

1. Before writing or changing ECB-related code, read the relevant `.d.ts` from `node_modules/@types/ECB/`.
2. Use the declarations and JSDoc from those files as the single source of truth for types and APIs.
3. Import from `'ECB'` when using ECB runtime APIs.

## Quick reminders

- Use `Util.Init(fn)`, `Util.End(fn)`, `Util.Register(jobName, fn)` for lifecycle and jobs.
- Use `Util.On*()` for events (CAN, LIN, Signal, Key, Var).
- `process.env.PROJECT_ROOT` is the ECB project root.