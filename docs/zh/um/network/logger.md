# 日志记录器

通过配置日志记录器，可以把相关的所有Trace数据到其他地方，解决UI界面Trace窗口数据存储有限的问题。


## 如何添加日志记录器

通过`Hardware->Network`点开网络配置界面，在`Loggers`中添加日志记录器。

![looger](./../../../media/um/network/network.png)

## 配置日志记录器

鼠标放到对应的日志记录器上，点击`✏️`按钮，可以编辑日志记录器。

![configLogger](./../../../media/um/network/configLogger.png)
![configLogger1](./../../../media/um/network/configLogger1.png)

* Transport
  * File，数据报文写入到文件中,需要选择对应的文件路径
  * Socket，数据报文写入到Socket中（暂时不支持）
* Format
  * ASC, Vector ASC Format, `ASC格式为流模式写入`
  * CSV, 逗号分隔的文本格式 (暂时不支持)
  * BLF，Vector BLF Format (暂时不支持)
* Record Types, 选择要记录的报文类型

  * CAN, 记录CAN报文
  * LIN, 记录LIN报文
  * ETH, 记录Ethernet报文
  * UDS, 记录PWM报文


## 写入文件的Demo

![looger](./../../../media/um/network/logger.gif)


