# HTML Control 示例

打开 `HtmlControl.ecb`，使用自带的两个 simulate CAN 通道，不需要真实硬件。需要包含新版 Panel 的 EcuBus-Pro 构建。

## 运行

1. 点击面板的 **START**。首次运行会编译 `ecu.ts`。
2. 拖动 HTML 内的 Load：左侧原生滑块、进度条同步变化，CAN speed 显示负载的两倍。
3. 切换左侧原生 Enabled：HTML 复选框同步变化，关闭后车速为 0。
4. 在 **HTML Command** 交互窗口启动 `0x101 Command` 的周期发送。窗口被遮挡时，从交互节点菜单打开它。
5. 在 HTML 的 CAN target 中填写 `45`，点击 **Set signal**。ECU received 显示 `45 %`，Command frames 持续增加，车速变成 `90.0 km/h`。
6. 点击 **Unsubscribe**：HTML 不再自动更新；点击 **Read values** 可单次读取；点击 **Subscribe** 恢复订阅。
7. 点击 **STOP**：写入控件禁用。直接调用写入 API 也会收到 `Panel is stopped`。

周期发送启动前，Load 由滑块控制；启动后，ECU 每收到一个 Command 都采用其中的 Target，覆盖手动 Load。先停止 Command 周期发送，再测试滑块联动。

| 通道 | 节点 | 作用 |
| --- | --- | --- |
| HTML_ECU / simulate 0 | HTML ECU / ecu.ts | 每 100 ms 发送 0x100，接收 0x101 |
| HTML_PANEL / simulate 1 | HTML Command | 每 100 ms 发送 0x101，接收 0x100 |

`panel.setSignal` 修改信号缓存，不单独发送报文。返回成功也不等于 ECU 已收到；通过 ECU received 和 Command frames 确认总线交互。

## 文件

| 文件 | 内容 |
| --- | --- |
| HtmlControl.ecb | 变量、数据库、模拟通道和面板引用 |
| html.ecpanel | 独立面板，内嵌 HTML/CSS 与 JavaScript |
| control.html | 可编辑的 HTML/CSS 源文件 |
| control.js | 可编辑的桥接 API 示例 |
| ecu.ts | 模拟 ECU 脚本 |
| HtmlDemo.dbc | Status.Speed 和 Command.Target |
| sync-panel.mjs | 将两个源文件同步进 html.ecpanel |

修改 `control.html` 或 `control.js` 后，在仓库根目录执行：

```powershell
node resources/examples/panel_html/sync-panel.mjs
```

然后关闭并重新打开示例工程，使应用重新读取 `.ecpanel`。同步前先关闭正在编辑此面板的窗口，避免稍后保存旧内容覆盖磁盘。运行时不直接加载 `.html` / `.js` 源文件；只读取 `.ecpanel` 中的内容。

## API 要点

```javascript
const value = await panel.getVar('HtmlLevel')
await panel.setVar('HtmlLevel', 50)
const off = await panel.onVar('HtmlLevel', value => console.log(value))
off()

const signal = await panel.getSignal('HtmlDemo.Speed')
console.log(signal.rawValue, signal.physicalValue)
await panel.setSignal('HtmlDemo.Target', '45') // 物理值 45%，DBC 原始值 450
await panel.setSignal('HtmlDemo.Target', 450)  // 数字参数为原始值
const offSignal = await panel.onSignal('HtmlDemo.Speed', signal => console.log(signal.physicalValue))
offSignal()
```

变量回调参数直接是值，信号回调参数是包含 `rawValue`、`physicalValue` 的对象。变量名称使用完整路径；信号名称是 `数据库名.信号名`，同一库里同名信号有歧义时会拒绝操作。信号的实时读取依赖订阅收到的样本，本示例先订阅再读取。

`HtmlLevel`、`HtmlEnabled` 保留上次值；`HtmlRxTarget`、`HtmlRxCount` 是运行状态，显式关闭保留。HTML 在沙箱 iframe 中执行，使用 `window.panel`，不能直接使用 Node、Electron IPC、`require` 或 `import ... from 'ECB'`。`ECB` 仅用于 `ecu.ts` 这类节点脚本。

Panel 使用说明见 [Panel 文档](../../../docs/zh/um/panel/index.md)。
