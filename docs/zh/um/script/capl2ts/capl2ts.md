# CAPL to EcuBus-Pro Script (TypeScript)

在汽车测试和诊断领域，`CAPL (CANoe Programming Language)`一直是开发测试自动化脚本的重要工具。 它在 `Vector CANoe` 生态系统中预示着强大的能力和成熟的用户基础。
然而，随着测试设想的多样化，跨平台的需求增加，对更大灵活性和可维护性的需求增加，是否有其他解决办法？

Ecuadus Bus-Pro的答案是使用 `TypeScript` 编写脚本。 Ecuadus Bus-Pro 脚本使用`TypeScript`作为开发语言，并包含现代软件工程做法。 与CAPL相比，`TypeScript`提供了一个更丰富的生态系统，更大的可扩展性，以及本地与 DevOps 工作流兼容性。

## EcuBus-Pro Script IntelliSense

> 因为EcuBus-Pro 脚本使用TypeScript 作为开发语言，您获得了TypeScript 类型系统提供的基于类型的Intelligense。

![信号智能](./../../../../media/um/script/tip1.gif)

## CAPL vs EcuBus-Pro Script 语法比较

> [!INFO]
> 持续更新。 更多脚本 API，请参阅 [API](https://app.whyengineer.com/scriptApi/index.html)

| 功能                                           | CAPL 示例                                                         | EcuBus-Pro Script Example (TypeScript) |
| -------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| **输入检查**                                     | 输入不足，没有编译时间检查                                                   | 强烈打字，IDE 提示 + 编译时间检查                                      |
| **Library & extensions** | 构建到矢量环境                                                         | NPM 生态系统，有丰富的第三方库                                         |
| **变量声明**                                     | `int count = 0;`                                                | `let 计数：数字 = 0;`                                          |
| **Print logs**                               | `write("Hello CAPL");`                                          | `console.log("Hello EcuBus-Pro");`                        |
| **消息接收事件**                                   | `在 Message CAN1.MyMsg%20write("received")；}`                    | `Util.OnCan(0x1, (msg) => Power console.log("接收");});`    |
| **Event callback**                           | "在密钥"a"上... }\` | `Util.OnKey('a', () => { ... });`                         |
| **变量关注**                                     | `on envVar EnvChecksumErrurs }`                                 | `Util.OnVar('EnvChecksumError', () => { ... });`          |

## 示例：

> 这方面的例子正在不断改进；欢迎提供捐助。

1. [监视信号更改和打印时间间隔](./capl2ts1.md)
2. [监视变量更改，发送LIN信号，并手动设置不正确的校验和](./capl2ts2.md)
