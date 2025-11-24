# 开发者文档指南

## 概述

本项目使用 [VitePress](https://vitepress.dev/) 作为文档系统，支持中英文双语文档。 文档位于 `docs/` 目录中，采用 Markdown 格式编写。 文档位于 `docs/` 目录中，采用 Markdown 格式编写。

## 项目结构

```text
docs/
├── en/          # English documentation
│   ├── about/   # About pages
│   ├── dev/     # Developer documentation
│   ├── faq/     # FAQ
│   └── um/      # User manual
├── zh/          # Chinese documentation
│   ├── about/   # About pages
│   ├── dev/     # Developer documentation
│   └── um/      # User manual
├── media/       # Media files (images, videos, etc.)
│   ├── about/   # About page media files
│   └── um/      # User manual media files
└── component/   # Custom components
```

## 开发命令

### 本地开发

```bash
# Start documentation development server
npm run docs:dev

# Build documentation
npm run docs:build

# Preview built documentation
npm run docs:preview
```

### 文档构建

```bash
# Build production documentation
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

1. 先创建中文版本
2. 翻译为英文版本（可由 AI 完成）
3. 保持文件结构一致
4. 确保链接和图片路径正确

### 文档组织

#### 推荐目录结构

```text
docs/zh/
├── about/           # About pages
│   ├── contact.md   # Contact information
│   ├── install.md   # Installation guide
│   └── sponsor.md   # Sponsorship information
├── dev/             # Developer documentation
│   ├── adapter.md   # Adapter documentation
│   ├── addon.md     # Plugin development
│   └── arch.md      # Architecture documentation
├── faq/             # FAQ
│   └── index.md     # FAQ homepage
└── um/              # User manual
    ├── can/         # CAN bus
    ├── lin/         # LIN bus
    ├── uds/         # UDS service
    └── var/         # Variable management
```

#### 文件命名规范

- 使用小写字母和连字符
- 文件名应具有描述性
- 避免空格和特殊字符

```text
✅ Correct: can-bus-guide.md
❌ Wrong: CAN Bus Guide.md
```
