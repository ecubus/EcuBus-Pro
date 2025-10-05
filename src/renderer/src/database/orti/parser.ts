import { CstParser, IToken, TokenType } from 'chevrotain'
import {
  allTokens,
  VERSION,
  KOIL,
  OSSEMANTICS,
  IMPLEMENTATION,
  CTYPE,
  ENUM,
  TOTRACE,
  STRING,
  SIZE,
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
  StringLiteral,
  QuotedHexNumber,
  HexNumber,
  DecimalNumber,
  Identifier,
  ArrayNotation
} from './lexer'

export class ORTIParser extends CstParser {
  constructor() {
    super(allTokens, {
      recoveryEnabled: true,
      nodeLocationTracking: 'full'
    })
    this.performSelfAnalysis()
  }

  // ============== Main Rules ==============

  public ortiFile = this.RULE('ortiFile', () => {
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.versionSection) },
        { ALT: () => this.SUBRULE(this.implementationSection) },
        { ALT: () => this.SUBRULE(this.informationSection) }
      ])
    })
  })

  // ============== Version Section ==============

  private versionSection = this.RULE('versionSection', () => {
    this.CONSUME(VERSION)
    this.CONSUME(LeftBrace)
    this.MANY(() => {
      this.SUBRULE(this.versionProperty)
    })
    this.CONSUME(RightBrace)
    this.CONSUME(Semicolon)
  })

  private versionProperty = this.RULE('versionProperty', () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(KOIL)
          this.CONSUME(Equals)
          this.SUBRULE(this.stringValue)
          this.CONSUME(Semicolon)
        }
      },
      {
        ALT: () => {
          this.CONSUME(OSSEMANTICS)
          this.CONSUME1(Equals)
          this.SUBRULE1(this.stringValue, { LABEL: 'semanticsType' })
          this.CONSUME(Comma)
          this.SUBRULE2(this.stringValue, { LABEL: 'semanticsVersion' })
          this.CONSUME1(Semicolon)
        }
      }
    ])
  })

  // ============== Implementation Section ==============

  private implementationSection = this.RULE('implementationSection', () => {
    this.CONSUME(IMPLEMENTATION)
    this.CONSUME(Identifier, { LABEL: 'implementationName' })
    this.CONSUME(LeftBrace)
    this.MANY(() => {
      this.SUBRULE(this.implementationBlock)
    })
    this.CONSUME(RightBrace)
    this.CONSUME(Semicolon)
  })

  private implementationBlock = this.RULE('implementationBlock', () => {
    this.SUBRULE(this.genericBlock)
  })

  // Generic block pattern: IDENTIFIER { ... } , "description" ;
  // This handles the unified format for all block types using generic identifiers
  // The blockType can be any identifier (OS, TASK, STACK, ALARM, RESOURCE, vs_ISR, vs_CONFIG, etc.)
  private genericBlock = this.RULE('genericBlock', () => {
    this.CONSUME(Identifier, { LABEL: 'blockType' })
    this.CONSUME(LeftBrace)
    this.MANY(() => {
      this.SUBRULE(this.typeDefinition)
    })
    this.CONSUME(RightBrace)
    this.CONSUME(Comma)
    this.SUBRULE(this.stringValue, { LABEL: 'description' })
    this.CONSUME(Semicolon)
  })

  // ============== Type Definitions ==============

  private typeDefinition = this.RULE('typeDefinition', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.ctypeDefinition) },
      { ALT: () => this.SUBRULE(this.enumDefinition) },
      { ALT: () => this.SUBRULE(this.stringDefinition) }
    ])
  })

  private ctypeDefinition = this.RULE('ctypeDefinition', () => {
    this.CONSUME(CTYPE)
    this.OPTION(() => {
      this.SUBRULE(this.stringValue, { LABEL: 'dataType' })
    })
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Identifier, { LABEL: 'variableName' })
        }
      },
      {
        ALT: () => {
          this.CONSUME(SIZE, { LABEL: 'variableName' })
        }
      }
    ])
    this.OPTION2(() => {
      this.CONSUME(ArrayNotation)
    })
    this.OPTION3(() => {
      this.CONSUME(Comma)
      this.SUBRULE2(this.stringValue, { LABEL: 'description' })
    })
    this.CONSUME(Semicolon)
  })

  private enumDefinition = this.RULE('enumDefinition', () => {
    this.OPTION(() => {
      this.CONSUME(TOTRACE)
    })
    this.CONSUME(ENUM)
    this.OPTION2(() => {
      this.SUBRULE(this.stringValue, { LABEL: 'enumType' })
    })
    this.CONSUME(LeftBracket)
    this.SUBRULE(this.enumValueList)

    this.CONSUME(RightBracket)
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Identifier, { LABEL: 'variableName' })
        }
      },
      {
        ALT: () => {
          this.CONSUME(SIZE, { LABEL: 'variableName' })
        }
      }
    ])
    this.OPTION3(() => {
      this.CONSUME(ArrayNotation)
    })
    this.CONSUME1(Comma)
    this.SUBRULE2(this.stringValue, { LABEL: 'description' })
    this.CONSUME(Semicolon)
  })

  private stringDefinition = this.RULE('stringDefinition', () => {
    this.CONSUME(STRING)
    this.CONSUME(Identifier, { LABEL: 'variableName' })
    this.CONSUME(Comma)
    this.SUBRULE(this.stringValue, { LABEL: 'description' })
    this.CONSUME(Semicolon)
  })

  private enumValueList = this.RULE('enumValueList', () => {
    this.SUBRULE(this.enumValue)
    this.MANY(() => {
      this.CONSUME(Comma)
      this.SUBRULE2(this.enumValue)
    })
    // Handle optional trailing comma after the last enum value
    this.OPTION(() => {
      this.CONSUME1(Comma)
    })
  })

  private enumValue = this.RULE('enumValue', () => {
    this.SUBRULE(this.stringValue, { LABEL: 'enumKey' })
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Equals)
          this.SUBRULE(this.value, { LABEL: 'enumValue' })
        }
      },
      {
        ALT: () => {
          this.CONSUME(Colon)
          this.CONSUME(Identifier, { LABEL: 'enumIdentifier' })
          this.CONSUME1(Equals)
          this.SUBRULE1(this.value, { LABEL: 'enumReference' })
        }
      }
    ])
  })

  // ============== Information Section ==============

  private informationSection = this.RULE('informationSection', () => {
    this.SUBRULE(this.genericInstance)
  })

  // Generic instance pattern: IDENTIFIER instanceName { ... } ;
  // This handles the unified format for all instance types using generic identifiers
  // The instanceType can be any identifier (OS, TASK, STACK, ALARM, RESOURCE, vs_ISR, vs_CONFIG, etc.)
  private genericInstance = this.RULE('genericInstance', () => {
    this.CONSUME(Identifier, { LABEL: 'instanceType' })
    this.CONSUME1(Identifier, { LABEL: 'instanceName' })
    this.CONSUME(LeftBrace)
    this.MANY(() => {
      this.SUBRULE(this.propertyAssignment)
    })
    this.CONSUME(RightBrace)
    this.CONSUME(Semicolon)
  })

  private propertyAssignment = this.RULE('propertyAssignment', () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Identifier, { LABEL: 'propertyName' })
        }
      },
      {
        ALT: () => {
          this.CONSUME(SIZE, { LABEL: 'propertyName' })
        }
      }
    ])
    this.OPTION(() => {
      this.CONSUME(LeftBracket)
      this.SUBRULE(this.numberValue, { LABEL: 'arrayIndex' })
      this.CONSUME(RightBracket)
    })
    this.CONSUME(Equals)
    this.SUBRULE(this.value, { LABEL: 'propertyValue' })
    this.CONSUME(Semicolon)
  })

  // ============== Value Rules ==============

  private value = this.RULE('value', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.stringValue) },
      { ALT: () => this.SUBRULE(this.numberValue) },
      { ALT: () => this.SUBRULE(this.referenceValue) }
    ])
  })

  private stringValue = this.RULE('stringValue', () => {
    this.CONSUME(StringLiteral)
  })

  private numberValue = this.RULE('numberValue', () => {
    this.OR([
      { ALT: () => this.CONSUME(QuotedHexNumber) },
      { ALT: () => this.CONSUME(HexNumber) },
      { ALT: () => this.CONSUME(DecimalNumber) }
    ])
  })

  private referenceValue = this.RULE('referenceValue', () => {
    this.OPTION(() => {
      this.CONSUME(Ampersand)
    })
    this.CONSUME(Identifier)
    this.MANY(() => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(LeftBracket)
            this.SUBRULE(this.numberValue)
            this.CONSUME(RightBracket)
          }
        },
        {
          ALT: () => {
            this.CONSUME(LeftParen)
            this.SUBRULE(this.value)
            this.MANY2(() => {
              this.CONSUME(Comma)
              this.SUBRULE2(this.value)
            })
            this.CONSUME(RightParen)
          }
        }
      ])
    })
  })
}

// Create singleton parser instance
export const ortiParser = new ORTIParser()
