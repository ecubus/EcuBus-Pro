# vSomeIP JavaScript Callback Management System

这个系统提供了一个完整的 JavaScript 回调管理解决方案，用于 vSomeIP 应用程序。它允许你在 JavaScript 中注册回调函数，当 vSomeIP 事件发生时，这些回调会被自动调用。

## 特性

- **线程安全**: 使用 Node.js 的 ThreadSafeFunction 确保跨线程调用的安全性
- **类型安全**: 完整的 TypeScript 类型定义
- **内存管理**: 自动管理回调的生命周期，防止内存泄漏
- **灵活的回调注册**: 支持多种类型的 vSomeIP 回调
- **动态管理**: 可以动态注册和注销回调

## 支持的回调类型

1. **State Handler**: 应用程序状态变化回调
2. **Message Handler**: 消息接收回调
3. **Availability Handler**: 服务可用性变化回调
4. **Subscription Handler**: 订阅状态变化回调
5. **Subscription Status Handler**: 订阅请求处理状态回调
6. **Watchdog Handler**: 周期性监控回调

## 安装和构建

### 前提条件

- Node.js (推荐 16.x 或更高版本)
- C++ 编译器 (支持 C++11 或更高版本)
- vSomeIP 库

### 构建步骤

1. 确保已安装 vSomeIP 库
2. 编译 C++ 扩展：

```bash
cd src/main/vsomeip
npm run build
```

## 基本用法

### 1. 创建回调管理器

```typescript
import { VsomeipCallbackManager } from './vsomeip';

// 创建 vSomeIP 应用程序实例
const vsomeipApp = createVsomeipApp(); // 你的 vSomeIP 应用实例

// 创建回调管理器
const callbackManager = new VsomeipCallbackManager(vsomeipApp);

// 检查应用程序是否设置成功
if (!callbackManager.hasApplication()) {
  console.warn('vSomeIP 应用程序未设置，回调可能无法正常工作');
}
```

### 2. 注册回调

```typescript
// 注册状态处理器
const stateCallbackId = callbackManager.registerStateHandler((state) => {
  console.log('应用程序状态变化:', state);
});

// 注册消息处理器
const messageCallbackId = callbackManager.registerMessageHandler(
  0x1234, // 服务 ID
  0x5678, // 实例 ID
  0x9ABC, // 方法 ID
  (message) => {
    console.log('收到消息:', message);
    console.log('负载:', message.payload);
  }
);

// 注册可用性处理器
const availabilityCallbackId = callbackManager.registerAvailabilityHandler(
  0x1234, // 服务 ID
  0x5678, // 实例 ID
  (info) => {
    console.log('服务可用性变化:', info);
  }
);
```

### 3. 设置看门狗

```typescript
// 设置周期性监控回调
const watchdogCallbackId = callbackManager.setWatchdogHandler(() => {
  console.log('应用程序运行正常');
}, 10); // 每 10 秒调用一次
```

### 4. 清理回调

```typescript
// 注销特定回调
callbackManager.unregisterCallback(stateCallbackId);

// 注销所有回调
callbackManager.unregisterAllCallbacks();
```

## 高级用法

### 通配符消息处理器

```typescript
// 注册通配符处理器，接收所有消息
const wildcardCallbackId = callbackManager.registerMessageHandler(
  0xFFFF, // ANY_SERVICE
  0xFFFF, // ANY_INSTANCE
  0xFFFF, // ANY_METHOD
  (message) => {
    console.log('收到任意消息:', message);
  }
);
```

### 动态回调管理

```typescript
// 动态注册临时回调
const tempCallbackId = callbackManager.registerMessageHandler(
  0xAAAA, 0xBBBB, 0xCCCC,
  (message) => {
    console.log('临时回调触发');
  }
);

// 5 秒后注销
setTimeout(() => {
  callbackManager.unregisterCallback(tempCallbackId);
}, 5000);
```

### 多服务处理器

```typescript
const services = [
  { service: 0x1000, instance: 0x2000, method: 0x3000, name: '服务 A' },
  { service: 0x4000, instance: 0x5000, method: 0x6000, name: '服务 B' },
  { service: 0x7000, instance: 0x8000, method: 0x9000, name: '服务 C' }
];

services.forEach(({ service, instance, method, name }) => {
  callbackManager.registerMessageHandler(service, instance, method, (message) => {
    console.log(`来自 ${name} 的消息:`, message);
  });
});
```

## API 参考

### VsomeipCallbackManager

#### 构造函数
```typescript
constructor(app: any)
```

#### 方法

##### registerStateHandler
```typescript
registerStateHandler(callback: VsomeipStateHandler): string
```
注册状态变化回调。

##### registerMessageHandler
```typescript
registerMessageHandler(service: number, instance: number, method: number, callback: VsomeipMessageHandler): string
```
注册消息接收回调。

##### registerAvailabilityHandler
```typescript
registerAvailabilityHandler(service: number, instance: number, callback: VsomeipAvailabilityHandler): string
```
注册服务可用性变化回调。

##### registerSubscriptionHandler
```typescript
registerSubscriptionHandler(service: number, instance: number, eventgroup: number, callback: VsomeipSubscriptionHandler): string
```
注册订阅状态变化回调。

##### registerSubscriptionStatusHandler
```typescript
registerSubscriptionStatusHandler(service: number, instance: number, eventgroup: number, event: number, callback: VsomeipSubscriptionStatusHandler): string
```
注册订阅状态处理回调。

##### setWatchdogHandler
```typescript
setWatchdogHandler(callback: VsomeipWatchdogHandler, intervalSeconds: number): string
```
设置周期性监控回调。

##### unregisterCallback
```typescript
unregisterCallback(callbackId: string): void
```
注销指定回调。

##### unregisterAllCallbacks
```typescript
unregisterAllCallbacks(): void
```
注销所有回调。

##### getCallbackCount
```typescript
getCallbackCount(): number
```
获取当前注册的回调数量。

##### hasCallback
```typescript
hasCallback(callbackId: string): boolean
```
检查指定回调是否已注册。

##### hasApplication
```typescript
hasApplication(): boolean
```
检查 vSomeIP 应用程序是否已设置。

### 类型定义

#### VsomeipMessage
```typescript
interface VsomeipMessage {
  service: number;
  instance: number;
  method: number;
  client: number;
  session: number;
  payload?: Buffer;
}
```

#### VsomeipAvailabilityInfo
```typescript
interface VsomeipAvailabilityInfo {
  service: number;
  instance: number;
  available: boolean;
}
```

#### VsomeipSubscriptionInfo
```typescript
interface VsomeipSubscriptionInfo {
  client: number;
  uid: number;
  gid: number;
  subscribed: boolean;
}
```

#### VsomeipSubscriptionStatusInfo
```typescript
interface VsomeipSubscriptionStatusInfo {
  eventgroup: number;
  event: number;
  status: number;
}
```

## 错误处理

系统会自动处理以下错误情况：

- 无效的回调 ID
- 重复的回调注册
- 内存分配失败
- 线程安全问题

## 性能考虑

- 使用 ThreadSafeFunction 确保线程安全，但会有轻微的性能开销
- 回调队列是无限制的，确保不会丢失事件
- 建议在不需要时及时注销回调以释放资源

## 调试

启用调试日志：

```typescript
// 设置环境变量
process.env.DEBUG = 'vsomeip:callbacks';

// 或者在代码中
console.log('回调统计:', callbackManager.getStats());
```

## 示例

查看 `example.ts` 文件获取完整的使用示例。

## 许可证

本项目遵循与主项目相同的许可证。 