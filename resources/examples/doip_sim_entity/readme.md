# DoIP Simulate Entity Example

This example demonstrates how to use the DOIP protocol to communicate with the ECU. Use script to simulate an entity and send UDS Response frame to the tester.

## Device

Use loopback channel
![device](device.png)

## Node

Add a node item and attach the script(`node.ts`)

![alt text](image-1.png)

```typescript
import { DiagResponse } from 'ECB'

Util.On('Tester_eth_1.DiagnosticSessionControl160.send', async (req) => {
  console.log('Received Diag request')
  const resp = DiagResponse.fromDiagRequest(req)
  await resp.outputDiag()
})


```

## Tester

Address information need same as your register entity

- Tester addr:200
- Gateway addr:100
- Simulate By: choose `sim_entity`, the node name.
![alt text](image-2.png)




## Execution

Start the sequence and open the trace window to view all frames. Alternatively, use Wireshark to capture these frames.
![trace](image.png)

