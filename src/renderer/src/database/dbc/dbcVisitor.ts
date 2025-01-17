import { CstNode, IToken } from "chevrotain";
import { parser } from "./parse";
import {
    DbcFileCstNode,
    VersionClauseCstNode,
    BusConfigClauseCstNode,
    NodesClauseCstNode,
    MessageClauseCstNode,
    SignalClauseCstNode,
    ValueTableClauseCstNode,
    AttributeClauseCstNode,
    AttributeDefaultClauseCstNode,
    AttributeAssignmentClauseCstNode,
    MultiplexedValueClauseCstNode,
    ValueDefinitionClauseCstNode,
    CommentClauseCstNode,
    NsSectionCstNode,
    DbcFileCstChildren,
    VersionClauseCstChildren,
    BusConfigClauseCstChildren
} from "./dbc_cst";

export interface DBC {
    version?: string;
    busConfig?: BusConfig;
    nodes: string[];
    messages: Record<number, Message>;
    valueTables: Record<string, ValueTable>;
    attributes: Record<string, Attribute>;
    comments: Record<string, string>;
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

export class DBCVisitor extends parser.getBaseCstVisitorConstructor() {
    constructor() {
        super();
        this.validateVisitor();
    }

    dbcFile(ctx: DbcFileCstChildren): DBC {
        const dbc: DBC = {
            nodes: [],
            messages: {},
            valueTables: {},
            attributes: {},
            comments: {}
        };
      
        if (ctx.versionClause) {
            dbc.version = this.visit(ctx.versionClause);
        }
        if (ctx.busConfigClause) {
            dbc.busConfig = this.visit(ctx.busConfigClause);
        }
        if (ctx.nodesClause) {
            dbc.nodes = this.visit(ctx.nodesClause);
        }
        if (ctx.messageClause) {
            ctx.messageClause.forEach((messageNode: MessageClauseCstNode) => {
                const message = this.visit(messageNode);
                dbc.messages[message.id] = message;
            });
        }
        if (ctx.valueTableClause) {
            ctx.valueTableClause.forEach((valueTableNode: ValueTableClauseCstNode) => {
                const valueTable = this.visit(valueTableNode);
                dbc.valueTables[valueTable.name] = valueTable;
            });
        }
        if (ctx.attributeClause) {
            ctx.attributeClause.forEach((attributeNode: AttributeClauseCstNode) => {
                const attribute = this.visit(attributeNode);
                dbc.attributes[attribute.name] = attribute;
            });
        }
        if (ctx.commentClause) {
            ctx.commentClause.forEach((commentNode: CommentClauseCstNode) => {
                const comment = this.visit(commentNode);
                dbc.comments[comment.id] = comment.text;
            });
        }
        return dbc;
    }

    versionClause(ctx: VersionClauseCstChildren): string {
        console.log('mmm',ctx)
        return ctx.StringLiteral[0].image;
    }

    busConfigClause(ctx: BusConfigClauseCstChildren): BusConfig {
        return {
            speed: ctx. ? parseInt(ctx.children.Number[0].image, 10) : 0
        };
    }

    nodesClause(ctx: NodesClauseCstNode): string[] {
        return ctx.children.Identifier.map((idToken: IToken) => idToken.image);
    }

    messageClause(ctx: MessageClauseCstNode): Message {
        const message: Message = {
            id: parseInt(ctx.children.Number[0].image, 10),
            name: ctx.children.Identifier[0].image,
            length: parseInt(ctx.children.Number[1].image, 10),
            sender: ctx.children.Identifier[1].image,
            signals: {}
        };

        if (ctx.children.signalClause) {
            ctx.children.signalClause.forEach((signalNode: SignalClauseCstNode) => {
                const signal = this.visit(signalNode);
                message.signals[signal.name] = signal;
            });
        }
        return message;
    }

    signalClause(ctx: SignalClauseCstNode): Signal {
        const signal: Signal = {
            name: ctx.children.Identifier[0].image,
            startBit: parseInt(ctx.children.Number[0].image, 10),
            length: parseInt(ctx.children.Number[1].image, 10),
            isLittleEndian: ctx.children.Number[2].image === '1',
            isSigned: ctx.children.Plus ? false : true,
            factor: parseFloat(ctx.children.Number[3].image),
            offset: parseFloat(ctx.children.Number[4].image),
            minimum: parseFloat(ctx.children.Number[5].image),
            maximum: parseFloat(ctx.children.Number[6].image),
            receivers: ctx.children.Identifier.slice(1).map((idToken: IToken) => idToken.image)
        };

        if (ctx.children.StringLiteral) {
            signal.unit = ctx.children.StringLiteral[0].image;
        }
        return signal;
    }

    valueTableClause(ctx: ValueTableClauseCstNode): ValueTable {
        const valueTable: ValueTable = {
            name: ctx.children.Identifier[0].image,
            values: {}
        };

        for (let i = 0; i < ctx.children.Number.length; i++) {
            const value = parseInt(ctx.children.Number[i].image, 10);
            const description = ctx.children.StringLiteral[i].image;
            valueTable.values[value] = description;
        }
        return valueTable;
    }

    attributeClause(ctx: AttributeClauseCstNode): Attribute {
        const attribute: Attribute = {
            name: ctx.children.StringLiteral[0].image,
            type: ctx.children.ENUM ? 'ENUM' : ctx.children.INT ? 'INT' : ctx.children.Identifier[0].image,
            definition: ctx.children.ENUM ? ctx.children.StringLiteral.slice(1).map((token: IToken) => token.image) : {
                min: parseInt(ctx.children.Number[0].image, 10),
                max: parseInt(ctx.children.Number[1].image, 10)
            },
            defaultValue: ctx.children.Identifier ? ctx.children.Identifier[0].image : ctx.children.Number ? parseInt(ctx.children.Number[0].image, 10) : undefined
        };
        return attribute;
    }

    commentClause(ctx: CommentClauseCstNode): { id: string, text: string } {
        const id = ctx.children.SG ? `SG_${ctx.children.Number[0].image}_${ctx.children.Identifier[0].image}` :
                  ctx.children.BO ? `BO_${ctx.children.Number[0].image}` :
                  `BU_${ctx.children.Identifier[0].image}`;
        const text = ctx.children.StringLiteral[0].image;
        return { id, text };
    }

    attributeDefaultClause(ctx: AttributeDefaultClauseCstNode): Attribute {
        const attribute: Attribute = {
            name: ctx.children.StringLiteral[0].image,
            type: 'DEFAULT',
            definition: null,
            defaultValue: ctx.children.Identifier ? ctx.children.Identifier[0].image : ctx.children.Number ? parseInt(ctx.children.Number[0].image, 10) : undefined
        };
        return attribute;
    }

    attributeAssignmentClause(ctx: AttributeAssignmentClauseCstNode): Attribute {
        const attribute: Attribute = {
            name: ctx.children.StringLiteral[0].image,
            type: 'ASSIGNMENT',
            definition: null,
            defaultValue: ctx.children.Identifier ? ctx.children.Identifier[0].image : ctx.children.Number ? parseInt(ctx.children.Number[0].image, 10) : undefined
        };
        return attribute;
    }

    multiplexedValueClause(ctx: MultiplexedValueClauseCstNode): any {
        return {
            messageId: parseInt(ctx.children.Number[0].image, 10),
            signalName: ctx.children.Identifier[0].image,
            value: parseInt(ctx.children.Number[1].image, 10)
        };
    }

    valueDefinitionClause(ctx: ValueDefinitionClauseCstNode): any {
        const values: Record<number, string> = {};
        for (let i = 0; i < ctx.children.Number.length; i++) {
            const value = parseInt(ctx.children.Number[i].image, 10);
            const description = ctx.children.StringLiteral[i].image;
            values[value] = description;
        }
        return {
            canId: parseInt(ctx.children.Number[0].image, 10),
            signalName: ctx.children.Identifier[0].image,
            values
        };
    }

    nsSection(ctx: NsSectionCstNode): void {
        // 处理 nsSection 的逻辑
        // 由于 nsSection 主要是描述符号表，不需要返回特定值
        // 可以在这里添加任何需要的处理逻辑
    }
}


