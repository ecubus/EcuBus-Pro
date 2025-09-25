import type { CstNode, ICstVisitor, IToken } from 'chevrotain'

export interface OrtiFileCstNode extends CstNode {
  name: 'ortiFile'
  children: OrtiFileCstChildren
}

export type OrtiFileCstChildren = {
  versionSection?: VersionSectionCstNode[]
  implementationSection?: ImplementationSectionCstNode[]
  informationSection?: InformationSectionCstNode[]
}

export interface VersionSectionCstNode extends CstNode {
  name: 'versionSection'
  children: VersionSectionCstChildren
}

export type VersionSectionCstChildren = {
  VERSION: IToken[]
  LeftBrace: IToken[]
  versionProperty?: VersionPropertyCstNode[]
  RightBrace: IToken[]
  Semicolon: IToken[]
}

export interface VersionPropertyCstNode extends CstNode {
  name: 'versionProperty'
  children: VersionPropertyCstChildren
}

export type VersionPropertyCstChildren = {
  KOIL?: IToken[]
  Equals?: IToken[]
  stringValue?: StringValueCstNode[]
  Semicolon?: IToken[]
  OSSEMANTICS?: IToken[]
  semanticsType?: StringValueCstNode[]
  Comma?: IToken[]
  semanticsVersion?: StringValueCstNode[]
}

export interface ImplementationSectionCstNode extends CstNode {
  name: 'implementationSection'
  children: ImplementationSectionCstChildren
}

export type ImplementationSectionCstChildren = {
  IMPLEMENTATION: IToken[]
  implementationName: IToken[]
  LeftBrace: IToken[]
  implementationBlock?: ImplementationBlockCstNode[]
  RightBrace: IToken[]
  Semicolon: IToken[]
}

export interface ImplementationBlockCstNode extends CstNode {
  name: 'implementationBlock'
  children: ImplementationBlockCstChildren
}

export type ImplementationBlockCstChildren = {
  genericBlock: GenericBlockCstNode[]
}

export interface GenericBlockCstNode extends CstNode {
  name: 'genericBlock'
  children: GenericBlockCstChildren
}

export type GenericBlockCstChildren = {
  blockType: IToken[]
  LeftBrace: IToken[]
  typeDefinition?: TypeDefinitionCstNode[]
  RightBrace: IToken[]
  Comma: IToken[]
  description: StringValueCstNode[]
  Semicolon: IToken[]
}

export interface TypeDefinitionCstNode extends CstNode {
  name: 'typeDefinition'
  children: TypeDefinitionCstChildren
}

export type TypeDefinitionCstChildren = {
  ctypeDefinition?: CtypeDefinitionCstNode[]
  enumDefinition?: EnumDefinitionCstNode[]
  stringDefinition?: StringDefinitionCstNode[]
}

export interface CtypeDefinitionCstNode extends CstNode {
  name: 'ctypeDefinition'
  children: CtypeDefinitionCstChildren
}

export type CtypeDefinitionCstChildren = {
  CTYPE: IToken[]
  dataType?: StringValueCstNode[]
  variableName?: IToken[]
  ArrayNotation?: IToken[]
  Comma?: IToken[]
  description?: StringValueCstNode[]
  Semicolon: IToken[]
}

export interface EnumDefinitionCstNode extends CstNode {
  name: 'enumDefinition'
  children: EnumDefinitionCstChildren
}

export type EnumDefinitionCstChildren = {
  TOTRACE?: IToken[]
  ENUM: IToken[]
  enumType?: StringValueCstNode[]
  LeftBracket: IToken[]
  enumValueList: EnumValueListCstNode[]
  RightBracket: IToken[]
  variableName?: IToken[]
  ArrayNotation?: IToken[]
  Comma: IToken[]
  description: StringValueCstNode[]
  Semicolon: IToken[]
}

export interface StringDefinitionCstNode extends CstNode {
  name: 'stringDefinition'
  children: StringDefinitionCstChildren
}

export type StringDefinitionCstChildren = {
  STRING: IToken[]
  variableName: IToken[]
  Comma: IToken[]
  description: StringValueCstNode[]
  Semicolon: IToken[]
}

export interface EnumValueListCstNode extends CstNode {
  name: 'enumValueList'
  children: EnumValueListCstChildren
}

export type EnumValueListCstChildren = {
  enumValue: EnumValueCstNode[]
  Comma?: IToken[]
}

export interface EnumValueCstNode extends CstNode {
  name: 'enumValue'
  children: EnumValueCstChildren
}

export type EnumValueCstChildren = {
  enumKey: StringValueCstNode[]
  Equals?: IToken[]
  enumValue?: ValueCstNode[]
  Colon?: IToken[]
  enumIdentifier?: IToken[]
  enumReference?: ValueCstNode[]
}

export interface InformationSectionCstNode extends CstNode {
  name: 'informationSection'
  children: InformationSectionCstChildren
}

export type InformationSectionCstChildren = {
  genericInstance: GenericInstanceCstNode[]
}

export interface GenericInstanceCstNode extends CstNode {
  name: 'genericInstance'
  children: GenericInstanceCstChildren
}

export type GenericInstanceCstChildren = {
  instanceType: IToken[]
  instanceName: IToken[]
  LeftBrace: IToken[]
  propertyAssignment?: PropertyAssignmentCstNode[]
  RightBrace: IToken[]
  Semicolon: IToken[]
}

export interface PropertyAssignmentCstNode extends CstNode {
  name: 'propertyAssignment'
  children: PropertyAssignmentCstChildren
}

export type PropertyAssignmentCstChildren = {
  propertyName?: IToken[]
  LeftBracket?: IToken[]
  arrayIndex?: NumberValueCstNode[]
  RightBracket?: IToken[]
  Equals: IToken[]
  propertyValue: ValueCstNode[]
  Semicolon: IToken[]
}

export interface ValueCstNode extends CstNode {
  name: 'value'
  children: ValueCstChildren
}

export type ValueCstChildren = {
  stringValue?: StringValueCstNode[]
  numberValue?: NumberValueCstNode[]
  referenceValue?: ReferenceValueCstNode[]
}

export interface StringValueCstNode extends CstNode {
  name: 'stringValue'
  children: StringValueCstChildren
}

export type StringValueCstChildren = {
  StringLiteral: IToken[]
}

export interface NumberValueCstNode extends CstNode {
  name: 'numberValue'
  children: NumberValueCstChildren
}

export type NumberValueCstChildren = {
  QuotedHexNumber?: IToken[]
  HexNumber?: IToken[]
  DecimalNumber?: IToken[]
}

export interface ReferenceValueCstNode extends CstNode {
  name: 'referenceValue'
  children: ReferenceValueCstChildren
}

export type ReferenceValueCstChildren = {
  Ampersand?: IToken[]
  Identifier: IToken[]
  LeftBracket?: IToken[]
  numberValue?: NumberValueCstNode[]
  RightBracket?: IToken[]
  LeftParen?: IToken[]
  value?: ValueCstNode[]
  Comma?: IToken[]
  RightParen?: IToken[]
}

export interface ICstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  ortiFile(children: OrtiFileCstChildren, param?: IN): OUT
  versionSection(children: VersionSectionCstChildren, param?: IN): OUT
  versionProperty(children: VersionPropertyCstChildren, param?: IN): OUT
  implementationSection(children: ImplementationSectionCstChildren, param?: IN): OUT
  implementationBlock(children: ImplementationBlockCstChildren, param?: IN): OUT
  genericBlock(children: GenericBlockCstChildren, param?: IN): OUT
  typeDefinition(children: TypeDefinitionCstChildren, param?: IN): OUT
  ctypeDefinition(children: CtypeDefinitionCstChildren, param?: IN): OUT
  enumDefinition(children: EnumDefinitionCstChildren, param?: IN): OUT
  stringDefinition(children: StringDefinitionCstChildren, param?: IN): OUT
  enumValueList(children: EnumValueListCstChildren, param?: IN): OUT
  enumValue(children: EnumValueCstChildren, param?: IN): OUT
  informationSection(children: InformationSectionCstChildren, param?: IN): OUT
  genericInstance(children: GenericInstanceCstChildren, param?: IN): OUT
  propertyAssignment(children: PropertyAssignmentCstChildren, param?: IN): OUT
  value(children: ValueCstChildren, param?: IN): OUT
  stringValue(children: StringValueCstChildren, param?: IN): OUT
  numberValue(children: NumberValueCstChildren, param?: IN): OUT
  referenceValue(children: ReferenceValueCstChildren, param?: IN): OUT
}
