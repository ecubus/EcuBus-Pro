import { createToken, Lexer, IToken } from 'chevrotain'

// ============== Token Definitions ==============

// Whitespace and Comments
export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED
})

export const SingleLineComment = createToken({
  name: 'SingleLineComment',
  pattern: /\/\/.*/,
  group: Lexer.SKIPPED
})

export const MultiLineComment = createToken({
  name: 'MultiLineComment',
  pattern: /\/\*[\s\S]*?\*\//,
  group: Lexer.SKIPPED
})

export const CStyleComment = createToken({
  name: 'CStyleComment',
  pattern: /\/\*.*?\*\//,
  group: Lexer.SKIPPED
})

// C Preprocessor directives
export const PreprocessorDirective = createToken({
  name: 'PreprocessorDirective',
  pattern: /#.*/,
  group: Lexer.SKIPPED
})

// Keywords
export const VERSION = createToken({ name: 'VERSION', pattern: /VERSION/ })
export const KOIL = createToken({ name: 'KOIL', pattern: /KOIL/ })
export const OSSEMANTICS = createToken({ name: 'OSSEMANTICS', pattern: /OSSEMANTICS/ })
export const IMPLEMENTATION = createToken({ name: 'IMPLEMENTATION', pattern: /IMPLEMENTATION/ })
export const OS = createToken({ name: 'OS', pattern: /OS/ })
export const TASK = createToken({ name: 'TASK', pattern: /TASK/ })
export const STACK = createToken({ name: 'STACK', pattern: /STACK/ })
export const ALARM = createToken({ name: 'ALARM', pattern: /ALARM/ })
export const RESOURCE = createToken({ name: 'RESOURCE', pattern: /RESOURCE/ })
export const CTYPE = createToken({ name: 'CTYPE', pattern: /CTYPE/ })
export const ENUM = createToken({ name: 'ENUM', pattern: /ENUM/ })
export const TOTRACE = createToken({ name: 'TOTRACE', pattern: /TOTRACE/ })
export const STRING = createToken({ name: 'STRING', pattern: /STRING/ })
export const SIZE = createToken({ name: 'SIZE', pattern: /SIZE/ })

// Custom ORTI keywords (with vs_ prefix)
export const VS_ISR = createToken({ name: 'VS_ISR', pattern: /vs_ISR/ })
export const VS_CONFIG = createToken({ name: 'VS_CONFIG', pattern: /vs_CONFIG/ })

// Punctuation
export const LeftBrace = createToken({ name: 'LeftBrace', pattern: /{/ })
export const RightBrace = createToken({ name: 'RightBrace', pattern: /}/ })
export const LeftBracket = createToken({ name: 'LeftBracket', pattern: /\[/ })
export const RightBracket = createToken({ name: 'RightBracket', pattern: /]/ })
export const LeftParen = createToken({ name: 'LeftParen', pattern: /\(/ })
export const RightParen = createToken({ name: 'RightParen', pattern: /\)/ })
export const Semicolon = createToken({ name: 'Semicolon', pattern: /;/ })
export const Comma = createToken({ name: 'Comma', pattern: /,/ })
export const Colon = createToken({ name: 'Colon', pattern: /:/ })
export const Equals = createToken({ name: 'Equals', pattern: /=/ })
export const Ampersand = createToken({ name: 'Ampersand', pattern: /&/ })

// Literals
export const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"(?:[^"\\]|\\.)*"/
})

// Quoted hex numbers (like "0x00")
export const QuotedHexNumber = createToken({
  name: 'QuotedHexNumber',
  pattern: /"0[xX][0-9a-fA-F]+"/
})

export const HexNumber = createToken({
  name: 'HexNumber',
  pattern: /0[xX][0-9a-fA-F]+/
})

export const DecimalNumber = createToken({
  name: 'DecimalNumber',
  pattern: /\d+(?:\.\d+)?/
})

// Identifiers (must come after keywords)
export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*/
})

// Array notation
export const ArrayNotation = createToken({
  name: 'ArrayNotation',
  pattern: /\[\]/
})

// All tokens in order of precedence
export const allTokens = [
  ArrayNotation,
  // Whitespace and comments (skipped)
  WhiteSpace,
  SingleLineComment,
  MultiLineComment,
  CStyleComment,
  PreprocessorDirective,

  // Keywords (must come before Identifier)
  VERSION,
  KOIL,
  OSSEMANTICS,
  IMPLEMENTATION,
  OS,
  TASK,
  STACK,
  ALARM,
  RESOURCE,
  CTYPE,
  ENUM,
  TOTRACE,
  STRING,
  SIZE,
  VS_ISR,
  VS_CONFIG,

  // Punctuation
  LeftBrace,
  RightBrace,
  LeftBracket,
  RightBracket,
  LeftParen,
  RightParen,
  Semicolon,
  Comma,
  Colon,
  Equals,
  Ampersand,

  // Literals (QuotedHexNumber must come before StringLiteral)
  QuotedHexNumber,
  StringLiteral,
  HexNumber,
  DecimalNumber,

  // Identifiers (must come after keywords)
  Identifier
]

// Create the lexer
export const ORTILexer = new Lexer(allTokens)

// Export token types for parser use
export type { IToken }
