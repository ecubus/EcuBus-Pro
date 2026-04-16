# SOME/IP Request/Response + Event Demo

This demo demonstrates how to use the SOME/IP protocol within the EcuBus-Pro environment.

## Overview

This example shows a basic SOME/IP setup with:

- Two SOME/IP devices configured for communication (Client and Server)
  - **Client App ID**: 0x6301
  - **Server App ID**: 0x6302
  
- A Server provider offering a service and event
  - **Service ID**: 0x1234
  - **Instance ID**: 0x1111
  - **Method ID**: 0x1002 (request/response)
  - **Event ID**: 0x8777 (notification/event publish)
  - **Port**: 30510 (reliable TCP connection)

## Script Behavior

The TypeScript script (`someip.ts`) runs on **Node 1**, which is attached only to **SomeIP_1** (the server, app `0x6302`). It implements:

- An echo server: receives SOME/IP **requests** for service `0x1234` and sends a response.
- A periodic **`someipNotify`** for event `0x8777` on the **same** SomeIP_1 stack (publisher path: `offer_event` was done at startup for that service).

The subscriber example script (`sub.ts`) runs on the client side and listens with:

- `Util.OnSomeipMessage('1234.*.*', ...)`
- `msg instanceof SomeipMessageEvent` to handle incoming event/notification frames.

**SomeIP_0** (`0x6301`) is the **client**. It does **not** run this script. To **receive** that event on SomeIP_0 you must:

1. Run the IA manual action **subscribe** on device SomeIP_0 (it calls `subscribeToEvent` on the client).
2. Use the **event id** `0x8777` (not the RPC method `0x1002`) and an `event_type` consistent with the server (`0` = ET_EVENT for this demo’s `is_field: false`).

Without a successful subscription, vSomeIP will not deliver the notification to SomeIP_0.

## Run Steps

1. Start project and ensure both SOME/IP devices are online.
2. Run `someip.ts` on the provider node (SomeIP_1 / app `0x6302`).
3. Run `sub.ts` on the consumer node (SomeIP_0 / app `0x6301`).
4. Trigger IA manual **subscribe** action on SomeIP_0 for:
   - service `0x1234`
   - instance `0x1111`
   - event group `0x0001`
   - event `0x8777`
5. Observe event logs on subscriber side.

## Network Setup

The demo uses localhost (127.0.0.1) for testing, making it easy to run without additional network configuration. Both SOME/IP applications communicate over the same Ethernet interface using different application IDs.
