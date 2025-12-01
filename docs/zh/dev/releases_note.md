# EcuBus-Pro 发布说明

## 0.8.57

发布日期：2025年12月1日

这个版本带来了两个重要的新功能——插件系统和OSEK OS追踪，同时对底层架构进行了较大优化。另外，我们将项目许可证正式更改为Apache License 2.0。

### ✨ 重大更新

#### 插件系统正式上线

这是本次更新的最大亮点。插件系统允许你通过安装社区开发的插件来扩展EcuBus的功能，也可以自己开发插件来满足特定需求。插件既可以创建全新的功能标签页，也能在现有页面上添加新按钮和功能。

- 支持自定义标签页和扩展现有功能页面
- 提供插件市场，方便安装和管理插件
- 开发文档齐全，方便二次开发

[查看详情](https://app.whyengineer.com/docs/um/plugin/plugin.html)

#### OSEK OS 追踪功能

新增的OSEK OS追踪功能让你可以实时查看OS运行状态，包括任务调度、中断响应、资源占用等信息，并以时间线和统计图表的形式直观展示。

- 支持通过串口、文件等多种方式接入追踪数据
- 实时显示任务和中断的运行时间线
- 提供CPU负载、任务统计等分析数据
- 可导出CSV格式数据供离线分析

[查看详情](https://app.whyengineer.com/docs/um/osTrace/)

#### 架构优化

对核心工作池进行了重构，提升了整体性能和稳定性。不过需要注意的是，**所有节点脚本需要重新构建才能正常使用**。

### 🚀 功能增强

**硬件支持**

- PEAK、Vector、Kvaser 三大厂商的CAN设备现在都支持周期发送功能了
- 新增对部分周立功(ZLG)设备型号的支持（USBCAN2、USBCAN-2E-U、USBCANFD-400U）

**CAN相关**

- 新增 CAN E2E（端到端保护）示例，演示如何实现校验和和序列计数器
- 改进了CAN TP的ID检查逻辑
- 优化DBC数据库中获取CAN帧长度的处理

**追踪和日志**

- 追踪窗口的时间精度从毫秒提升到微秒，更适合精确测试
- 支持多路追踪，可以同时查看多个数据源
- 日志文件名现在会自动加上时间戳，方便归档查找

**LIN总线**

- 新增LIN自动寻址示例
- 修复了发送ID为0的帧时的问题
- 修复了脚本中LIN/CAN数据未正确缓冲的问题

**图表和界面**

- 大幅优化了消息窗口的性能表现
- 改善了图表组件处理大量数据时的流畅度
- 优化了图表的工具提示和步进控制交互
- 改进了示例项目中的图片展示

### 🐛 问题修复

- 修复了在没有子功能的情况下参数保存失败的问题
- 修复了SA DLL的CMake模板错误
- 修复了脚本中无法获取正确信号值的问题
- 修复了序列状态索引错误导致的问题
- 修复了脚本变量无法正确更新的问题

### 🔧 其他改进

- 项目许可证正式更改为Apache License 2.0，更加开放友好
- 事件总线系统改用成熟的mitt库，提升了稳定性
- UDS服务配置现在允许相同子功能带不同的抑制位
- 内部数据数组增加了UUID标识，方便追踪

### ⚠️ 重要提示

由于底层工作池架构的重构，**升级到v0.8.57后，所有节点脚本必须重新构建**，否则可能无法正常运行。

---

## 0.8.56

从 v0.8.55 到 v0.8.56 的变更：

- [功能]：启动时添加自动构建脚本
- [缺陷]：修复 UDS TesterPresent 无法设置为 0x80
- [缺陷]：修复 CAN DBC 值未定义问题
- [功能]：添加 CAN 统计信息 sentCnt 和 recvCnt
- [功能]：添加高精度定时器

---

## 0.8.55

从 v0.8.54 到 v0.8.55 的变更：

- [功能]：在 https://github.com/ecubus/EcuBus-Pro/pull/197 中添加 archLinux 构建，由 @taotieren 贡献
- [缺陷]：修复 API runUdsSeq 无法正确运行序列的缺陷
- [功能]：基础 SOME/IP 功能就绪，[详情](https://app.whyengineer.com/zh/docs/um/someip/)
- [API]：添加 getSignal API
- [API]：添加 onSignal API

---

## 0.8.54

从 v0.8.53 到 v0.8.54 的变更：

- [更新] 在 https://github.com/ecubus/EcuBus-Pro/pull/194 中为 candle 添加显示版本信息，由 @RCSN 贡献
- [缺陷]：修复脚本构建未复制 \*.node 文件
- [缺陷]：修复日志清除过程，该过程导致某些初始化日志被清除
- [示例]：添加 NSUC1612_LIN_OTA 示例
- [缺陷]：修复 CRC 错误

---

## 0.8.53

从 v0.8.52 到 v0.8.53 的变更：

- [API]：添加 LIN 电源控制 API
- [优化]：优化 trace 性能
- [优化]：优化 trace UDS 实例和方向
- [优化]：移除 UDS 最大缓冲区大小限制
- [优化]：在 https://github.com/ecubus/EcuBus-Pro/pull/191 中为 Candle 设备添加 CAN 错误报告，由 @RCSN 贡献

---

## 0.8.52

从 v0.8.51 到 v0.8.52 的变更：

- [功能]：添加文件记录器
- [缺陷]：修复 Linux 中缺少 esbuild
- [优化]：优化 LIN TP 调度方法
- [优化]：优化 ecb_cli test 子命令

---

## 0.8.51

从 v0.8.50 到 v0.8.51 的变更：

- [缺陷]：修复 DBC Motorola 信号数据解析
- [优化]：优化 LinCable 错误显示
- [优化]：优化 lin_conformance_test 示例
- [优化]：初始化 SAE J2602 测试示例

---

## 0.8.50

从 v0.8.49 到 v0.8.50 的变更：

- [优化]：由 @NiiMER 在 #3c673a4 中为每个文件添加新行
- [功能]：在覆盖模式下添加 trace ID 过滤器和增量时间
- [优化]：优化测试 beforeEach 和 afterEach 以及日志显示
- [优化]：添加中文文档
- [功能]：PWM 输出，由 @frankie-zeng 在 https://github.com/ecubus/EcuBus-Pro/pull/176 中贡献
- [优化]：添加 socket 清除
- [缺陷]：修复 Vector CAN 时间戳不连续
- [功能]：LinCable 添加 PWM 输出能力
- [优化]：允许不访问 Vector 通道
- [缺陷]：修复服务配置页面中的输入问题

---

## 0.8.49

从 v0.8.48 到 v0.8.49 的变更：

- [缺陷]：修复 parseInt 返回负值
- [缺陷]：修复面板视图数据更改流程
- [优化]：允许功能地址返回
- [优化]：优化 LDF 解析
- [缺陷]：修复 LIN LDF 逻辑值显示错误
- [功能]：添加 gs_usb(candle) 支持

---

## 0.8.48

从 v0.8.47 到 v0.8.48 的变更：

- [优化]：优化消息左对齐
- [缺陷]：修复内存泄漏
- [功能]：添加 SecureAccessGenerateKeyEx 和 SecureAccessGenerateKeyExOpt 内置脚本
- [缺陷]：修复 LDF/DBC 解析问题
- [优化]：优化网络中的测试节点
- [优化]：优化 LIN LDF 解析

---

## 0.8.47

从 v0.8.46 到 v0.8.47 的变更：

### 重点内容

**[EcuBus LinCable](https://app.whyengineer.com/docs/um/hardware/lincable.html)** – 用于汽车开发的 USB 转 LIN 适配器 **已发布**！

特性：

- 故障注入和一致性测试
- 高级 LIN 协议支持
- 跨平台和软件集成
- 用于二次开发的开放通信协议
- DFU 固件更新支持

### 其他变更

- [缺陷]：修复 Vector LIN 主节点无法接收，由 @frankie-zeng 在 https://github.com/ecubus/EcuBus-Pro/pull/169 中贡献
- [功能]：运行单个测试用例就绪
- [缺陷]：修复获取供应商失败
- [优化]：优化不同平台供应商
- [优化]：优化 SLCAN 时间戳和 CANFD

---

## 0.8.46

从 v0.8.45 到 v0.8.46 的变更：

- [bug]：修复 fc 多次发送问题
- [feat]：添加 slcan can can-fd @frankie-zeng 在 https://github.com/ecubus/EcuBus/pull/165
- [bug]：修复 dbc 解析信号名包含整数字符串
- [bug]：修复测试日志重叠
- [bug]：通过 isTest 修复 nodeitem 流控制
- [opt]：使 secureAccess 仅在 Windows 中工作 @frankie-zeng 在 https://github.com/ecubus/EcuBus/pull/161
- [opt]：esbuild 可执行二进制文件处理到操作系统 @sengulhamza 在 https://github.com/ecubus/EcuBus/pull/163

---

## 0.8.45

从 v0.8.44 到 v0.8.45 的变更：

- [opt]：优化测试器逻辑和功能地址
- [api]：移除 RegisterEthVirtualEntity api，通过 UI 中的 simulate_by 配置控制
- [bug]：修复 uds 0x85 参数无法删除
- [bug]：修复 dbc 计算不匹配
- [opt]：启用 backgroundThrottling
- [feat]：添加跟踪覆盖模式 [详情](https://app.whyengineer.com/docs/um/trace/trace.html#overwrite-mode)
- [bug]：修复 can dbc SIG_GROUP_ 无法解析问题
- [bug]：修复 uds negativeResponse 问题
- [bug]：修复 can dbc EV_ 无法解析问题

---

## 0.8.44

从 v0.8.43 到 v0.8.44 的变更：

- [bug]：修复 toomoss can 时钟频率问题
- [feat]：添加暗黑主题 [详情](https://app.whyengineer.com/docs/um/setting/general.html#theme)
- [example]：添加面板示例 [详情](https://app.whyengineer.com/examples/panel/readme.html)
- [feat]：添加面板 LED 组件
- [bug]：修复变量触发器
- [feat]：优化 changeServiceApi
- [example]：添加 uds 0x29 示例 [详情](https://app.whyengineer.com/examples/uds_0x29/readme.html)
- [bug]：修复 worker 响应参数不是缓冲区

---

## 0.8.43

从 v0.8.42 到 v0.8.43 的变更：

- [feat]：添加窗口重新排列功能
- [bug]：修复 toomoss lin 无法停止
- [bug]：修复 dbc 解析全局注释错误
- [api]：添加 linStartScheduler/linStopScheduler api

---

## v0.8.42

从 v0.8.41 到 v0.8.42 的变更：

- [feat]：添加 UDS 代码生成能力
- [bug]：修复 doip tcp 客户端修复端口 TIME_WAIT 状态
- [opt]：优化 HIL 测试
- [opt]：优化多窗口

---

## v0.8.41

从 v0.8.40 到 v0.8.41 的变更：

- [feat]：添加解析 S19 文件 api
- [bug]：修复 doip tcp 日志流错误
- [feat]：多窗口正常

---

## v0.8.40

从 v0.8.39 到 v0.8.40 的变更：

- [example]：添加 doip 网关示例
- [bug]：修复 doip 自身实体日志问题
- [bug]：修复 findService 不匹配包含服务 id 问题

---

## v0.8.39

从 v0.8.38 到 v0.8.39 的变更：

- [feat]：添加 doip 客户端 ip 控制 [详情](https://app.whyengineer.com/docs/um/doip/doip.html#tcp-udp-source-port-control)
- [feat]：vector lin 适配器支持。 由 @hmf1235789 在 #153

## **完整变更日志**：https://github.com/ecubus/EcuBus-Pro/compare/v0.8.38...v0.8.39

## v0.8.38

从 v0.8.37 到 v0.8.38 的变更：

- [bug]：修复 uds 服务参数无法保存
- [bug]：修复 tsconfig nodejs 目标版本

---

## v0.8.37

从 v0.8.36 到 v0.8.37 的变更：

- [bug]：修复 LDF 解析带空格 @frankie-zeng 在 https://github.com/ecubus/EcuBus-Pro/pull/145
- [opt]：允许 UDS 服务具有相同子功能，例如：0x31 @frankie-zeng 在 https://github.com/ecubus/EcuBus-Pro/pull/146
- [bug]：ZLG 设备无法关闭 @frankie-zeng 在 https://github.com/ecubus/EcuBus-Pro/pull/144
- [bug]：修复波特率检查和覆盖 @frankie-zeng 在 https://github.com/ecubus/EcuBus-Pro/pull/148
- [feat]：添加 doip 版本选择 @frankie-zeng 在 https://github.com/ecubus/EcuBus-Pro/pull/150
- [bug]：修复 kvaser 多设备
- [feat]：在跟踪中添加 uds 参数解析

## **完整变更日志**：https://github.com/ecubus/EcuBus-Pro/compare/v0.8.36...v0.8.37

## v0.8.36

从 v0.8.35 到 v0.8.36 的变更：

- **[feat]：vector can 完成**
- [feat]：在跟踪中添加设备过滤器
- [bug]：修复 can ia 周期发送数据长度
- [opt]：优化 can 波特率选择
- [feat]：添加 kvaser can 静默模式
- [feat]：添加 kvaser lin 功能

---

## v0.8.35

从 v0.8.34 到 v0.8.35 的变更：

- [功能]: 面板功能
- [功能]:添加 UDS 测试器模拟方式
- [修复]: 修复图表/仪表动态启用
- [修复]:修复 CAN DBC 解析错误

---

## v0.8.34

从 v0.8.33 到 v0.8.34 的变更：

- [修复]:修复 ZLG CAN-FD 设备初始化错误
- [修复]:修复 IPC 获取版本错误，当驱动程序未安装时会失败

---

## v0.8.33

从 v0.8.32 到 v0.8.33 的变更：

- [修复]:修复 ZLG CAN 设备回显
- [功能]:添加 DBC 浮点类型支持

---

## v0.8.32

从 v0.8.31 到 v0.8.32 的变更：

- [修复]:修复 API diagIsPositiveResponse 错误
- [修复]:修复 LIN 诊断从节点响应 ID 错误

---

## v0.8.31

从 v0.8.30 到 v0.8.31 的变更：

- [修复]: 修复频率不是数字类型

---

## v0.8.30

从 v0.8.29 到 v0.8.30 的变更：

- [功能]:添加数据图表功能 [详情](https://app.whyengineer.com/docs/um/graph/graph.html)
- [功能]:添加变量系统功能 [详情](https://app.whyengineer.com/docs/um/var/var.html)
- [功能]:添加一些 ZLG 设备
- [修复]: 修复脚本缓冲区越界
- [修复]:修复同星 CAN 事件丢失
- [功能]:添加同星/ZLG CAN 120Ω 电阻控制

---

## v0.8.29

从 v0.8.28 到 v0.8.29 的变更：

- [功能]:添加 CAN 测试器在线 #102 [详情](https://app.whyengineer.com/docs/um/uds/testerPresent.html)
- [修复]:修复 CANI 中的通道选择 #107

---

## v0.8.28

从 v0.8.27 到 v0.8.28 的变更：

- [修复]:修复 PEAK CAN 波特率错误
- [修复]: 修复布局最大窗口最小容器设置

---

## v0.8.27

从 v0.8.26 到 v0.8.27 的变更：

- [修复]:修复 LDF 注释 #99
- [功能]: 添加包管理

---

## v0.8.26

从 v0.8.25 到 v0.8.26 的变更：

- [功能]:添加构建 \*.node 和 \*.dll 复制
- [修复]:修复 pnpm 未找到
- [优化]: 添加关闭软件时的提示
- [功能]: 添加图表仪表功能
- [功能]:优化 LIN 信号物理值
- [功能]:添加 LIN 编码变更

---

## v0.8.25

从 v0.8.24 到 v0.8.25 的变更：

- [功能]:添加 UI 缩放功能
- [功能]: 重构跟踪完成
- [功能]: 添加脚本结束回调
- [功能]:为 esbuild 添加 node-bindings，但仍需将 .node 复制到 .ScriptBuild
- [修复]:修复同星 LIN 输出电压错误
- [功能]:在跟踪窗口中添加 LIN 校验和类型
- [修复]:修复 LIN ID 错误
- [修复]: 修复保存项目失败
- [修复]:修复 LIN 波特率不是数字
- [修复]:提高 LDF 解析兼容性
- [修复]: 修复关闭项目未清理数据

---

## v0.8.24

从 v0.8.23 到 v0.8.24 的变更：

- [功能]:添加同星 LIN
- [依赖]:更新 axios

---

## v0.8.23

从 v0.8.22 到 v0.8.23 的变更：

- [功能]:UDS 序列与内置脚本
- [功能]:为 UDS 服务添加 FILE 参数
- [修复]:修复 linAddr 中的名称检查

---

## v0.8.22

从 v0.8.21 到 v0.8.22 的变更：

- [功能]:添加 DoIP 直接 TCP 连接 #82

---

## v0.8.21

从 v0.8.20 到 v0.8.21 的变更：

- [修复]:修复 UDP 套接字关闭两次 #80
- [修复]:修复 eth 句柄必需 #81

---

## v0.8.20

从 v0.8.19 到 v0.8.20 的变更：

- [功能]:添加 ZLG ZCAN_USBCANFD_100U 支持
- [修复]: 修复白屏

---

## v0.8.19

从 v0.8.18 到 v0.8.19 的变更：

- [功能]:CLI 测试完成

---

## v0.8.18

从 v0.8.17 到 v0.8.18 的变更：

- [功能]: 测试框架完成
- [功能]: 测试架构基础完成
- [重构]: 重构网络节点逻辑
- [bug]：修复日志序列问题

---

## v0.8.17

从 v0.8.16 到 v0.8.17 的变更：

- [bug]：修复窗口拖拽调整大小错误
- [feat]：添加示例 readme mermaid 支持
- [feat]：添加十六进制解析/写入脚本功能

---

## v0.8.16

从 v0.8.15 到 v0.8.16 的变更：

- [opt]：优化 cani 通道选择

---

## v0.8.15

从 v0.8.14 到 v0.8.15 的变更：

- [feat]：添加 can setSingal
- [feat]：优化 can dbc 解析
- [feat]：添加信号更新
- [feat]：添加解析 dbc 文件

---

## v0.8.14

从 v0.8.13 到 v0.8.14 的变更：

- [opt]：优化 UI 窗口
- [bug]：修复诊断追加，必须具有 transform 属性
- [opt]：优化工具提示时间
- [feat]：从 LIN 数据库生成图形完成
- [feat]：添加 setSignal 脚本 API
- [opt]：优化 LDF 解析兼容性

---

## v0.8.13

从 v0.8.12 到 v0.8.13 的变更：

- [bug]：修复按键事件未关闭
- [feat]：添加 LIN
- [feat]：添加 LIN-TP
- [feat]：添加 UDS over LIN
- [feat]：添加跟踪暂停/播放
- [feat]：添加 LIN IA
- [opt]：添加 LDF 解析空格和错误行显示

---

## v0.8.12

从 v0.8.11 到 v0.8.12 的变更：

- [feat]：添加 LDF 数据库功能

---

## v0.8.11

从 v0.8.10 到 v0.8.11 的变更：

- [feat]：向 CLI 添加 pnpm 功能
- [feat]：添加 ldfParse 代码
- [bug]：修复 can-ia 数据长度!=2 问题

---

## v0.8.10

从 v0.8.9 到 v0.8.10 的变更：

- [bug]：修复枚举导出问题
- [feat]：添加脚本 OnKey 功能
- [feat]：添加 node serialport 库支持

---

## v0.8.9

从 v0.8.8 到 v0.8.9 的变更：

- [bug]：修复 CLI seq 未关闭

---

## v0.8.8

从 v0.8.7 到 v0.8.8 的变更：

- [cli]：初始化首个 CLI 版本，支持 seq 命令
- [feat]：添加 CLI seq 功能
- [opt]：优化 CAN UDS CC 速度
- [bug]：修复 s can 输入问题
- [bug]：修复 eid 无法输入问题

---

## v0.8.7

从 v0.8.6 到 v0.8.7 的变更：

- [example]：添加 doip 和 doip_sim_entity 示例
- [feat]：添加 doip 功能
- [bug]：修复 peak sja1000 支持问题
- [opt]：优化错误格式从十进制到十六进制

---

## v0.8.6

从 v0.8.5 到 v0.8.6 的变更：

- [bug]：修复 sa.node 锁定问题

---

## v0.8.5

从 v0.8.4 到 v0.8.5 的变更：

- [feat]：优化发布说明显示
- [feet]：添加便携式 zip 发布
- [feat]：添加加载 DLL 接口，请参阅 [https://app.whyengineer.com/examples/secure_access_dll/readme.html](https://app.whyengineer.com/examples/secure_access_dll/readme.html)

