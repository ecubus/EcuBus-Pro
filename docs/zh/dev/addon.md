# 插件

`Node.js` 访问 dll/so 库需要插件，本文档将向您展示如何编写和设置插件。

> [!TIP]
> 确保您已安装 `node-gyp`

还需要 `node-addon-api`

## 测试 Node-gyp

```bash
cd src/main/docan
npx node-gyp rebuild
```

您将看到以下输出：

```bash
gyp info ok
```

## SWIG

`SWIG` 是一个软件开发工具，可将用 C 和 C++ 编写的程序与各种高级编程语言连接起来。
有关 `SWIG` 的更多信息 [swig](https://github.com/swig/swig)

`所有包装代码都应由 SWIG 生成`

您可以查看示例代码：

- src/main/docan/peak/swig/peak.i
- src/main/docan/kavser/swig/kvaser.i
