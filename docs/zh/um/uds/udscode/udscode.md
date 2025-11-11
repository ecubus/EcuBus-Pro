# UDS -> C Code

<!-- markdownlint-disable MD033 -->

用户可以根据他们配置的 UDS 服务生成C 代码。 代码格式取决于用户定义的模板。
![code](./images/uds-code-format.png)

## UDS 代码生成

首先，用户需要启用 UDS 代码生成在 UDS 测试器。

![code1](./images/enable-code-gen.png)

然后用户可以添加模板配置。 每个模板配置包含两个字段：

- **模板路径**：用户可以从本地文件系统中选择一个模板文件。
- **生成路径**：用户可以指定生成代码保存的路径。

支持多个模板配置。 用户可以根据需要添加或删除模板配置，每个模板都支持运行时间预览功能。

## 特殊属性

当启用 UDS 代码生成时，每个服务都支持添加用户定义的“代码生成”特殊属性。
![code2](./images/special-config.png)

属性定义为密钥值格式。

**要求：**

- 不能复制密钥
- 值必须是字符串

## 模板

UDS 代码生成系统基于[**Handlebars.js**](https://handlebarsjs.com) 模板引擎，通过广泛的自定义助手方法来增强，提供强大的代码生成能力。

### 模板系统概述

<span v-pre>
Templates use Handlebars syntax with double curly braces `{{ }}` for expressions and `{{# }}{{/ }}` for block helpers. 该系统提供访问UDS服务数据、配置属性和一组丰富的助手功能。
</span>

### 可用的数据内容

生成代码时，模板可以访问：

- **测试者:[TesterInfo](https://app.whyengineer.com/scriptApi/interfaces/TesterInfo.html)**: 所有已配置的 UDS 服务及其属性
- **project:ProjectInfo**: 项目信息:

```ts
导出接口 ProjectInfo
  名称：字符串
  路径：字符串
}
```

### 自定义帮助方法

#### **数学操作**

- <span v-pre>`{{add a b}}`</span> - Addition
- <span v-pre>`{{subtract a b}}`</span> - Subtraction
- <span v-pre>`{{multiply a b}}`</span> - Multiplication
- <span v-pre>`{{divide a b}}`</span> - Division
- <span v-pre>`{{abs num}}`</span> - Absolute value
- <span v-pre>`{{ceil num}}`</span> - Round up
- <span v-pre>`{{floor num}}`</span> - Round down
- <span v-pre>`{{modulo a b}}`</span> - Remainder
- <span v-pre>`{{avg array}}`</span> - Average of array
- <span v-pre>`{{sum array}}`</span> - Sum of array

#### **String Manipulation**

- <span v-pre>`{{camelcase str}}`</span> - Convert to camelCase
- <span v-pre>`{{capitalize str}}`</span> - Capitalize first letter
- <span v-pre>`{{uppercase str}}`</span> - Convert to UPPERCASE
- <span v-pre>`{{lowercase str}}`</span> - Convert to lowercase
- <span v-pre>`{{dashcase str}}`</span> - Convert to dash-case
- <span v-pre>`{{snakecase str}}`</span> - Convert to snake_case
- <span v-pre>`{{dotcase str}}`</span> - Convert to dot.case
- <span v-pre>`{{append str suffix}}`</span> - Append suffix
- <span v-pre>`{{prepend str prefix}}`</span> - Prepend prefix
- <span v-pre>`{{trim str}}`</span> - Remove whitespace
- <span v-pre>`{{replace str old new}}`</span> - Replace text

#### **数组操作**

- <span v-pre>`{{first array n}}`</span> - Get first n items
- <span v-pre>`{{last array n}}`</span> - Get last n items
- <span v-pre>`{{after array n}}`</span> - Get items after index n
- <span v-pre>`{{before array n}}`</span> - Get items before index n
- <span v-pre>`{{join array separator}}`</span> - Join array elements
- <span v-pre>`{{arrayify value}}`</span> - Convert to array
- <span v-pre>`{{#forEach array}}...{{/forEach}}`</span> - Iterate array
- <span v-pre>`{{#eachIndex array}}...{{/eachIndex}}`</span> - Iterate with index

#### **比较和逻辑**

- <span v-pre>`{{eq a b}}`</span> - Equal to
- <span v-pre>`{{ne a b}}`</span> - Not equal to
- <span v-pre>`{{gt a b}}`</span> - Greater than
- <span v-pre>`{{lt a b}}`</span> - Less than
- <span v-pre>`{{gte a b}}`</span> - Greater than or equal
- <span v-pre>`{{lte a b}}`</span> - Less than or equal
- <span v-pre>`{{isString val}}`</span> - Check if string
- <span v-pre>`{{isNumber val}}`</span> - Check if number
- <span v-pre>`{{isArray val}}`</span> - Check if array
- <span v-pre>`{{isDefined val}}`</span> - Check if defined
- <span v-pre>`{{isUndefined val}}`</span> - Check if undefined

#### **实用功能**

- <span v-pre>`{{setVar name value}}`</span> - Set variable
- <span v-pre>`{{jsonParse str}}`</span> - Parse JSON string
- <span v-pre>`{{jsonStringify obj}}`</span> - Convert to JSON
- <span v-pre>`{{times n}}...{{/times}}`</span> - Repeat n times
- <span v-pre>`{{range start end}}...{{/range}}`</span> - Loop from start to end
- <span v-pre>`{{logFile message}}`</span> - Debug output
- <span v-pre>`{{error message}}`</span> - Throw error

### 模板示例

```handlebars
/* Generated UDS Code */
#include <stdint.h>

{{#forEach services}}
// Service: {{name}}
{{#if (isDefined description)}}
/* {{description}} */
{{/if}}

#define {{uppercase (snakecase name)}}_ID 0x{{serviceId}}

{{#if specialProperties}}
/* Special Properties */
{{#each specialProperties}}
#define {{uppercase (snakecase @key)}} "{{this}}"
{{/each}}
{{/if}}

{{/forEach}}
```

### 更多复杂的示例

请参阅 [uds_generate_code](https://app.whyengineer.com/examples/uds_generate_code/readme) 示例。

<!-- markdownlint-enable MD033 -->