# 安全访问 DLL 示例

- 接口：`CAN`
- 供应商设备：`Simulate`

## 构建 DLL

您可以使用自己的方法，也可以使用 cmake。 （仅支持 x64 平台）
步骤如下：

1. 打开 VS x64_x86 交叉工具命令提示符终端

2. 执行以下命令：

   ```bash
   cd SeedKey
   mkdir build
   cd build
   cmake .. -A x64
   cmake --build . --config Release
   ```

3. `dll` 文件夹包含预构建的 dll 文件。

## 使用 DLL

项目设置了一个模拟设备，可用于测试 dll。 一个节点项附加了脚本（`node.ts`）

> [!TIP]
> 需要 x64 平台 dll 文件

```typescript
import { SecureAccessDll } from 'ECB'
import path from 'path'

//setup dll
const sa = new SecureAccessDll(path.join(process.env.PROJECT_ROOT, 'dll', 'GenerateKeyEx.dll'))
//call the function
const seed = sa.GenerateKeyEx(
  Buffer.from([1, 2, 3, 4, 5]),
  1,
  Buffer.from([1, 2, 3, 4, 5]),
  Buffer.from([1, 2, 3, 4, 5])
)
console.log(seed)
```

## 步骤

![alt text](image.png)
![alt text](image-1.png)
![alt text](image-2.png)

## 其他

默认的 dll 包装器遵循[指南](https://cdn.vector.com/cms/content/know-how/_application-notes/AN-IDG-1-017_SecurityAccess.pdf)，如果您想使用其他接口，可以自行构建包装器。 有关更多信息，请参阅[源代码](https://github.com/ecubus/EcuBus-Pro/tree/master/src/main/worker/secureAccess)。
