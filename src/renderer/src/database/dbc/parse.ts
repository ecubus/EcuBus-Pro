import { CstChildrenDictionary, CstNode, CstParser, IToken, Lexer, Rule, createToken } from "chevrotain";



// 首先定义所有的tokens
const WhiteSpace = createToken({
    name: "WhiteSpace",
    pattern: /\s+/,
    group: Lexer.SKIPPED
});

const Comment = createToken({
    name: "Comment",
    pattern: /\/\/[^\n]*/,
    group: Lexer.SKIPPED
});

// 按照长度和特异性排序定义tokens
const BA_DEF_DEF_REL = createToken({ name: "BA_DEF_DEF_REL", pattern: /BA_DEF_DEF_REL_/ });
const BA_DEF_SGTYPE = createToken({ name: "BA_DEF_SGTYPE", pattern: /BA_DEF_SGTYPE_/ });
const BA_DEF_DEF = createToken({ name: "BA_DEF_DEF", pattern: /BA_DEF_DEF_/ });
const BA_DEF_REL = createToken({ name: "BA_DEF_REL", pattern: /BA_DEF_REL_/ });
const BA_SGTYPE = createToken({ name: "BA_SGTYPE", pattern: /BA_SGTYPE_/ });
const BA_DEF = createToken({ name: "BA_DEF", pattern: /BA_DEF_\s+/ });
const BA_REL = createToken({ name: "BA_REL", pattern: /BA_REL_/ });
const BA = createToken({ name: "BA", pattern: /BA_/ });

const SIGTYPE_VALTYPE = createToken({ name: "SIGTYPE_VALTYPE", pattern: /SIGTYPE_VALTYPE_/ });
const SIG_VALTYPE = createToken({ name: "SIG_VALTYPE", pattern: /SIG_VALTYPE_/ });
const SIG_TYPE_REF = createToken({ name: "SIG_TYPE_REF", pattern: /SIG_TYPE_REF_/ });
const SIG_GROUP = createToken({ name: "SIG_GROUP", pattern: /SIG_GROUP_/ });
const SG_MUL_VAL = createToken({ name: "SG_MUL_VAL", pattern: /SG_MUL_VAL_/ });

const SGTYPE_VAL = createToken({ name: "SGTYPE_VAL", pattern: /SGTYPE_VAL_/ });
const SGTYPE = createToken({ name: "SGTYPE", pattern: /SGTYPE_/ });

const VAL_TABLE = createToken({ name: "VAL_TABLE", pattern: /VAL_TABLE_/ });
const VAL = createToken({ name: "VAL", pattern: /VAL_/ });

const BU_SG_REL = createToken({ name: "BU_SG_REL", pattern: /BU_SG_REL_/ });
const BU_EV_REL = createToken({ name: "BU_EV_REL", pattern: /BU_EV_REL_/ });
const BU_BO_REL = createToken({ name: "BU_BO_REL", pattern: /BU_BO_REL_/ });
const BO_TX_BU = createToken({ name: "BO_TX_BU", pattern: /BO_TX_BU_/ });
const BO = createToken({ name: "BO", pattern: /BO_/ });
const BU = createToken({ name: "BU", pattern: /BU_/ });

const CAT_DEF = createToken({ name: "CAT_DEF", pattern: /CAT_DEF_/ });
const CAT = createToken({ name: "CAT", pattern: /CAT_/ });

const ENVVAR_DATA = createToken({ name: "ENVVAR_DATA", pattern: /ENVVAR_DATA_/ });
const EV_DATA = createToken({ name: "EV_DATA", pattern: /EV_DATA_/ });

const Version = createToken({ name: "Version", pattern: /VERSION/ });
const FILTER = createToken({ name: "FILTER", pattern: /FILTER/ });
const NS = createToken({ name: "NS", pattern: /NS_/ });
const BS = createToken({ name: "BS", pattern: /BS_/ });
const SG = createToken({ name: "SG", pattern: /SG_/ });
const CM = createToken({ name: "CM", pattern: /CM_/ });

const NS_DESC = createToken({ name: "NS_DESC", pattern: /NS_DESC_/ });

// 基本tokens
const StringLiteral = createToken({ name: "StringLiteral", pattern: /"[^"]*"/ });
const Identifier = createToken({ name: "Identifier", pattern: /[a-zA-Z_][a-zA-Z0-9_]*/ });
// 修改 Number token 以支持科学记数法
const Number = createToken({ 
    name: "Number", 
    pattern: /[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?\s*/ 
});
const Colon = createToken({ name: "Colon", pattern: /:/ });
const Semicolon = createToken({ name: "Semicolon", pattern: /;/ });
const Pipe = createToken({ name: "Pipe", pattern: /\|/ });
const At = createToken({ name: "At", pattern: /@/ });
const OpenParen = createToken({ name: "OpenParen", pattern: /\(/ });
const CloseParen = createToken({ name: "CloseParen", pattern: /\)/ });
const OpenBracket = createToken({ name: "OpenBracket", pattern: /\[/ });
const CloseBracket = createToken({ name: "CloseBracket", pattern: /\]/ });
const Comma = createToken({ name: "Comma", pattern: /,/ });
const Plus = createToken({ name: "Plus", pattern: /\+/ });
const Minus = createToken({ name: "Minus", pattern: /-/ });

// 在基本 tokens 部分添加新的 tokens
const MultiplexerIndicator = createToken({ 
    name: "MultiplexerIndicator", 
    pattern: /[mM][a-zA-Z0-9_]*/ 
});

const ENUM = createToken({ name: "ENUM", pattern: /ENUM/ });
const INT = createToken({ name: "INT", pattern: /INT/ });

// 定义allTokens数组，保持相同的顺序
const allTokens = [
   
    WhiteSpace, Comment,
    // 按长度/特异性排序
    BA_DEF_DEF_REL, BA_DEF_SGTYPE, BA_DEF_DEF, BA_DEF_REL, // 新增 BA_DEF_DEF_
    BA_SGTYPE, BA_DEF, BA_REL, BA,
    SIGTYPE_VALTYPE, SIG_VALTYPE, SIG_TYPE_REF, SIG_GROUP, SG_MUL_VAL,
    SGTYPE_VAL, SGTYPE,
    VAL_TABLE, VAL,
    BU_SG_REL, BU_EV_REL, BU_BO_REL,
    BO_TX_BU, BO, BU,
    CAT_DEF, CAT,
    ENVVAR_DATA, EV_DATA,
    NS_DESC,
    Version, FILTER, NS, BS, SG, CM,
    ENUM, INT, // 新增
    Colon, Semicolon, Pipe, At,
    OpenParen, CloseParen, OpenBracket, CloseBracket,
    StringLiteral,  Number, Plus, Minus,Identifier, MultiplexerIndicator,
    Comma
];

// 创建lexer
export const JsonLexer = new Lexer(allTokens);

class DBCParser extends CstParser {
    constructor() {
        super(allTokens);
        this.performSelfAnalysis();
    }

    private version = this.RULE("versionClause", () => {
        this.CONSUME1(Version);
        this.CONSUME1(StringLiteral);
        this.OPTION(() => this.CONSUME1(Semicolon));
    });

    private busConfig = this.RULE("busConfigClause", () => {
        this.CONSUME1(BS);
        this.CONSUME1(Colon);
        this.OPTION(() => this.CONSUME1(Semicolon));
    });

    private nodes = this.RULE("nodesClause", () => {
        this.CONSUME1(BU);
        this.CONSUME1(Colon);
        this.MANY(() => {
            this.CONSUME1(Identifier); // List of CAN-Nodes separated by whitespaces
        });
        this.OPTION(() => this.CONSUME1(Semicolon));
    });

    private signal = this.RULE("signalClause", () => {
        // SG_ <SignalName> [M|m<MultiplexerIdentifier>]
        this.CONSUME1(SG);
        this.CONSUME1(Identifier); // SignalName (required)
        
        // Multiplexer part (optional)
        this.OPTION(() => {
            
            this.CONSUME2(Identifier);  // 匹配 M 或 m
           
        });

        // : <StartBit>|<Length>@<Endianness><Signed>
        this.CONSUME1(Colon);
        this.CONSUME2(Number);  // StartBit (required)
        this.CONSUME1(Pipe);    // | separator
        this.CONSUME3(Number);  // Length (required)
        this.CONSUME1(At);      // @ separator
        this.CONSUME4(Number);  // Endianness (required): 1=Intel, 0=Motorola
        
        // Sign indicator
        this.OR1([
            { ALT: () => this.CONSUME1(Plus) },   // unsigned (+)
            { ALT: () => this.CONSUME1(Minus) }   // signed (-)
        ]);

        // (<Factor>,<Offset>)
        this.CONSUME1(OpenParen);
        this.CONSUME5(Number);  // Factor (required)
        this.CONSUME1(Comma);
        this.CONSUME6(Number);  // Offset (required)
        this.CONSUME1(CloseParen);

        // [<Min>|<Max>]
        this.CONSUME1(OpenBracket);
        this.CONSUME7(Number);  // Minimum value (required)
        this.CONSUME2(Pipe);    // | separator
        this.CONSUME8(Number);  // Maximum value (required)
        this.CONSUME1(CloseBracket);
        
        // "[Unit]" (optional)
        this.OPTION2(() => {
            this.OR2([
                { ALT: () => this.CONSUME2(StringLiteral) }, // quoted unit
                { ALT: () => this.CONSUME3(Identifier) }     // unquoted unit
            ]);
        });

        // Receiving nodes (required, at least one)
        this.AT_LEAST_ONE_SEP({
            SEP: Comma,
            DEF: () => {
                this.OR3([
                    { ALT: () => this.CONSUME4(Identifier) },      // node name
                    { ALT: () => this.CONSUME3(StringLiteral) }    // Vector__XXX or special names
                ]);
            }
        });
        
        this.OPTION3(() => this.CONSUME1(Semicolon));
    });

    private message = this.RULE("messageClause", () => {
        this.CONSUME1(BO);
        this.CONSUME1(Number); // Message ID in decimal or hex format

        this.OR1([
            { ALT: () => this.CONSUME1(Identifier) }, // Standard message name
            { ALT: () => this.CONSUME1(StringLiteral) } // Message name with special characters
        ]);
        this.CONSUME1(Colon);  // Colon after message ID
        this.CONSUME2(Number); // Message length (in bytes)
        this.OR2([
            { ALT: () => this.CONSUME2(Identifier) }, // Standard node name
            { ALT: () => this.CONSUME2(StringLiteral) } // Node name with special characters or Vector__XXX
        ]);
        this.OPTION(() => this.CONSUME2(Semicolon));
        
        // Signals are optional
        this.MANY(() => {
            this.SUBRULE(this.signal);
        });
    });

    private valueTable = this.RULE("valueTableClause", () => {
        this.CONSUME1(VAL_TABLE);
        this.CONSUME1(Identifier); // Table name
        this.MANY(() => {
            this.CONSUME1(Number);
            this.CONSUME1(StringLiteral);
        });
        this.OPTION(() => this.CONSUME1(Semicolon));
    });

    private attribute = this.RULE("attributeClause", () => {
        this.CONSUME1(BA_DEF);
        this.OPTION(() => {
            this.OR1([
                { ALT: () => this.CONSUME1(BU) },
                { ALT: () => this.CONSUME1(BO) },
                { ALT: () => this.CONSUME1(SG) }
            ]);
        });

        // 属性名
        this.CONSUME1(StringLiteral);

        // 属性类型和值
        this.OR2([
            { 
                ALT: () => {
                    // ENUM "value1","value2",...
                    this.CONSUME(ENUM);
                    this.AT_LEAST_ONE_SEP({
                        SEP: Comma,
                        DEF: () => this.CONSUME2(StringLiteral)
                    });
                }
            },
            {
                ALT: () => {
                    // INT min max
                    this.CONSUME(INT);
                    this.CONSUME1(Number); // Min
                    this.CONSUME2(Number); // Max
                }
            },
            { 
                ALT: () => this.CONSUME1(Identifier) // 其他类型
            }
        ]);

        this.OPTION1(() => this.CONSUME1(Semicolon));
    });

    // 添加新的规则处理属性默认值
    private attributeDefault = this.RULE("attributeDefaultClause", () => {
        this.CONSUME(BA_DEF_DEF);
        this.CONSUME(StringLiteral); // 属性名称
        
        // 默认值可以是数字、字符串或标识符
        this.OR([
            { ALT: () => this.CONSUME(Number) },      // 数字值
            { ALT: () => this.CONSUME1(StringLiteral) },// 字符串值
            { ALT: () => this.CONSUME(Identifier) }   // 标识符值
        ]);
        
        this.OPTION(() => this.CONSUME(Semicolon));
    });

    // 添加新的规则处理属性赋值
    private attributeAssignment = this.RULE("attributeAssignmentClause", () => {
        this.CONSUME(BA);
        this.CONSUME(StringLiteral); // AttributeName
        
        // 属性赋值有多种格式
        this.OR([
            { 
                // 简单全局属性: BA_ "BusType" "CAN";
                ALT: () => {
                    this.OR1([
                        { ALT: () => this.CONSUME1(StringLiteral) },
                        { ALT: () => this.CONSUME1(Number) }
                    ]);
                }
            },
            {
                // 节点属性: BA_ "AttributeName" BU_ NodeName Value;
                ALT: () => {
                    this.CONSUME(BU);
                    this.CONSUME2(Identifier); // NodeName
                    this.OR2([
                        { ALT: () => this.CONSUME2(StringLiteral) },
                        { ALT: () => this.CONSUME2(Number) }
                    ]);
                }
            },
            {
                // 消息属性: BA_ "AttributeName" BO_ MessageID Value;
                ALT: () => {
                    this.CONSUME(BO);
                    this.CONSUME3(Number); // MessageID
                    this.OR3([
                        { ALT: () => this.CONSUME3(StringLiteral) },
                        { ALT: () => this.CONSUME4(Number) }
                    ]);
                }
            },
            {
                // 信号属性: BA_ "AttributeName" SG_ MessageID SignalName Value;
                ALT: () => {
                    this.CONSUME(SG);
                    this.CONSUME5(Number); // MessageID
                    this.CONSUME3(Identifier); // SignalName
                    this.OR4([
                        { ALT: () => this.CONSUME4(StringLiteral) },
                        { ALT: () => this.CONSUME6(Number) }
                    ]);
                }
            }
        ]);
        
        this.OPTION(() => this.CONSUME(Semicolon));
    });

    // 添加新的规则处理多路复用信号值
    private multiplexedValue = this.RULE("multiplexedValueClause", () => {
        this.CONSUME(SG_MUL_VAL);
        this.CONSUME1(Number);        // Message ID
        this.CONSUME1(Identifier);    // Signal name
        this.CONSUME2(Identifier);    // Signal name
        this.CONSUME3(Number);      // Signal

        this.CONSUME4(Number);      // Signal
        
        this.OPTION(() => this.CONSUME(Semicolon));
    });

    private valueDefinition = this.RULE("valueDefinitionClause", () => {
        this.CONSUME1(VAL);
        this.CONSUME1(Number); // CAN-ID
        this.CONSUME1(Identifier); // SignalName
        this.MANY(() => {
            this.CONSUME2(Number); // Value
            this.CONSUME2(StringLiteral); // Value description
        });
        this.OPTION(() => this.CONSUME1(Semicolon));
    });

    private comment = this.RULE("commentClause", () => {
        this.CONSUME1(CM);
        this.OR([
            {
                ALT: () => {
                    this.CONSUME1(SG);
                    this.CONSUME1(Number); // CAN-ID
                    this.CONSUME2(Identifier); // SignalName
                }
            },
            {
                ALT: () => {
                    this.CONSUME2(BO);
                    this.CONSUME2(Number); // CAN-ID
                }
            },
            {
                ALT: () => {
                    this.CONSUME3(BU);
                    this.CONSUME3(Identifier); // NodeName
                }
            }
        ]);
        this.CONSUME1(StringLiteral); // DescriptionText
        this.OPTION(() => this.CONSUME1(Semicolon));
    });

    private nsSection = this.RULE("nsSection", () => {
        this.CONSUME1(NS);
        this.CONSUME1(Colon);
        
        // 在冒号后面需要一个换行，我们可以跳过它因为已经在 lexer 中设置了 WhiteSpace 为 SKIPPED
        
        // 标识符列表
        this.MANY(() => {
            this.OR([
                { ALT: () => this.CONSUME1(NS_DESC) },
                { ALT: () => this.CONSUME1(CM) },
                { ALT: () => this.CONSUME1(BA_DEF) },
                { ALT: () => this.CONSUME1(BA) },
                { ALT: () => this.CONSUME1(VAL) },
                { ALT: () => this.CONSUME1(CAT_DEF) },
                { ALT: () => this.CONSUME1(CAT) },
                { ALT: () => this.CONSUME1(FILTER) },
                { ALT: () => this.CONSUME1(BA_DEF_DEF) },
                { ALT: () => this.CONSUME1(EV_DATA) },
                { ALT: () => this.CONSUME1(ENVVAR_DATA) },
                { ALT: () => this.CONSUME1(SGTYPE) },
                { ALT: () => this.CONSUME1(SGTYPE_VAL) },
                { ALT: () => this.CONSUME1(BA_DEF_SGTYPE) },
                { ALT: () => this.CONSUME1(BA_SGTYPE) },
                { ALT: () => this.CONSUME1(SIG_TYPE_REF) },
                { ALT: () => this.CONSUME1(VAL_TABLE) },
                { ALT: () => this.CONSUME1(SIG_GROUP) },
                { ALT: () => this.CONSUME1(SIG_VALTYPE) },
                { ALT: () => this.CONSUME1(SIGTYPE_VALTYPE) },
                { ALT: () => this.CONSUME1(BO_TX_BU) },
                { ALT: () => this.CONSUME1(BA_DEF_REL) },
                { ALT: () => this.CONSUME1(BA_REL) },
                { ALT: () => this.CONSUME1(BA_DEF_DEF_REL) },
                { ALT: () => this.CONSUME1(BU_SG_REL) },
                { ALT: () => this.CONSUME1(BU_EV_REL) },
                { ALT: () => this.CONSUME1(BU_BO_REL) },
                { ALT: () => this.CONSUME1(SG_MUL_VAL) }
            ]);
        });
        
        // 最后消费分号
        // this.CONSUME1(Semicolon);
    });

    public dbcFile = this.RULE("dbcFile", () => {
        // Version section is optional
        this.OPTION(() => {
            this.SUBRULE(this.version);
        });
        
        // NS_ section
        this.SUBRULE(this.nsSection);
        
        // BS_ section
        this.SUBRULE(this.busConfig);
        
        // BU_ section
        this.SUBRULE(this.nodes);
        
        // 剩余部分
        this.MANY(() => {
            this.OR([
                { ALT: () => this.SUBRULE2(this.message) },
                { ALT: () => this.SUBRULE2(this.valueTable) },
                { ALT: () => this.SUBRULE2(this.attribute) },
                { ALT: () => this.SUBRULE2(this.attributeDefault) },
                { ALT: () => this.SUBRULE2(this.attributeAssignment) },
                { ALT: () => this.SUBRULE2(this.multiplexedValue) },
                { ALT: () => this.SUBRULE2(this.comment) },
                { ALT: () => this.SUBRULE2(this.valueDefinition) } // 添加对信号值定义的处理
            ]);
        });
    });
}

export const parser = new DBCParser()
export const productions: Record<string, Rule> = parser.getGAstProductions();
