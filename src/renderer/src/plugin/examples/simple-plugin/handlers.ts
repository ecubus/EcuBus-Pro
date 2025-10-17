/**
 * 简单插件的处理器
 */

import { ElMessageBox } from 'element-plus'

export default {
  /**
   * 显示测试帮助
   */
  showTestHelp() {
    ElMessageBox.alert(
      'This is a test helper added by the Simple Plugin. You can add any custom functionality here!',
      'Test Helper',
      {
        confirmButtonText: 'OK',
        type: 'info'
      }
    )
  }
}
