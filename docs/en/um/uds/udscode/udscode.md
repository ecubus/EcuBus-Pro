# UDS -> C Code
<!-- markdownlint-disable MD033 -->

Users can generate C code based on their configured UDS services. The code format depends on user-defined templates.
![code](./images/uds-code-format.png)

## UDS Code Generation

First, users need to enable UDS code generation in the UDS Tester.

![code1](./images/enable-code-gen.png)

Then users can add Template Configurations. Each template configuration contains two fields:

* **Template Path**: Users can select a template file from the local file system.
* **Generate Path**: Users can specify the path where the generated code will be saved.

Multiple template configurations are supported. Users can add or remove template configurations as needed, and each template supports runtime preview functionality.

## Special Properties

When enabling UDS code generation, each service supports adding user-defined special properties for `code generation`.
![code2](./images/special-config.png)

Properties are defined in Key-Value format.

**Requirements:**

* Keys cannot be duplicated
* Values must be strings

## Template

The UDS code generation system is based on [**Handlebars.js**](https://handlebarsjs.com) templating engine, enhanced with extensive custom helper methods to provide powerful code generation capabilities.

### Template System Overview

<span v-pre>
Templates use Handlebars syntax with double curly braces `{{ }}` for expressions and `{{# }}{{/ }}` for block helpers. The system provides access to UDS service data, configuration properties, and a rich set of helper functions.
</span>

### Available Data Context

When generating code, templates have access to:

* **tester:[TesterInfo](https://app.whyengineer.com/scriptApi/interfaces/TesterInfo.html)**: All configured UDS services and their properties
* **project:ProjectInfo**: Project information, type is:

```ts
export interface ProjectInfo {
  name: string
  path: string
}
```

### Custom Helper Methods

#### **Mathematical Operations**

* <span v-pre>`{{add a b}}`</span> - Addition
* <span v-pre>`{{subtract a b}}`</span> - Subtraction  
* <span v-pre>`{{multiply a b}}`</span> - Multiplication
* <span v-pre>`{{divide a b}}`</span> - Division
* <span v-pre>`{{abs num}}`</span> - Absolute value
* <span v-pre>`{{ceil num}}`</span> - Round up
* <span v-pre>`{{floor num}}`</span> - Round down
* <span v-pre>`{{modulo a b}}`</span> - Remainder
* <span v-pre>`{{avg array}}`</span> - Average of array
* <span v-pre>`{{sum array}}`</span> - Sum of array

#### **String Manipulation**

* <span v-pre>`{{camelcase str}}`</span> - Convert to camelCase
* <span v-pre>`{{capitalize str}}`</span> - Capitalize first letter
* <span v-pre>`{{uppercase str}}`</span> - Convert to UPPERCASE
* <span v-pre>`{{lowercase str}}`</span> - Convert to lowercase
* <span v-pre>`{{dashcase str}}`</span> - Convert to dash-case
* <span v-pre>`{{snakecase str}}`</span> - Convert to snake_case
* <span v-pre>`{{dotcase str}}`</span> - Convert to dot.case
* <span v-pre>`{{append str suffix}}`</span> - Append suffix
* <span v-pre>`{{prepend str prefix}}`</span> - Prepend prefix
* <span v-pre>`{{trim str}}`</span> - Remove whitespace
* <span v-pre>`{{replace str old new}}`</span> - Replace text

#### **Array Operations**

* <span v-pre>`{{first array n}}`</span> - Get first n items
* <span v-pre>`{{last array n}}`</span> - Get last n items
* <span v-pre>`{{after array n}}`</span> - Get items after index n
* <span v-pre>`{{before array n}}`</span> - Get items before index n
* <span v-pre>`{{join array separator}}`</span> - Join array elements
* <span v-pre>`{{arrayify value}}`</span> - Convert to array
* <span v-pre>`{{#forEach array}}...{{/forEach}}`</span> - Iterate array
* <span v-pre>`{{#eachIndex array}}...{{/eachIndex}}`</span> - Iterate with index

#### **Comparison & Logic**

* <span v-pre>`{{eq a b}}`</span> - Equal to
* <span v-pre>`{{ne a b}}`</span> - Not equal to
* <span v-pre>`{{gt a b}}`</span> - Greater than
* <span v-pre>`{{lt a b}}`</span> - Less than
* <span v-pre>`{{gte a b}}`</span> - Greater than or equal
* <span v-pre>`{{lte a b}}`</span> - Less than or equal
* <span v-pre>`{{isString val}}`</span> - Check if string
* <span v-pre>`{{isNumber val}}`</span> - Check if number
* <span v-pre>`{{isArray val}}`</span> - Check if array
* <span v-pre>`{{isDefined val}}`</span> - Check if defined
* <span v-pre>`{{isUndefined val}}`</span> - Check if undefined

#### **Utility Functions**

* <span v-pre>`{{setVar name value}}`</span> - Set variable
* <span v-pre>`{{jsonParse str}}`</span> - Parse JSON string
* <span v-pre>`{{jsonStringify obj}}`</span> - Convert to JSON
* <span v-pre>`{{times n}}...{{/times}}`</span> - Repeat n times
* <span v-pre>`{{range start end}}...{{/range}}`</span> - Loop from start to end
* <span v-pre>`{{logFile message}}`</span> - Debug output
* <span v-pre>`{{error message}}`</span> - Throw error

### Template Example

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

### More Complex Example

See the [uds_generate_code](https://app.whyengineer.com/examples/uds_generate_code/readme) example.

<!-- markdownlint-enable MD033 -->