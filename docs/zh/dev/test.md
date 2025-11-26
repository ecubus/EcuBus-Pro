# 测试

项目的测试基于 `Vitest` 框架。 获取有关 `Vitest` 框架的更多信息 [vitest](https://vitest.dev/)。

## 测试代码

所有测试代码位于 `test` 目录中。 测试代码使用 `TypeScript` 编写，并使用 `Vitest` 框架运行测试。

## 运行特定测试文件

```bash
npx vitest test/docan/candle.test.ts
```

## 使用模式运行特定测试用例

```bash
npx vitest test/docan/candle.test.ts --t "test name"
```

## 运行测试

```bash
npm run test
```

![alt text](../../media/dev/image.png)

测试失败时停止

```bash
npx vitest --bail=1
```
