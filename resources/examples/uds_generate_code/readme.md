# UDS Generate Code Example
<!-- markdownlint-disable MD033 -->
This example demonstrates how to use EcuBus-Pro's [UDS code generation](https://app.whyengineer.com/docs/um/uds/udscode.html) system with Handlebars templates.The `uds.hbs` template generates C code for DCM (Diagnostic Communication Manager) configuration based on your UDS service definitions.

## Template File Analysis: `uds.hbs`

### Template Structure Overview

The template generates C code with two main configuration arrays:

1. `Dcm[]` - Main service configuration array
2. `DcmRoutineControlConfig[]` - Routine control specific configuration

### Detailed Code Analysis

#### 1. License Header

```handlebars
/**
* Open Source License
* ... (license text)
*/
```

Static license header that will be included in all generated files.

#### 2. Include Statement

```handlebars
#include "Dcm.h"
```

Standard C include for DCM functionality.

#### 3. Service Count Calculation

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

**Line-by-line explanation:**

- <span v-pre>`{{logFile 'Calculate active service type except JobFunction'~}}`</span> - Debug output to log file
- <span v-pre>`{{setVar 'serviceNum' 0~}}`</span> - Initialize counter variable to 0
- <span v-pre>`{{#each tester.allServiceList~}}`</span> - Iterate through all services in the tester
- <span v-pre>`{{#if (not (eq @key 'Job'))}}`</span> - Check if current service key is NOT 'Job'
- <span v-pre>`{{setVar 'serviceNum' (add @root.serviceNum 1)~}}`</span> - Increment counter for non-Job services
- <span v-pre>`{{/if~}}`</span> - End if statement
- <span v-pre>`{{/each~}}`</span> - End each loop
- <span v-pre>`#define SUPPORTED_SERVICE_NUM {{@root.serviceNum}}`</span> - Generate C macro with total count

#### 4. Main DCM Configuration Array

```handlebars
DcmConfig_t Dcm[]={
{{#each tester.allServiceList}}
```

**Explanation:**

- `DcmConfig_t Dcm[]={` - Start C array declaration
- <span v-pre>`{{#each tester.allServiceList}}`</span> - Loop through all UDS services

##### 4.1 Session Control Service (0x10)

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

**Explanation:**

- <span v-pre>`{{#if (eq @key '0x10')}}`</span> - Check if current service ID equals 0x10 (Session Control)
- Generates DCM configuration for Session Control service
- Enables multiple session types using bitwise OR
- Sets security level to NULL (no security required)
- Assigns callback function

##### 4.2 Read Data by Identifier Service (0x22)

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

**Explanation:**

- <span v-pre>`{{#if (eq @key '0x22')}}`</span> - Check for service ID 0x22 (Read Data by Identifier)
- Similar structure to Session Control but with different callback function

##### 4.3 Routine Control Service (0x31)

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

**Explanation:**

- <span v-pre>`{{#if (eq @key '0x31')}}`</span> - Check for service ID 0x31 (Routine Control)
- Configures Routine Control service with appropriate callback

#### 5. Routine Control Specific Configuration

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

**Line-by-line explanation:**

- `DcmRoutineControlConfig_t DcmRoutineControlConfig[]={` - Start routine control config array
- <span v-pre>`{{#each (get tester.allServiceList '0x31')}}`</span> - Loop through all 0x31 (Routine Control) services
- <span v-pre>`/* {{name}} */`</span> - Generate comment with service name
- `{` - Start configuration structure
- <span v-pre>`.routineControlType={{get (first (filter params 'routineControlType' property='name')) 'phyValue' }},`</span> - Extract routine control type from parameters
- <span v-pre>`.routineIdentifier=[{{get (first (filter params 'routineIdentifier' property='name')) 'value.data'}}],`</span> - Extract routine identifier
- <span v-pre>`.session={{#if generateConfigs}}{{get generateConfigs 'session'}}{{else}}DCM_DEFAULT_SESSION_EN{{/if}},`</span> - Set session type (custom or default)
- <span v-pre>`.security={{#if generateConfigs}}{{get generateConfigs 'security'}}{{else}}DCM_SECURITY_LEVEL_NULL{{/if}},`</span> - Set security level (custom or default)
- `},` - End configuration structure
- <span v-pre>`{{/each}}`</span> - End loop
- `};` - Close array

## Helper Methods Used

### Data Access Helpers

- <span v-pre>`{{get object property}}`</span> - Access object property safely
- <span v-pre>`{{first array}}`</span> - Get first element of array
- <span v-pre>`{{filter array value property='name'}}`</span> - Filter array by property value

### Logic Helpers

- <span v-pre>`{{#if condition}}...{{else}}...{{/if}}`</span> - Conditional logic
- <span v-pre>`{{eq a b}}`</span> - Equality comparison
- <span v-pre>`{{not condition}}`</span> - Logical NOT

### Utility Helpers

- <span v-pre>`{{setVar name value}}`</span> - Set template variable
- <span v-pre>`{{add a b}}`</span> - Mathematical addition
- <span v-pre>`{{logFile message}}`</span> - Debug logging

### Iteration Helpers

- <span v-pre>`{{#each array}}...{{/each}}`</span> - Loop through array elements
- <span v-pre>`{{@key}}`</span> - Current key in iteration
- <span v-pre>`{{@root}}`</span> - Access root context

## Usage Instructions

1. **Configure UDS Services**: Set up your UDS services in EcuBus-Pro tester
2. **Add Template**: Select the `uds.hbs` template file
3. **Set Generation Path**: Specify output directory for generated C code
4. **Generate Code**: Run the code generation process
5. **Integration**: Include generated files in your DCM implementation

## Generated Output Example

The template will generate C code similar to:

```c
/**
* Open Source License
* 
* EcuBus-Pro is licensed under a modified version of the Apache License 2.0, with the following additional conditions:
* 
* 1. EcuBus-Pro may be utilized commercially, including as a diagnostic tool or as a development platform for enterprises. Should the conditions below be met, a commercial license must be obtained from the producer:
* 
* a. Device support and licensing: 
*     - The EcuBus-Pro source code includes support for a set of standard usb devices.
*     - If you want to add support for your proprietary devices without open-sourcing the implementation, you must obtain a commercial license from EcuBus-Pro.
* 
* b. LOGO and copyright information: In the process of using EcuBus-Pro's frontend, you may not remove or modify the LOGO or copyright information in the EcuBus-Pro console or applications. This restriction is inapplicable to uses of EcuBus-Pro that do not involve its frontend.
*     - Frontend Definition: For the purposes of this license, the "frontend" of EcuBus-Pro includes all components located in the `src/renderer/` directory when running EcuBus-Pro from the raw source code, or the "renderer" components when running EcuBus-Pro with Electron.
* 
* 2. As a contributor, you should agree that:
* 
* a. The producer can adjust the open-source agreement to be more strict or relaxed as deemed necessary.
* b. Your contributed code may be used for commercial purposes, including but not limited to its diagnostic business operations.
* 
* 
* Apart from the specific conditions mentioned above, all other rights and restrictions follow the Apache License 2.0. Detailed information about the Apache License 2.0 can be found at http://www.apache.org/licenses/LICENSE-2.0.
* 
* The interactive design and hardware interface of this product are protected by patents.
* EcuBus-Pro and its logo are registered trademarks of Whyengineer, Inc.
* 
* © 2025 Whyengineer, Inc.
* 
* For commercial licensing inquiries, please contact: frankie.zengfu@gmail.com
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