import IDL_GrammarLexer from './IDL_GrammarLexer'
import IDL_GrammarParser from './IDL_GrammarParser'
import IDL_GrammarVisitor from './IDL_GrammarVisitor'
import antlr4 from 'antlr4'

// 自定义 Visitor 类来提取 IDL 结构
class IDLStructureVisitor extends IDL_GrammarVisitor {
    constructor() {
        super()
        this.result = {
            modules: [],
            structs: [],
            enums: [],
            typedefs: []
        }
    }

    visitSpecification(ctx) {
        // 访问所有定义
        if (ctx.definition) {
            ctx.definition().forEach(def => this.visit(def))
        }
        return this.result
    }

    visitModule_dcl(ctx) {
        const moduleName = ctx.identifier().getText()
        const moduleContent = {
            name: moduleName,
            structs: [],
            enums: [],
            typedefs: []
        }
        
        // 保存当前模块上下文
        const oldResult = this.result
        this.result = moduleContent
        
        // 访问模块内容
        if (ctx.module_contents) {
            ctx.module_contents().forEach(content => this.visit(content))
        }
        
        // 恢复上下文并添加模块
        this.result = oldResult
        this.result.modules.push(moduleContent)
        
        return moduleContent
    }

    visitStruct_def(ctx) {
        const structName = ctx.identifier().getText()
        const struct = {
            name: structName,
            members: []
        }
        
        // 访问成员列表
        if (ctx.member_list()) {
            const memberList = ctx.member_list()
            if (memberList.member) {
                memberList.member().forEach(member => {
                    const memberInfo = this.visit(member)
                    if (memberInfo) {
                      
                        struct.members.push(...memberInfo)
                    }
                })
            }
        }
        
        this.result.structs.push(struct)
        return struct
    }

    visitMember(ctx) {
        const typeSpec = ctx.type_spec()
        const declarators = ctx.declarators()
        
        if (typeSpec && declarators) {
            const type = this.visit(typeSpec)
            const names = this.visit(declarators)
            
            return names.map(name => ({
                name: name,
                type: type
            }))
        }
        return null
    }

    visitType_spec(ctx) {
        return this.visit(ctx.simple_type_spec())
    }

    visitSimple_type_spec(ctx) {
        if (ctx.base_type_spec()) {
            return this.visit(ctx.base_type_spec())
        } else if (ctx.template_type_spec()) {
            return this.visit(ctx.template_type_spec())
        } else if (ctx.scoped_name()) {
            return ctx.scoped_name().getText()
        }
        return 'unknown'
    }

    visitBase_type_spec(ctx) {
        if (ctx.integer_type()) {
            return this.visit(ctx.integer_type())
        } else if (ctx.floating_pt_type()) {
            return this.visit(ctx.floating_pt_type())
        } else if (ctx.char_type()) {
            return 'char'
        } else if (ctx.boolean_type()) {
            return 'boolean'
        } else if (ctx.octet_type()) {
            return 'octet'
        }
        return 'unknown'
    }

    visitInteger_type(ctx) {
        if (ctx.signed_int()) {
            return this.visit(ctx.signed_int())
        } else if (ctx.unsigned_int()) {
            return this.visit(ctx.unsigned_int())
        }
        return 'int'
    }

    visitSigned_int(ctx) {
        if (ctx.signed_short_int()) {
            return 'short'
        } else if (ctx.signed_long_int()) {
            return 'long'
        } else if (ctx.signed_longlong_int()) {
            return 'long long'
        } else if (ctx.signed_octet_int()) {
            return 'int8'
        }
        return 'int'
    }

    visitUnsigned_int(ctx) {
        if (ctx.unsigned_short_int()) {
            return 'unsigned short'
        } else if (ctx.unsigned_long_int()) {
            return 'unsigned long'
        } else if (ctx.unsigned_longlong_int()) {
            return 'unsigned long long'
        } else if (ctx.unsigned_octet_int()) {
            return 'uint8'
        }
        return 'unsigned int'
    }

    visitFloating_pt_type(ctx) {
        if (ctx.float_type()) {
            return 'float'
        } else if (ctx.double_type()) {
            return 'double'
        } else if (ctx.long_double_type()) {
            return 'long double'
        }
        return 'float'
    }

    visitString_type(ctx) {
        if (ctx.positive_int_const()) {
            const size = ctx.positive_int_const().getText()
            return `string<${size}>`
        }
        return 'string'
    }

    visitTemplate_type_spec(ctx) {
        if (ctx.string_type()) {
            return this.visit(ctx.string_type())
        } else if (ctx.sequence_type()) {
            return this.visit(ctx.sequence_type())
        }
        return 'template'
    }

    visitDeclarators(ctx) {
        const declarators = []
        if (ctx.declarator) {
            ctx.declarator().forEach(decl => {
                const name = this.visit(decl)
                if (name) {
                    declarators.push(name)
                }
            })
        }
        return declarators
    }

    visitDeclarator(ctx) {
        if (ctx.simple_declarator()) {
            return this.visit(ctx.simple_declarator())
        } else if (ctx.complex_declarator()) {
            return this.visit(ctx.complex_declarator())
        }
        return null
    }

    visitSimple_declarator(ctx) {
        return ctx.identifier().getText()
    }

    visitComplex_declarator(ctx) {
        if (ctx.array_declarator()) {
            return this.visit(ctx.array_declarator())
        }
        return null
    }

    visitArray_declarator(ctx) {
        // 对于数组声明符，我们只返回标识符名称
        // 数组大小信息可以在后续处理中添加
        return ctx.identifier().getText()
    }

    visitEnum_dcl(ctx) {
        const enumName = ctx.identifier().getText()
        const enumDef = {
            name: enumName,
            values: []
        }
        
        if (ctx.enumerator_list()) {
            const enumeratorList = ctx.enumerator_list()
            if (enumeratorList.enumerator) {
                enumeratorList.enumerator().forEach(enumerator => {
                    const enumValue = this.visit(enumerator)
                    if (enumValue) {
                        enumDef.values.push(enumValue)
                    }
                })
            }
        }
        
        this.result.enums.push(enumDef)
        return enumDef
    }

    visitEnumerator(ctx) {
        const name = ctx.declarator().getText()
        let value = null
        
        if (ctx.const_expr && ctx.const_expr().length > 0) {
            value = ctx.const_expr(0).getText()
        }
        
        return { name, value }
    }

    visitTypedef_dcl(ctx) {
        const typeDeclarator = ctx.type_declarator()
        if (typeDeclarator) {
            const typedef = this.visit(typeDeclarator)
            if (typedef) {
          
                this.result.typedefs.push(...typedef)
                return typedef
            }
        }
        return null
    }

    visitType_declarator(ctx) {
        const typeSpec = ctx.type_spec()
        const declarators = ctx.declarators()
        
        if (typeSpec && declarators) {
            const type = this.visit(typeSpec)
            const names = this.visit(declarators)
            
            return names.map(name => ({
                name: name,
                type: type
            }))
        }
        return null
    }
}

export default function parse(content) {
    const chars = new antlr4.InputStream(content)
    const lexer = new IDL_GrammarLexer(chars)
    const tokens = new antlr4.CommonTokenStream(lexer)
    const parser = new IDL_GrammarParser(tokens)
    
    // 创建语法树
    const tree = parser.specification()
    
    // 使用自定义 Visitor 访问语法树
    const visitor = new IDLStructureVisitor()
    const result = visitor.visit(tree)
    
    return result
}
