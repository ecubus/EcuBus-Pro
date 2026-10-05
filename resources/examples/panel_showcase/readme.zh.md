# Panel Showcase

这是一个可直接打开的 Panel 演示工程，使用两个 `simulate` CAN 通道，不需要真实硬件。

![Panel Showcase 运行界面](showcase.png)

| 通道 | 节点 | 报文 |
|---|---|---|
| `SIM_ECU` | Demo ECU（`simulation.ts`） | 发送 `0x100 Status`（100 ms），接收 `0x101 Command` |
| `SIM_PANEL` | Panel Command（交互节点） | 发送 `0x101 Command`（100 ms），接收 `0x100 Status` |

打开 `PanelShowcase.ecb`，点击 Start，再打开 Panel Command 窗口启动 `Command` 周期发送。Panel 的 DBC target 写入 `Command.Target`，关闭 Automatic sweep 后 Demo ECU 按 `Target` 设置负载；`Status` 的速度、温度等信号回到 Panel 显示。

主 Panel 分成三页：

- Overview：START/STOP、开关、复选框、滑块、数值输入、单选组、下拉框、按钮、仪表、数值显示、LED、进度条和 DBC 物理值输入。
- Inputs / Actions：Hex/Text Editor、字节编辑器、文件/目录/保存路径选择、十六进制和二进制输入、普通 Button 动作。
- Appearance：六种 LED 形状、三种 Button 形状、四个进度方向、嵌入式图片和 HTML + JavaScript 控件。三个 Button 切换 `DemoToggle`，六个 LED 同步亮灭；Fill 滑块、四个进度条和 HTML 控件共用 `DemoFill`，任一处修改其余同步，`DemoFill` ≥ 80 时脚本点亮 Fill ≥ 80 指示灯；HTML 控件同时订阅 `PanelDemo.Speed` 信号。

`simulation.ts` 是模拟 ECU 脚本：周期性生成速度、温度、负载、状态和计数器，接收面板变量和 CAN 命令。`PanelDemo.dbc` 是演示 DBC，`variables.json` 是变量清单，`.ecpanel` 文件是独立 Panel 文件。

工程文件：`PanelShowcase.ecb`  
主面板：`showcase.ecpanel`  
详情面板：`detail.ecpanel`  
模拟脚本：`simulation.ts`

复制整个目录后再打开工程，保持这些文件的相对路径即可。每个工程使用单独的目录，不要与其他工程共用，否则会共用生成的 `tsconfig.json` 和变量类型，导致脚本编译失败。`DEMO.md` 是文件 Button 的示例目标。

Panel 控件属性中的"记住值"默认开启：停止测量时，控件绑定的用户变量值写回工程，保存工程后下次启动沿用；关闭后每次启动使用控件的初始值。启动脚本主动赋值仍会覆盖该值，本示例的用户参数初始化使用当前变量值。
