# 开发者文档指南

## 概述

本项目使用 [VitePress](https://vitepress.dev/) 作为文档系统，支持中英文双语文档。 文档位于 `docs/` 目录中，采用 Markdown 格式编写。

## 项目结构

```text
docs/
├── en/          # 英文文档
│   ├── about/   # 关于页面
│   ├── dev/     # 开发者文档
│   ├── faq/     # 常见问题
│   └── um/      # 用户手册
├── zh/          # 中文文档
│   ├── about/   # 关于页面
│   ├── dev/     # 开发者文档
│   └── um/      # 用户手册
├── media/       # 媒体文件（图片、视频等）
│   ├── about/   # 关于页面媒体文件
│   └── um/      # 用户手册媒体文件
└── component/   # 自定义组件
```

## 开发命令

### 本地开发

```bash
# 启动文档开发服务器
npm run docs:dev

# 构建文档
npm run docs:build

# 预览构建后的文档
npm run docs:preview
```

### 文档构建

```bash
# 构建生产环境文档
npm run docs:build
```

## 编写文档

### 多语言支持

#### 文件对应关系

中英文文档应保持相同的结构：

```text
docs/zh/dev/adapter.md  ↔  docs/en/dev/adapter.md
docs/zh/um/can/can.md   ↔  docs/en/um/can/can.md
```

#### 翻译指南

1. 首先创建中文版本
2. 翻译为英文版本（可由AI完成）
3. 保持文件结构一致
4. 确保链接和图片路径正确

### 文档组织

#### 推荐目录结构

```text
docs/zh/
├── about/           # 关于页面
│   ├── contact.md   # 联系信息
│   ├── install.md   # 安装指南
│   └── sponsor.md   # 赞助信息
├── dev/             # 开发者文档
│   ├── adapter.md   # 适配器文档
│   ├── addon.md     # 插件开发
│   └── arch.md      # 架构文档
├── faq/             # 常见问题
│   └── index.md     # 常见问题首页
└── um/              # 用户手册
    ├── can/         # CAN 总线
    ├── lin/         # LIN 总线
    ├── uds/         # UDS 服务
    └── var/         # 变量管理
```

#### 文件命名规范

- 使用小写字母和连字符
- 文件名应具有描述性
- 避免空格和特殊字符

```text
✅ 正确：can-bus-guide.md
❌ 错误：CAN Bus Guide.md
```
