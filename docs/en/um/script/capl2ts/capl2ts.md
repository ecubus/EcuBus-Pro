# CAPL to EcuBus-Pro Script (TypeScript)

In the automotive testing and diagnostics domain, `CAPL (CANoe Programming Language)` has long been an important tool for developing test automation scripts. It boasts powerful capabilities and a mature user base within the `Vector CANoe` ecosystem.
However, as test scenarios diversify, cross-platform requirements increase, and the demand for greater flexibility and maintainability grows, is there an alternative solution?

EcuBus-Pro’s answer is to write scripts with `TypeScript`. EcuBus-Pro scripts use `TypeScript` as the development language and embrace modern software engineering practices. Compared with CAPL, `TypeScript` offers a richer ecosystem, greater extensibility, and native compatibility with DevOps workflows.

## EcuBus-Pro Script IntelliSense

> Because EcuBus-Pro scripts use TypeScript as the development language, you get type-based IntelliSense provided by the TypeScript type system.

![Signal IntelliSense](./../../../../media/um/script/tip1.gif)

## CAPL vs EcuBus-Pro Script Syntax Comparison

> [!INFO]
> Continuously updated. For more script APIs, see the [API](https://app.whyengineer.com/scriptApi/index.html)

| Feature          | CAPL Example                                   | EcuBus-Pro Script Example (TypeScript)                    |
| ---------------- | ---------------------------------------------- | --------------------------------------------------------- |
| **Type checking** | Weak typing, no compile-time checks            | Strong typing, IDE hints + compile-time checks            |
| **Libraries & extensions** | Built into the Vector environment           | NPM ecosystem with abundant third-party libraries         |
| **Variable declaration** | `int counter = 0;`                           | `let counter: number = 0;`                                |
| **Print logs**   | `write("Hello CAPL");`                         | `console.log("Hello EcuBus-Pro");`                       |
| **Message receive event** | `on message CAN1.MyMsg{  write("Received");}` | `Util.OnCan(0x1, (msg) => {  console.log("Received");});` |
| **Event callback** | `on key 'a' { ... }`                           | `Util.OnKey('a', () => { ... });`                         |
| **Variable watch** | `on envVar EnvChecksumError { ... }`           | `Util.OnVar('EnvChecksumError', () => { ... });`          |

## Examples

> Examples are continuously being improved; contributions are welcome.

1. [Monitor signal changes and print time intervals](./capl2ts1.md)
2. [Monitor variable changes, send a LIN signal, and manually set an incorrect checksum](./capl2ts2.md)
