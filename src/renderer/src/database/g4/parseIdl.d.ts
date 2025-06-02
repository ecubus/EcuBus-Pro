// TypeScript declarations for IDL parser

export interface StructMember {
  name: string
  type: string
}

export interface Struct {
  name: string
  members: StructMember[]
}

export interface EnumValue {
  name: string
  value: string | null
}

export interface Enum {
  name: string
  values: EnumValue[]
}

export interface Typedef {
  name: string
  type: string
}

export interface Parameter {
  name: string
  type: string
  direction?: 'in' | 'out' | 'inout'
}

export interface Method {
  name: string
  returnType: string
  parameters: Parameter[]
}

export interface Interface {
  name: string
  methods: Method[]
}

export interface Module {
  name: string
  structs: Struct[]
  enums: Enum[]
  typedefs: Typedef[]
  interfaces: Interface[]
}

export interface IDLParseResult {
  id: string
  name: string
  modules: Module[]
  structs: Struct[]
  enums: Enum[]
  typedefs: Typedef[]
  interfaces: Interface[]
}

declare function parseIdl(content: string): IDLParseResult

export default parseIdl
