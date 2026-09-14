# 图表

图表信号功能允许您以图形格式可视化信号之间的数据流。 此功能对于理解信号之间的关系以及调试复杂的信号交互特别有用。
![alt text](../../../media/um/graph/image.png)

- **折线**
- **仪表**
- **数据**

## 添加信号

![alt text](../../../media/um/graph/image-1.png)

从数据库添加信号，这取决于[数据库](./../database.md)。

![alt text](../../../media/um/graph/image-2.png)

## 添加变量

![alt text](../../../media/um/graph/image-7.png)

来自[`变量窗口`](./../var/var.md)的所有有效变量。

## 多信号同图显示

在左侧树中添加多个信号或变量，并勾选需要绘制的条目。所有已启用曲线会叠加显示在同一时间轴上，共享 X（时间）轴。每条曲线保留各自颜色，并在图例中显示，便于区分重叠曲线。

通过树中的复选框即可向时间轴添加或移除变量，无需为每个信号单独创建图表窗口。仅启用一个条目时，行为与原先一致（单条曲线并使用该信号的 Y 轴设置）。

![alt text](../../../media/um/graph/image-3.png)
![alt text](../../../media/um/graph/image-5.png)
![alt text](../../../media/um/graph/image-6.png)

## 编辑信号属性

![alt text](../../../media/um/graph/image-4.png)

## 拖拽/缩放折线图

您可以通过拖动鼠标滚轮来放大/缩小图表。
![alt text](../../../media/um/graph/graph.gif)
