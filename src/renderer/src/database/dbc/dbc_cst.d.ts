import type { CstNode, ICstVisitor, IToken } from "chevrotain";

export interface IdentifierOrStringCstNode extends CstNode {
  name: "identifierOrString";
  children: IdentifierOrStringCstChildren;
}

export type IdentifierOrStringCstChildren = {
  Identifier?: IToken[];
  StringLiteral?: IToken[];
};

export interface SgReceiverCstNode extends CstNode {
  name: "sgReceiver";
  children: SgReceiverCstChildren;
}

export type SgReceiverCstChildren = {
  Identifier?: IToken[];
  StringLiteral?: IToken[];
};

export interface VersionClauseCstNode extends CstNode {
  name: "versionClause";
  children: VersionClauseCstChildren;
}

export type VersionClauseCstChildren = {
  Version: IToken[];
  StringLiteral: IToken[];
  Semicolon?: IToken[];
};

export interface BusConfigClauseCstNode extends CstNode {
  name: "busConfigClause";
  children: BusConfigClauseCstChildren;
}

export type BusConfigClauseCstChildren = {
  BS: IToken[];
  Colon: IToken[];
  Semicolon?: IToken[];
};

export interface NodesClauseCstNode extends CstNode {
  name: "nodesClause";
  children: NodesClauseCstChildren;
}

export type NodesClauseCstChildren = {
  BU: IToken[];
  Colon: IToken[];
  Identifier?: IToken[];
  Semicolon?: IToken[];
};

export interface SignalClauseCstNode extends CstNode {
  name: "signalClause";
  children: SignalClauseCstChildren;
}

export type SignalClauseCstChildren = {
  SG: IToken[];
  Identifier: (IToken)[];
  Colon: IToken[];
  Number: (IToken)[];
  Pipe: (IToken)[];
  At: IToken[];
  Plus?: IToken[];
  Minus?: IToken[];
  OpenParen: IToken[];
  Comma: (IToken)[];
  CloseParen: IToken[];
  OpenBracket?: IToken[];
  CloseBracket?: IToken[];
  identifierOrString?: IdentifierOrStringCstNode[];
  sgReceiver: SgReceiverCstNode[];
  Semicolon?: IToken[];
};

export interface MessageClauseCstNode extends CstNode {
  name: "messageClause";
  children: MessageClauseCstChildren;
}

export type MessageClauseCstChildren = {
  BO: IToken[];
  Number: (IToken)[];
  identifierOrString: (IdentifierOrStringCstNode)[];
  Colon: IToken[];
  Semicolon?: IToken[];
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
  Semicolon?: IToken[];
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
  ENUM?: IToken[];
  Comma?: IToken[];
  INT?: IToken[];
  Number?: (IToken)[];
  Identifier?: IToken[];
  Semicolon?: IToken[];
};

export interface AttributeDefaultClauseCstNode extends CstNode {
  name: "attributeDefaultClause";
  children: AttributeDefaultClauseCstChildren;
}

export type AttributeDefaultClauseCstChildren = {
  BA_DEF_DEF: IToken[];
  StringLiteral: (IToken)[];
  Number?: IToken[];
  Identifier?: IToken[];
  Semicolon?: IToken[];
};

export interface AttributeAssignmentClauseCstNode extends CstNode {
  name: "attributeAssignmentClause";
  children: AttributeAssignmentClauseCstChildren;
}

export type AttributeAssignmentClauseCstChildren = {
  BA: IToken[];
  StringLiteral: (IToken)[];
  Number?: (IToken)[];
  BU?: IToken[];
  Identifier?: (IToken)[];
  BO?: IToken[];
  SG?: IToken[];
  Semicolon?: IToken[];
};

export interface MultiplexedValueClauseCstNode extends CstNode {
  name: "multiplexedValueClause";
  children: MultiplexedValueClauseCstChildren;
}

export type MultiplexedValueClauseCstChildren = {
  SG_MUL_VAL: IToken[];
  Number: (IToken)[];
  Identifier: (IToken)[];
  Semicolon?: IToken[];
};

export interface ValueDefinitionClauseCstNode extends CstNode {
  name: "valueDefinitionClause";
  children: ValueDefinitionClauseCstChildren;
}

export type ValueDefinitionClauseCstChildren = {
  VAL: IToken[];
  Number: (IToken)[];
  Identifier: IToken[];
  StringLiteral?: IToken[];
  Semicolon?: IToken[];
};

export interface SignalCommentCstNode extends CstNode {
  name: "signalComment";
  children: SignalCommentCstChildren;
}

export type SignalCommentCstChildren = {
  SG: IToken[];
  Number: IToken[];
  Identifier: IToken[];
};

export interface MessageCommentCstNode extends CstNode {
  name: "messageComment";
  children: MessageCommentCstChildren;
}

export type MessageCommentCstChildren = {
  BO: IToken[];
  Number: IToken[];
};

export interface NodeCommentCstNode extends CstNode {
  name: "nodeComment";
  children: NodeCommentCstChildren;
}

export type NodeCommentCstChildren = {
  BU: IToken[];
  Identifier: IToken[];
};

export interface CommentClauseCstNode extends CstNode {
  name: "commentClause";
  children: CommentClauseCstChildren;
}

export type CommentClauseCstChildren = {
  CM: IToken[];
  signalComment?: SignalCommentCstNode[];
  messageComment?: MessageCommentCstNode[];
  nodeComment?: NodeCommentCstNode[];
  StringLiteral: IToken[];
  Semicolon?: IToken[];
};

export interface NsSectionCstNode extends CstNode {
  name: "nsSection";
  children: NsSectionCstChildren;
}

export type NsSectionCstChildren = {
  NS: IToken[];
  Colon: IToken[];
  NS_DESC?: IToken[];
  CM?: IToken[];
  BA_DEF?: IToken[];
  BA?: IToken[];
  VAL?: IToken[];
  CAT_DEF?: IToken[];
  CAT?: IToken[];
  FILTER?: IToken[];
  BA_DEF_DEF?: IToken[];
  EV_DATA?: IToken[];
  ENVVAR_DATA?: IToken[];
  SGTYPE?: IToken[];
  SGTYPE_VAL?: IToken[];
  BA_DEF_SGTYPE?: IToken[];
  BA_SGTYPE?: IToken[];
  SIG_TYPE_REF?: IToken[];
  VAL_TABLE?: IToken[];
  SIG_GROUP?: IToken[];
  SIG_VALTYPE?: IToken[];
  SIGTYPE_VALTYPE?: IToken[];
  BO_TX_BU?: IToken[];
  BA_DEF_REL?: IToken[];
  BA_REL?: IToken[];
  BA_DEF_DEF_REL?: IToken[];
  BU_SG_REL?: IToken[];
  BU_EV_REL?: IToken[];
  BU_BO_REL?: IToken[];
  SG_MUL_VAL?: IToken[];
};

export interface DbcFileCstNode extends CstNode {
  name: "dbcFile";
  children: DbcFileCstChildren;
}

export type DbcFileCstChildren = {
  versionClause?: VersionClauseCstNode[];
  nsSection: NsSectionCstNode[];
  busConfigClause: BusConfigClauseCstNode[];
  nodesClause: NodesClauseCstNode[];
  messageClause?: MessageClauseCstNode[];
  valueTableClause?: ValueTableClauseCstNode[];
  attributeClause?: AttributeClauseCstNode[];
  attributeDefaultClause?: AttributeDefaultClauseCstNode[];
  attributeAssignmentClause?: AttributeAssignmentClauseCstNode[];
  multiplexedValueClause?: MultiplexedValueClauseCstNode[];
  commentClause?: CommentClauseCstNode[];
  valueDefinitionClause?: ValueDefinitionClauseCstNode[];
};

export interface ICstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  identifierOrString(children: IdentifierOrStringCstChildren, param?: IN): OUT;
  sgReceiver(children: SgReceiverCstChildren, param?: IN): OUT;
  versionClause(children: VersionClauseCstChildren, param?: IN): OUT;
  busConfigClause(children: BusConfigClauseCstChildren, param?: IN): OUT;
  nodesClause(children: NodesClauseCstChildren, param?: IN): OUT;
  signalClause(children: SignalClauseCstChildren, param?: IN): OUT;
  messageClause(children: MessageClauseCstChildren, param?: IN): OUT;
  valueTableClause(children: ValueTableClauseCstChildren, param?: IN): OUT;
  attributeClause(children: AttributeClauseCstChildren, param?: IN): OUT;
  attributeDefaultClause(children: AttributeDefaultClauseCstChildren, param?: IN): OUT;
  attributeAssignmentClause(children: AttributeAssignmentClauseCstChildren, param?: IN): OUT;
  multiplexedValueClause(children: MultiplexedValueClauseCstChildren, param?: IN): OUT;
  valueDefinitionClause(children: ValueDefinitionClauseCstChildren, param?: IN): OUT;
  signalComment(children: SignalCommentCstChildren, param?: IN): OUT;
  messageComment(children: MessageCommentCstChildren, param?: IN): OUT;
  nodeComment(children: NodeCommentCstChildren, param?: IN): OUT;
  commentClause(children: CommentClauseCstChildren, param?: IN): OUT;
  nsSection(children: NsSectionCstChildren, param?: IN): OUT;
  dbcFile(children: DbcFileCstChildren, param?: IN): OUT;
}
