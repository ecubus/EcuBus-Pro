import { CstNode, ICstVisitor, IToken } from 'chevrotain'
import { ortiParser } from './parser'
import {
  ORTIFile,
  ORTIVersion,
  ORTIImplementation,
  ORTIosInstance,
  ORTITaskInstance,
  ORTIStackInstance,
  ORTIAlarmInstance,
  ORTIResourceInstance,
  ORTIIsrInstance,
  ORTIConfigInstance,
  ORTIEnum,
  CType,
  ORTITaskType,
  ORTIScheduleType
} from './index'
import {
  ICstNodeVisitor,
  OrtiFileCstChildren,
  VersionSectionCstChildren,
  VersionPropertyCstChildren,
  ImplementationSectionCstChildren,
  ImplementationBlockCstChildren,
  OsBlockCstChildren,
  TaskBlockCstChildren,
  StackBlockCstChildren,
  AlarmBlockCstChildren,
  ResourceBlockCstChildren,
  IsrBlockCstChildren,
  ConfigBlockCstChildren,
  TypeDefinitionCstChildren,
  CtypeDefinitionCstChildren,
  EnumDefinitionCstChildren,
  StringDefinitionCstChildren,
  EnumValueListCstChildren,
  EnumValueCstChildren,
  InformationSectionCstChildren,
  OsInstanceCstChildren,
  TaskInstanceCstChildren,
  StackInstanceCstChildren,
  AlarmInstanceCstChildren,
  ResourceInstanceCstChildren,
  IsrInstanceCstChildren,
  ConfigInstanceCstChildren,
  PropertyAssignmentCstChildren,
  ValueCstChildren,
  StringValueCstChildren,
  NumberValueCstChildren,
  ReferenceValueCstChildren
} from './orti_cst'

// Generate the visitor interface based on parser rules
const BaseCstVisitor = ortiParser.getBaseCstVisitorConstructor()

export class ORTIVisitor extends BaseCstVisitor implements ICstNodeVisitor<any, any> {
  constructor() {
    super()
    this.validateVisitor()
  }

  // ============== Main Entry Point ==============

  ortiFile(children: OrtiFileCstChildren): ORTIFile {
    const result: ORTIFile = {
      version: { koil: '', osSemantics: { type: '', version: '' } },
      implementation: {} as ORTIImplementation,
      osInstance: {} as ORTIosInstance,
      tasks: [],
      stacks: [],
      resources: [],
      alarms: [],
      isrs: [],
      configs: []
    }

    // Process version sections
    if (children.versionSection) {
      children.versionSection.forEach((versionNode) => {
        const version = this.visit(versionNode)
        if (version) {
          result.version = { ...result.version, ...version }
        }
      })
    }

    // Process implementation sections
    if (children.implementationSection) {
      children.implementationSection.forEach((implNode) => {
        const implementation = this.visit(implNode)
        if (implementation) {
          result.implementation = implementation
        }
      })
    }

    // Process information sections (instances)
    if (children.informationSection) {
      children.informationSection.forEach((infoNode) => {
        const info = this.visit(infoNode)
        if (info) {
          switch (info.type) {
            case 'os':
              result.osInstance = info.data
              break
            case 'task':
              result.tasks.push(info.data)
              break
            case 'stack':
              result.stacks.push(info.data)
              break
            case 'alarm':
              result.alarms.push(info.data)
              break
            case 'resource':
              result.resources.push(info.data)
              break
            case 'isr':
              result.isrs.push(info.data)
              break
            case 'config':
              result.configs.push(info.data)
              break
          }
        }
      })
    }

    return result
  }

  // ============== Version Section ==============

  versionSection(children: VersionSectionCstChildren): Partial<ORTIVersion> {
    const result: Partial<ORTIVersion> = {}

    if (children.versionProperty) {
      children.versionProperty.forEach((propNode) => {
        const prop = this.visit(propNode)
        if (prop) {
          Object.assign(result, prop)
        }
      })
    }

    return result
  }

  versionProperty(children: VersionPropertyCstChildren): Partial<ORTIVersion> {
    if (children.KOIL) {
      return {
        koil: this.extractStringValue(children.stringValue![0])
      }
    }

    if (children.OSSEMANTICS) {
      return {
        osSemantics: {
          type: this.extractStringValue(children.semanticsType![0]),
          version: this.extractStringValue(children.semanticsVersion![0])
        }
      }
    }

    return {}
  }

  // ============== Implementation Section ==============

  implementationSection(children: ImplementationSectionCstChildren): ORTIImplementation {
    const name = children.implementationName[0].image

    const implementation: ORTIImplementation = {
      name,
      os: {} as any,
      task: {} as any,
      stack: {} as any,
      alarm: {} as any,
      resource: {} as any,
      isr: {} as any,
      config: {} as any
    }

    if (children.implementationBlock) {
      children.implementationBlock.forEach((blockNode) => {
        const block = this.visit(blockNode)
        if (block) {
          switch (block.type) {
            case 'os':
              implementation.os = block.data
              break
            case 'task':
              implementation.task = block.data
              break
            case 'stack':
              implementation.stack = block.data
              break
            case 'alarm':
              implementation.alarm = block.data
              break
            case 'resource':
              implementation.resource = block.data
              break
            case 'isr':
              implementation.isr = block.data
              break
            case 'config':
              implementation.config = block.data
              break
          }
        }
      })
    }

    return implementation
  }

  implementationBlock(
    children: ImplementationBlockCstChildren
  ): { type: string; data: any } | null {
    if (children.osBlock) {
      return { type: 'os', data: this.visit(children.osBlock[0]) }
    }
    if (children.taskBlock) {
      return { type: 'task', data: this.visit(children.taskBlock[0]) }
    }
    if (children.stackBlock) {
      return { type: 'stack', data: this.visit(children.stackBlock[0]) }
    }
    if (children.alarmBlock) {
      return { type: 'alarm', data: this.visit(children.alarmBlock[0]) }
    }
    if (children.resourceBlock) {
      return { type: 'resource', data: this.visit(children.resourceBlock[0]) }
    }
    if (children.isrBlock) {
      return { type: 'isr', data: this.visit(children.isrBlock[0]) }
    }
    if (children.configBlock) {
      return { type: 'config', data: this.visit(children.configBlock[0]) }
    }
    return null
  }

  osBlock(children: OsBlockCstChildren): any {
    return this.processTypeDefinitionBlock(children)
  }

  taskBlock(children: TaskBlockCstChildren): any {
    return this.processTypeDefinitionBlock(children)
  }

  stackBlock(children: StackBlockCstChildren): any {
    return this.processTypeDefinitionBlock(children)
  }

  alarmBlock(children: AlarmBlockCstChildren): any {
    return this.processTypeDefinitionBlock(children)
  }

  resourceBlock(children: ResourceBlockCstChildren): any {
    return this.processTypeDefinitionBlock(children)
  }

  isrBlock(children: IsrBlockCstChildren): any {
    return this.processTypeDefinitionBlock(children)
  }

  configBlock(children: ConfigBlockCstChildren): any {
    return this.processTypeDefinitionBlock(children)
  }

  // ============== Type Definitions ==============

  private processTypeDefinitionBlock(children: any): any {
    const result: any = {}

    if (children.typeDefinition) {
      children.typeDefinition.forEach((typeDefNode: any) => {
        const typeDef = this.visit(typeDefNode)
        if (typeDef) {
          result[typeDef.name] = typeDef.definition
        }
      })
    }

    return result
  }

  typeDefinition(children: TypeDefinitionCstChildren): { name: string; definition: any } | null {
    if (children.ctypeDefinition) {
      return this.visit(children.ctypeDefinition[0])
    }
    if (children.enumDefinition) {
      return this.visit(children.enumDefinition[0])
    }
    if (children.stringDefinition) {
      return this.visit(children.stringDefinition[0])
    }
    return null
  }

  ctypeDefinition(children: CtypeDefinitionCstChildren): { name: string; definition: CType } {
    const name = children.variableName[0].image
    const type = this.extractStringValue(children.dataType[0])
    const description = this.extractStringValue(children.description[0])
    const isArray = !!children.ArrayNotation

    return {
      name,
      definition: {
        type,
        variableName: name,
        description,
        isArray
      }
    }
  }

  enumDefinition(children: EnumDefinitionCstChildren): { name: string; definition: ORTIEnum } {
    const name = children.variableName[0].image
    const enumType = children.enumType ? this.extractStringValue(children.enumType[0]) : undefined
    const description = this.extractStringValue(children.description[0])
    const isArray = !!children.ArrayNotation
    const totrace = !!children.TOTRACE

    const values: { [key: string]: string | number } = {}
    if (children.enumValueList) {
      const enumValues = this.visit(children.enumValueList[0])
      if (enumValues) {
        Object.assign(values, enumValues)
      }
    }

    return {
      name,
      definition: {
        name: enumType || name,
        type: enumType,
        values,
        variableName: name,
        description,
        isArray,
        totrace
      }
    }
  }

  stringDefinition(children: StringDefinitionCstChildren): { name: string; definition: CType } {
    const name = children.variableName[0].image
    const description = this.extractStringValue(children.description[0])

    return {
      name,
      definition: {
        type: 'string',
        variableName: name,
        description
      }
    }
  }

  enumValueList(children: EnumValueListCstChildren): { [key: string]: string | number } {
    const result: { [key: string]: string | number } = {}

    if (children.enumValue) {
      children.enumValue.forEach((enumValueNode) => {
        const enumValue = this.visit(enumValueNode)
        if (enumValue) {
          result[enumValue.key] = enumValue.value
        }
      })
    }

    return result
  }

  enumValue(children: EnumValueCstChildren): { key: string; value: string | number } | null {
    const key = this.extractStringValue(children.enumKey[0])

    if (children.enumValue) {
      const value = this.extractNumberValue(children.enumValue[0])
      return { key, value }
    }

    if (children.enumReference) {
      const reference = this.extractStringValue(children.enumReference[0])
      return { key, value: reference }
    }

    return null
  }

  // ============== Information Section ==============

  informationSection(children: InformationSectionCstChildren): { type: string; data: any } | null {
    if (children.osInstance) {
      return { type: 'os', data: this.visit(children.osInstance[0]) }
    }
    if (children.taskInstance) {
      return { type: 'task', data: this.visit(children.taskInstance[0]) }
    }
    if (children.stackInstance) {
      return { type: 'stack', data: this.visit(children.stackInstance[0]) }
    }
    if (children.alarmInstance) {
      return { type: 'alarm', data: this.visit(children.alarmInstance[0]) }
    }
    if (children.resourceInstance) {
      return { type: 'resource', data: this.visit(children.resourceInstance[0]) }
    }
    if (children.isrInstance) {
      return { type: 'isr', data: this.visit(children.isrInstance[0]) }
    }
    if (children.configInstance) {
      return { type: 'config', data: this.visit(children.configInstance[0]) }
    }
    return null
  }

  osInstance(children: OsInstanceCstChildren): ORTIosInstance {
    const name = children.instanceName[0].image
    const properties = this.extractProperties(children)

    // Extract core number
    const coreNum = properties.vs_CORE_NUM ? parseInt(properties.vs_CORE_NUM) : 0

    // Extract core configurations
    const coreConfigs: any[] = []
    for (let i = 0; i < coreNum; i++) {
      const config = {
        coreIndex: i,
        coreId: properties[`vs_CORE_ID[${i}]`] || '',
        runningTask: properties[`RUNNINGTASK[${i}]`] || '',
        runningTaskPriority: properties[`RUNNINGTASKPRIORITY[${i}]`] || '',
        runningIsr2: properties[`RUNNINGISR2[${i}]`] || '',
        serviceTrace: properties[`vs_SERVICETRACE[${i}]`] || '',
        lastError: properties[`LASTERROR[${i}]`] || '',
        currentAppMode: properties[`CURRENTAPPMODE[${i}]`] || ''
      }
      coreConfigs.push(config)
    }

    return {
      name,
      coreNum,
      coreConfigs
    }
  }

  taskInstance(children: TaskInstanceCstChildren): ORTITaskInstance {
    const name = children.instanceName[0].image
    const properties = this.extractProperties(children)

    return {
      name,
      priority: properties.PRIORITY || '',
      state: properties.STATE || '',
      stack: properties.STACK || '',
      remainingActivations: properties.REMAININGACTIVATIONS || '',
      homePriority: properties.vs_Home_Priority || '',
      taskType: this.parseTaskType(properties.vs_Task_Type),
      schedule: this.parseScheduleType(properties.vs_Schedule),
      maxActivations: properties.vs_max_Activations || ''
    }
  }

  stackInstance(children: StackInstanceCstChildren): ORTIStackInstance {
    const name = children.instanceName[0].image
    const properties = this.extractProperties(children)

    return {
      name,
      size: properties.SIZE || '',
      stackDirection: properties.STACKDIRECTION || '',
      baseAddress: properties.BASEADDRESS || '',
      fillPattern: properties.FILLPATTERN || ''
    }
  }

  alarmInstance(children: AlarmInstanceCstChildren): ORTIAlarmInstance {
    const name = children.instanceName[0].image
    const properties = this.extractProperties(children)

    return {
      name,
      alarmTime: properties.ALARMTIME || '',
      cycleTime: properties.CYCLETIME || '',
      state: properties.STATE || '',
      action: properties.ACTION || '',
      counter: properties.COUNTER || ''
    }
  }

  resourceInstance(children: ResourceInstanceCstChildren): ORTIResourceInstance {
    const name = children.instanceName[0].image
    const properties = this.extractProperties(children)

    return {
      name,
      state: properties.STATE || '',
      locker: properties.LOCKER || '',
      priority: properties.PRIORITY || ''
    }
  }

  isrInstance(children: IsrInstanceCstChildren): ORTIIsrInstance {
    const name = children.instanceName[0].image
    const properties = this.extractProperties(children)

    return {
      name,
      priority: properties.vs_Priority || '',
      type: properties.vs_Type || '',
      state: properties.vs_State || ''
    }
  }

  configInstance(children: ConfigInstanceCstChildren): ORTIConfigInstance {
    const name = children.instanceName[0].image
    const properties = this.extractProperties(children)

    return {
      name,
      scalabilityClass: properties.vs_ScalabilityClass || '',
      statusLevel: properties.vs_StatusLevel || ''
    }
  }

  // ============== Property Assignment ==============

  propertyAssignment(children: PropertyAssignmentCstChildren): { name: string; value: any } {
    const propertyName = children.propertyName[0].image
    const arrayIndex = children.arrayIndex ? this.extractNumberValue(children.arrayIndex[0]) : null
    const propertyValue = this.visit(children.propertyValue[0])

    const fullName = arrayIndex !== null ? `${propertyName}[${arrayIndex}]` : propertyName

    return {
      name: fullName,
      value: propertyValue
    }
  }

  // ============== Value Extraction ==============

  value(children: ValueCstChildren): any {
    if (children.stringValue) {
      return this.visit(children.stringValue[0])
    }
    if (children.numberValue) {
      return this.visit(children.numberValue[0])
    }
    if (children.referenceValue) {
      return this.visit(children.referenceValue[0])
    }
    return null
  }

  stringValue(children: StringValueCstChildren): string {
    return this.extractStringValue(children)
  }

  numberValue(children: NumberValueCstChildren): number {
    return this.extractNumberValue(children)
  }

  referenceValue(children: ReferenceValueCstChildren): string {
    let result = ''

    if (children.Ampersand) {
      result += '&'
    }

    if (children.Identifier) {
      result += children.Identifier[0].image
    }

    // Handle array access and function calls
    // This is a simplified implementation - you may need to expand this
    // based on the complexity of reference expressions in your ORTI files

    return result
  }

  // ============== Helper Methods ==============

  private extractProperties(children: any): { [key: string]: any } {
    const properties: { [key: string]: any } = {}

    if (children.propertyAssignment) {
      children.propertyAssignment.forEach((propNode: any) => {
        const prop = this.visit(propNode)
        if (prop) {
          properties[prop.name] = prop.value
        }
      })
    }

    return properties
  }

  private extractStringValue(children: any): string {
    if (!children || !children.StringLiteral) return ''
    const str = children.StringLiteral[0].image
    // Remove quotes
    return str.slice(1, -1)
  }

  private extractNumberValue(children: any): number {
    if (!children) return 0

    if (children.HexNumber) {
      return parseInt(children.HexNumber[0].image, 16)
    }

    if (children.DecimalNumber) {
      return parseFloat(children.DecimalNumber[0].image)
    }

    return 0
  }

  private parseTaskType(value: string): ORTITaskType {
    switch (value?.toUpperCase()) {
      case 'BASIC':
        return ORTITaskType.BASIC
      case 'EXTENDED':
        return ORTITaskType.EXTENDED
      default:
        return ORTITaskType.BASIC
    }
  }

  private parseScheduleType(value: string): ORTIScheduleType {
    switch (value?.toUpperCase()) {
      case 'FULL':
        return ORTIScheduleType.FULL
      case 'NON':
        return ORTIScheduleType.NON
      default:
        return ORTIScheduleType.FULL
    }
  }
}

export const ortiVisitor = new ORTIVisitor()
