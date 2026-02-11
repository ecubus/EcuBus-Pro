# EcuBus-Pro 中的 AI 辅助脚本编写

EcuBus-Pro 将 AI 辅助功能直接集成到其基于 TypeScript 的脚本环境中。 通过结合强类型、结构化 API 以及针对 ECB 脚本 API 的领域特定代理技能，AI 助手能够以高准确度理解、生成和优化脚本。

由于脚本层构建在 TypeScript 之上，AI 可以可靠地解释类型、接口和函数签名。 这使得精确的代码生成和上下文感知建议成为可能。 不熟悉 TypeScript 的嵌入式汽车工程师可以通过用自然语言描述预期行为快速上手，而无需先学习语言语法。

## 概述

AI 助手支持：

- 自然语言到代码生成
- 上下文感知的 API 建议
- 脚本解释与注释
- 重构与优化
- 测试脚本脚手架

该助手通过提供 ECB 脚本 API 结构化知识的代理技能得到增强，这些知识包括总线操作、诊断和常见验证模式。 这确保了生成的代码与实际平台能力保持一致。

![AI_ARCH](./../../../media/um/script/ai-arch.jpg)

## 自然语言到脚本

工程师可以直接描述功能：

> “每 100 毫秒发送 CAN ID 0x123 并记录响应。”

AI 使用 ECB API 生成有效的 TypeScript 脚本：

<video controls width="640" height="480" src="./../../../media/um/script/ai1.mp4" poster="./../../../media/um/script/ai-arch.jpg">
  您的浏览器不支持 video 标签。
</video>

## 总结

EcuBus-Pro 中的 AI 辅助脚本编写将脚本开发转变为交互式工作流。 借助 TypeScript 的结构和领域感知的代理技能，该助手可提供准确、符合 API 规范的代码生成与指导。

汽车嵌入式工程师可以专注于通信逻辑和验证目标，而 AI 则处理语法、结构和 API 细节——从而实现快速上手并提高生产力。
