# SOME/IP Request/Response Demo

This demo demonstrates how to use the SOME/IP protocol within the EcuBus-Pro environment.

## Overview

This example shows a basic SOME/IP setup with:

- Two SOME/IP devices configured for communication (Client and Server)
  - **Client App ID**: 0x6301
  - **Server App ID**: 0x6302
  
- A Server provider offering a service
  - **Service ID**: 0x1234
  - **Instance ID**: 0x1111
  - **Method ID**: 0x1002 (for the interactive action)
  - **Port**: 30510 (reliable TCP connection)

## Script Behavior

The TypeScript script (`someip.ts`) runs on **Node 1**, which is attached only to **SomeIP_1** (the server, app `0x6302`). It implements:

- An echo server: receives SOME/IP **requests** for service `0x1234` and sends a response.
- A periodic **`someipNotify`** for event `0x8777` on the **same** SomeIP_1 stack (publisher path: `offer_event` was done at startup for that service).

**SomeIP_0** (`0x6301`) is the **client**. It does **not** run this script. To **receive** that event on SomeIP_0 you must:

1. Run the IA manual action **subscribe** on device SomeIP_0 (it calls `subscribeToEvent` on the client).
2. Use the **event id** `0x8777` (not the RPC method `0x1002`) and an `event_type` consistent with the server (`0` = ET_EVENT for this demo’s `is_field: false`).

Without a successful subscription, vSomeIP will not deliver the notification to SomeIP_0.

## Network Setup

The demo uses localhost (127.0.0.1) for testing, making it easy to run without additional network configuration. Both SOME/IP applications communicate over the same Ethernet interface using different application IDs.
