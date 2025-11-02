# 脚本（Script）

脚本运行于 Node.js 环境，基于 TypeScript/JavaScript。我们使用 `ts` 进行语法检查，
使用 esbuild 构建脚本，构建脚本位于 `.ScriptBuild` 目录。

## 编辑器（Editor）

推荐使用 VS Code 编辑脚本；安装 `TypeScript` 扩展可获得语法检查与智能提示。
![alt text](script1.gif)

> [!TIP]
> 我们计划提供 VS Code 扩展，以便在 VS Code 中直接构建脚本。

## 构建脚本（Build Script）

![alt text](image.png)
如果脚本存在错误，可在 `Message` 窗口查看构建错误信息。
![alt text](image-1.png)

## 脚本 API（Script API）

你可以打开 `API` 窗口查看 API 信息。
![alt text](image-2.png)

或者查看在线文档：[API](https://app.whyengineer.com/scriptApi/index.html)

## 脚本用法（Script Usage）

### Node.js 能力（Node.js Ability）

#### Init（初始化）

初始化函数是脚本入口，脚本加载时会被调用。

```typescript
Util.Init(() => {
  console.log('Init')
})
```

#### Timer（定时器）

定时器是 Node.js 的内置特性，可用于周期性任务。更多信息参见
[Timer](https://nodejs.org/api/timers.html)。

```typescript
// periodical output can message
let timer = setInterval(() => {
  outputCan(canMsg)
}, 1000)

// stop the timer
clearInterval(timer)

//refresh the timer
timer.refresh()
```

#### OnKey（按键）

监听按键事件，可在按键被按下时执行任务。

```typescript
// listen to the key event
Util.OnKey('s', () => {
  outputCan(canMsg)
})
```

#### OnCan（CAN 消息）

监听 CAN 消息，你可以在收到 CAN 消息时执行一些任务。

```typescript
// listen to the can message
Util.OnCan(0x1, (msg) => {
  console.log(msg)
})
// listen all can message
Util.OnCan(true, (msg) => {
  console.log(msg)
})
```

#### On（UDS 事件）

监听 UDS 相关事件。
`<tester name>.<service item name>.recv` 用于监听收到的 UDS 消息；
`<tester name>.<service item name>.send` 用于监听发送的 UDS 消息。

```typescript
// 监听 UDS 报文
Util.On('Can.DiagRequest.recv', (msg) => {
  // 接收诊断响应
})
Util.On('Can.DiagRequest.send', (msg) => {
  // 接收诊断请求
})
```

## 示例（Example）

::: details 脚本初始化时发送 10 条 CAN 消息，30 秒后再发送 1 条  {open}

```typescript
async function sendCanMessage(msgId: number, targetId: number, dataPattern: string) {
    console.log(`sendCanMessage called with msgId: ${msgId}, targetId: ${targetId}`);

    const dataBytes = Buffer.from(dataPattern.repeat(8), 'hex');
    console.log("Total Length:", dataBytes.length);

    const fdMsg: CanMessage = {
        id: targetId,
        dir: 'OUT',
        data: dataBytes,
        msgType: {
            idType: CAN_ID_TYPE.STANDARD,
            brs: true,
            canfd: true,
            remote: false,
        }
    };

    try {
        await output(fdMsg);
    } catch (error) {
        console.error(`CAN FD 发送失败 (ID: ${msgId}):`, error);
    }

}

Util.Init(async () => {
    console.log("Init");
    // 循环 10 次，定义不同的消息 ID 和数据内容
    for (let i = 0; i < 10; i++) {
        const msgId = 0x510 + i;
        const targetId = 0x520 + i;
        const dataPattern = i % 2 === 0 ? '1234567890ABCDEF' : 'FFAABBCCDDEE5599';
        await sendCanMessage(msgId, targetId, dataPattern);
    }

    setTimeout(() => {
        console.log("Timeout triggered, preparing to send CAN message...");
        const msgId = 0x510 + 10;
        const targetId = 0x520 + 10;
        const dataPattern = 'DEADBEEFCAFEBABE';
    
        sendCanMessage(msgId, targetId, dataPattern);
    }, 30000); // 延时 30 秒
})
```

:::
