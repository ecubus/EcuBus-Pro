# UDS 代码生成示例

<!-- markdownlint-disable MD033 -->

本示例演示了如何使用 EcuBus-Pro 的 [UDS 代码生成](https://app.whyengineer.com/docs/um/uds/udscode.html) 系统与 Handlebars 模板。`uds.hbs` 模板基于您的 UDS 服务定义生成 DCM（诊断通信管理器）配置的 C 代码。

## 模板文件分析：`uds.hbs`

### 模板结构概览

该模板生成包含两个主要配置数组的 C 代码：

1. `Dcm[]` - 主服务配置数组
2. `DcmRoutineControlConfig[]` - 例程控制特定配置

### 详细代码分析

#### 1. 许可证头部

```handlebars
/**
* Open Source License
* ... (license text)
*/
```

将包含在所有生成文件中的静态许可证头部。

#### 2. 包含语句

```handlebars
#include "Dcm.h"
```

用于 DCM 功能的标准 C 包含。

#### 3. 服务数量计算

```handlebars
{{logFile 'Calculate active service type except JobFunction'~}}
{{setVar 'serviceNum' 0~}}
{{#each tester.allServiceList~}}
{{#if (not (eq @key 'Job'))}}
{{setVar 'serviceNum' (add @root.serviceNum 1)~}}
{{/if~}}
{{/each~}}
#define SUPPORTED_SERVICE_NUM {{@root.serviceNum}}
```

**逐行解释：**

- <span v-pre>`{{logFile 'Calculate active service type except JobFunction'~}}`</span> - 调试输出到日志文件
- <span v-pre>`{{setVar 'serviceNum' 0~}}`</span> - 将计数器变量初始化为 0
- <span v-pre>`{{#each tester.allServiceList~}}`</span> - 遍历测试器中的所有服务
- <span v-pre>`{{#if (not (eq @key 'Job'))}}`</span> - 检查当前服务键是否不是 'Job'
- <span v-pre>`{{setVar 'serviceNum' (add @root.serviceNum 1)~}}`</span> - 为非 Job 服务递增计数器
- <span v-pre>`{{/if~}}`</span> - 结束 if 语句
- <span v-pre>`{{/each~}}`</span> - 结束 each 循环
- <span v-pre>`#define SUPPORTED_SERVICE_NUM {{@root.serviceNum}}`</span> - 生成包含总计数量的 C 宏

#### 4. 主 DCM 配置数组

```handlebars
DcmConfig_t Dcm[]={
{{#each tester.allServiceList}}
```

**解释：**

- `DcmConfig_t Dcm[]={` - 开始 C 数组声明
- <span v-pre>`{{#each tester.allServiceList}}`</span> - 遍历所有 UDS 服务

##### 4.1 会话控制服务 (0x10)

```handlebars
{{#if (eq @key '0x10')}}
    /* Diagnostic Session Control (0x10) */
    {
        DCM_DIAGNOSTIC_SESSION_CONTROL,
        DCM_DEFAULT_SESSION_EN | DCM_PROGRAMMING_SESSION_EN | DCM_EXTENDED_DIAGNOSTIC_SESSION_EN,
        DCM_SECURITY_LEVEL_NULL,
        Dcm_SessionControlCallback,
    },
{{/if}}
```

**解释：**

- <span v-pre>`{{#if (eq @key '0x10')}}`</span> - 检查当前服务 ID 是否等于 0x10（会话控制）
- 生成会话控制服务的 DCM 配置
- 使用按位 OR 启用多个会话类型
- 将安全级别设置为 NULL（无需安全）
- 分配回调函数

##### 4.2 按标识符读取数据服务 (0x22)

```handlebars
{{#if (eq @key '0x22')}}
    /* Read Data by Identifier (0x22) */
    {
        DCM_READ_DATA_BY_IDENTIFIER,
        DCM_DEFAULT_SESSION_EN | DCM_PROGRAMMING_SESSION_EN | DCM_EXTENDED_DIAGNOSTIC_SESSION_EN,
        DCM_SECURITY_LEVEL_NULL,
        Dcm_ReadDataByIdentifierCallback,
    },
{{/if}}
```

**解释：**

- <span v-pre>`{{#if (eq @key '0x22')}}`</span> - 检查服务 ID 0x22（按标识符读取数据）
- 与会话控制类似的结构，但使用不同的回调函数

##### 4.3 例程控制服务 (0x31)

```handlebars
{{#if (eq @key '0x31')}}
    /* RoutineControl (0x31) */
    {
        DCM_ROUNTINE_CONTROL,
        DCM_DEFAULT_SESSION_EN | DCM_PROGRAMMING_SESSION_EN | DCM_EXTENDED_DIAGNOSTIC_SESSION_EN,
        DCM_SECURITY_LEVEL_NULL,
        Dcm_RoutineControlCallback,
    },
{{/if}}
```

**解释：**

- <span v-pre>`{{#if (eq @key '0x31')}}`</span> - 检查服务 ID 0x31（例程控制）
- 使用适当的回调函数配置例程控制服务

#### 5. 例程控制特定配置

```handlebars
DcmRoutineControlConfig_t DcmRoutineControlConfig[]={
{{#each (get tester.allServiceList '0x31')}}
    /* {{name}} */   
    {
        .routineControlType={{get (first (filter params 'routineControlType' property='name')) 'phyValue' }},
        .routineIdentifier=[{{get (first (filter params 'routineIdentifier' property='name')) 'value.data'}}],
        .session={{#if generateConfigs}}{{get generateConfigs 'session'}}{{else}}DCM_DEFAULT_SESSION_EN{{/if}},
        .security={{#if generateConfigs}}{{get generateConfigs 'security'}}{{else}}DCM_SECURITY_LEVEL_NULL{{/if}},
    },
{{/each}}
};
```

**逐行解释：**

- `DcmRoutineControlConfig_t DcmRoutineControlConfig[]={` - 开始例程控制配置数组
- <span v-pre>`{{#each (get tester.allServiceList '0x31')}}`</span> - 遍历所有 0x31（例程控制）服务
- <span v-pre>`/* {{name}} */`</span> - 生成包含服务名称的注释
- `{` - 开始配置结构
- <span v-pre>`.routineControlType={{get (first (filter params 'routineControlType' property='name')) 'phyValue' }},`</span> - 从参数中提取例程控制类型
- <span v-pre>`.routineIdentifier=[{{get (first (filter params 'routineIdentifier' property='name')) 'value.data'}}],`</span> - 提取例程标识符
- <span v-pre>`.session={{#if generateConfigs}}{{get generateConfigs 'session'}}{{else}}DCM_DEFAULT_SESSION_EN{{/if}},`</span> - 设置会话类型（自定义或默认）
- <span v-pre>`.security={{#if generateConfigs}}{{get generateConfigs 'security'}}{{else}}DCM_SECURITY_LEVEL_NULL{{/if}},`</span> - 设置安全级别（自定义或默认）
- `},` - 结束配置结构
- <span v-pre>`{{/each}}`</span> - 结束循环
- `};` - 关闭数组

## 使用的辅助方法

### 数据访问辅助方法

- <span v-pre>`{{get object property}}`</span> - 安全访问对象属性
- <span v-pre>`{{first array}}`</span> - 获取数组的第一个元素
- <span v-pre>`{{filter array value property='name'}}`</span> - 按属性值过滤数组

### 逻辑辅助方法

- <span v-pre>`{{#if condition}}...{{else}}...{{/if}}`</span> - 条件逻辑
- <span v-pre>`{{eq a b}}`</span> - 相等比较
- <span v-pre>`{{not condition}}`</span> - 逻辑非

### 实用工具助手

- <span v-pre>`{{setVar name value}}`</span> - 设置模板变量
- <span v-pre>`{{add a b}}`</span> - 数学加法
- <span v-pre>`{{logFile message}}`</span> - 调试日志记录

### 迭代助手

- <span v-pre>`{{#each array}}...{{/each}}`</span> - 遍历数组元素
- <span v-pre>`{{@key}}`</span> - 迭代中的当前键
- <span v-pre>`{{@root}}`</span> - 访问根上下文

## 使用说明

1. **配置 UDS 服务**：在 EcuBus-Pro 测试器中设置您的 UDS 服务
2. **添加模板**：选择 `uds.hbs` 模板文件
3. **设置生成路径**：指定生成的 C 代码的输出目录
4. **生成代码**：运行代码生成过程
5. **集成**：将生成的文件包含到您的 DCM 实现中

## 生成输出示例

该模板将生成类似于以下的 C 代码：

```c
/**
* 开源许可证
* 
* EcuBus-Pro 基于 Apache License 2.0 的修改版本进行许可，并附加以下条件：
* 
* 1. EcuBus-Pro 可用于商业用途，包括作为诊断工具或企业开发平台。若满足以下条件，必须从生产商处获取商业许可证：
* 
* a. 设备支持和许可：
*     - EcuBus-Pro 源代码包含对一组标准 USB 设备的支持。
*     - 如果您希望添加对专有设备的支持而不开源实现，必须从 EcuBus-Pro 获取商业许可证。
* 
* b. LOGO 和版权信息：在使用 EcuBus-Pro 前端的过程中，您不得移除或修改 EcuBus-Pro 控制台或应用程序中的 LOGO 或版权信息。此限制不适用于不涉及 EcuBus-Pro 前端的用途。
*     - 前端定义：就本许可证而言，EcuBus-Pro 的“前端”包括从原始源代码运行 EcuBus-Pro 时位于 `src/renderer/` 目录中的所有组件，或使用 Electron 运行 EcuBus-Pro 时的“渲染器”组件。
* 
* 2. 作为贡献者，您应同意：
* 
* a. 生产商可根据需要调整开源协议，使其更严格或更宽松。
* b. 您贡献的代码可用于商业目的，包括但不限于其诊断业务运营。
* 
* 
* 除上述特定条件外，所有其他权利和限制均遵循 Apache License 2.0。有关 Apache License 2.0 的详细信息，请访问 http://www.apache.org/licenses/LICENSE-2.0。
* 
* 本产品的交互设计和硬件接口受专利保护。
* EcuBus-Pro 及其徽标是 Whyengineer, Inc. 的注册商标。
* 
* © 2025 Whyengineer, Inc.
* 
* 有关商业许可的咨询，请联系：frankie.zengfu@gmail.com
*/



#include "Dcm.h"


#define SUPPORTED_SERVICE_NUM 9

DcmConfig_t Dcm[]={
    /* Diagnostic Session Control (0x10) */
    {
        DCM_DIAGNOSTIC_SESSION_CONTROL,
        DCM_DEFAULT_SESSION_EN | DCM_PROGRAMMING_SESSION_EN | DCM_EXTENDED_DIAGNOSTIC_SESSION_EN,
        DCM_SECURITY_LEVEL_NULL,
        Dcm_SessionControlCallback,
    },
    /* RoutineControl (0x31) */
    {
        DCM_ROUNTINE_CONTROL,
        DCM_DEFAULT_SESSION_EN | DCM_PROGRAMMING_SESSION_EN | DCM_EXTENDED_DIAGNOSTIC_SESSION_EN,
        DCM_SECURITY_LEVEL_NULL,
        Dcm_RoutineControlCallback,
    },
    
};

DcmRoutineControlConfig_t DcmRoutineControlConfig[]={
    /* RoutineControl490 */   
    {
        .routineControlType=1,
        .routineIdentifier=[2,2],
        .session=DCM_EXTENDED_DIAGNOSTIC_SESSION_EN,
        .security=DCM_SECURITY_LEVEL_1 | DCM_SECURITY_LEVEL_2,
    },
    /* RoutineControl491 */   
    {
        .routineControlType=2,
        .routineIdentifier=[255,0],
        .session=DCM_DEFAULT_SESSION_EN,
        .security=DCM_SECURITY_LEVEL_NULL,
    },
};
```

<!-- markdownlint-enable MD033 -->