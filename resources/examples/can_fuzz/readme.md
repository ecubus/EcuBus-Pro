# CAN Fuzz Example

CAN bus fuzzing example based on [can-hax](https://github.com/rybolov/can-hax) fingerprint format. Uses ECB `fingerprintFromCanMessages` and `fuzz` APIs to fingerprint and fuzz CAN traffic, with ECU health monitoring.

## Overview

- **Node 1 (fuzz.ts)**: Loads fingerprint, sends fuzz frames, listens for ECU crash signal
- **Node 2 (ecu.ts)**: Simulated ECU that "crashes" when it receives a trigger CAN ID, then sends a crash signal
- **Device**: SIMULATE_0 (virtual CAN bus for testing)

## Fingerprint Format

The fingerprint file (`icsim_fingerprint.json`) uses can-hax format:

| Char | Meaning                    |
|------|----------------------------|
| `0`  | Fixed 0x00 (not observed)  |
| `N`  | Decimal nibble (0-9)       |
| `H`  | Hex nibble (0-F)           |

Example: `"133": "00000000HN"` → CAN ID 0x133, 5 bytes, last nibble varies.

## File Structure

```
can_fuzz/
├── README.md
├── can_fuzz.ecb          # Project config
├── ecu.ts                 # Simulated ECU (Node 2)
├── fuzz.ts                # Fuzz script (Node 1)
├── icsim_fingerprint.json # ICSIM Vehicle Simulator fingerprint
└── tsconfig.json
```

## How to Run

1. Open `can_fuzz.ecb` in ECB
2. Start the CAN device (SIMULATE_0)
3. Both nodes start automatically:
   - Node 1 sends fuzz frames
   - Node 2 receives and monitors for trigger

## ECU Crash Detection

When the simulated ECU receives **CAN ID 0x133** (vulnerability trigger), it:

1. Logs `*** VULNERABILITY TRIGGERED ***`
2. Sends crash signal **0x7FF#DEAD** on the bus

Fuzz listens for 0x7FF. When received, `onAfterSend` returns `false` and fuzzing stops.

## Quick Test

To quickly verify crash detection, uncomment in `fuzz.ts`:

```ts
canId: '133',  // Only fuzz 0x133
```

The ECU will trigger on the first 0x133 frame and fuzz will stop immediately.

## Fuzz Options

| Option       | Default | Description                                      |
|--------------|---------|--------------------------------------------------|
| `timing`     | 20      | Delay (ms) between frames                        |
| `quick`      | false   | Restricted set: N=0,1,5,9; H=0,1,9,A,B,F        |
| `superQuick` | false   | Minimal set: N=0,9; H=0,F                       |
| `adaptive`   | true    | Auto-reduce set for complex templates           |
| `canId`      | -       | Fuzz only this CAN ID (e.g. `'133'`)             |

## Custom Fingerprint

Use `fingerprintFromCanMessages` to generate a fingerprint from live CAN capture:

```ts
const frames: CanMessage[] = [];
Util.OnCan(true, (msg) => frames.push(msg));
await sleep(10000);  // Capture 10s
Util.OffCan(true, cb);
const fp = fingerprintFromCanMessages(frames);
```

## Real Hardware

Replace SIMULATE_0 with a real CAN device in the project. Ensure `DEVICE` in `fuzz.ts` matches the device name.
