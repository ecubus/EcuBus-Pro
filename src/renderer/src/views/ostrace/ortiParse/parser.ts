import { CstParser, IToken, TokenType } from 'chevrotain'
import {
  allTokens,
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
    this.OR([
      { ALT: () => this.SUBRULE(this.osBlock) },
      { ALT: () => this.SUBRULE(this.taskBlock) },
      { ALT: () => this.SUBRULE(this.stackBlock) },
      { ALT: () => this.SUBRULE(this.alarmBlock) },
      { ALT: () => this.SUBRULE(this.resourceBlock) },
      { ALT: () => this.SUBRULE(this.isrBlock) },
      { ALT: () => this.SUBRULE(this.configBlock) }
    ])
  })

  private osBlock = this.RULE('osBlock', () => {
    this.CONSUME(OS)
    this.CONSUME(LeftBrace)
    this.MANY(() => {
      this.SUBRULE(this.typeDefinition)
    })
    this.CONSUME(RightBrace)
    this.CONSUME(Comma)
    this.SUBRULE(this.stringValue, { LABEL: 'description' })
    this.CONSUME(Semicolon)
  })

  private taskBlock = this.RULE('taskBlock', () => {
    this.CONSUME(TASK)
    this.CONSUME(LeftBrace)
    this.MANY(() => {
      this.SUBRULE(this.typeDefinition)
    })
    this.CONSUME(RightBrace)
    this.CONSUME(Comma)
    this.SUBRULE(this.stringValue, { LABEL: 'description' })
    this.CONSUME(Semicolon)
  })

  private stackBlock = this.RULE('stackBlock', () => {
    this.CONSUME(STACK)
    this.CONSUME(LeftBrace)
    this.MANY(() => {
      this.SUBRULE(this.typeDefinition)
    })
    this.CONSUME(RightBrace)
    this.CONSUME(Comma)
    this.SUBRULE(this.stringValue, { LABEL: 'description' })
    this.CONSUME(Semicolon)
  })

  private alarmBlock = this.RULE('alarmBlock', () => {
    this.CONSUME(ALARM)
    this.CONSUME(LeftBrace)
    this.MANY(() => {
      this.SUBRULE(this.typeDefinition)
    })
    this.CONSUME(RightBrace)
    this.CONSUME(Comma)
    this.SUBRULE(this.stringValue, { LABEL: 'description' })
    this.CONSUME(Semicolon)
  })

  private resourceBlock = this.RULE('resourceBlock', () => {
    this.CONSUME(RESOURCE)
    this.CONSUME(LeftBrace)
    this.MANY(() => {
      this.SUBRULE(this.typeDefinition)
    })
    this.CONSUME(RightBrace)
    this.CONSUME(Comma)
    this.SUBRULE(this.stringValue, { LABEL: 'description' })
    this.CONSUME(Semicolon)
  })

  private isrBlock = this.RULE('isrBlock', () => {
    this.CONSUME(VS_ISR)
    this.CONSUME(LeftBrace)
    this.MANY(() => {
      this.SUBRULE(this.typeDefinition)
    })
    this.CONSUME(RightBrace)
    this.CONSUME(Comma)
    this.SUBRULE(this.stringValue, { LABEL: 'description' })
    this.CONSUME(Semicolon)
  })

  private configBlock = this.RULE('configBlock', () => {
    this.CONSUME(VS_CONFIG)
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
        // Handle keywords used as identifiers
        ALT: () => {
          this.CONSUME(STACK, { LABEL: 'variableName' })
        }
      },
      {
        ALT: () => {
          this.CONSUME(ALARM, { LABEL: 'variableName' })
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
    this.CONSUME(Comma)
    this.SUBRULE2(this.stringValue, { LABEL: 'description' })
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
        // Handle case where STACK appears as identifier (not keyword)
        ALT: () => {
          this.CONSUME(STACK, { LABEL: 'variableName' })
        }
      },
      {
        // Handle case where ALARM appears as identifier (not keyword)
        ALT: () => {
          this.CONSUME(ALARM, { LABEL: 'variableName' })
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
          this.SUBRULE(this.numberValue, { LABEL: 'enumValue' })
        }
      },
      {
        ALT: () => {
          this.CONSUME(Colon)
          this.CONSUME(Identifier, { LABEL: 'enumIdentifier' })
          this.CONSUME1(Equals)
          this.SUBRULE1(this.stringValue, { LABEL: 'enumReference' })
        }
      }
    ])
  })

  // ============== Information Section ==============

  private informationSection = this.RULE('informationSection', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.osInstance) },
      { ALT: () => this.SUBRULE(this.taskInstance) },
      { ALT: () => this.SUBRULE(this.stackInstance) },
      { ALT: () => this.SUBRULE(this.alarmInstance) },
      { ALT: () => this.SUBRULE(this.resourceInstance) },
      { ALT: () => this.SUBRULE(this.isrInstance) },
      { ALT: () => this.SUBRULE(this.configInstance) }
    ])
  })

  private osInstance = this.RULE('osInstance', () => {
    this.CONSUME(OS)
    this.CONSUME(Identifier, { LABEL: 'instanceName' })
    this.CONSUME(LeftBrace)
    this.MANY(() => {
      this.SUBRULE(this.propertyAssignment)
    })
    this.CONSUME(RightBrace)
    this.CONSUME(Semicolon)
  })

  private taskInstance = this.RULE('taskInstance', () => {
    this.CONSUME(TASK)
    this.CONSUME(Identifier, { LABEL: 'instanceName' })
    this.CONSUME(LeftBrace)
    this.MANY(() => {
      this.SUBRULE(this.propertyAssignment)
    })
    this.CONSUME(RightBrace)
    this.CONSUME(Semicolon)
  })

  private stackInstance = this.RULE('stackInstance', () => {
    this.CONSUME(STACK)
    this.CONSUME(Identifier, { LABEL: 'instanceName' })
    this.CONSUME(LeftBrace)
    this.MANY(() => {
      this.SUBRULE(this.propertyAssignment)
    })
    this.CONSUME(RightBrace)
    this.CONSUME(Semicolon)
  })

  private alarmInstance = this.RULE('alarmInstance', () => {
    this.CONSUME(ALARM)
    this.CONSUME(Identifier, { LABEL: 'instanceName' })
    this.CONSUME(LeftBrace)
    this.MANY(() => {
      this.SUBRULE(this.propertyAssignment)
    })
    this.CONSUME(RightBrace)
    this.CONSUME(Semicolon)
  })

  private resourceInstance = this.RULE('resourceInstance', () => {
    this.CONSUME(RESOURCE)
    this.CONSUME(Identifier, { LABEL: 'instanceName' })
    this.CONSUME(LeftBrace)
    this.MANY(() => {
      this.SUBRULE(this.propertyAssignment)
    })
    this.CONSUME(RightBrace)
    this.CONSUME(Semicolon)
  })

  private isrInstance = this.RULE('isrInstance', () => {
    this.CONSUME(VS_ISR)
    this.CONSUME(Identifier, { LABEL: 'instanceName' })
    this.CONSUME(LeftBrace)
    this.MANY(() => {
      this.SUBRULE(this.propertyAssignment)
    })
    this.CONSUME(RightBrace)
    this.CONSUME(Semicolon)
  })

  private configInstance = this.RULE('configInstance', () => {
    this.CONSUME(VS_CONFIG)
    this.CONSUME(Identifier, { LABEL: 'instanceName' })
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
        // Handle keywords used as property names
        ALT: () => {
          this.CONSUME(STACK, { LABEL: 'propertyName' })
        }
      },
      {
        ALT: () => {
          this.CONSUME(ALARM, { LABEL: 'propertyName' })
        }
      },
      {
        ALT: () => {
          this.CONSUME(TASK, { LABEL: 'propertyName' })
        }
      },
      {
        ALT: () => {
          this.CONSUME(RESOURCE, { LABEL: 'propertyName' })
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
