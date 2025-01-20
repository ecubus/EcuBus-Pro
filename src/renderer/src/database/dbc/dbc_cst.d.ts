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

export interface EnumTypeCstNode extends CstNode {
  name: "enumType";
  children: EnumTypeCstChildren;
}

export type EnumTypeCstChildren = {
  ENUM: IToken[];
  StringLiteral: IToken[];
  Comma?: IToken[];
};

export interface IntTypeCstNode extends CstNode {
  name: "intType";
  children: IntTypeCstChildren;
}

export type IntTypeCstChildren = {
  INT: IToken[];
  Number: (IToken)[];
};

export interface HexTypeCstNode extends CstNode {
  name: "hexType";
  children: HexTypeCstChildren;
}

export type HexTypeCstChildren = {
  HEX: IToken[];
  Number: (IToken)[];
};

export interface OtherTypeCstNode extends CstNode {
  name: "otherType";
  children: OtherTypeCstChildren;
}

export type OtherTypeCstChildren = {
  Identifier: IToken[];
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
  EV?: IToken[];
  StringLiteral: IToken[];
  enumType?: EnumTypeCstNode[];
  intType?: IntTypeCstNode[];
  hexType?: HexTypeCstNode[];
  otherType?: OtherTypeCstNode[];
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

export interface GlobalAttributeAssignmentCstNode extends CstNode {
  name: "globalAttributeAssignment";
  children: GlobalAttributeAssignmentCstChildren;
}

export type GlobalAttributeAssignmentCstChildren = {
  StringLiteral?: IToken[];
  Number?: IToken[];
};

export interface NodeAttributeAssignmentCstNode extends CstNode {
  name: "nodeAttributeAssignment";
  children: NodeAttributeAssignmentCstChildren;
}

export type NodeAttributeAssignmentCstChildren = {
  BU: IToken[];
  Identifier: IToken[];
  StringLiteral?: IToken[];
  Number?: IToken[];
};

export interface MessageAttributeAssignmentCstNode extends CstNode {
  name: "messageAttributeAssignment";
  children: MessageAttributeAssignmentCstChildren;
}

export type MessageAttributeAssignmentCstChildren = {
  BO: IToken[];
  Number: (IToken)[];
  StringLiteral?: IToken[];
};

export interface SignalAttributeAssignmentCstNode extends CstNode {
  name: "signalAttributeAssignment";
  children: SignalAttributeAssignmentCstChildren;
}

export type SignalAttributeAssignmentCstChildren = {
  SG: IToken[];
  Number: (IToken)[];
  Identifier: IToken[];
  StringLiteral?: IToken[];
};

export interface AttributeAssignmentClauseCstNode extends CstNode {
  name: "attributeAssignmentClause";
  children: AttributeAssignmentClauseCstChildren;
}

export type AttributeAssignmentClauseCstChildren = {
  BA: IToken[];
  StringLiteral: IToken[];
  globalAttributeAssignment?: GlobalAttributeAssignmentCstNode[];
  nodeAttributeAssignment?: NodeAttributeAssignmentCstNode[];
  messageAttributeAssignment?: MessageAttributeAssignmentCstNode[];
  signalAttributeAssignment?: SignalAttributeAssignmentCstNode[];
  Semicolon?: IToken[];
};

export interface MultiplexedValueClauseCstNode extends CstNode {
  name: "multiplexedValueClause";
  children: MultiplexedValueClauseCstChildren;
}

export type MultiplexedValueClauseCstChildren = {
  SG_MUL_VAL: IToken[];
  Number: IToken[];
  Identifier: (IToken)[];
  RangeList: IToken[];
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
  enumType(children: EnumTypeCstChildren, param?: IN): OUT;
  intType(children: IntTypeCstChildren, param?: IN): OUT;
  hexType(children: HexTypeCstChildren, param?: IN): OUT;
  otherType(children: OtherTypeCstChildren, param?: IN): OUT;
  attributeClause(children: AttributeClauseCstChildren, param?: IN): OUT;
  attributeDefaultClause(children: AttributeDefaultClauseCstChildren, param?: IN): OUT;
  globalAttributeAssignment(children: GlobalAttributeAssignmentCstChildren, param?: IN): OUT;
  nodeAttributeAssignment(children: NodeAttributeAssignmentCstChildren, param?: IN): OUT;
  messageAttributeAssignment(children: MessageAttributeAssignmentCstChildren, param?: IN): OUT;
  signalAttributeAssignment(children: SignalAttributeAssignmentCstChildren, param?: IN): OUT;
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
