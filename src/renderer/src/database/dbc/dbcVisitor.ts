import { parser } from './parse';
import type { ICstNodeVisitor, DbcFileCstChildren, VersionClauseCstChildren, 
  BusConfigClauseCstChildren, NodesClauseCstChildren, MessageClauseCstChildren, 
  SignalClauseCstChildren, ValueTableClauseCstChildren, AttributeClauseCstChildren } from './dbc_cst';
import type { DBC, Signal, Message, ValueTable, Attribute } from './parse';
const visitor = parser.getBaseCstVisitorConstructorWithDefaults();
export class DBCVisitor extends visitor {
  constructor() {
    super();
    this.validateVisitor();
  }

  validateVisitor() {
    parser.getGAstProductions();
  }

  dbcFile(ctx: DbcFileCstChildren): DBC {
    const result: DBC = {
      nodes: [],
      messages: {},
      valueTables: {},
      attributes: {},
      comments: {}
    };

    if (ctx.versionClause) {
      result.version = this.versionClause(ctx.versionClause[0].children);
    }

    if (ctx.busConfigClause) {
      result.busConfig = this.busConfigClause(ctx.busConfigClause[0].children);
    }

    if (ctx.nodesClause) {
      result.nodes = this.nodesClause(ctx.nodesClause[0].children);
    }

    ctx.messageClause?.forEach(msg => {
      const message = this.messageClause(msg.children);
      result.messages[message.id] = message;
    });

    ctx.valueTableClause?.forEach(vt => {
      const valueTable = this.valueTableClause(vt.children);
      result.valueTables[valueTable.name] = valueTable;
    });

    return result;
  }

  versionClause(ctx: VersionClauseCstChildren): string {
    return ctx.StringLiteral[0].image.slice(1, -1); // Remove quotes
  }

  busConfigClause(ctx: BusConfigClauseCstChildren): { speed: number } {
    return { speed: Number(ctx.Number[0].image) };
  }

  nodesClause(ctx: NodesClauseCstChildren): string[] {
    return ctx.Identifier?.map(token => token.image) || [];
  }

  signalClause(ctx: SignalClauseCstChildren): Signal {
    const signal: Signal = {
      name: ctx.Identifier[0].image,
      startBit: Number(ctx.Number[0].image),
      length: Number(ctx.Number[1].image),
      isLittleEndian: Number(ctx.Number[2].image) === 1,
      isSigned: Number(ctx.Number[3].image) === 1,
      factor: Number(ctx.Number[4].image),
      offset: Number(ctx.Number[5].image),
      minimum: Number(ctx.Number[6].image),
      maximum: Number(ctx.Number[7].image),
      unit: ctx.StringLiteral[0].image.slice(1, -1),
      receivers: ctx.Identifier.slice(1).map(id => id.image)
    };
    return signal;
  }

  messageClause(ctx: MessageClauseCstChildren): Message {
    const message: Message = {
      id: Number(ctx.Number[0].image),
      name: ctx.Identifier[0].image,
      length: Number(ctx.Number[1].image),
      sender: ctx.StringLiteral[0].image.slice(1, -1),
      signals: {}
    };

    ctx.signalClause?.forEach(sig => {
      const signal = this.signalClause(sig.children);
      message.signals[signal.name] = signal;
    });

    return message;
  }

  valueTableClause(ctx: ValueTableClauseCstChildren): ValueTable {
    const values: Record<number, string> = {};
    const numbers = ctx.Number || [];
    const strings = ctx.StringLiteral || [];
    
    for (let i = 0; i < numbers.length; i++) {
      values[Number(numbers[i].image)] = strings[i].image.slice(1, -1);
    }

    return {
      name: ctx.Identifier[0].image,
      values
    };
  }

  attributeClause(ctx: AttributeClauseCstChildren): Attribute {
    return {
      name: ctx.StringLiteral[0].image.slice(1, -1),
      type: ctx.Identifier ? 'ENUM' : 'STRING',
      definition: null,
      defaultValue: null
    };
  }
}


