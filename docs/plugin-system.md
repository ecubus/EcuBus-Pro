# Tab 插件系统使用指南

## 概述

Tab 插件系统允许您通过 JSON 配置文件动态扩展应用程序的 Tab 功能，无需修改源代码即可：

- ✅ 添加全新的 Tab
- ✅ 在现有 Tab 中添加新的按钮或菜单
- ✅ 使用自定义图标和样式
- ✅ 绑定自定义事件处理器

## 插件目录结构

插件存放在用户数据目录的 `plugins` 文件夹中：

```
%APPDATA%/ecubus-pro/plugins/
├── my-plugin/
│   ├── manifest.json      # 插件配置文件（必需）
│   ├── handlers.ts         # 事件处理器（可选）
│   └── README.md           # 插件说明（可选）
└── another-plugin/
    ├── manifest.json
    └── handlers.ts
```

## 插件配置文件 (manifest.json)

### 基本结构

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "插件描述",
  "author": "作者名称",
  "tabs": [...],        // 新增的 Tab（可选）
  "extensions": [...]   // 对现有 Tab 的扩展（可选）
}
```

### 完整示例

```json
{
  "id": "demo-plugin",
  "name": "Demo Plugin",
  "version": "1.0.0",
  "description": "演示插件功能",
  "author": "Your Name",
  
  "tabs": [
    {
      "name": "demo",
      "label": "Demo",
      "icon": "mdi:puzzle",
      "items": [
        {
          "type": "button",
          "id": "demo-action",
          "label": "Demo Action",
          "icon": "mdi:play",
          "iconSize": "24px",
          "onClick": "handleDemoAction"
        },
        {
          "type": "divider"
        },
        {
          "type": "dropdown",
          "id": "demo-menu",
          "label": "Demo Menu",
          "icon": "mdi:menu",
          "items": [
            {
              "command": "option1",
              "label": "Option 1",
              "icon": "mdi:numeric-1"
            },
            {
              "command": "option2",
              "label": "Option 2",
              "icon": "mdi:numeric-2",
              "disabled": false
            }
          ],
          "onCommand": "handleDemoCommand"
        }
      ]
    }
  ],
  
  "extensions": [
    {
      "targetTab": "home",
      "position": "end",
      "items": [
        {
          "type": "button",
          "id": "home-extension",
          "label": "Extended",
          "icon": "mdi:star",
          "onClick": "handleHomeExtension"
        }
      ]
    }
  ]
}
```

## 配置项说明

### 新增 Tab (tabs)

| Field | Type | Required | Description |
|------|------|------|------|
| `name` | string | ✅ | Tab unique identifier |
| `label` | string | ✅ | Tab display text |
| `icon` | string | ❌ | Iconify icon name (e.g. `mdi:puzzle`) |
| `items` | array | ✅ | Items in the tab |

**Note**: Plugin tabs are always displayed after system tabs (Home, Hardware, Diagnostics, SOA, Test, Others) in the order they are loaded.

### 扩展现有 Tab (extensions)

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `targetTab` | string | ✅ | 目标 Tab 名称（`home`、`hardware`、`diag`、`soa`、`test`、`other`） |
| `position` | string\|number | ❌ | 插入位置：`start`、`end`、数字索引（默认 `end`） |
| `items` | array | ✅ | 要添加的项目列表 |

### 项目类型

#### 按钮 (button)

```json
{
  "type": "button",
  "id": "unique-id",
  "label": "Button Text",
  "icon": "mdi:rocket",
  "iconSize": "24px",
  "onClick": "handlerFunctionName",
  "minWidth": false,
  "style": "color: red",
  "class": {
    "custom-class": true
  }
}
```

#### 下拉菜单 (dropdown)

```json
{
  "type": "dropdown",
  "id": "unique-id",
  "label": "Menu Text",
  "icon": "mdi:menu",
  "iconSize": "24px",
  "onCommand": "handlerFunctionName",
  "items": [
    {
      "command": "cmd1",
      "label": "Command 1",
      "icon": "mdi:numeric-1",
      "disabled": false,
      "divided": false
    }
  ]
}
```

#### 分隔符 (divider)

```json
{
  "type": "divider"
}
```

## 事件处理器 (handlers.ts)

创建 `handlers.ts` 文件来定义事件处理逻辑：

```typescript
import { ElMessage } from 'element-plus'

export default {
  // 按钮点击处理器
  handleDemoAction() {
    ElMessage.success('Demo action executed!')
    console.log('Button clicked')
  },

  // 下拉菜单命令处理器
  handleDemoCommand(command: string) {
    ElMessage.info(`Command: ${command}`)
    
    switch (command) {
      case 'option1':
        console.log('Option 1 selected')
        break
      case 'option2':
        console.log('Option 2 selected')
        break
    }
  },

  // 扩展项处理器
  handleHomeExtension() {
    ElMessage.success('Home extension clicked!')
  }
}
```

## 图标使用

插件系统支持 [Iconify](https://icon-sets.iconify.design/) 的所有图标：

### 常用图标集

- **Material Design Icons**: `mdi:icon-name`
  - 示例: `mdi:home`, `mdi:settings`, `mdi:account`
  
- **Material Symbols**: `material-symbols:icon-name`
  - 示例: `material-symbols:dashboard`, `material-symbols:analytics`
  
- **Font Awesome**: `fa:icon-name` 或 `fa6-solid:icon-name`
  - 示例: `fa:user`, `fa6-solid:gear`

### 查找图标

访问 [Iconify Icon Sets](https://icon-sets.iconify.design/) 搜索所需图标。

## 内置 Tab 名称

您可以扩展以下内置 Tab：

| Tab 名称 | 说明 |
|---------|------|
| `home` | 主页 |
| `hardware` | 硬件 |
| `diag` | 诊断 |
| `soa` | SOA |
| `test` | 测试 |
| `other` | 其他 |

## 完整示例

查看 `src/renderer/src/plugin/examples/` 目录下的示例插件：

1. **my-custom-plugin** - 展示如何添加新 Tab 和扩展现有 Tab
2. **simple-plugin** - 简单的扩展示例

## 开发工作流

### 1. 创建插件目录

```bash
cd %APPDATA%/ecubus-pro/plugins
mkdir my-plugin
cd my-plugin
```

### 2. 创建 manifest.json

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "extensions": [
    {
      "targetTab": "home",
      "position": "end",
      "items": [
        {
          "type": "button",
          "id": "test-button",
          "label": "Test",
          "icon": "mdi:test-tube",
          "onClick": "handleTest"
        }
      ]
    }
  ]
}
```

### 3. 创建 handlers.ts

```typescript
import { ElMessage } from 'element-plus'

export default {
  handleTest() {
    ElMessage.success('Test button clicked!')
  }
}
```

### 4. 重启应用

插件会在应用启动时自动加载。

## 调试

### 查看插件加载日志

打开开发者工具（F12），查看控制台输出：

```
Loading 2 plugins...
Plugin my-plugin registered successfully
Plugin another-plugin registered successfully
Plugins loaded successfully
```

### 常见问题

**Q: 插件没有生效？**
- 检查 `manifest.json` 格式是否正确
- 确认插件目录位置正确
- 查看控制台是否有错误信息

**Q: 图标没有显示？**
- 确认图标名称格式正确（如 `mdi:home`）
- 尝试使用其他图标验证

**Q: 处理器没有被调用？**
- 确认 `handlers.ts` 导出正确
- 检查处理器函数名称与配置中的名称匹配

## 最佳实践

1. **唯一的插件 ID**: 使用反向域名格式（如 `com.company.plugin-name`）
2. **版本管理**: 遵循语义化版本（SemVer）
3. **错误处理**: 在处理器中添加 try-catch
4. **用户反馈**: 使用 ElMessage 提供操作反馈
5. **文档**: 为插件编写 README.md

## API 参考

### 插件管理器

```typescript
import { tabPluginManager } from '@r/plugin/tabPluginManager'

// 注册插件
tabPluginManager.registerPlugin(plugin)

// 获取所有插件
tabPluginManager.getAllPlugins()

// 获取特定插件
tabPluginManager.getPlugin('plugin-id')

// 调用处理器
tabPluginManager.callHandler('plugin-id', 'handlerName', ...args)

// 卸载插件
tabPluginManager.unregisterPlugin('plugin-id')
```

## 未来计划

- [ ] 插件市场
- [ ] 热重载支持
- [ ] 插件权限系统
- [ ] 更多扩展点
- [ ] 插件开发 CLI 工具

## 贡献

欢迎提交插件示例和改进建议！

