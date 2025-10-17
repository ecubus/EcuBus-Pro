# Tab 插件系统使用指南

## 概述

Tab 插件系统允许您通过 JSON 配置文件动态扩展应用程序的 Tab 功能，无需修改源代码即可：

- ✅ 添加全新的 Tab
- ✅ 在现有 Tab 中添加新的按钮或菜单
- ✅ 使用自定义图标和样式
- ✅ 绑定自定义事件处理器

## 快速开始

### 第一步：找到插件目录

插件存放在用户数据目录的 `plugins` 文件夹中：

**Windows**: `%APPDATA%\ecubus-pro\plugins\`
**macOS**: `~/Library/Application Support/ecubus-pro/plugins/`
**Linux**: `~/.config/ecubus-pro/plugins/`

应用会在启动时自动创建此目录。

### 第二步：创建您的第一个插件

在插件目录下创建一个新文件夹，例如 `my-first-plugin`：

```
plugins/
└── my-first-plugin/
    ├── manifest.json
    └── handlers.ts
```

### 第三步：编写 manifest.json

```json
{
  "id": "my-first-plugin",
  "name": "我的第一个插件",
  "version": "1.0.0",
  "description": "这是一个测试插件",
  "author": "您的名字",
  "extensions": [
    {
      "targetTab": "home",
      "position": "end",
      "items": [
        {
          "type": "button",
          "id": "hello-button",
          "label": "你好",
          "icon": "mdi:hand-wave",
          "onClick": "sayHello"
        }
      ]
    }
  ]
}
```

### 第四步：编写 handlers.ts

```typescript
import { ElMessage } from 'element-plus'

export default {
  sayHello() {
    ElMessage.success('你好，这是我的第一个插件！')
  }
}
```

### 第五步：重启应用

保存文件后，重启 EcuBus Pro，您就会在 Home Tab 的末尾看到新添加的"你好"按钮！

## 核心概念

### 1. 添加新 Tab

在 `manifest.json` 中使用 `tabs` 数组：

```json
{
  "tabs": [
    {
      "name": "my-tab",
      "label": "我的Tab",
      "icon": "mdi:star",
      "items": [...]
    }
  ]
}
```

- `name`: Tab 的唯一标识（必需）
- `label`: 显示的文本（必需）
- `icon`: 图标名称（可选）
- `items`: Tab 中的按钮和菜单（必需）

**⚠️ 重要限制**：
- 插件添加的新 Tab **只能追加在系统 Tab 之后**
- 系统 Tab 顺序：Home → Hardware → Diagnostics → SOA → Test → Others
- 插件 Tab 按照**加载顺序**依次排列，无法自定义顺序
- 例如：先加载的插件 A 的 tab 会排在后加载的插件 B 的 tab 之前

### 2. 扩展现有 Tab

在 `manifest.json` 中使用 `extensions` 数组：

```json
{
  "extensions": [
    {
      "targetTab": "home",
      "position": "end",
      "items": [...]
    }
  ]
}
```

- `targetTab`: 要扩展的 Tab（`home`、`hardware`、`diag`、`soa`、`test`、`other`）
- `position`: 插入位置（`start` 开头、`end` 末尾、数字索引）
- `items`: 要添加的项目

### 3. 三种项目类型

#### 按钮

```json
{
  "type": "button",
  "id": "my-button",
  "label": "点击我",
  "icon": "mdi:cursor-default-click",
  "onClick": "handleClick"
}
```

#### 下拉菜单

```json
{
  "type": "dropdown",
  "id": "my-menu",
  "label": "选项",
  "icon": "mdi:menu",
  "onCommand": "handleMenuCommand",
  "items": [
    {
      "command": "option1",
      "label": "选项 1",
      "icon": "mdi:numeric-1"
    },
    {
      "command": "option2",
      "label": "选项 2",
      "icon": "mdi:numeric-2"
    }
  ]
}
```

#### 分隔符

```json
{
  "type": "divider"
}
```

## 事件处理

### 按钮点击

```typescript
export default {
  handleClick() {
    // 您的逻辑
    console.log('按钮被点击了')
  }
}
```

### 下拉菜单

```typescript
export default {
  handleMenuCommand(command: string) {
    switch (command) {
      case 'option1':
        console.log('选项 1')
        break
      case 'option2':
        console.log('选项 2')
        break
    }
  }
}
```

### 访问应用功能

```typescript
import { ElMessage, ElMessageBox } from 'element-plus'

export default {
  showMessage() {
    ElMessage.success('操作成功！')
  },
  
  confirmAction() {
    ElMessageBox.confirm('确定要执行此操作吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      // 用户点击确定
      console.log('确认')
    }).catch(() => {
      // 用户点击取消
      console.log('取消')
    })
  }
}
```

## 使用图标

### Iconify 图标库

插件支持 [Iconify](https://icon-sets.iconify.design/) 的所有图标，搜索并使用：

**常用图标集**：
- Material Design Icons: `mdi:home`, `mdi:settings`, `mdi:account`
- Material Symbols: `material-symbols:dashboard`
- Font Awesome: `fa:user`, `fa6-solid:gear`

**查找图标**：
访问 https://icon-sets.iconify.design/ 搜索图标名称

### 示例

```json
{
  "icon": "mdi:rocket-launch",    // 火箭
  "icon": "mdi:heart",            // 爱心
  "icon": "mdi:cog",              // 齿轮
  "icon": "mdi:account-circle",   // 用户头像
  "icon": "mdi:folder-open"       // 文件夹
}
```

## 实战示例

### 示例 1：添加快捷工具

```json
{
  "id": "quick-tools",
  "name": "快捷工具",
  "version": "1.0.0",
  "extensions": [
    {
      "targetTab": "home",
      "position": "end",
      "items": [
        {
          "type": "divider"
        },
        {
          "type": "button",
          "id": "calculator",
          "label": "计算器",
          "icon": "mdi:calculator",
          "onClick": "openCalculator"
        }
      ]
    }
  ]
}
```

```typescript
export default {
  openCalculator() {
    // 打开计算器窗口
    window.electron.ipcRenderer.send('open-calculator')
  }
}
```

### 示例 2：添加自定义 Tab

```json
{
  "id": "my-tools",
  "name": "我的工具集",
  "version": "1.0.0",
  "tabs": [
    {
      "name": "tools",
      "label": "工具",
      "icon": "mdi:toolbox",
      "items": [
        {
          "type": "button",
          "id": "tool1",
          "label": "工具 1",
          "icon": "mdi:wrench",
          "onClick": "useTool1"
        },
        {
          "type": "button",
          "id": "tool2",
          "label": "工具 2",
          "icon": "mdi:screwdriver",
          "onClick": "useTool2"
        }
      ]
    }
  ]
}
```

### 示例 3：带下拉菜单的复杂功能

```json
{
  "type": "dropdown",
  "id": "export-tools",
  "label": "导出",
  "icon": "mdi:export",
  "onCommand": "handleExport",
  "items": [
    {
      "command": "export-pdf",
      "label": "导出为 PDF",
      "icon": "mdi:file-pdf"
    },
    {
      "command": "export-excel",
      "label": "导出为 Excel",
      "icon": "mdi:file-excel"
    },
    {
      "command": "export-json",
      "label": "导出为 JSON",
      "icon": "mdi:code-json"
    }
  ]
}
```

```typescript
import { ElMessage } from 'element-plus'

export default {
  async handleExport(command: string) {
    ElMessage.info(`正在导出为 ${command}...`)
    
    switch (command) {
      case 'export-pdf':
        // PDF 导出逻辑
        break
      case 'export-excel':
        // Excel 导出逻辑
        break
      case 'export-json':
        // JSON 导出逻辑
        break
    }
  }
}
```

## 调试技巧

### 1. 查看日志

按 `F12` 打开开发者工具，在控制台查看：

```
Loading 1 plugins...
Plugin my-plugin registered successfully
Plugins loaded successfully
```

### 2. 常见错误

**插件没有加载**
- 检查 manifest.json 格式是否正确（使用 JSON 验证器）
- 确认文件编码为 UTF-8
- 查看控制台错误信息

**图标不显示**
- 确认图标名称正确（如 `mdi:home`）
- 尝试其他图标测试

**点击无反应**
- 检查 handlers.ts 是否正确导出
- 确认函数名与配置中的名称一致
- 查看控制台是否有 JavaScript 错误

### 3. 测试流程

1. 修改插件文件
2. 保存
3. 重启应用
4. 打开开发者工具查看日志
5. 测试功能

## 配置参考

### manifest.json 完整结构

```json
{
  "id": "string (必需)",
  "name": "string (必需)",
  "version": "string (必需)",
  "description": "string (可选)",
  "author": "string (可选)",
  "tabs": [
    {
      "name": "string (必需)",
      "label": "string (必需)",
      "icon": "string (可选)",
      "position": "number (可选)",
      "items": []
    }
  ],
  "extensions": [
    {
      "targetTab": "string (必需)",
      "position": "start|end|number (可选)",
      "items": []
    }
  ]
}
```

### 按钮配置

```json
{
  "type": "button",
  "id": "string (必需)",
  "label": "string (必需)",
  "icon": "string (可选, Iconify图标名)",
  "iconSize": "string (可选, 如 '24px')",
  "onClick": "string (必需, 处理器函数名)",
  "minWidth": "boolean (可选)",
  "style": "string (可选, CSS样式)",
  "class": "object (可选, CSS类名)"
}
```

### 下拉菜单配置

```json
{
  "type": "dropdown",
  "id": "string (必需)",
  "label": "string (必需)",
  "icon": "string (可选)",
  "iconSize": "string (可选)",
  "onCommand": "string (必需, 处理器函数名)",
  "items": [
    {
      "command": "string (必需)",
      "label": "string (必需)",
      "icon": "string (可选)",
      "disabled": "boolean (可选)",
      "divided": "boolean (可选, 是否显示分隔线)"
    }
  ]
}
```

## 重要限制

### ⚠️ Tab 位置限制

**插件新增的 Tab 只能追加在系统 Tab 之后！**

系统 Tab 的固定顺序是：
1. Home（主页）
2. Hardware（硬件）
3. Diagnostics（诊断）
4. SOA
5. Test（测试）
6. Others（其他）

**之后才是插件的 Tab**

插件 Tab 按照加载顺序排列。例如，如果有两个插件：
- 插件目录：`plugins/plugin-a/` （先加载）
- 插件目录：`plugins/plugin-b/` （后加载）

最终显示顺序：
```
Home → Hardware → Diagnostics → SOA → Test → Others → Plugin A Tab → Plugin B Tab
                                                        ↑ 插件tabs从这里开始，按加载顺序排列
```

插件加载顺序由插件目录的字母顺序决定。

### 如何在系统 Tab 中添加功能？

如果您想在系统 Tab（如 Home、Hardware 等）中添加功能，请使用 `extensions` 而不是 `tabs`：

```json
{
  "extensions": [
    {
      "targetTab": "home",
      "position": "end",
      "items": [
        {
          "type": "button",
          "label": "我的功能",
          "onClick": "myHandler"
        }
      ]
    }
  ]
}
```

## 最佳实践

1. **使用有意义的 ID**: `com.company.plugin-name` 格式
2. **提供清晰的标签**: 让用户一目了然
3. **合理使用图标**: 增强视觉识别
4. **添加用户反馈**: 使用 ElMessage 告知操作结果
5. **处理错误**: 使用 try-catch 防止崩溃
6. **编写文档**: 在插件目录添加 README.md
7. **优先使用 extensions**: 如果功能适合现有 tab，使用扩展而不是新建 tab

## 示例插件

查看内置示例：
- `src/renderer/src/plugin/examples/my-custom-plugin/` - 完整示例
- `src/renderer/src/plugin/examples/simple-plugin/` - 简单示例

## 常见问题

**Q: 可以在插件中使用第三方库吗？**
A: 可以，但需要在 handlers.ts 中导入。注意应用环境中已有的库才能直接使用。

**Q: 插件可以访问应用数据吗？**
A: 可以通过 IPC 与主进程通信，访问文件系统等资源。

**Q: 如何分享我的插件？**
A: 将插件文件夹打包成 zip，其他用户解压到 plugins 目录即可。

**Q: 插件会影响应用性能吗？**
A: 插件只在启动时加载，对运行时性能影响很小。

## 获取帮助

- 查看示例插件
- 阅读完整文档
- 提交 Issue
- 加入社区讨论

祝您开发愉快！🚀

