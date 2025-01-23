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
    BusConfigClauseCstChildren,
    NsSectionCstChildren,
    SignalClauseCstChildren,
    MessageClauseCstChildren,
    IdentifierOrStringCstChildren,
    SgReceiverCstChildren,
    CommentClauseCstChildren,
    SignalCommentCstChildren,
    MessageCommentCstChildren,
    NodeCommentCstChildren,
    NodesClauseCstChildren,
    ValueDefinitionClauseCstChildren,
    ValueTableClauseCstChildren,
    IntTypeCstChildren,
    HexTypeCstChildren,
    EnumTypeCstChildren,
    OtherTypeCstChildren,
    AttributeClauseCstChildren,
    AttributeDefaultClauseCstChildren,
    AttributeAssignmentClauseCstChildren,
    GlobalAttributeAssignmentCstChildren,
    NodeAttributeAssignmentCstChildren,
    MessageAttributeAssignmentCstChildren,
    SignalAttributeAssignmentCstChildren,
    MultiplexedValueClauseCstChildren
} from "./dbc_cst";
import { cloneDeep } from "lodash";

export interface NodeItem{
    name:string
    comment?:string
    attributes: Record<string, Attribute>;
}

export interface DBC {
    name:string
    version?: string;
    busConfig?: BusConfig;
    nodes: Record<string, NodeItem>; 
    messages: Record<number, Message>;
    valueTables: Record<string, ValueTable>;
    attributes: Record<string, Attribute>;
    comments: string[] // global comment
}

export interface BusConfig {
    speed: number;  // in kBit/s
}

export interface Signal {
    name: string;
    messageName:string;
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
    valueTable?: string;
    values?:{label:string,value:number}[];
    attributes: Record<string, Attribute>;
    multiplexerIndicator?: string;  // M for multiplexer, m<value> for multiplexed
    multiplexerRange?: {
        name: string;
        range:number[]
    }; 
}

export interface Message {
    id: number;
    name: string;
    length: number;
    sender: string;
    signals: Record<string, Signal>;
    comment?: string;
    attributes: Record<string, Attribute>;
    transmitters?: string[];
    receivers?: string[];
}

export interface ValueTable {
    name: string;
    comment?: string;
    values: {label:string,value:number}[]
}

export interface Attribute {
    name: string;
    attrType:'network'|'node'|'message'|'signal'|'envVar';
    type: 'INT' | 'FLOAT' | 'STRING' | 'ENUM' | 'HEX';
    min?: number;
    max?: number;
    enumList?: string[];
    defaultValue?: number | string;
    currentValue?: number | string;
}

export class DBCVisitor extends parser.getBaseCstVisitorConstructor() {
    constructor() {
        super();
        this.validateVisitor();
    }
    intType(ctx:IntTypeCstChildren){
        return {
            min:parseInt(ctx.Number[0].image, 10),
            max:parseInt(ctx.Number[1].image, 10)
        }
    }
    hexType(ctx: HexTypeCstChildren){
        return {
            min:Number(ctx.Number[0].image),
            max:Number(ctx.Number[1].image)
        }
    }
    enumType(ctx:EnumTypeCstChildren){
        return ctx.StringLiteral.map((token: IToken) => token.image.replace(/"/g, ''))
    }
    otherType(ctx:OtherTypeCstChildren){
        return ctx.Identifier[0].image
    }
    dbcFile(ctx: DbcFileCstChildren): DBC {
        const dbc: DBC = {
            name:'',
            nodes: {},
            messages: {},
            valueTables: {},
            attributes: {},
            comments: [],
           
        };
        
        if(ctx.nsSection){
            this.visit(ctx.nsSection)
        }
        if (ctx.versionClause) {
            dbc.version = this.visit(ctx.versionClause);
        }
        if (ctx.nodesClause) {
            dbc.nodes = this.visit(ctx.nodesClause);
        }
        if (ctx.valueTableClause) {
            ctx.valueTableClause.forEach((valueTableNode: ValueTableClauseCstNode) => {
                const valueTable = this.visit(valueTableNode);
                dbc.valueTables[valueTable.name] = valueTable;
            });
        }
        if (ctx.messageClause) {
            ctx.messageClause.forEach((messageNode: MessageClauseCstNode) => {
                const message = this.visit(messageNode);
                dbc.messages[message.id] = message;
            });
        }

        if (ctx.attributeClause) {
            ctx.attributeClause.forEach((attributeNode: AttributeClauseCstNode) => {
                const attribute = this.visit(attributeNode);
                dbc.attributes[attribute.name] = attribute;
            });
        }
        if(ctx.attributeDefaultClause){
            ctx.attributeDefaultClause.forEach((attributeDefaultNode:AttributeDefaultClauseCstNode)=>{
                const attribute=this.visit(attributeDefaultNode)
                const attr=dbc.attributes[attribute.name]
                if(attr){
                    attr.defaultValue=attribute.value
                }
            })
        }
        if(ctx.attributeAssignmentClause){
            ctx.attributeAssignmentClause.forEach((attributeAssignmentNode:AttributeAssignmentClauseCstNode)=>{
                const attribute=this.visit(attributeAssignmentNode)
                if(attribute.type=='global'){
                 
                    dbc.attributes[attribute.name].currentValue=attribute.value
                }else if(attribute.type=='node'){
                    const node=dbc.nodes[attribute.value.nodeName]
                    if(node){
                        const clone=cloneDeep(dbc.attributes[attribute.name])
                        clone.currentValue=attribute.value.value
                        node.attributes[attribute.name]=clone
                      
                    }
                }else if(attribute.type=='message'){
                    const message=dbc.messages[attribute.value.id]
                    if(message){
                        const clone=cloneDeep(dbc.attributes[attribute.name])
                        clone.currentValue=attribute.value.value
                        message.attributes[attribute.name]=clone
                        
                    }
                }else if(attribute.type=='signal'){
                    const message=dbc.messages[attribute.value.id]
                    if(message){
                        const signal=message.signals[attribute.value.signalName]
                        if(signal){
                            const clone=cloneDeep(dbc.attributes[attribute.name])
                            clone.currentValue=attribute.value.value
                            signal.attributes[attribute.name]=clone
                            
                        }
                    }
                }
            })
        }
        if (ctx.commentClause) {
            ctx.commentClause.forEach((commentNode: CommentClauseCstNode) => {
                const comment = this.visit(commentNode);
                if(comment){
                    if(comment.type=='global'){
                        dbc.comments.push(comment.comment);
                    }else if(comment.type=='signal'){
                        const message=dbc.messages[comment.signal.id]
                        if(message){
                            const signal=message.signals[comment.signal.signalName]
                            if(signal){
                                signal.comment=comment.comment
                            }
                        }
                    }else if(comment.type=='message'){
                        const message=dbc.messages[comment.message.id]
                        if(message){
                            message.comment=comment.comment
                        }
                    }else if(comment.type=='node'){
                        const node=dbc.nodes[comment.node.node]
                        if(node){
                            node.comment=comment.comment
                        }
                    }

                }
            });
        }
        if(ctx.valueDefinitionClause){
            ctx.valueDefinitionClause.forEach((valueDefinitionNode:ValueDefinitionClauseCstNode)=>{
                const valueDefinition=this.visit(valueDefinitionNode)
                const message=dbc.messages[valueDefinition.canId]
                if(message){
                    const signal=message.signals[valueDefinition.signalName]
                    if(signal){
                        signal.values=valueDefinition.values.map((v:any)=>({label:v.label,value:v.value}))
                    }
                }
            })
        }
        if(ctx.multiplexedValueClause){
            ctx.multiplexedValueClause.forEach((multiplexedValueNode:MultiplexedValueClauseCstNode)=>{
                const multiplexedValue=this.visit(multiplexedValueNode)
                
                const message=dbc.messages[multiplexedValue.messageId]
                if(message){
                    const signal=message.signals[multiplexedValue.signalName[0]]
                    if(signal){
                       signal.multiplexerRange={
                            name:multiplexedValue.signalName[1],
                            range:multiplexedValue.value
                          }
                    }
                }
            })
        }
      
        return dbc;
    }

    versionClause(ctx: VersionClauseCstChildren): string {
        return ctx.StringLiteral[0].image?.replace(/"/g, '') || '';
    }

    busConfigClause(ctx: BusConfigClauseCstChildren): BusConfig {
        // return {
        //     speed: ctx. ? parseInt(ctx.children.Number[0].image, 10) : 0
        // };
        return {} as any
    }

    nodesClause(ctx: NodesClauseCstChildren): Record<string, NodeItem> {
        const nodes: Record<string, NodeItem> = {};
        if(ctx.Identifier){
            for (let i = 0; i < ctx.Identifier.length; i++) {
                const node = ctx.Identifier[i].image;
                nodes[node] = {
                    name: node,
                    attributes: { }
                };
            }
        }
        return nodes;
    }
    identifierOrString(ctx: IdentifierOrStringCstChildren): string {
        return ctx.Identifier ? ctx.Identifier[0].image : ctx.StringLiteral?ctx.StringLiteral[0].image.replace(/"/g, ''):'';
    }
    sgReceiver(ctx: SgReceiverCstChildren): string {
        return ctx.Identifier ? ctx.Identifier[0].image : ctx.StringLiteral?ctx.StringLiteral[0].image.replace(/"/g, ''):'';
    }
    messageClause(ctx: MessageClauseCstChildren): Message {
       
        const message: Message = {
            id: parseInt(ctx.Number[0].image, 10),
            name: this.visit(ctx.identifierOrString[0]),
            length: parseInt(ctx.Number[1].image, 10),
            sender: this.visit(ctx.identifierOrString[1]),
            signals: {},
            attributes: { }
        };

        if (ctx.signalClause) {
            ctx.signalClause.forEach((signalNode: SignalClauseCstNode) => {
                const signal = this.visit(signalNode);
                signal.messageName=message.name
                message.signals[signal.name] = signal;
            });
        }
        return message
    }

    signalClause(ctx: SignalClauseCstChildren): Signal {
        const signal: Signal = {
            messageName:'',
            name: ctx.Identifier[0].image,
            startBit: parseInt(ctx.Number[0].image, 10),
            length: parseInt(ctx.Number[1].image, 10),
            isLittleEndian: ctx.Number[2].image === '1',
            isSigned: ctx.Plus ? false : true,
            factor: parseFloat(ctx.Number[3].image),
            offset: parseFloat(ctx.Number[4].image),
            attributes: { },
            receivers: [],
            unit:ctx.identifierOrString?this.visit(ctx.identifierOrString[0]):undefined,
            
        };
        if(ctx.Identifier[1]){
            signal.multiplexerIndicator=ctx.Identifier[1] ? ctx.Identifier[1].image : undefined
            //multiplexerIndicator must like this: [M|m<M-ID>]
            // if(signal.multiplexerIndicator){
            //     const reg=/(M$|m\d+$)/
            //     if(!reg.test(signal.multiplexerIndicator)){
            //         // throw new Error('multiplexerIndicator must like this: [M|m<M-ID>]')
            //         const line=ctx.Identifier[1].startLine
            //         const column=ctx.Identifier[1].startColumn
            //         const message=`multiplexerIndicator must like this: [M|m<M-ID>]`
            //         throw new Error(`Parser error at line ${line}, column ${column}: ${message}`)
            //     }
            // }
        }
        if(ctx.Number[5]){
            signal.minimum=parseFloat(ctx.Number[5].image)
        }
        if(ctx.Number[6]){
            signal.maximum=parseFloat(ctx.Number[6].image)
        }
        if (ctx.sgReceiver) {
            ctx.sgReceiver.forEach((receiverNode) => {
                signal.receivers.push(this.visit(receiverNode));
            });
        }
        return signal;
       
    }

    valueTableClause(ctx: ValueTableClauseCstChildren): ValueTable {
        const valueTable: ValueTable = {
            name: ctx.Identifier[0].image,
            values: []
        };

        if(ctx.Number&&ctx.StringLiteral){
            for(let i=0;i<ctx.Number.length;i++){
                valueTable.values.push({
                    label:ctx.StringLiteral[i].image.replace(/"/g, ''),
                    value:parseInt(ctx.Number[i].image, 10)
                })
            }
        }
        

       
        return valueTable
    }

    attributeClause(ctx: AttributeClauseCstChildren):Attribute {
        const attrs:Attribute={
            name:ctx.StringLiteral[0].image.replace(/"/g, ''),
            attrType:'network',
            type:'INT',
        }
        if(ctx.BO){
            attrs.attrType='message'
        }else if(ctx.BU){
            attrs.attrType='node'
        }else if(ctx.SG){
            attrs.attrType='signal'
        }else if(ctx.EV){
            attrs.attrType='envVar'
        }
        if(ctx.enumType){
            attrs.type='ENUM'
            attrs.enumList=this.visit(ctx.enumType)
        }else if(ctx.hexType){
            attrs.type='HEX'
            attrs.min=this.visit(ctx.hexType).min
            attrs.max=this.visit(ctx.hexType).max
        }else if(ctx.intType){
            attrs.type='INT'
            attrs.min=this.visit(ctx.intType).min
            attrs.max=this.visit(ctx.intType).max
        }else if(ctx.otherType){
            //null, STRING
            attrs.type='STRING'
        }
        
        return attrs
    }
    signalComment(ctx: SignalCommentCstChildren): {
        id:number,
        signalName:string
    } {
        return {
            id:parseInt(ctx.Number[0].image, 10),
            signalName:ctx.Identifier[0].image
        }
    }
    messageComment(ctx: MessageCommentCstChildren): {
        id:number
    } {
        return {
            id:parseInt(ctx.Number[0].image, 10)
        }
    }
    nodeComment(ctx: NodeCommentCstChildren): {
        node:string
    } {
        return {
            node:ctx.Identifier[0].image
        }
    }
    commentClause(ctx: CommentClauseCstChildren){
        // const id = ctx.children.SG ? `SG_${ctx.children.Number[0].image}_${ctx.children.Identifier[0].image}` :
        //           ctx.children.BO ? `BO_${ctx.children.Number[0].image}` :
        //           `BU_${ctx.children.Identifier[0].image}`;
        // const text = ctx.children.StringLiteral[0].image;
        // return { id, text };
        const comment=ctx.StringLiteral[0].image.replace(/"/g, '')
        const c:{
            type:'global'|'signal'|'message'|'node',
            comment:string,
            signal?:{
                id:number,
                signalName:string
            },
            message?:{
                id:number
            },
            node?:{
                node:string
            }
        }={
            type:'global',
            comment
        }
       
        if(ctx.signalComment){
            c.type='signal'
            c.signal=this.visit(ctx.signalComment)
        }else if(ctx.messageComment){
            c.type='message'
            c.message=this.visit(ctx.messageComment)
        }else if(ctx.nodeComment){
            c.type='node'
            c.node=this.visit(ctx.nodeComment)
        }
        return c
    }
    globalAttributeAssignment(ctx:GlobalAttributeAssignmentCstChildren){
        return ctx.StringLiteral?ctx.StringLiteral[0].image.replace(/"/g, ''):parseInt(ctx.Number![0].image, 10)
    }
    nodeAttributeAssignment(ctx:NodeAttributeAssignmentCstChildren){
        return {
            nodeName:ctx.Identifier[0].image,
            value:ctx.StringLiteral?ctx.StringLiteral[0].image.replace(/"/g, ''):parseInt(ctx.Number![0].image, 10)
        }
    }
    messageAttributeAssignment(ctx:MessageAttributeAssignmentCstChildren){
        return {
            id:parseInt(ctx.Number[0].image, 10),
            value:ctx.StringLiteral?ctx.StringLiteral[0].image.replace(/"/g, ''):parseInt(ctx.Number[1].image, 10)
        }
    }

    attributeDefaultClause(ctx: AttributeDefaultClauseCstChildren){
        return {
            name:ctx.StringLiteral[0].image.replace(/"/g, ''),
            value:ctx.Number?parseInt(ctx.Number[0].image, 10):ctx.StringLiteral[1].image.replace(/"/g, '')
        }
    }
    signalAttributeAssignment(ctx:SignalAttributeAssignmentCstChildren){
        return {
            id:parseInt(ctx.Number[0].image, 10),
            signalName:ctx.Identifier[0].image,
            value:ctx.StringLiteral?ctx.StringLiteral[0].image.replace(/"/g, ''):parseInt(ctx.Number[1].image, 10)
        }
    }
    attributeAssignmentClause(ctx: AttributeAssignmentClauseCstChildren) {
        const ret={
            name:ctx.StringLiteral[0].image.replace(/"/g, ''),
            type:'global',
            value:''
        }
        
        if(ctx.messageAttributeAssignment){
            //BO_
            ret.type='message'
            ret.value=this.visit(ctx.messageAttributeAssignment)
        }else if(ctx.signalAttributeAssignment){
            //SG_
            ret.type='signal'
            ret.value=this.visit(ctx.signalAttributeAssignment)
        }else if(ctx.nodeAttributeAssignment){
            //BU_
            ret.type='node'
            ret.value=this.visit(ctx.nodeAttributeAssignment)
        }else if(ctx.globalAttributeAssignment){
            //global
            ret.value=this.visit(ctx.globalAttributeAssignment)
        }
        return ret
    }

    multiplexedValueClause(ctx: MultiplexedValueClauseCstChildren) {
        const val:{
            messageId:number,
            signalName:string[],
            value:number[]
        }={
            messageId: parseInt(ctx.Number[0].image, 10),
            signalName: ctx.Identifier.map((token: IToken) => token.image),
            value:[]
        };
        for(const v of ctx.RangeList){
            const s=v.image.split('-')
            const start=parseInt(s[0], 10)
            const end=parseInt(s[1], 10)
            //push start-end to val.value
            if(start==end){
                val.value.push(start)
            }else{
                for(let i=start;i<end;i++){
                    val.value.push(i)
                }
            }
           
           
        }
       
        return val
    }
    
    valueDefinitionClause(ctx: ValueDefinitionClauseCstChildren): {
        canId:number,
        signalName:string,
        values:{label:string,value:number}[]
    } {
        const v:{
            canId:number,
            signalName:string,
            values:{label:string,value:number}[]
        }={
            canId:parseInt(ctx.Number[0].image, 10),
            signalName:ctx.Identifier[0].image,
            values:[]
        }
        
        if(ctx.StringLiteral){
            for(let i=0;i<ctx.StringLiteral.length;i++){
                v.values.push({
                    label:ctx.StringLiteral[i].image.replace(/"/g, ''),
                    value:parseInt(ctx.Number[i+1].image, 10)
                })
            }
        }
        //ok
        return v
    }

    nsSection(ctx: NsSectionCstChildren): void {
        // 处理 nsSection 的逻辑
        // 由于 nsSection 主要是描述符号表，不需要返回特定值
        // 可以在这里添加任何需要的处理逻辑
        // if(ctx.SGTYPE)

    }
}


