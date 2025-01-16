import { CstChildrenDictionary, CstNode, CstParser, IToken, Lexer, Rule, createToken } from "chevrotain";

// DBC File Structure Interfaces
export interface DBCVersion {
    version: string;
}

export interface BusConfig {
    speed: number;  // in kBit/s
}

export interface Signal {
    name: string;
    multiplexerIndicator?: string;  // M for multiplexer, m<value> for multiplexed
    startBit: number;
    length: number;
    isLittleEndian: boolean;  // 1 = little-endian (Intel), 0 = big-endian (Motorola)
    isSigned: boolean;        // true = signed, false = unsigned
    factor: number;
    offset: number;
    minimum?: number;
    maximum?: number;
    unit?: string;
    receivers: string[];
    comment?: string;
    values?: Record<number, string>;  // Value table
    attributes?: Record<string, any>; // Signal attributes
}

export interface Message {
    id: number;
    name: string;
    length: number;
    sender: string;
    signals: Record<string, Signal>;
    comment?: string;
    attributes?: Record<string, any>;
    transmitters?: string[];
}

export interface ValueTable {
    name: string;
    values: Record<number, string>;
}

export interface Attribute {
    name: string;
    type: 'INT' | 'FLOAT' | 'STRING' | 'ENUM';
    definition: any;
    defaultValue: any;
}

export interface DBC {
    version?: string;
    busConfig?: BusConfig;
    nodes: string[];
    messages: Record<number, Message>;
    valueTables: Record<string, ValueTable>;
    attributes: Record<string, Attribute>;
    comments: Record<string, string>;
}

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
const BA_DEF = createToken({ name: "BA_DEF", pattern: /BA_DEF_/ });
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

// 基本tokens
const StringLiteral = createToken({ name: "StringLiteral", pattern: /"[^"]*"/ });
const Identifier = createToken({ name: "Identifier", pattern: /[a-zA-Z_][a-zA-Z0-9_]*/ });
const Number = createToken({ name: "Number", pattern: /\d+(\.\d+)?/ });
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

// 定义allTokens数组，保持相同的顺序
const allTokens = [
    WhiteSpace, Comment,
    // 按长度/特异性排序
    BA_DEF_DEF_REL, BA_DEF_SGTYPE, BA_DEF_DEF, BA_DEF_REL,
    BA_SGTYPE, BA_DEF, BA_REL, BA,
    SIGTYPE_VALTYPE, SIG_VALTYPE, SIG_TYPE_REF, SIG_GROUP, SG_MUL_VAL,
    SGTYPE_VAL, SGTYPE,
    VAL_TABLE, VAL,
    BU_SG_REL, BU_EV_REL, BU_BO_REL,
    BO_TX_BU, BO, BU,
    CAT_DEF, CAT,
    ENVVAR_DATA, EV_DATA,
    Version, FILTER, NS, BS, SG, CM,
    StringLiteral, Identifier, Number,
    Plus, Minus,
    Colon, Semicolon, Pipe, At,
    OpenParen, CloseParen, OpenBracket, CloseBracket,
    Comma
];

// 创建lexer
const JsonLexer = new Lexer(allTokens);

class DBCParser extends CstParser {
    constructor() {
        super(allTokens);
        this.performSelfAnalysis();
    }

    private version = this.RULE("versionClause", () => {
        this.CONSUME(Version);
        this.CONSUME(StringLiteral);
    });

    private busConfig = this.RULE("busConfigClause", () => {
        this.CONSUME(BS);
        this.CONSUME(Colon);
        this.CONSUME(Number);
        this.CONSUME(Semicolon);
    });

    private nodes = this.RULE("nodesClause", () => {
        this.CONSUME(BU);
        this.MANY(() => {
            this.CONSUME(Identifier);
        });
        this.CONSUME(Semicolon);
    });

    private signal = this.RULE("signalClause", () => {
        this.CONSUME(SG);
        this.CONSUME1(Identifier); // Signal name
        this.OPTION(() => {
            this.OR([
                { ALT: () => this.CONSUME(StringLiteral) }, // M
                { ALT: () => {
                    this.CONSUME2(Identifier); // m
                    this.CONSUME(Number); // multiplexer value
                }}
            ]);
        });
        this.CONSUME(Colon);
        this.CONSUME1(Number); // Start bit
        this.CONSUME(Pipe);
        this.CONSUME2(Number); // Length
        this.CONSUME(At);
        this.CONSUME3(Number); // Endianness
        this.OR1([
            { ALT: () => this.CONSUME(Plus) },
            { ALT: () => this.CONSUME(Minus) }
        ]); // Sign indicator
        this.CONSUME(OpenParen);
        this.CONSUME5(Number); // Factor
        this.CONSUME(Comma);
        this.CONSUME6(Number); // Offset
        this.CONSUME(CloseParen);
        this.CONSUME(OpenBracket);
        this.CONSUME7(Number); // Minimum
        this.CONSUME1(Pipe);
        this.CONSUME8(Number); // Maximum
        this.CONSUME(CloseBracket);
        this.CONSUME2(StringLiteral); // Unit
        this.AT_LEAST_ONE_SEP({
            SEP: Comma,
            DEF: () => this.CONSUME3(Identifier) // Receiving nodes
        });
        this.CONSUME(Semicolon);
    });

    private message = this.RULE("messageClause", () => {
        this.CONSUME(BO);
        this.CONSUME(Number); // Message ID
        this.CONSUME(Identifier); // Message name
        this.CONSUME(Colon);
        this.CONSUME1(Number); // Message length
        this.CONSUME1(StringLiteral); // Sending node
        // Add semicolon after message header
        this.CONSUME(Semicolon);
        // Signals are optional
        this.MANY(() => {
            this.SUBRULE(this.signal);
        });
    });

    private valueTable = this.RULE("valueTableClause", () => {
        this.CONSUME(VAL_TABLE);
        this.CONSUME(Identifier); // Table name
        this.MANY(() => {
            this.CONSUME(Number);
            this.CONSUME(StringLiteral);
        });
        this.CONSUME(Semicolon);
    });

    private attribute = this.RULE("attributeClause", () => {
        this.CONSUME(BA_DEF);
        this.OPTION(() => {
            this.OR([
                { ALT: () => this.CONSUME(BU) },
                { ALT: () => this.CONSUME(BO) },
                { ALT: () => this.CONSUME(SG) }
            ]);
        });
        this.CONSUME(StringLiteral); // Attribute name
        this.OR1([
            { ALT: () => this.CONSUME(Identifier) }, // Type
            { ALT: () => this.CONSUME1(StringLiteral) } // Enum values
        ]);
        this.OPTION1(() => {
            this.CONSUME1(Number); // Min
            this.CONSUME2(Number); // Max
        });
        this.CONSUME(Semicolon);
    });

    private nsSection = this.RULE("nsSection", () => {
        this.CONSUME(NS);
        this.CONSUME(Colon);
        this.MANY(() => {
            this.OR([
                { ALT: () => this.CONSUME(Identifier) },
                { ALT: () => this.CONSUME(NS) },
                { ALT: () => this.CONSUME(CM) },
                { ALT: () => this.CONSUME(BA_DEF) },
                { ALT: () => this.CONSUME(BA) },
                { ALT: () => this.CONSUME(VAL) },
                { ALT: () => this.CONSUME(CAT_DEF) },
                { ALT: () => this.CONSUME(CAT) },
                { ALT: () => this.CONSUME(FILTER) },
                { ALT: () => this.CONSUME(BA_DEF_DEF) },
                { ALT: () => this.CONSUME(EV_DATA) },
                { ALT: () => this.CONSUME(ENVVAR_DATA) },
                { ALT: () => this.CONSUME(SGTYPE) },
                { ALT: () => this.CONSUME(SGTYPE_VAL) },
                { ALT: () => this.CONSUME(BA_DEF_SGTYPE) },
                { ALT: () => this.CONSUME(BA_SGTYPE) },
                { ALT: () => this.CONSUME(SIG_TYPE_REF) },
                { ALT: () => this.CONSUME(VAL_TABLE) },
                { ALT: () => this.CONSUME(SIG_GROUP) },
                { ALT: () => this.CONSUME(SIG_VALTYPE) },
                { ALT: () => this.CONSUME(SIGTYPE_VALTYPE) },
                { ALT: () => this.CONSUME(BO_TX_BU) },
                { ALT: () => this.CONSUME(BA_DEF_REL) },
                { ALT: () => this.CONSUME(BA_REL) },
                { ALT: () => this.CONSUME(BA_DEF_DEF_REL) },
                { ALT: () => this.CONSUME(BU_SG_REL) },
                { ALT: () => this.CONSUME(BU_EV_REL) },
                { ALT: () => this.CONSUME(BU_BO_REL) },
                { ALT: () => this.CONSUME(SG_MUL_VAL) }
            ]);
        });
        this.CONSUME(Semicolon);
    });

    public dbcFile = this.RULE("dbcFile", () => {
        // Version section
        this.SUBRULE(this.version);
        this.CONSUME(Semicolon);
        
        // NS_ section
        this.SUBRULE(this.nsSection);
        
        // BS_ section
        this.CONSUME(BS);
        this.CONSUME(Colon);
        this.CONSUME(Semicolon);
        
        // BU_ section
        this.CONSUME(BU);
        this.CONSUME(Colon);
        this.MANY(() => {
            this.CONSUME(Identifier);
        });
        this.CONSUME1(Semicolon);
        
        // 剩余部分
        this.MANY1(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.message) },
                { ALT: () => this.SUBRULE(this.valueTable) },
                { ALT: () => this.SUBRULE(this.attribute) }
            ]);
        });
    });
}

export const parser = new DBCParser()
export const productions: Record<string, Rule> = parser.getGAstProductions();

// Create visitor implementation


// Update the parse function
export function parseDBCFile(text: string) {
    // Remove comments and empty lines
    const cleanText = text.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '')
                         .replace(/^\s*\n/gm, '');
    const lexingResult = JsonLexer.tokenize(cleanText);
 
    if (lexingResult.errors.length > 0) {
        throw new Error(`Lexing errors: ${lexingResult.errors[0].message}`);
    }

    parser.input = lexingResult.tokens;

    const cst = parser.dbcFile();
    if (parser.errors.length > 0) {
        const error = parser.errors[0];
        const { line, column } = getLineAndColumn(text, error.token.startOffset);
        throw new Error(`Parsing errors at line ${line}, column ${column}: ${error.message}`);
    }

    return cst;
}

function getLineAndColumn(text: string, offset: number): { line: number; column: number } {
    const lines = text.slice(0, offset).split('\n');
    return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1
    };
}
