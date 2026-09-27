# Panel 验证

`progress.spec.ts` 验证四向填充、起点值、百分比与小数格式、无数据、越界限幅、兼容旧文档以及属性撤销/锁定。Electron 冒烟脚本另生成 `progress-light.png`、`progress-dark.png`，检查真实渲染的方向、格式及停止时清空填充。

同一组 Electron 截图包含三种按钮形状；脚本检查矩形/圆角半径、圆形宽高相等以及圆形点动按钮的一对 1/0 写入。

真实 Electron 冒烟验证（先执行 `npm run build`，使用当前 `out/` 产物）：

```sh
node node_modules/electron/cli.js test/panel/electron-smoke.cjs
```

使用独立临时配置与工程，启动真实主进程、预加载和 Vue 页面。验证编辑器添加/保存、真实 IPC 写入 `.ecb`、关闭工程并重新加载页面后恢复、运行数值、按钮 1/0 写入、外部窗口及停止后的取消订阅。完成后退出测试窗口，控制台输出截图和 `result.json` 所在目录。不会打开当前用户工程。

变量绑定由测试代码设置，运行样本通过 logBus 注入，按钮通过 DOM PointerEvent 操作；不覆盖原生文件对话框、系统鼠标拖拽、整个应用进程重启或真实 ECU 通信。截图使用 Electron `capturePage()`，无需系统截图插件。

脚本同时验证旧面板迁移报告、创建新版副本及通过真实 IPC 将原版和副本写入同一工程；产出迁移报告和副本截图。`migration.spec.ts` 覆盖支持控件、变量绑定优先级、拒绝不兼容行为/数值、不修改原始对象和副本命名冲突。

窗口布局回归使用 Electron `sendInputEvent` 操作真实缩放手柄和标题栏：替换窗口状态对象后检查外框、标题、编辑区尺寸一致，并验证拖动坐标及最大化还原。为避免遮挡，测试工程会关闭默认 Message 窗口；这不操作用户工程。

画布大小可通过右侧、底部、右下角手柄调整，遵循缩放比例和网格吸附；缩小时保留控件位置，不允许画布裁掉已有控件。一次拖拽对应一步撤销，Esc 取消。Electron 使用 `sendInputEvent` 在 50% 缩放下拖拽画布并验证宽高、撤销/重做、单边缩小取消与工程保存恢复。

独立 Start / Stop 控件增加后组件数为 18。Electron 验证同一控件内绿色 START 和红色 STOP 按状态启用、实际启停，以及类型保存恢复。标签测试覆盖默认左侧与显式位置保留，运行截图检查字符串输入标签在左侧。

Windows 下正在运行的应用可能锁住 `out/main/chunks/*.node`，使常规构建清理失败。保留应用运行时可在 PowerShell 使用独立产物：

```powershell
npm run typecheck
node node_modules/electron-vite/bin/electron-vite.js build --outDir node_modules/.cache/panel-migration-build
$env:PANEL_SMOKE_BUILD_DIR = (Resolve-Path node_modules/.cache/panel-migration-build).Path
node node_modules/electron/cli.js test/panel/electron-smoke.cjs
Remove-Item Env:PANEL_SMOKE_BUILD_DIR
```

单元测试：

```sh
node node_modules/vitest/vitest.mjs run test/panel
```

独立浏览器交互验证：

```sh
node node_modules/vite/bin/vite.js --config test/panel/vite.config.ts
```

打开 http://127.0.0.1:5199/。使用产品 FreePanelEditor/PanelCanvas/ControlView 组件；画布保存仅更新内存中的测试文档。变量选择器提供 Level 数值变量。

- `?dark=1`：深色主题。
- `?en=1`：英文界面，示例控件标签仍为测试文档原文。
- `?runtime=1`：运行组件的模拟验证，Start / Stop 切换运行状态，Receive 42 注入更新。写入调用只记录在页面底部，并回显到控件，不连接 Electron 或硬件。
- `?containers=1`：分组、嵌套控件和两页标签页示例；可与 `dark=1`、`runtime=1` 组合。
- `?sources=1`：增加 Demo.Vehicle.Speed 信号和 State 字符串变量，可与容器示例组合。
- `?gallery=1`：全部 13 种控件的展示面板。

浏览器入口使用 `.mts`，与项目的 Node 测试类型检查分开。校验浏览器测试和产品前端：

```sh
node node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p test/panel/tsconfig.json
```

人工交互检查：

1. 在 50%、100%、200% 下拖拽，确认属性坐标按设计像素变化；关闭吸附时，屏幕位移除以缩放比例应等于文档位移。
2. 框选和 Shift 追加选择，整体拖动，验证相对位置及一次撤销。
3. 拖动尺寸手柄，检查 X/Y/W/H、画布边界和撤销。
4. 修改属性、复制、删除、排列、锁定，保存测试文档，继续修改后撤销。
5. 预览中修改数值、滑块和枚举；回到编辑模式，运行值不得污染文档初始值。
6. 绑定 Level，检查单位、范围、清除和撤销；深浅主题下检查弹窗。
7. 模拟运行中接收数据，不应产生写入；按钮按下后释放或移出，应产生一次 1 和一次 0；停止后接收数据无变化。
8. 新建开关/指示灯应为 128 × 32；默认尺寸下标签和状态不溢出。
9. 进度条和仪表修改最小值、最大值及初始值，检查负范围、越界限幅和单位；模拟运行停止时显示“—”，接收 42 时同步显示且无写入。
10. 图片导入 PNG/JPEG/WebP/GIF，切换适应方式，清除后撤销恢复；锁定后不可修改。图片以嵌入数据保存在文档中。
11. 在容器示例中拖动外层分组与内层控件；200% 下移动 32 个屏幕像素，应改变 16 个设计像素。缩小容器不能裁掉已有子控件，子控件拖出边界后应回到边界内。
12. Shift 多选同一容器/页面的控件，组合、取消组合、整组复制和删除；撤销应恢复完整结构，包括隐藏页。锁定父容器后，子控件不能移动或改属性。
13. 新增页面并改名，选中标签页后从组件栏添加控件；修改“容器”和“页面”可调整归属。非空页面不能直接删除，先移动或删除其控件。最后一页不能删除。
14. 改页面名称后一次撤销应恢复整段名称；设置默认页，预览中切页，回到编辑后默认页不变。图层选中隐藏页控件应自动切换页面。
15. 容器模拟运行中接收 42 后再切到详情，应立即显示 42 且没有回写。点动按钮按下/释放仅记录一对 1/0；左右方向键可切页。
16. 数据栏按名称搜索，切换信号/变量。拖 Speed 到空白处应新增一个绑定显示控件，撤销一次完整移除；拖 Level 到滑块应绑定该控件而不增加数量。
17. 拖 State 到数值输入/开关时应拒绝；拖到数值显示可绑定。拖入容器空白应进入当前页，控件坐标不越界；锁定目标不允许重新绑定。
18. 多选数值输入和滑块应显示共有范围、步长、单位、初始值、只读；多选仪表和滑块不应出现步长或只读。批量修改单位或范围后，一次撤销恢复所有值并保留多选。
19. 混合值应有明确标记。加入锁定控件后，批量修改仅影响未锁定控件；混合单位仍可完整输入并一次提交。

该入口不验证真实 Electron 窗口、工程文件持久化或 ECU 通信。这些仍需在桌面应用和指定测试设备上执行。

`persistence.spec.ts` 验证真实编辑/运行入口的保存 id、JSON 往返恢复和旧版分派；子控件与数据存储使用替身，不验证 Electron 磁盘读写、窗口交互或真实通信。

`project-file.spec.mts` 使用真实 Pinia 工程/数据存储执行保存、关闭、重开及再次保存；文件 IPC 替换为 Node 文件读写，临时 `.ecb` 在测试后清理。覆盖新旧 Panel、窗口参数、容器、图片和绑定数据，仍不验证 Electron IPC 传输或桌面交互。该测试通过上面的 `test/panel/tsconfig.json` 执行类型检查。

同一测试还读取仓库真实旧工程，验证普通打开自动升级、源文件打开时不改写、保存重开幂等、示例入口转换以及五个复杂样本保持原版。Electron 脚本额外用临时副本验证真实文件 IPC 自动升级及新版编辑器保存后保留原始 rule/options。

`actions.spec.ts` 覆盖字符串类型约束、空字符串、只读/停止限制、Radio 枚举校验、按钮动作状态，以及文件/目录/保存路径和取消选择。Electron 脚本验证 17 项控件入口、字符串/Check Box/Radio 写入、按钮启停、文件与面板打开、路径取消与停止后的异步结果丢弃、配置保存重开，并生成 `actions-and-inputs.png`。路径对话框返回值和系统文件打开在测试进程中替换，仍不覆盖原生对话框交互与真实外部程序启动。

`hex-text.spec.ts` 验证 UTF-8 字符串、单字节文本和 Hex 转换、非法输入拒绝及字节数组写入。Electron 另验证两侧分隔条实际拖拽、LED 默认无标签及灯体尺寸、Hex 字节数组通过真实变量 IPC 写入。旧 `input` 类型保留，未配置 editorMode 的文档仍使用文本模式。

`led.spec.ts` 验证六种形状、亮/灭值及颜色、未知状态、等比例/拉伸、边框和属性撤销恢复。Electron 验证六种 SVG 路径与运行时亮/灭颜色切换，生成 `led-shapes.png`。

`progress-position.spec.ts` 覆盖独立数值位置、旧隐藏设置与撤销保存。Electron 用实际元素矩形验证隐藏/左/上/右/下及垂直进度条数值位置，生成 `progress-value-positions.png`。

`numeric.spec.ts` 覆盖数值格式与严格解析、范围限制、单位/范围标签、报警恢复、同源原始值/物理值订阅和 CAN 物理值逆向换算。Electron 使用实际文本输入验证 Hex 数值通过变量 IPC 写入，并检查十进制/二进制显示及上下限报警背景恢复，生成 `numeric-formats.png`。这些检查不覆盖真实 CAN/LIN 设备通信。

`external-file.spec.mts` 覆盖 `.ecpanel` 格式、跨工程绑定匹配与歧义处理、相对引用和缺失文件。工程文件测试验证真实磁盘保存/重开时仅保存引用、载入外部修改及保留丢失引用；编辑入口测试验证文件写入失败时不替换已保存内容。Electron 覆盖另存为、再次保存写回、重启载入和导入另一个文件，使用测试对话框结果和真实文件 IPC。

## 新版示例与 HTML Control

`remembered-values.spec.ts` 覆盖记忆值缓存、500 ms 合并写入、切换工程和显式补写、旧存储键兼容及批量读取。运行值先更新内存，每 500 ms 异步合并写入配置目录下的 `remembered-variables/<工程哈希>.json`，临时文件写完后再替换。停止测量等待补写；正常退出最多等待 2 秒，超时记录错误后退出，未完成的更新可能丢失。读取失败使用初始值并保留原文件，该次会话不覆盖它；下次启动测量重试读取。HTML 冒烟脚本同时检查原生控件按变量去重查询，以及 HTML 单变量读取只产生一次 IPC 且不携带整个变量表。

缓存按工程路径隔离，最多保留 16 个可淘汰的工程缓存，正在使用或尚未保存的缓存不淘汰。交替查询不会触发写盘，未保存工程不持久化。启动测量时按完整变量表清理已删除或关闭保留的变量；旧工程文件可在“用户变量 → 记忆文件”中选择删除，当前使用中或尚未写完的记录不可删除；不按年龄自动删除。新文件记录工程路径，旧版纯变量映射仍可读取。旧配置值迁移成功后才删除对应旧记录。写盘失败会记录错误并保留脏数据，后续变量更新或生命周期补写时重试，不阻断停止测量。测试覆盖写入异常、多工程交替读取和失败后的补写；面板只使用 `ipc-panel-var-values` 批量接口，纯布局变化不查询变量。`remembered-disk.spec.ts` 验证真实文件保存及新缓存读取。持久化只在主进程 VarLOG 入口触发；worker 打包后可检查 `dist/index.js.map` 不包含 persistence、store 和 conf。

Windows 下使用 `node node_modules/electron/cli.js` 启动冒烟脚本，不直接运行 `electron.exe`。四个脚本的控制台日志同步写入各自临时目录的 `console.log`，结果保存在同目录的 `result.json`，不依赖启动终端的输出管道。临时目录为 `%TEMP%/ecubus-panel-electron-*`。`smoke-console.spec.ts` 验证输出管道断开时日志仍能保存。

`examples.spec.mts` 检查六个旧示例转为 `.ecpanel` 后的控件数、绑定和按钮语义，以及 HTML 源文件与独立面板的一致性。旧面板原始数据保存在 `fixtures/` 中，用于继续验证旧版兼容。

独立 HTML 示例的 Electron 验证：

```powershell
node node_modules/electron/cli.js test/panel/html-smoke.cjs
```

使用当前构建，或通过 `PANEL_SMOKE_BUILD_DIR` 指定独立构建目录。脚本在临时目录复制 `panel_html`，编译 ECU 脚本并验证 HTML/原生控件双向联动、两个 simulate 通道的信号写入和接收、取消/恢复订阅、停止时拒绝写入。它通过 IPC 启动交互节点周期发送，不覆盖用户点击该发送按钮的路径。

六个迁移示例的渲染验证：

```powershell
node node_modules/electron/cli.js test/panel/migrated-smoke.cjs
```

此脚本只打开临时副本，检查控件数量、绑定状态并截图，不启动硬件测量。Program 示例中不受支持的旧 DBC 在临时副本中过滤；原工程数据库不改动。停止后清空显示的通用冒烟用例显式关闭测试变量保留；默认保留行为由 `remembered-values.spec.ts` 和 `showcase-smoke.cjs` 验证。

`shutdown.spec.ts` 覆盖同步清理异常、写入拒绝以及停止/写入不返回时的退出超时。HTML 冒烟验证损坏文件回退、启动锁释放、手动清理和正常退出落盘。
