# 开发者文档指南

## 概览

这个项目使用 [VitePress](https://vitepress.dev/)作为文件系统，支持中文和英文的双语文件。 文档位于"docs/"目录中，并以 Markdown 格式编写。

## 项目结构

```text
docs/
*. --en/ # English documentation
cody- - about/# 关于pages
tensim - dev/# 开发者文档
cassess/ --faq/# FAQ
centin- - - mum/ # 用户手册
*--zh/ # - zh/ # 中文文档
todlem - about/# 关于pages
cleared - dev/# 开发者文档
tend - --dev/# 用户文档
--media/ # 媒体文件(图像), 视频等
condition. ---about/# 关于页面媒体文件的文件
ximum - - um/ # 用户手动媒体文件
--组件/ # 自定义组件
```

## 开发命令

### 地方发展

```bash
# 启动文档开发服务器
npm 运行文档:dev

# 编译文档
npm 运行文档:building

# 预览内置文档
npm 运行文档:预览
```

### 文档版本

```bash
# 构建生产文档
npm 运行 docs:build。
```

## 写入文档

### 多语言支持

#### 文件通讯录

中文和英文文件应保持相同的结构：

```text
docs/zh/dev/adapter.md ↔️ docs/en/dev/adapter.md
docs/zh/um/can/can.md ↔️ docs/en/um/can/can.md
```

#### 翻译指南

1. 先创建中文版本
2. 翻译成英文本(可以由AI完成)
3. 保持文件结构一致
4. 确保链接和图像路径正确

### 文件组织

#### 推荐的目录结构

```text
docs/zh/
├── about/           # 关于页面
│   ├── contact.md   # 联系方式
│   ├── install.md   # 安装指南
│   └── sponsor.md   # 赞助信息
├── dev/             # 开发者文档
│   ├── adapter.md   # 适配器文档
│   ├── addon.md     # 插件开发
│   └── arch.md      # 架构文档
├── faq/             # 常见问题
│   └── index.md     # 常见问题首页
└── um/              # 用户手册
    ├── can/         # CAN总线
    ├── lin/         # LIN总线
    ├── uds/         # UDS服务
    └── var/         # 变量管理
```

#### 文件命名协议

- 使用小写字母和连线
- 文件名应该是描述性的
- 避免空格和特殊字符

```text
:check_mark_buton: 正确: can bus-guide.md
❌ Wrong: CAN Bus Guide.md
```
