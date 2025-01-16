import type { CstNode, ICstVisitor, IToken } from "chevrotain";

export interface VersionClauseCstNode extends CstNode {
  name: "versionClause";
  children: VersionClauseCstChildren;
}

export type VersionClauseCstChildren = {
  Version: IToken[];
  StringLiteral: IToken[];
  Semicolon: IToken[];
};

export interface BusConfigClauseCstNode extends CstNode {
  name: "busConfigClause";
  children: BusConfigClauseCstChildren;
}

export type BusConfigClauseCstChildren = {
  BS: IToken[];
  Colon: IToken[];
  Number: IToken[];
  Semicolon: IToken[];
};

export interface NodesClauseCstNode extends CstNode {
  name: "nodesClause";
  children: NodesClauseCstChildren;
}

export type NodesClauseCstChildren = {
  BU: IToken[];
  Identifier?: IToken[];
  Semicolon: IToken[];
};

export interface SignalClauseCstNode extends CstNode {
  name: "signalClause";
  children: SignalClauseCstChildren;
}

export type SignalClauseCstChildren = {
  SG: IToken[];
  Identifier: (IToken)[];
  StringLiteral: (IToken)[];
  Number: (IToken)[];
  Colon: IToken[];
  Pipe: (IToken)[];
  At: IToken[];
  OpenParen: IToken[];
  Comma: (IToken)[];
  CloseParen: IToken[];
  OpenBracket: IToken[];
  CloseBracket: IToken[];
  Semicolon: IToken[];
};

export interface MessageClauseCstNode extends CstNode {
  name: "messageClause";
  children: MessageClauseCstChildren;
}

export type MessageClauseCstChildren = {
  BO: IToken[];
  Number: (IToken)[];
  Identifier: IToken[];
  Colon: IToken[];
  StringLiteral: IToken[];
  signalClause?: SignalClauseCstNode[];
};

export interface ValueTableClauseCstNode extends CstNode {
  name: "valueTableClause";
  children: ValueTableClauseCstChildren;
}

export type ValueTableClauseCstChildren = {
  VAL_TABLE: IToken[];
  Identifier: IToken[];
  Number?: IToken[];
  StringLiteral?: IToken[];
  Semicolon: IToken[];
};

export interface AttributeClauseCstNode extends CstNode {
  name: "attributeClause";
  children: AttributeClauseCstChildren;
}

export type AttributeClauseCstChildren = {
  BA_DEF: IToken[];
  BU?: IToken[];
  BO?: IToken[];
  SG?: IToken[];
  StringLiteral: (IToken)[];
  Identifier?: IToken[];
  Number?: (IToken)[];
  Semicolon: IToken[];
};

export interface DbcFileCstNode extends CstNode {
  name: "dbcFile";
  children: DbcFileCstChildren;
}

export type DbcFileCstChildren = {
  versionClause?: VersionClauseCstNode[];
  busConfigClause?: BusConfigClauseCstNode[];
  nodesClause?: NodesClauseCstNode[];
  messageClause?: MessageClauseCstNode[];
  valueTableClause?: ValueTableClauseCstNode[];
  attributeClause?: AttributeClauseCstNode[];
};

export interface ICstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  versionClause(children: VersionClauseCstChildren, param?: IN): OUT;
  busConfigClause(children: BusConfigClauseCstChildren, param?: IN): OUT;
  nodesClause(children: NodesClauseCstChildren, param?: IN): OUT;
  signalClause(children: SignalClauseCstChildren, param?: IN): OUT;
  messageClause(children: MessageClauseCstChildren, param?: IN): OUT;
  valueTableClause(children: ValueTableClauseCstChildren, param?: IN): OUT;
  attributeClause(children: AttributeClauseCstChildren, param?: IN): OUT;
  dbcFile(children: DbcFileCstChildren, param?: IN): OUT;
}
