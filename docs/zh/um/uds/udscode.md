# UDS -> C 代码

用户可以基于其已配置的 UDS 服务生成 C 代码。代码格式由用户定义的模板决定。
![code](./code0.png)

## UDS 代码生成

首先，需要在 UDS Tester 中启用 UDS 代码生成功能。

![code1](./code1.png)

然后可以添加模板配置（Template Configurations）。每个模板包含两项：
* **Template Path**：从本地文件系统选择模板文件
* **Generate Path**：指定生成代码的保存路径

支持多个模板配置。可按需添加或移除，每个模板均支持运行时预览。

## 特殊属性（Special Properties）

启用 UDS 代码生成后，每个服务都支持为“代码生成”添加用户自定义的特殊属性。
![code2](./code2.png)

属性以 Key-Value 形式定义。

**要求：**
* Key 不可重复
* Value 必须为字符串


## 模板（Template）

UDS 代码生成系统基于 [**Handlebars.js**](https://handlebarsjs.com) 模板引擎，并增强了大量自定义 helper 方法，以提供强大的代码生成功能。

### 模板系统概览

模板采用 Handlebars 语法，表达式使用 <span v-pre>`{{ }}`</span>，块级 helper 使用 <span v-pre>`{{# }}{{/ }}`</span>。系统可访问 UDS 服务数据、配置属性以及丰富的 helper 函数。

### 可用数据上下文

生成代码时，模板可访问：
- **tester:[TesterInfo](https://app.whyengineer.com/scriptApi/interfaces/TesterInfo.html)**：所有已配置的 UDS 服务及其属性
- **project:ProjectInfo**：项目信息，类型如下：
```ts
export interface ProjectInfo {
  name: string
  path: string
}
```

### 自定义 Helper 方法

#### **数学运算**
- <span v-pre>`{{add a b}}`</span> - 加法
- <span v-pre>`{{subtract a b}}`</span> - 减法
- <span v-pre>`{{multiply a b}}`</span> - 乘法
- <span v-pre>`{{divide a b}}`</span> - 除法
- <span v-pre>`{{abs num}}`</span> - 绝对值
- <span v-pre>`{{ceil num}}`</span> - 向上取整
- <span v-pre>`{{floor num}}`</span> - 向下取整
- <span v-pre>`{{modulo a b}}`</span> - 取余
- <span v-pre>`{{avg array}}`</span> - 平均值
- <span v-pre>`{{sum array}}`</span> - 求和

#### **字符串处理**
- <span v-pre>`{{camelcase str}}`</span> - 转为 camelCase
- <span v-pre>`{{capitalize str}}`</span> - 首字母大写
- <span v-pre>`{{uppercase str}}`</span> - 转为大写
- <span v-pre>`{{lowercase str}}`</span> - 转为小写
- <span v-pre>`{{dashcase str}}`</span> - 转为 dash-case
- <span v-pre>`{{snakecase str}}`</span> - 转为 snake_case
- <span v-pre>`{{dotcase str}}`</span> - 转为 dot.case
- <span v-pre>`{{append str suffix}}`</span> - 追加后缀
- <span v-pre>`{{prepend str prefix}}`</span> - 前置前缀
- <span v-pre>`{{trim str}}`</span> - 移除空白
- <span v-pre>`{{replace str old new}}`</span> - 文本替换

#### **数组操作**
- <span v-pre>`{{first array n}}`</span> - 取前 n 项
- <span v-pre>`{{last array n}}`</span> - 取后 n 项
- <span v-pre>`{{after array n}}`</span> - 取索引 n 之后的项目
- <span v-pre>`{{before array n}}`</span> - 取索引 n 之前的项目
- <span v-pre>`{{join array separator}}`</span> - 连接数组元素
- <span v-pre>`{{arrayify value}}`</span> - 转为数组
- <span v-pre>`{{#forEach array}}...{{/forEach}}`</span> - 遍历数组
- <span v-pre>`{{#eachIndex array}}...{{/eachIndex}}`</span> - 带索引遍历

#### **比较与逻辑**
- <span v-pre>`{{eq a b}}`</span> - 等于
- <span v-pre>`{{ne a b}}`</span> - 不等于
- <span v-pre>`{{gt a b}}`</span> - 大于
- <span v-pre>`{{lt a b}}`</span> - 小于
- <span v-pre>`{{gte a b}}`</span> - 大于等于
- <span v-pre>`{{lte a b}}`</span> - 小于等于
- <span v-pre>`{{isString val}}`</span> - 是否字符串
- <span v-pre>`{{isNumber val}}`</span> - 是否数字
- <span v-pre>`{{isArray val}}`</span> - 是否数组
- <span v-pre>`{{isDefined val}}`</span> - 是否已定义
- <span v-pre>`{{isUndefined val}}`</span> - 是否未定义

#### **实用函数**
- <span v-pre>`{{setVar name value}}`</span> - 设置变量
- <span v-pre>`{{jsonParse str}}`</span> - 解析 JSON 字符串
- <span v-pre>`{{jsonStringify obj}}`</span> - 转为 JSON
- <span v-pre>`{{times n}}...{{/times}}`</span> - 重复 n 次
- <span v-pre>`{{range start end}}...{{/range}}`</span> - 从 start 到 end 循环
- <span v-pre>`{{logFile message}}`</span> - 调试输出
- <span v-pre>`{{error message}}`</span> - 抛出错误

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

### 更复杂的示例

参见示例 [uds_generate_code](https://app.whyengineer.com/examples/uds_generate_code/readme)。
