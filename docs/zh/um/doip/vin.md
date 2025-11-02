# 车辆识别码（VIN）请求行为

我们支持 4 种 VIN 请求方式：

1. 单播 VIN 请求（Unicast VIN Request）
2. 省略 VIN，直接建立 TCP 连接（Omit VIN, TCP connect directly）
3. 广播 VIN 请求（UDP4）
4. 组播 VIN 请求（UDP6）

![示意图](image-5.png)

## 单播 VIN 请求（Unicast VIN Request）

> [!NOTE]
> 此方式仅配置 Request Address。
>

![示意图](image.png)
![示意图](image-1.png)

## 省略 VIN，直接建立 TCP 连接

不发起 UDP 请求，直接连接到 TCP 服务器，参见 [[#82](https://github.com/ecubus/EcuBus-Pro/issues/82)]。

> [!NOTE]
> 此方式仅配置 Request Address。
>

![示意图](image-2.png)

## 广播 VIN 请求（UDP4）

![示意图](image-3.png)
![示意图](image-4.png)

## 组播 VIN 请求（UDP6）

暂不支持。
