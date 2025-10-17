/**
 * 插件处理器示例
 * 这些函数会在用户点击插件添加的按钮或菜单时被调用
 */

import { ElMessage } from 'element-plus'

export default {
  /**
   * 处理自定义动作
   */
  handleCustomAction() {
    ElMessage.success('Custom action executed!')
    console.log('Custom action from plugin')
  },

  /**
   * 处理自定义下拉菜单命令
   */
  handleCustomCommand(command: string) {
    ElMessage.info(`Custom command: ${command}`)
    console.log('Custom command:', command)

    // 根据不同的命令执行不同的操作
    switch (command) {
      case 'action1':
        console.log('Executing action 1')
        break
      case 'action2':
        console.log('Executing action 2')
        break
    }
  },

  /**
   * 处理 Home tab 的扩展按钮
   */
  handleHomeExtension() {
    ElMessage.success('Home tab extension clicked!')
    console.log('Home extension from plugin')
  },

  /**
   * 处理 Other tab 的扩展按钮
   */
  handleOtherExtension() {
    ElMessage.info('Other tab extension clicked!')
    console.log('Other extension from plugin')

    // 这里可以打开一个窗口，或者执行其他操作
    // 例如：layoutMaster.addWin('custom-view', 'custom-view-id')
  }
}
