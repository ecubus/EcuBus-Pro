import { parseXml, parseIdl } from '../../src/main/vbs/parse'
import { test, expect } from 'vitest'
import path from 'path'

test('parse idl', async () => {
  const idl = await parseIdl(path.join(__dirname, 'test.idl'))

  // 验证顶层结构
  expect(idl).toBeDefined()
  expect(idl).toHaveProperty('modules')
  expect(idl).toHaveProperty('structs')
  expect(idl).toHaveProperty('enums')
  expect(idl).toHaveProperty('typedefs')

  // 验证模块
  expect(idl.modules).toHaveLength(1)
  const mvbsModule = idl.modules[0]

  expect(mvbsModule.name).toBe('MVBS')
  expect(mvbsModule).toHaveProperty('structs')
  expect(mvbsModule).toHaveProperty('enums')
  expect(mvbsModule).toHaveProperty('typedefs')

  // 验证模块内的结构体数量
  // HelloWorld, HelloWorld1-5, BasicTypeStruct, sdatatype, ComplexDataType = 9个

  expect(mvbsModule.structs).toHaveLength(9)

  // 验证 HelloWorld 结构体
  const helloWorld = mvbsModule.structs.find((s: any) => s.name === 'HelloWorld')

  expect(helloWorld).toBeDefined()
  expect(helloWorld?.members).toHaveLength(2)

  // 验证 HelloWorld 的成员

  const idMember = helloWorld?.members.find((m: any) => m.name === 'id')
  expect(idMember).toBeDefined()
  expect(idMember?.type).toBe('long')

  const msgMember = helloWorld?.members.find((m: any) => m.name === 'msg')
  expect(msgMember).toBeDefined()
  expect(msgMember?.type).toBe('string<64>')

  // 验证 BasicTypeStruct 结构体
  const basicTypeStruct = mvbsModule.structs.find((s: any) => s.name === 'BasicTypeStruct')

  expect(basicTypeStruct).toBeDefined()
  expect(basicTypeStruct?.members).toHaveLength(12)

  // 验证 BasicTypeStruct 的各种类型成员
  const expectedMembers = [
    { name: 'id', type: 'long' },
    { name: 'msg', type: 'string<64>' },
    { name: 'tag', type: 'char' },
    { name: 'u8_data', type: 'octet' },
    { name: 'short_data', type: 'short' },
    { name: 'ushort_data', type: 'unsigned short' },
    { name: 'ulong_data', type: 'unsigned long' },
    { name: 'llong_data', type: 'long long' },
    { name: 'ullong_data', type: 'unsigned long long' },
    { name: 'float_data', type: 'float' },
    { name: 'double_data', type: 'double' },
    { name: 'bool_data', type: 'boolean' }
  ]

  expectedMembers.forEach((expected) => {
    const member = basicTypeStruct?.members.find((m: any) => m.name === expected.name)

    expect(member, `成员 ${expected.name} 应该存在`).toBeDefined()
    expect(member?.type, `成员 ${expected.name} 的类型应该是 ${expected.type}`).toBe(expected.type)
  })

  // 验证 sdatatype 结构体
  const sdatatype = mvbsModule.structs.find((s: any) => s.name === 'sdatatype')
  expect(sdatatype).toBeDefined()
  expect(sdatatype?.members).toHaveLength(3)
  expect(sdatatype?.members.every((m: any) => m.type === 'long')).toBe(true)

  // 验证枚举
  expect(mvbsModule.enums).toHaveLength(1)
  const edatatype = mvbsModule.enums[0]
  expect(edatatype.name).toBe('edatatype')
  expect(edatatype.values).toHaveLength(4)

  // 验证枚举值
  const expectedEnumValues = [
    { name: 'ZERO', value: '0' },
    { name: 'ONE', value: '1' },
    { name: 'TWO', value: '2' },
    { name: 'THREE', value: '3' }
  ]

  expectedEnumValues.forEach((expected, index) => {
    expect(edatatype.values[index].name).toBe(expected.name)
    expect(edatatype.values[index].value).toBe(expected.value)
  })

  // 验证类型定义
  expect(mvbsModule.typedefs).toHaveLength(2)

  // 验证 arrayType typedef
  const arrayType = mvbsModule.typedefs.find((t: any) =>
    Array.isArray(t) ? t.some((item: any) => item.name === 'arrayType') : t.name === 'arrayType'
  )
  expect(arrayType).toBeDefined()

  // 验证全局结构体
  expect(idl.structs).toHaveLength(1)
  const structSize50 = idl.structs[0]
  expect(structSize50.name).toBe('StructSize50')
  expect(structSize50.members).toHaveLength(14)

  // 验证 StructSize50 的第一个成员
  const firstMember = structSize50.members[0]
  expect(firstMember.name).toBe('id')
  expect(firstMember.type).toBe('unsigned long')

  // 验证 ComplexDataType 结构体（包含自定义类型）
  const complexDataType = mvbsModule.structs.find((s: any) => s.name === 'ComplexDataType')
  expect(complexDataType).toBeDefined()
  expect(complexDataType?.members).toHaveLength(4)

  const structDataMember = complexDataType?.members.find((m: any) => m.name === 'struct_data')
  expect(structDataMember).toBeDefined()
  expect(structDataMember?.type).toBe('sdatatype')

  const enumDataMember = complexDataType?.members.find((m: any) => m.name === 'enum_data')
  expect(enumDataMember).toBeDefined()
  expect(enumDataMember?.type).toBe('edatatype')
})
test('parse idl1', async () => {
  const idl = await parseIdl(path.join(__dirname, 'vbslite_perf_demo.idl'))

  expect(idl).toBeDefined()
  const HelloWorld26 = idl.structs.find((s: any) => s.name === 'HelloWorld26')
  expect(HelloWorld26).toBeDefined()
  expect(HelloWorld26?.members).toHaveLength(2)
  const indexMember = HelloWorld26?.members.find((m: any) => m.name === 'index')
  expect(indexMember).toBeDefined()
  expect(indexMember?.type).toBe('unsigned long')
  const messageMember = HelloWorld26?.members.find((m: any) => m.name === 'message')
  expect(messageMember).toBeDefined()
  expect(messageMember?.type).toBe('long')
})
test('parse rpc', async () => {
  const idl = await parseIdl(path.join(__dirname, 'calculator.idl'))

  expect(idl).toBeDefined()
  expect(idl.modules).toHaveLength(1)
  const mvbsModule = idl.modules[0]
  expect(mvbsModule.name).toBe('MVBS')
  expect(mvbsModule).toHaveProperty('interfaces')
  expect(mvbsModule.interfaces).toHaveLength(1)
  const calculatorInterface = mvbsModule.interfaces[0]
  expect(calculatorInterface.name).toBe('calculator')
  expect(calculatorInterface.methods).toHaveLength(1)
  const addMethod = calculatorInterface.methods[0]
  expect(addMethod.name).toBe('add')
  expect(addMethod.parameters).toHaveLength(3)
  expect(addMethod.parameters[0].name).toBe('a')
  expect(addMethod.parameters[0].type).toBe('long')
  expect(addMethod.parameters[1].name).toBe('b')
  expect(addMethod.parameters[1].type).toBe('long')
  expect(addMethod.parameters[2].name).toBe('ret')
  expect(addMethod.parameters[2].type).toBe('long')
  expect(addMethod.parameters[2].direction).toBe('out')
})
