# 面板展示

一个可直接打开的面板演示项目，使用两个 `simulate` CAN 通道，因此无需硬件。

![面板展示运行中](showcase.png)

| 通道          | 节点                      | 报文                                           |
| ----------- | ----------------------- | -------------------------------------------- |
| `SIM_ECU`   | 演示 ECU（`simulation.ts`） | 发送 `0x100 Status`（100 ms），接收 `0x101 Command` |
| `SIM_PANEL` | 面板命令（交互节点）              | 发送 `0x101 Command`（100 ms），接收 `0x100 Status` |

打开 `PanelShowcase.ecb`，点击开始，然后打开 Panel Command 窗口并启动周期性 `Command` 发送。面板的 DBC 目标写入 `Command.Target`；关闭自动扫描时，演示 ECU 根据 `Target` 设置负载。速度、温度及其他 `Status` 信号会回显在面板上。

主面板有三个页面：

- 概览：START/STOP、开关、复选框、滑块、数值输入、单选组、选择框、按钮、仪表、数值显示、LED、进度条和 DBC 物理值输入。
- 输入 / 操作：十六进制/文本编辑器、字节编辑器、文件/目录/保存路径选择、十六进制和二进制输入，以及普通按钮操作。
- 外观：六种 LED 形状、三种按钮形状、四个进度方向、一张嵌入图片和一个 HTML + JavaScript 控件。三个按钮切换 `DemoToggle`，六个 LED 跟随它；填充滑块、四个进度条和 HTML 控件共享 `DemoFill`，因此更改其中一个会更新其他项，并且当 `DemoFill` ≥ 80 时脚本会点亮填充 ≥ 80 指示器。 HTML 控件还订阅 `PanelDemo.Speed` 信号。

`simulation.ts` 是模拟 ECU：它周期性地生成速度、温度、负载、状态和计数器，并接收面板变量和 CAN 命令。 `PanelDemo.dbc` 是演示 DBC，`variables.json` 列出变量，`.ecpanel` 文件是独立的面板文件。

项目：`PanelShowcase.ecb`  
主面板：`showcase.ecpanel`  
详情面板：`detail.ecpanel`  
仿真脚本：`simulation.ts`

打开项目前复制整个文件夹，并保持相对路径不变。为每个项目分配各自的文件夹：共享文件夹的项目也会共享生成的 `tsconfig.json` 和变量类型，这会破坏脚本编译。 `DEMO.md` 是文件按钮的目标。

请记住，面板控件属性中的记住值默认开启：当测量停止时，绑定的用户变量值会写回项目，并且在保存项目后，下一次测量会从这些值开始。关闭时，每次测量都从控件的初始值开始。启动脚本分配的值仍会覆盖它；此示例从当前变量值初始化其用户参数。
