import IDL_GrammarLexer from './IDL_GrammarLexer'
import IDL_GrammarParser from './IDL_GrammarParser'
import IDL_GrammarListener from './IDL_GrammarListener'

export default function parse(content) {
    const lexer = new IDL_GrammarLexer(content)
    const tokens = new antlr4.CommonTokenStream(lexer)
    const parser = new IDL_GrammarParser(tokens)
    const listener = new IDL_GrammarListener()
    parser.addParseListener(listener)
    parser.parse()
    return listener.result
}
