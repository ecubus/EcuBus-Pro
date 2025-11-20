# EcuadBus-Pro 版本说明

## 0.8.56

从 v.8.55 到 v0.8.56 变化：

- [feat]：在启动时添加自动生成脚本
- [bug]:fix uds TesterPress 不能设置 0x80
- [bug]:fix can dbc 值未定义问题
- [feat]:add can statistics sentCnt and recvCnt
- [feat]: 添加高精度定时器

---

## 0.8.55

从0.8.54v.8.55变化：

- [feat]由 @taotieren 在 https://github.com/ecubus/EcuBus-Pro/pull/197中添加 archLinux 版本
- [bug]:fix api runUdsSeq 可以运行Correnct序列错误
- [feat]:base someip 功能正确, [Detail](https://app.whyengineer.com/zh/docs/um/someip/)
- [api]:添加 getSignal api
- [api]:add onSignal API

---

## 0.8.54

从v0.8.53变化到v0.8.54：

- [update] 通过@RCSN 在 https://github.com/ecubus/EcuBus-Pro/pull/194 中添加糖果的显示版本信息
- [bug]:fix 脚本构建不复制 \*.node
- [bug]:fixe 日志清除过程，临时清除一些init 日志。
- [demo]:添加 NSUC1612_LIN_OTA demo
- [bug]:fix crc 错误

---

## 0.8.53

从 v.8.52 到 v0.8.53 变化：

- [api]: 添加电流控制api
- [opt]选择跟踪性能。
- [opt]选择痕迹内嵌和目录
- [opt]:删除 uds 最大缓冲区大小限制
- [opt]:add CAN 错误报告在 https://github.com/ecubus/EcuBus-Pro/pull/191 由 @RCSN

---

## 0.8.52

从v0.8.51变成v0.8.52：

- [feat]: 添加文件记录器
- [bug]:fixe esbuild在 linux 中丢失
- [opt]:lin tp sch 方法
- [opt]选择 ecb_cli 测试子命令

---

## 0.8.51

从 v0.8.50 到 v0.8.51变化：

- [bug]:fix dbc 摩托拉信号数据解析
- [opt]：可选行错误显示
- [opt]选项 lin_conformance_test 示例
- [opt]:init sae j2602 测试示例

---

## 0.8.50

从 v0.8.49 变化到 v0.8.50：

- [opt]: 在 #3c673a4 中添加新行到每个文件中 @NiireMER。
- [feat]：在覆盖模式下添加跟踪id过滤器和增益时间
- [opt]在每一次之前和之后选择测试，每次和日志显示
- [opt]:add 中文文档
- [feat]:Pwm output by @frankie-zeng in https://github.com/ecubus/EcuadBus-Pro/pull/176
- [opt]：添加套接字清除
- [bug]:fix 矢量可以断开断开
- [feat]:linCable 添加 PWM 输出能力
- [opt]: allow不访问矢量频道
- [bug]:fix 输入服务配置页

---

## 0.8.49

从v0.8.48改为v0.8.49：

- [bug]:fix parseInt 返回负值
- [bug]:fix 面板视图数据更改流
- [opt]:allowe funcional addresses return
- [opt]:opt ldf parse
- [bug]:fix lin ldf 逻辑值显示错误
- [feat]添加gs_bank(随机) 支持

---

## 0.8.48

从v0.8.47变成v0.8.48：

- [opt]左侧对齐
- [bug]:fix mim leak
- [feat]:添加 SecureAccessGenerateKeyEx 和 SecureAccessGenerateKeyExOpt buildin 脚本
- [bug]:fix ldf/dbc 解析问题
- [opt]网络中的测试节点
- [opt]:opt lin ldf parse

---

## 0.8.47

从v0.8.46变成v0.8.47：

### 高亮

**[EcuBus LinCable](https://app.whyengineer.com/docs/um/hardware/lincable.html)** - USB 到 LIN 汽车发展适配器 **启动** ！

功能：

- 故障注入和配套测试
- 高级LIN协议支持
- 跨平台和软件集成
- 为次要发展开放通信协议
- DFU 固件更新支持

### 其他更改

- [bug]:fix vector link master not receive by @frankie-zeng in https://github.com/ecubus/EcuBus-Pro/pull/169
- [feat]:run 单个测试大小写
- [bug]:fix 抓取供应商失败
- [opt]选择diff 平台供应商
- [opt]选择slcan 时间戳和canfd

---

## 0.8.46

从v0.8.45改为v0.8.46：

- [bug]:fix fc 发送多次问题
- [feat]:add slcan can can fd @frankie-zeng in https://github.com/ecubus/cuberBus/pull/165
- [bug]:fix dbc 解析信号名称有intstr
- [bug]:fix test log 重叠.
- [bug]用测试来修复节点流控制
- [opt]:make secureAccess work in windows only @frankie-zeng in https://github.com/ecubus/EcuBus/pull/161
- [opt]:esbuild可执行文件bin challenging to OS by @sengulhamza in https://github.com/ecubus/ EcuBus/pull/163

---

## 0.8.45

从v0.8.44改为v0.85：

- [opt]选择测试器逻辑&func 地址
- [api]:remove RegisterEthVirtualEnty api, 通过模拟在 UI 中进行控制
- [bug]:fix uds 0x85 param 不能删除
- [bug]:fix dbc calc 不匹配
- [opt]: 启用背景Throutling
- [feat]:添加跟踪覆盖模式 [Detail](https://app.whyengineer.com/docs/um/trace/trace.html#overwrite-mode)
- [bug]:fix can dbc SIG_GROUP_ 无法解析问题
- [bug]:fip 否定响应问题
- [bug]:fix can dbc EV_ 无法解析问题

---

## 0.8.44

从v0.8.43改为v0.8.44：

- [bug]:fix toomoss 可以时钟频率
- [feat]:添加黑色主题 [Detail](https://app.whyengineer.com/docs/um/setting/general.html#theme)
- [example]:添加面板示例 [Detail](https://app.whyengineer.com/examples/panel/readme.html)
- [feat]: 添加带领面板的组件
- [bug]:fix var 触发器
- [feat]选择changeServiceApi
- [example]:添加 0x29 示例 [Detail](https://app.whyengineer.com/examples/uds_0x29/readme.html)
- [bug]:fix worker resp param 不是缓存的

---

## 0.8.43

从v0.8.42改为v0.8.43：

- [feat]: 添加窗口重新排列功能
- [bug]:fix toomoss lin 不能停止
- [bug]:fix dbc 解析全局评论错误
- [api]: 添加 linStartScheduler/linStopScheduler api

---

## v0.8.42

从v0.8.41到 v0.8.42：

- [feat]:add UDS 代码生成能力
- [bug]:fix doip tcp 客户端修复端口 TIME_WAIT 状态
- [opt]选择 HIL 测试
- [opt]选择多窗口

---

## v0.8.41

从v0.8.40改为v0.8.41：

- [feat]:add parse S19 file api
- [bug]:fix doip tcp 日志流错误
- [feat]:multi window

---

## v0.8.40

从 v0.8.39 变化到 v0.8.40：

- [example]:添加 doip 网关示例
- [bug]:fix doip 自己整理日志问题
- [bug]:fix findService 不匹配包含服务ID问题

---

## v0.8.39

从v0.8.38改为v0.8.39：

- [feat]:添加 doip 客户端ip 控制 [Detail](https://app.whyengineer.com/docs/um/doip/doip.html#tcp-udp-source-port-control)
- [feat]:vector lin 适配器支持。 由 @hmf1235789 于 #153

## **Full Changelog**: https://github.com/ecubus/EcuBus-Pro/comparre/v0.8.38...v0.8.39

## v0.8.38

从v0.8.37变成v0.8.38：

- [bug]:fix Options service param 不能保存
- [bug]:fix tsconfig nodejs 目标版本

---

## v0.8.37

从0.8.36v到0.8.37v.8.37：

- [bug]:fix LDF parse with space by @frankie-zeng in https://github.com/ecubus/EcuBus-Pro/pull/145
- [opt]:allowe UDS service with same subfunctions, ex: 0x31 by @frankie-zeng in https://github.com/ecubus/Bus-Pro/pull/146
- [bug]:ZLG 设备无法被 @frankie-zeng 在 https://github.com/ecubus/EcuBus-Pro/pull/144 关闭
- [bug]：修复由 @frankie-zeng 在 https://github.com/ecubus/EcuadBus-Pro/pull/148 中检查和覆盖
- [feat]:add doip version choose by @frankie-zeng in https://github.com/ecubus/EcuBus-Pro/pull/150。
- [bug]:fix kvaser 多设备
- [feat]:添加 uds param 解析在轨迹

## **Full Changelog**: https://github.com/ecubus/EcuBus-Pro/comparre/v0.8.36...v0.8.37

## v.8.36

从v0.8.35改为v0.8.36：

- **[feat]:vector 可以完成**
- [feat]: 添加追踪中的设备过滤器
- [bug]:fix can ia period 发送数据长度
- [opt]可以选择预览率
- [feat]:添加 kvaser 可以静音模式
- [feat]:添加 kvaser lin 功能

---

## v0.8.35

从v0.8.34改为v0.8.35：

- [feat]: pope功能
- [feat]:addd Ops tester 模拟 by
- [bug]:fix graph/goge 动态启用
- [bug]:fix can dbc 解析错误

---

## v0.8.34

从v0.8.33改为v0.8.34：

- [bug]:fix zlg can fd 设备输入错误
- [bug]:fix ipc get version bug, 当驱动程序未安装时将失败

---

## v0.8.33

从v0.8.32改为v0.8.33：

- [bug]:fixe zlg 可以回音设备
- [feat]：添加 dbc 浮动支持类型

---

## v0.8.32

从v0.8.31改为v0.8.32：

- [bug]:fix api diagIsPositiveResponse 错误
- [bug]:fix lin diag 从属重置ID 错误

---

## v0.8.31

从v0.8.30 改为v0.8.31：

- [bug]:fix freq 不是数字类型

---

## v0.8.30

从v0.8.29改为v0.8.30：

- [功能]：添加数据图表完成 [详情](https://app.whyengineer.com/docs/um/graph/graph.html)
- [feat]:添加var system ow [Detail](https://app.whyengineer.com/docs/um/var/var.html)
- [feat]: 添加一些ZLG设备
- [bug]:fix 脚本缓冲出站
- [bug]:fix toomoss 可能会发生故障。
- [feat]:添加toomoss/zlg 可以120个控制

---

## v0.8.29

从v0.8.28改为v0.8.29：

- [feat]:add can tester present #102 [Detail](https://app.whyengineer.com/docs/um/uds/testerPresent.html)
- [bug]:fix 通道选择在 cani #107

---

## v0.8.28

从v0.8.27改为v0.8.28：

- [bug]:fix PEAK 可以预览错误
- [bug]: fix布局最大窗口最小容量设置

---

## v.8.27

从v0.8.26改为v0.8.27：

- [bug]:fix ldf 评论 #99
- [feat]: 添加软件包管理

---

## v0.8.26

从v0.8.25改为v0.8.26：

- [feat]:添加Building \*.node 和 \*.dll 副本
- [bug]:fix pnpm 未找到
- [opt]关闭软件时添加提示
- [feat]: 添加图表仪功能
- [feat]:let lin 信号物理值
- [feat]:添加 link 编码更改

---

## v0.8.25

从v0.8.24改为v0.8.25：

- [feat]:添加 UI 缩放功能
- [feat]:reface 追踪完成
- [feat]：添加脚本结束回调
- [feat]:添加节点绑定到 esbuild, 但仍然需要复制 .node 到 .ScriptBuilding
- [bug]:fix toomoss lin 输出电压错误
- [feat]:添加 link 校验和类型在跟踪窗口
- [bug]:fix lin id 错误
- [bug]:fix 保存项目失败
- [bug]:fix lin Baudrate 不是数字
- [bug]: 增加解析兼容性
- [bug]:fixe 关闭项目无法清理数据

---

## v0.8.24

从v0.8.23变成v0.8.24：

- [feat]:添加toomoss lin
- [dep]:update axios

---

## v0.8.23

从v0.8.22改为v0.8.23：

- [feat]:uds 序列构建脚本中
- [feat]:添加 FILE 参数到 Ops 服务
- [bug]:fix name 检查 linAddr

---

## v0.8.22

从v0.8.21改为v0.8.22：

- [feat]:add doip 直接连接 tcp #82

---

## v0.8.21

从v0.8.20改为v0.8.21：

- [bug]:fix udp 套接字关闭两次#80
- [bug]:fix eth句柄是必需的 #81

---

## v0.8.20

从v0.8.19改为v0.8.20：

- [feat]:添加 ZLG ZCAN_USBCANFD_100U 支持
- [bug]:fix 白色屏幕

---

## v0.8.19

从v0.8.18改为v0.8.19：

- [feat]:cli 测试 确定

---

## v0.8.18

从v0.8.17改为v0.8.18：

- [feat]:test Framework ow
- [feat]:test arch base确定
- [refactor]: 重新计算网络节点逻辑。
- [bug]:fix 日志序列问题

---

## v0.8.17

从v0.8.16改为v0.8.17：

- [bug]:fix window 拖动错误大小
- [feat]:添加示例 readme mermaid 支持
- [feat]：添加十六进制解析/写脚本能力

---

## v0.8.16

从v0.8.15到v0.8.16：

- [opt]选择cani频道

---

## v0.8.15

从v0.8.14改为v0.8.15：

- [feat]:add can setSingal
- [feat]:select can dbc 解析
- [feat]: 添加信号更新
- [feat]:添加prase dbc 文件

---

## v0.8.14

从v0.8.13改为v0.8.14：

- [opt]选择ui 窗口
- [bug]:fix diag Append，必须具有变换属性
- [opt]工具提示时间
- [feat]:grgh 从 link 数据库 ow
- [feat]:添加setSignSystem api
- [opt]选择ldf 解析兼容性

---

## v0.8.13

从v0.8.12改为v0.8.13：

- [bug]:fix key 事件未关闭
- [feat]:添加 lin
- [feat]: 添加行数
- [feat]: 添加浮点数
- [feat]: 添加跟踪暂停/播放
- [feat]:添加 lin ia
- [opt]：添加ldf 解析空间和错误行显示

---

## v.8.12

从v0.8.11改为v0.8.12：

- [feat]:添加 LDF 数据库功能

---

## v0.8.11

从v0.8.10改为v0.8.11：

- [feat]:添加 pnpm 能力到cli
- [feat]:添加 ldfParse 代码
- [bug]:fix can-ia data length!=2 issue

---

## v0.8.10

从v0.8.9改为v0.8.10：

- [bug]:fix enum 导出问题
- [feat]: 添加脚本开钥功能
- [feat]：添加节点串行lib 支持

---

## v0.8.9

从v0.8.8改为v0.8.9：

- [bug]:fix cli seq 不关闭

---

## v0.8.8

从v0.8.7改为v0.8.8：

- [cli]:init first cli version, support seq 命令
- [feat]:添加 cli seq 能力
- [opt]:let can uds cc 速度
- [bug]:fix 可以输入问题
- [bug]:fix eid 不能输入问题

---

## v0.8.7

从v0.8.6改为v0.8.7：

- [example]: 添加 doip 和 doip_sim_entity 示例
- [feat]:添加 doip 功能
- [bug]:fix 峰sja1000 支持问题
- [opt]对十六进制格式错误

---

## v0.8.6

从v0.8.5到v0.8.6的变化：

- [bug]:fix sa.node 锁定问题

---

## v0.8.5

从v0.8.4改为v0.8.5：

- [feat]：选择发布笔记显示
- [feet]: 添加便携式zip发布
- [feat]: 添加dll 接口，查看 [https://app.whyengineer.com/examples/secure_access_dll/readme.html](https://app.whyengineer.com/examples/secure_access_dll/readme.html)

