#!/usr/bin/env python3
"""
Basic ECB Example

This example demonstrates the basic usage of the ECB library.

To use this script in EcuBus-Pro:
1. Install ECB: pip install ecb
2. Configure the script path in EcuBus-Pro
3. Set scriptType to 'python' in the options
"""

import asyncio
from ecb import ECBClient, set_client, log, output, setSignal, varApi


class BasicScript(ECBClient):
    """Basic script example"""

    async def on_start(self, data_set, service_map, tester_name, test_control):
        """Called when script starts"""
        log("Basic script started!")
        log(f"Tester name: {tester_name}")
        log(f"Data set keys: {list(data_set.keys()) if isinstance(data_set, dict) else 'N/A'}")

        # Output a message
        await output("Hello from Python ECB!")

        # Set a signal
        await setSignal("EngineSpeed", 1500.0)

        # Set a variable
        await varApi("setVar", "TestCounter", 0)

        return {"status": "started"}

    async def on_end(self):
        """Called when script ends"""
        log("Basic script ended!")
        return {"status": "ended"}

    async def on_event(self, event_name, event_data):
        """Handle events"""
        log(f"Event received: {event_name}")
        return {"status": "ok"}


if __name__ == "__main__":
    client = BasicScript()
    set_client(client)
    client.run()  # This will run asyncio.run() internally
