# LED控制面板示例

本示例演示了EcuBus-Pro中的一个简单程序执行面板，包括状态指示和消息显示。

## 演示功能

1. **程序执行控制**
   - "启动"按钮切换模拟程序的执行。
   - 启动后，程序运行随机时间（2-5秒）然后自动失败。

2. **状态指示**
   - 两个大型LED指示灯：
     - **红色LED**：程序失败时亮起。
     - **蓝色LED**：程序成功时亮起（本演示中未使用，但为扩展保留）。
   - 状态消息区域显示当前状态（例如"正在启动程序执行"、"程序在随机时间后失败"、"手动停止程序执行"）。

3. **面板布局**
   - 包含徽标和标题，便于识别。
   - 所有控件和指示灯以网格形式排列，清晰明了。

## 使用的变量

| 变量名称                            | 类型     | 用途/描述                       |
| ------------------------------- | ------ | --------------------------- |
| Program.run     | number | 控制程序的启动/停止（由启动按钮触发）。        |
| Program.success | number | 指示程序是否成功（启动时设为1，失败/停止时设为0）。 |
| Program.failed  | number | 指示程序是否失败（失败时设为1，否则为0）。      |
| Program.msg     | string | 在面板中显示当前状态消息。               |

> 有关变量的更多信息可在[变量](../../../docs/um/var/var.md)部分找到。

## 工作原理

- 按下**启动**按钮开始程序。
- 消息区域将显示"正在启动程序执行"。
- 经过随机间隔（2-5秒）后，程序将模拟失败：
  - 消息更新为"程序在随机时间后失败"。
  - 红色LED亮起。
  - 启动按钮重置。
- 您可以通过关闭启动按钮手动停止程序，这将显示"手动停止程序执行"。

## 示例面板

![Demo](demo.gif)

## 代码概览

- **panel.ecb**：定义面板布局、变量和UI元素。
- **program.ts**：处理启动、停止和模拟程序失败的逻辑。

```typescript
import { setVar } from 'ECB'
let timer: NodeJS.Timeout
Util.OnVar('Program.run', async (args) => {
  if (args.value == 1) {
    setVar('Program.success', 1)
    setVar('Program.failed', 0)
    setVar('Program.msg', 'Starting program execution')
    timer = setTimeout(async () => {
      setVar('Program.msg', 'Program failed after random time')
      setVar('Program.failed', 1)
      setVar('Program.success', 0)
      setVar('Program.run', 0)
    }, randomTime)
  } else {
    setVar('Program.msg', 'Manual stop of program execution')
    setVar('Program.success', 0)
    setVar('Program.failed', 0)
    clearTimeout(timer)
  }
})
const randomTime = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000
```
