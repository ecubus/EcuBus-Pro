# 车辆识别请求行为

我们支持4种VIN请求方法：

1. 单播VIN请求
2. 省略VIN，直接TCP连接
3. 广播VIN请求（UDP4）
4. 多播VIN请求（UDP6）

![alt text](../../../media/um/doip/image-5.png)

## 单播VIN请求

> [!NOTE]
> 此方法仅设置请求地址。

![alt text](../../../media/um/doip/image.png)
![alt text](../../../media/um/doip/image-1.png)

## 省略VIN，直接TCP连接

无需UDP请求，直接连接到TCP服务器，参见[[#82](https://github.com/ecubus/EcuBus-Pro/issues/82)]

> [!NOTE]
> 此方法仅设置请求地址。

![alt text](../../../media/um/doip/image-2.png)

## 广播VIN请求（UDP4）

![alt text](../../../media/um/doip/image-3.png)
![alt text](../../../media/um/doip/image-4.png)

## 多播VIN请求（UDP6）

暂不支持。
