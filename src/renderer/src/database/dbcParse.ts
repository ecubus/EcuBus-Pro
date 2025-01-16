import { CstChildrenDictionary, CstNode, CstParser, IToken, Lexer, createToken } from "chevrotain";
import { DBC, parseDBCFile, parser } from "./dbc/parse";
import { DBCVisitor } from "./dbc/dbcVisitor";


// Update the parse function
export default function parse(text: string): DBC {
    const cst=parseDBCFile(text);

    const visitor = new DBCVisitor();
    return visitor.visit(cst);
}
