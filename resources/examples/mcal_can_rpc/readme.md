# PC MCAL-CAN over JSON-RPC

This example shows how a **C** PC implementation of AUTOSAR MCAL CAN talks to EcuBus-Pro hardware through `ecb_cli rpc`.

Your production `Can.c` should keep the AUTOSAR signatures (`Can_Init`, `Can_Write`, `Can_MainFunction_Read`, …) and implement each of them as one JSON-RPC call. `can_rpc_demo.c` is a small POSIX client that performs that sequence on two `simulate` controllers.

## Run

Terminal 1:

```bash
ecb_cli rpc --log-level=info
```

Terminal 2:

```bash
cd resources/examples/mcal_can_rpc
make
./can_rpc_demo
# or: ./can_rpc_demo 127.0.0.1 17320
```

You should see `Can.Init`, `Can.SetControllerMode`, `Can.Write`, then `Can.MainFunction_Read` returning the loopback frame on controller 1.

## Files

| File | Role |
| --- | --- |
| `can_rpc.h` | Method name macros and `E_OK` / `CAN_BUSY` constants |
| `can_rpc_demo.c` | POSIX TCP NDJSON client |
| `Makefile` | `cc -std=c11` |

Full protocol: [CLI JSON-RPC](/docs/en/um/cli/rpc.md).
