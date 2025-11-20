# Test

The test of the project is based on the `Vitest` framework. Get more information about the `Vitest` framework [vitest](https://vitest.dev/).

## Test Code

All test code is located in the `test` directory. The test code is written in `TypeScript` and uses the `Vitest` framework to run the test.

## Run Specific Test File

```bash
npx vitest test/docan/candle.test.ts
```

## Run Specific Test Case with pattern

```bash
npx vitest test/docan/candle.test.ts --t "test name"
```

## Run Test

```bash
npm run test
```

![alt text](../../media/dev/image.png)

Stop test when failed

```bash
npx vitest --bail=1
```
