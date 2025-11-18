# 详细的EcuBus-Pro 开发环境设置指南

该指南详细说明了建立厄瓜多尔公共汽车发展环境的问题。 在我们开始之前，请作如下准备：

1. Node.js - 从官方网站下载最新版本
2. EcuBus 源代码 - 从 GitHub 下载最新版本

只要具备这些先决条件，我们就可以着手安装。

## 步骤 1：安装 Node.js

按照这些步骤安装 Node.js：

![1](detail/1.jpg)

点击“下一步”：

![2](detail/2.jpg)

点击“下一步”：

![3](detail/3.jpg)

点击“下一步”：

![4](detail/4.jpg)

点击“下一步”：

![5](detail/5.jpg)

请确保勾选上面图像中突出显示的框。 这将自动安装 Node.js 所需的 Python 和 VS2019 。 即使您已经安装了这些程序，我们也建议选中此项。

![6](detail/6.jpg)

Click "Install":

![7](detail/7.jpg)

正在安装...

![8](detail/8.jpg)

点击"完成"。 下面的屏幕将会显示；按任意键继续：

![9](detail/9.jpg)

按任意键继续：

![10](detail/10.jpg)

下一个屏幕将检查您的电脑是否已经安装 Python 和 VS 。 如果没有，它将安装它们。 首次安装可能需要一些时间：

![11](detail/11.jpg)

既然我的电脑已经安装了Python 3.1.3和 VS2019，它们就会被跳过：

![12](detail/12.jpg)

Python 3.1.3和 VS2019 开发环境现在已经安装。 您可以退出此屏幕。

## 步骤 2: 安装 NPM包

我们已经完成Node.js安装。 现在让我们安装 NPM包。

浏览至EcuBus 项目目录 (E:\EcuBus\EcuBus_install\EcuBus-Pro-master 在这个例子中:

![13](detail/13.jpg)

运行 `npm install` 命令：

![14](detail/14.jpg)

## 第 3 步：编译原生模块

安装完成后，导航到 src/main/docan 目录：

![15](detail/15.jpg)

运行以下命令来编译: `npx node-gyp rebuild`

![16](detail/16.jpg)

正如所显示的那样，有104个错误。 这个问题使我长期感到困惑。 最初，我认为这是一个环境问题，但**这实际上是由于.h 文件的编码格式**。

![17](detail/17.jpg)

打开Notepad的 toomoss 文件夹，我们发现离线_type.h 以 UTF-8 编码：

![18](detail/18.jpg)

使用 BOM 将格式改为 UTF-8 并重编：

![19](detail/19.jpg)

现在错误被减至75个，在sfn.cxx文件中出现问题：

![20](detail/20.jpg)

将 tsfn.cxx 文件编码更改为 BOM 格式：

![21](detail/21.jpg)

更改后，再次运行编译命令：

![22](detail/22.jpg)

编纂现在成功：

![23](detail/23.jpg)

问题已解决！

## 第 4 步：编译Dolin 模块

接下来，导航到多林文件夹并运行编译命令：

![24](detail/24.jpg)

我们再次遇到错误，可能是因为文件编码问题：

![25](detail/25.jpg)

首先，我们修改 tsfn.cxx 文件编码格式：

![26](detail/26.jpg)

编译仍然失败，错误相同。 要确定哪个文件有格式问题，请在 VS2019 或 VS2022中打开项目：

![27](detail/27.jpg)

编译VS2019时发生以下错误：

![28](detail/28.jpg)

我们发现\n2lin_ex.h 文件有编码问题。 修改并重新编译后：

![29](detail/29.jpg)

解决错误！

## 步骤5：启动应用程序

返回主目录并运行 `npm 运行 dev`：

![30](detail/30.jpg)

经过几分钟后，EcuadBus 软件接口将会出现，表明环境设置已完成。

![31](detail/31.jpg)

## Summary

文件编码格式严重影响编译过程。 这是我第一次遇到这样一个问题，可能是因为需要对特定文件编码格式进行跨平台编译。

我希望如果你遇到类似的问题，本指南将有所帮助。 谢谢！
