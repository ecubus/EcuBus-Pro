# 测试

项目的测试基于`Vitest`框架。 获取有关 `Vitest` 框架的更多信息 [vitest](https://vitest.dev/)。

## 测试代码

所有测试代码都位于`test`目录中。 测试代码写入`TypeScript`，使用`Vitest`框架来运行测试。

## 运行特定测试文件

```bash
npx 有效测试/docan/candle.test.ts
```

## 以图案运行特定测试案例

```bash
npx virtest/docan/candle.test.ts --t "test name"
```

## 运行测试

```bash
npm 运行测试
```

![alt text](../../media/dev/image.png)

失败时停止测试

```bash
npx viest --bail=1
```
