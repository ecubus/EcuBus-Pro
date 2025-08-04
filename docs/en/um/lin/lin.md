# LIN (Local Interconnect Network)

LIN is a cost-effective and deterministic communication protocol designed for connecting Electronic Control Units (ECUs) with smart sensors, actuators, and controls. EcuBus-Pro's LIN module provides comprehensive features for developing, analyzing, and testing LIN networks in compliance with LIN 2.x specifications.

> [!IMPORTANT]
> Some features described below may require importing a LIN Description File (LDF). For more information about LDF, see the [database documentation](./../ldf).

> [!INFO]
> Supported Hardware:
> | Manufacturer | Protocols | Abilities |
> |--------|-------------------| -- |
> | PEAK | LIN | |
> | KVASER | LIN | |
> | Toomoss | LIN| Support 12v voltage output/input, 5v voltage output   |
> | VECTOR | LIN | |
 

## Schedule Table Management

Control and monitor LIN network communications through schedule table execution.

### Schedule Table Operations

1. **Add Interaction**

   - Access the schedule table configuration interface
   - Define communication parameters
     ![Schedule Table Addition](image.png)

2. **Open Interaction**
   - View and manage existing schedule tables
     ![Open Schedule Table](image-1.png)

## Node Simulation & Signal Editing

Configure and simulate LIN nodes to test network behavior.

### Node Configuration Steps

1. **Add Node**

   - Create a new node in the network
     ![Add New Node](image-2.png)

2. **Configure Node Settings**

   - Set up node parameters and properties
     ![Node Configuration](image-3.png)

3. **Signal Value Editor**
   - Edit signal values for configured nodes
   - Note: Only signals published by the configured node can be modified
     ![Signal Value Editor](image-4.png)

## LIN Transport Protocol and Diagnostics

Implement and test diagnostic services using LIN TP.

### Diagnostic Operations

1. **Configure LIN Tester**

   - Import address information from LIN database
   - Set up diagnostic parameters
     ![LIN Tester Setup](image-5.png)

2. **Diagnostic Execution**

   - Enable schedule table execution (required for diagnostics)
   - Send diagnostic requests and monitor responses
     ![Diagnostic Execution](image-6.png)

   Response handling:

   - View diagnostic responses from simulated nodes
     ![Diagnostic Response](image-7.png)
