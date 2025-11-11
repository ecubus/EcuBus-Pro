# Addon

`Node.js`访问dll/so 库需要附加组件，这个文档将向您显示如何写入安装附加组件.

> [!TIP]
> 请确保您已安装了 `node-gyp`

还需要`node-addon-api`

## 测试节点健身器

```bash
cd src/main/docan
npx node-gyp 重建
```

您将看到以下输出：

```bash
健身信息确定
```

## SWIG

`SWIG`是一个软件开发工具，它将以C和C++写成的程序与各种高级编程语言连接起来。
更多关于 `SWIG` [swig](https://github.com/swig/swig)

`所有wap代码都应该由 SWIG` 生成

您可以看到示例代码：

- src/main/docan/pe/swig/supe.i
- src/main/docan/kavser/swig/kvaser.i
