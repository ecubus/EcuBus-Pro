# LIN Transport Layer Test Example

Low-level LIN TP test that manually constructs consecutive frames and inserts functional requests in between to test protocol behavior.

## Test Cases

### Test 1: Physical Addressing (物理寻址)
Basic multi-frame transmission test:
```typescript
// First Frame: NAD=2, PCI=0x10, Length=0x11
msg1: [0x02, 0x10, 0x11, 0x10, 0x01, 0x3, 0x4, 0x5]

// Consecutive Frame 1: NAD=2, PCI=0x21  
msg3: [0x02, 0x21, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]

// Consecutive Frame 2: NAD=2, PCI=0x22
msg5: [0x02, 0x22, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11]

// Wait for response on frame 0x3D
```

### Test 2: Functional Addressing Interference (功能寻址干扰测试)
Tests that functional requests don't interrupt ongoing physical transmission:
```typescript
// Same 3-frame sequence as Test 1, but with functional frames inserted:
msg1 -> msg2 (functional) -> msg3 -> msg4 (functional) -> msg5 -> response

// Functional frames: NAD=0x7E, SID=0x02, Data=0x3e80
msg2/msg4: [0x7E, 0x02, 0x3e, 0x80, 0xAA, 0xAA, 0xAA, 0xAA]
```

## Frame Details

- **Request Frame ID**: 0x3C
- **Response Frame ID**: 0x3D  
- **Physical NAD**: 0x02 (Motor1)
- **Functional NAD**: 0x7E (broadcast)
- **Checksum**: Classic
- **Timeout**: 1000ms

## Expected Results

1. **Test 1**: ECU responds after receiving all 3 consecutive frames
2. **Test 2**: Functional requests are ignored during physical transmission; ECU only responds to the physical sequence

## Usage

1. Load `test_lin_tp.ecb`
2. Connect LIN hardware to COM8 (19200 baud)
3. Run tests to verify LIN TP protocol compliance
