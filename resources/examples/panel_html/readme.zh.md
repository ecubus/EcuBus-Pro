# HTML 控制示例

打开 `HtmlControl.ecb`。它使用自身两个模拟 CAN 通道，因此无需硬件。需要带有新 Panel 的 EcuBus-Pro 构建版本。

![HTML 控制运行中](html-control.png)

## 运行

1. 在面板上点击 **START**。首次运行会编译 `ecu.ts`。
2. 在 HTML 控件内拖动 Load：左侧的原生滑块和进度条会跟随变化，CAN 速度显示为负载的两倍。
3. 切换左侧的原生 Enabled 开关：HTML 复选框会跟随变化，禁用时速度降至 0。
4. 在 **HTML Command** 交互窗口中，启动 `0x101 Command` 的周期发送。如果窗口已隐藏，请从交互节点菜单中将其打开。
5. 在 HTML CAN target 中输入 `45`，然后点击 **Set signal**。 ECU received 显示 `45 %`，Command 帧持续增加，速度变为 `90.0 km/h`。
6. 点击 **Unsubscribe**：HTML 停止自动更新；**Read values** 执行一次读取；**Subscribe** 恢复订阅。
7. 点击 **STOP**：写入控件被禁用。直接调用写入 API 也会返回 `Panel is stopped`。

在周期发送开始之前，Load 由滑块控制。一旦开始，ECU 会从接收到的每个 Command 中获取 Target，覆盖手动设置的 Load。再次测试滑块之前，请先停止周期 Command 发送。

| 通道                                     | 节点                                | 角色                         |
| -------------------------------------- | --------------------------------- | -------------------------- |
| HTML_ECU / 模拟 0   | HTML ECU / ecu.ts | 每 100 ms 发送 0x100，接收 0x101 |
| HTML_PANEL / 模拟 1 | HTML 命令                           | 每 100 ms 发送 0x101，接收 0x100 |

`panel.setSignal` 更新信号缓存，其本身不会发送帧。成功并不意味着 ECU 已接收；请检查 ECU received 和 Command 帧以确认总线通信。

## 文件

| 文件                              | 内容                                                            |
| ------------------------------- | ------------------------------------------------------------- |
| HtmlControl.ecb | 变量、数据库、模拟通道和面板引用                                              |
| html.ecpanel    | 带有嵌入式 HTML/CSS 和 JavaScript 的独立面板                             |
| control.html    | 可编辑的 HTML/CSS 源文件                                             |
| control.js      | 可编辑的桥接 API 示例                                                 |
| ecu.ts          | 模拟 ECU 脚本                                                     |
| HtmlDemo.dbc    | Status.Speed 和 Command.Target |
| sync-panel.mjs  | 将两个源文件复制到 html.ecpanel 中                      |

编辑 `control.html` 或 `control.js` 后，请从仓库根目录运行：

```powershell
node resources/examples/panel_html/sync-panel.mjs
```

然后关闭并重新打开示例项目，以便应用再次读取 `.ecpanel`。同步之前，请关闭任何正在编辑此面板的窗口，以免之后将较旧的内容保存并覆盖该文件。运行时仅使用 `.ecpanel` 中的内容；不会加载 `.html` / `.js` 源文件。

## API

```javascript
const value = await panel.getVar('HtmlLevel')
await panel.setVar('HtmlLevel', 50)
const off = await panel.onVar('HtmlLevel', value => console.log(value))
off()

const signal = await panel.getSignal('HtmlDemo.Speed')
console.log(signal.rawValue, signal.physicalValue)
await panel.setSignal('HtmlDemo.Target', '45') // physical 45%, DBC raw value 450
await panel.setSignal('HtmlDemo.Target', 450)  // a number is the raw value
const offSignal = await panel.onSignal('HtmlDemo.Speed', signal => console.log(signal.physicalValue))
offSignal()
```

变量回调接收值本身；信号回调接收一个包含 `rawValue` 和 `physicalValue` 的对象。变量名使用完整路径；信号名为 `database.signal`，同一数据库中含义模糊的信号名会被拒绝。 `getSignal()` 返回当前测量中最新解码的发送或接收帧采样，与 HTML 订阅无关；在没有采样时，它会回退到项目数据库值，该值可能未设置。 `setSignal()` 更新发送数据库；成功并不能确认已发送或 ECU 已处理，因此写入后立即读取不保证会返回新值。信号记录随测量一起开始，因此首次读取或新打开的窗口可以获取到更早的一次性采样。

`HtmlLevel` 和 `HtmlEnabled` 绑定到启用了 Remember value 的原生控件，因此它们的值会在测量停止时写回项目；`HtmlRxTarget` 和 `HtmlRxCount` 是运行时状态，不会写回。 HTML 通过 `window.panel` 在沙箱化的 iframe 中运行，不能使用 Node、Electron IPC、`require` 或 `import`…… from 'ECB'`。 `ECB`仅用于诸如`ecu.ts\` 之类的 node 脚本。

有关用法，请参阅 [Panel 文档](../../../docs/um/panel/index.md)。
