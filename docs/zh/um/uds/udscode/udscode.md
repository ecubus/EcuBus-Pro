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
模板使用 Handlebars 语法，双花括号 `{{ }}` 用于表达式，`{{# }}{{/ }}` 用于块助手。 该系统提供访问UDS服务数据、配置属性和一组丰富的助手功能。
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

- <span v-pre>`{{add a b}}`</span> - 加法
- <span v-pre>`{{subtract a b}}`</span> - 减法
- <span v-pre>`{{multiply a b}}`</span> - 乘法
- <span v-pre>`{{divide a b}}`</span> - 除法
- <span v-pre>`{{abs num}}`</span> - 绝对值
- <span v-pre>`{{ceil num}}`</span> - 向上取整
- <span v-pre>`{{floor num}}`</span> - 向下取整
- <span v-pre>`{{modulo a b}}`</span> - 余数
- <span v-pre>`{{avg array}}`</span> - 数组平均值
- <span v-pre>`{{sum array}}`</span> - 数组求和

#### **String Manipulation**

- <span v-pre>`{{camelcase str}}`</span> - 转换为驼峰命名法
- <span v-pre>`{{capitalize str}}`</span> - 首字母大写
- <span v-pre>`{{uppercase str}}`</span> - 转换为大写
- <span v-pre>`{{lowercase str}}`</span> - 转换为小写
- <span v-pre>`{{dashcase str}}`</span> - 转换为短横线命名法
- <span v-pre>`{{snakecase str}}`</span> - 转换为蛇形命名法
- <span v-pre>`{{dotcase str}}`</span> - 转换为点分隔命名法
- <span v-pre>`{{append str suffix}}`</span> - 添加后缀
- <span v-pre>`{{prepend str prefix}}`</span> - 添加前缀
- <span v-pre>`{{trim str}}`</span> - 移除空白字符
- <span v-pre>`{{replace str old new}}`</span> - 替换文本

#### **数组操作**

- <span v-pre>`{{first array n}}`</span> - 获取前 n 项
- <span v-pre>`{{last array n}}`</span> - 获取后 n 项
- <span v-pre>`{{after array n}}`</span> - 获取索引 n 之后的项
- <span v-pre>`{{before array n}}`</span> - 获取索引 n 之前的项
- <span v-pre>`{{join array separator}}`</span> - 连接数组元素
- <span v-pre>`{{arrayify value}}`</span> - 转换为数组
- <span v-pre>`{{#forEach array}}...{{/forEach}}`</span> - 遍历数组
- <span v-pre>`{{#eachIndex array}}...{{/eachIndex}}`</span> - 带索引遍历

#### **比较和逻辑**

- <span v-pre>`{{eq a b}}`</span> - 等于
- <span v-pre>`{{ne a b}}`</span> - 不等于
- <span v-pre>`{{gt a b}}`</span> - 大于
- <span v-pre>`{{lt a b}}`</span> - 小于
- <span v-pre>`{{gte a b}}`</span> - 大于等于
- <span v-pre>`{{lte a b}}`</span> - 小于等于
- <span v-pre>`{{isString val}}`</span> - 检查是否为字符串
- <span v-pre>`{{isNumber val}}`</span> - 检查是否为数字
- <span v-pre>`{{isArray val}}`</span> - 检查是否为数组
- <span v-pre>`{{isDefined val}}`</span> - 检查是否已定义
- <span v-pre>`{{isUndefined val}}`</span> - 检查是否未定义

#### **实用功能**

- <span v-pre>`{{setVar name value}}`</span> - 设置变量
- <span v-pre>`{{jsonParse str}}`</span> - 解析 JSON 字符串
- <span v-pre>`{{jsonStringify obj}}`</span> - 转换为 JSON
- <span v-pre>`{{times n}}...{{/times}}`</span> - 重复 n 次
- <span v-pre>`{{range start end}}...{{/range}}`</span> - 从 start 到 end 循环
- <span v-pre>`{{logFile message}}`</span> - Debug output
- <span v-pre>`{{error message}}`</span> - 抛出错误

### 模板示例

```handlebars
/* 生成的 UDS 代码 */
#include <stdint.h>

{{#forEach services}}
// 服务：{{name}}
{{#if (isDefined description)}}
/* {{description}} */
{{/if}}

#define {{uppercase (snakecase name)}}_ID 0x{{serviceId}}

{{#if specialProperties}}
/* 特殊属性 */
{{#each specialProperties}}
#define {{uppercase (snakecase @key)}} "{{this}}"
{{/each}}
{{/if}}

{{/forEach}}
```

### 更多复杂的示例

请参阅 [uds_generate_code](https://app.whyengineer.com/examples/uds_generate_code/readme) 示例。

<!-- markdownlint-enable MD033 -->