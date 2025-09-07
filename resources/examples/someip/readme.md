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

The TypeScript script (`someip.ts`) implements a simple echo server:
- Receives any SOME/IP request message for service 0x1234
- Automatically generates and sends a response back to the requester


## Network Setup

The demo uses localhost (127.0.0.1) for testing, making it easy to run without additional network configuration. Both SOME/IP applications communicate over the same Ethernet interface using different application IDs.
