# EcuBus-Pro 开发环境详细设置指南

本指南提供了设置 EcuBus 开发环境的详细说明。在开始之前，请准备以下内容：

1. Node.js - 从官方网站下载最新版本
2. EcuBus 源代码 - 从 GitHub 下载最新版本

准备好这些前置条件后，我们可以开始安装。

## 步骤 1：安装 Node.js

按照以下步骤安装 Node.js：

![1](detail/1.jpg)

点击"下一步"：

![2](detail/2.jpg)

点击"下一步"：

![3](detail/3.jpg)

点击"下一步"：

![4](detail/4.jpg)

点击"下一步"：

![5](detail/5.jpg)

确保勾选上图高亮显示的复选框。这将自动安装 Node.js 所需的 Python 和 VS2019。即使您已经安装了这些程序，我们仍然建议勾选此复选框。

![6](detail/6.jpg)

点击"安装"：

![7](detail/7.jpg)

安装进行中...

![8](detail/8.jpg)

点击"完成"。将出现以下屏幕；按任意键继续：

!9[](detail/9.jpg)

按任意键继续：

![10](detail/10.jpg)

下一个屏幕将检查您的计算机是否已安装 Python 和 VS。如果没有，它将安装它们。首次安装可能需要一些时间：

![11](detail/11.jpg)

由于我的计算机已经安装了 Python 3.13.3 和 VS2019，这些被跳过了：

![12](detail/12.jpg)

Python 3.13.3 和 VS2019 开发环境现已安装。您可以退出此屏幕。

## 步骤 2：安装 NPM 包

我们已经完成了 Node.js 的安装。现在让我们安装 NPM 包。

导航到 EcuBus 项目目录（本例中为 E:\EcuBus\EcuBus_install\EcuBus-Pro-master）：

![13](detail/13.jpg)

运行 `npm install` 命令：

![14](detail/14.jpg)

## 步骤 3：编译原生模块

安装完成后，导航到 src/main/docan 目录：

![15](detail/15.jpg)

运行以下命令进行编译：`npx node-gyp rebuild`

![16](detail/16.jpg)

如图所示，有 104 个错误。这个问题困扰了我很长时间。起初，我认为是环境问题，但**实际上是由于 .h 文件的编码格式**。

![17](detail/17.jpg)

用记事本打开 toomoss 文件夹，我们发现 offline_type.h 编码为 UTF-8：

![18](detail/18.jpg)

将格式更改为 UTF-8 with BOM 并重新编译：

![19](detail/19.jpg)

现在错误减少到 75 个，tsfn.cxx 文件有问题：

![20](detail/20.jpg)

将 tsfn.cxx 文件编码更改为 BOM 格式：

![21](detail/21.jpg)

进行此更改后，再次运行编译命令：

![22](detail/22.jpg)

编译现在成功：

![23](detail/23.jpg)

问题解决了！

## 步骤 4：编译 Dolin 模块

接下来，导航到 dolin 文件夹并运行编译命令：

![24](detail/24.jpg)

我们再次遇到错误，可能是由于文件编码问题：

![25](detail/25.jpg)

首先，我们修改 tsfn.cxx 文件的编码格式：

![26](detail/26.jpg)

编译仍然失败，出现相同的错误。为了识别哪个文件有格式问题，在 VS2019 或 VS2022 中打开项目：

![27](detail/27.jpg)

在 VS2019 中编译时，我们得到以下错误：

![28](detail/28.jpg)

我们发现 usb2lin_ex.h 文件有编码问题。修改后重新编译：

![29](detail/29.jpg)

错误已解决！

## 步骤 5：启动应用程序

返回主目录并运行 `npm run dev`：

![30](detail/30.jpg)

片刻之后，EcuBus 软件界面将出现，表明环境设置已完成。

![31](detail/31.jpg)

## 总结

文件编码格式对编译过程有显著影响。这是我第一次遇到这样的问题，可能是由于跨平台编译对特定文件编码格式的要求。

如果您遇到类似的问题，希望本指南能有所帮助。谢谢！
