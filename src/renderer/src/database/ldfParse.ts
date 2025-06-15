import { CstChildrenDictionary, CstNode, CstParser, IToken, Lexer, createToken } from 'chevrotain'

export interface GlobalDef {
  LIN_protocol_version: string
  LIN_language_version: string
  LIN_speed: number
  schTimeout?: number
  Channel_name?: string /* If signal name is "signal1" and Channel_name = "net1" in the LDF, then generated signal name will be "signal1_net1".*/
}

export function getConfigFrames(ldfObj: LDF, nodeName: string): string[] {
  const list: string[] = []
  for (const sig of Object.keys(ldfObj.signals)) {
    if (ldfObj.signals[sig].punishedBy == nodeName) {
      list.push(sig)
    } else if (ldfObj.signals[sig].subscribedBy.indexOf(nodeName) != -1) {
      list.push(sig)
    }
  }
  const frames: string[] = []
  for (const frame of Object.keys(ldfObj.frames)) {
    const sigs = ldfObj.frames[frame].signals
    for (const s of list) {
      sigs.forEach((sig) => {
        if (sig.name == s) {
          frames.push(frame)
        }
      })
    }
  }

  const lastFrames = [...new Set(frames)]
  for (const e of Object.keys(ldfObj.eventTriggeredFrames)) {
    for (const f of ldfObj.eventTriggeredFrames[e].frameNames) {
      lastFrames.forEach((frame) => {
        if (frame == f) {
          lastFrames.push(e)
        }
      })
    }
  }
  return [...new Set(lastFrames)]
}

export interface SlaveNode {
  nodeName: string
}

export interface MasterNode {
  nodeName: string
  timeBase: number
  jitter: number
}

export interface NodeAttrDef {
  LIN_protocol: string
  configured_NAD: number
  initial_NAD?: number
  supplier_id: number
  function_id: number
  variant?: number
  response_error?: string
  fault_state_signals?: string[]
  P2_min?: number
  ST_min?: number
  N_As_timeout?: number
  N_Cr_timeout?: number
  configFrames?: string[]
}

export interface CompositeNode {
  compositeNode: string
  logicalNodes: string[]
}

export interface NodeDef {
  master: MasterNode
  salveNode: string[]
}

export interface SignalDef {
  signalName: string
  signalSizeBits: number
  initValue: number | number[]
  value?: number | number[]
  physValue?: number | string
  physValueEnum?: string
  update?: boolean
  punishedBy: string
  subscribedBy: string[]
  singleType: 'ByteArray' | 'Scalar'
}

export interface SignalGroupDef {
  name: string
  offset: number
}

export interface SignalGroupSDef {
  name: string
  size: number
  signals: SignalGroupDef[]
}

export interface Frame {
  name: string
  id: number
  publishedBy: string
  frameSize: number
  signals: { name: string; offset: number }[]
}

export interface SporadicFrames {
  name: string
  frameNames: string[]
}

export interface EventTriggeredFrame {
  name: string
  schTableName: string
  frameId: number
  frameNames: string[]
}

export enum Command {
  MasterReq,
  SlaveResp,
  AssignNAD,
  ConditionalChangeNAD,
  DataDump,
  SaveConfiguration,
  AssignFrameIdRange,
  FreeFormat,
  AssignFrameId
}

export interface SchTable {
  name: string
  entries: {
    name: string
    delay: number
    isCommand: boolean
    AssignNAD?: {
      nodeName: string
    }
    ConditionalChangeNAD?: {
      nad: number
      id: number
      byte: number
      mask: number
      inv: number
      newNad: number
    }
    DataDump?: {
      nodeName: string
      D1: number
      D2: number
      D3: number
      D4: number
      D5: number
    }
    SaveConfiguration?: {
      nodeName: string
    }
    AssignFrameIdRange?: {
      nodeName: string
      frameIndex: number
      framePID?: number[]
    }
    FreeFormat?: {
      D: number[]
    }
    AssignFrameId?: {
      nodeName: string
      frameName: string
    }
  }[]
}

export interface SignalEncodeType {
  name: string
  encodingTypes: {
    type: 'logicalValue' | 'physicalValue' | 'bcdValue' | 'asciiValue'
    logicalValue?: {
      signalValue: number
      textInfo?: string
    }
    physicalValue?: {
      minValue: number
      maxValue: number
      scale: number
      offset: number
      textInfo?: string
    }
  }[]
}

export interface LDF {
  id: string
  name: string
  global: GlobalDef
  node: NodeDef
  nodeAttrs: Record<string, NodeAttrDef>
  composite?: Record<string, CompositeNode[]>
  signals: Record<string, SignalDef>
  signalGroups: SignalGroupSDef[]
  frames: Record<string, Frame>
  sporadicFrames: Record<string, SporadicFrames>
  eventTriggeredFrames: Record<string, EventTriggeredFrame>
  schTables: SchTable[]
  signalEncodeTypes: Record<string, SignalEncodeType>
  signalRep: Record<string, string[]>
}

const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED
})

// 添加注释token处理
const BlockComment = createToken({
  name: 'BlockComment',
  pattern: /\/\*[\s\S]*?\*\//,
  group: Lexer.SKIPPED
})

const LineComment = createToken({
  name: 'LineComment',
  pattern: /\/\/[^\n]*/,
  group: Lexer.SKIPPED
})

const Header = createToken({ name: 'Header', pattern: /LIN_description_file\s*/ })
const Version = createToken({ name: 'Version', pattern: /LIN_protocol_version\s+/ })
const LVersion = createToken({ name: 'LVersion', pattern: /LIN_language_version\s+/ })
const Speed = createToken({ name: 'Speed', pattern: /LIN_speed\s+/ })
const CharString = createToken({ name: 'CharString', pattern: /"([^"]*)"/ })
const Equal = createToken({ name: 'Equal', pattern: /=/ })
const EOF = createToken({ name: 'EOF', pattern: /\s*;/ })
const KBPS = createToken({ name: 'KBPS', pattern: /\s+kbps/ })
const Interger = createToken({
  name: 'Interger',
  pattern: /(-?\s*\d+\.\d+|-?0x[a-fA-F0-9]+|-?\d+)/
})

// const Interger = createToken({ name: "Interger", pattern: /\b(-?\d+|0x[a-fA-F0-9]+)\b/ })
const Channel_name = createToken({ name: 'Channel_name', pattern: /[C|c]hannel_name\s+/ })
const Identifier = createToken({ name: 'Identifier', pattern: /[a-zA-Z_][a-zA-Z_0-9]*/ })
const Nodes = createToken({ name: 'Nodes', pattern: /[N|n]odes\s*/ })
const Node_attributes = createToken({ name: 'Node_attributes', pattern: /[N|n]ode_attributes\s*/ })
const LCurly = createToken({ name: 'LCurly', pattern: /{/ })
const RCurly = createToken({ name: 'RCurly', pattern: /}/ })
const Comma = createToken({ name: 'Comma', pattern: /,\s*/ })
const Colon = createToken({ name: 'Colon', pattern: /:/ })
const Master = createToken({ name: 'Master', pattern: /[M|m]aster\s*:\s*/ })
const Slave = createToken({ name: 'Slave', pattern: /[S|s]laves\s*:\s*/ })
const MS = createToken({ name: 'MS', pattern: /\s+ms/ })
const DELAY = createToken({ name: 'DELAY', pattern: /\s*delay\s+/ })
const product_id = createToken({ name: 'product_id', pattern: /product_id\s+/ })
const response_error = createToken({ name: 'response_error', pattern: /response_error\s+/ })
const fault_state_signals = createToken({
  name: 'fault_state_signals',
  pattern: /fault_state_signals\s+/
})
const P2_min = createToken({ name: 'P2_min', pattern: /P2_min\s+/ })
const ST_min = createToken({ name: 'ST_min', pattern: /ST_min\s+/ })
const N_As_timeout = createToken({ name: 'N_As_timeout', pattern: /N_As_timeout\s+/ })
const N_Cr_timeout = createToken({ name: 'N_Cr_timeout', pattern: /N_Cr_timeout\s+/ })
const configurable_frames = createToken({
  name: 'configurable_frames',
  pattern: /configurable_frames\s*/
})
const LIN_protocol = createToken({ name: 'LIN_protocol', pattern: /LIN_protocol\s+/ })
const configured_NAD = createToken({ name: 'configured_NAD', pattern: /configured_NAD\s+/ })
const initial_NAD = createToken({ name: 'initial_NAD', pattern: /initial_NAD\s+/ })
const composite = createToken({ name: 'composite', pattern: /[C|c]omposite\s+/ })
const configuration = createToken({ name: 'configuration', pattern: /[C|c]onfiguration\s+/ })
const Signals = createToken({ name: 'Signals', pattern: /Signals\s*/ })
const Diagnostic_signals = createToken({
  name: 'Diagnostic_signals',
  pattern: /Diagnostic_signals\s+/
})
const DiagReq = createToken({ name: 'DiagReq', pattern: /(Master|Slave)(Req|Resp)B[0-7]\s*:\s*/ })
const Frames = createToken({ name: 'Frames', pattern: /Frames\s*/ })
const Signal_groups = createToken({ name: 'Signal_groups', pattern: /Signal_groups\s+/ })
const Sporadic_frames = createToken({ name: 'Sporadic_frames', pattern: /Sporadic_frames\s+/ })
const Event_triggered_frames = createToken({
  name: 'Event_triggered_frames',
  pattern: /Event_triggered_frames\s+/
})
const Diagnostic_frames = createToken({
  name: 'Diagnostic_frames',
  pattern: /Diagnostic_frames\s+/
})
const DiagReqFrame = createToken({
  name: 'DiagReqFrame',
  pattern:
    /((MasterReq\s*:\s*(0x3c|60|0x3C|0X3C|0X3c)\s*)|(SlaveResp\s*:\s*(0x3d|61|0x3D|0X3D|0X3d)\s*))/
})
const SubDiagReq = createToken({
  name: 'SubDiagReq',
  pattern: /(Master|Slave)(Req|Resp)B[0-7]\s*,\s*/
})
const Schedule_tables = createToken({ name: 'Schedule_tables', pattern: /Schedule_tables\s+/ })
const MasterReqSlaveResp = createToken({
  name: 'MasterReqSlaveResp',
  pattern: /(MasterReq|SlaveResp)\s+/
})
const AssignNAD = createToken({ name: 'AssignNAD', pattern: /AssignNAD\s+/ })
const ConditionalChangeNAD = createToken({
  name: 'ConditionalChangeNAD',
  pattern: /ConditionalChangeNAD\s+/
})
const DataDump = createToken({ name: 'DataDump', pattern: /DataDump\s+/ })
const SaveConfiguration = createToken({
  name: 'SaveConfiguration',
  pattern: /SaveConfiguration\s+/
})
const AssignFrameIdRange = createToken({
  name: 'AssignFrameIdRange',
  pattern: /AssignFrameIdRange\s+/
})
const FreeFormat = createToken({ name: 'FreeFormat', pattern: /FreeFormat\s+/ })
const AssignFrameId = createToken({ name: 'AssignFrameId', pattern: /AssignFrameId\s+/ })
const Signal_encoding_types = createToken({
  name: 'Signal_encoding_types',
  pattern: /Signal_encoding_types\s+/
})
const logical_value = createToken({ name: 'logical_value', pattern: /logical_value,\s+/ })
const physical_value = createToken({ name: 'physical_value', pattern: /physical_value,\s+/ })
const bcd_value = createToken({ name: 'bcd_value', pattern: /bcd_value\s+/ })
const ascii_value = createToken({ name: 'ascii_value', pattern: /ascii_value\s+/ })
const Signal_representation = createToken({
  name: 'Signal_representation',
  pattern: /Signal_representation\s+/
})

const allTokens = [
  // 注释token必须放在最前面，以确保它们有更高的优先级
  BlockComment,
  LineComment,
  Header,
  Version,
  LVersion,
  Speed,
  CharString,
  Equal,
  EOF,
  KBPS,
  Interger,
  Channel_name,
  Node_attributes,
  composite,
  configuration,
  Signals,
  Diagnostic_signals,
  DiagReq,
  Frames,
  Signal_groups,
  Sporadic_frames,
  Event_triggered_frames,
  Diagnostic_frames,
  DiagReqFrame,
  SubDiagReq,
  Schedule_tables,
  DELAY,
  MasterReqSlaveResp,
  AssignNAD,
  ConditionalChangeNAD,
  Signal_encoding_types,
  logical_value,
  physical_value,
  bcd_value,
  ascii_value,
  Signal_representation,
  DataDump,
  SaveConfiguration,
  AssignFrameIdRange,
  FreeFormat,
  AssignFrameId,
  configured_NAD,
  initial_NAD,
  LIN_protocol,
  product_id,
  response_error,
  fault_state_signals,
  P2_min,
  ST_min,
  N_As_timeout,
  N_Cr_timeout,
  configurable_frames,
  Nodes,
  LCurly,
  RCurly,
  Comma,
  Colon,
  Master,
  Slave,
  MS,
  Identifier,
  WhiteSpace
]

class LdfParser extends CstParser {
  constructor() {
    super(allTokens)
    this.performSelfAnalysis()
  }
  /* LIN_description_file; */
  private header = this.RULE('HeaderClause', () => {
    this.CONSUME(Header)
    this.CONSUME(EOF)
  })
  /* LIN_protocol_version = "2.2"; */
  private version = this.RULE('VersionClause', () => {
    this.CONSUME(Version)
    this.CONSUME(Equal)
    this.CONSUME(CharString)
    this.CONSUME(EOF)
  })

  /* LIN_language_version = "2.2"; */

  private llversion = this.RULE('LVersionClause', () => {
    this.CONSUME(LVersion)
    this.CONSUME(Equal)
    this.CONSUME(CharString)
    this.CONSUME(EOF)
  })
  /* LIN_speed = 19.2 kbps; */
  private speed = this.RULE('SpeedClause', () => {
    this.CONSUME(Speed)
    this.CONSUME(Equal)
    this.CONSUME(Interger)
    this.CONSUME(KBPS)
    this.CONSUME(EOF)
  })

  private channel = this.RULE('ChannelClause', () => {
    this.CONSUME(Channel_name)
    this.CONSUME(Equal)
    this.CONSUME(CharString)
    this.CONSUME(EOF)
  })

  private nodes = this.RULE('NodesClause', () => {
    this.CONSUME(Nodes)
    this.CONSUME(LCurly)
    this.CONSUME(Master)
    this.CONSUME(Identifier)
    this.CONSUME(Comma)
    this.CONSUME(Interger)
    this.CONSUME(MS)
    this.CONSUME1(Comma)
    this.CONSUME1(Interger)
    this.CONSUME1(MS)
    this.CONSUME(EOF)
    this.CONSUME(Slave)

    this.AT_LEAST_ONE_SEP({
      SEP: Comma,
      DEF: () => {
        this.CONSUME1(Identifier)
      }
    })
    this.CONSUME1(EOF)
    this.CONSUME(RCurly)
  })
  private frameDefinition = this.RULE('frameDefinition', () => {
    this.CONSUME(Identifier)
    this.OPTION(() => {
      this.CONSUME(Equal)
      this.CONSUME(Interger)
    })
    this.CONSUME(EOF)
  })

  private configurable_frames = this.RULE('configurable_framesClause', () => {
    this.CONSUME(configurable_frames)
    this.CONSUME(LCurly)
    this.MANY(() => {
      this.SUBRULE(this.frameDefinition)
    })
    this.CONSUME(RCurly)
  })

  private product_id = this.RULE('product_idClause', () => {
    this.CONSUME(product_id)
    this.CONSUME(Equal)
    this.CONSUME(Interger)
    this.CONSUME(Comma)
    this.CONSUME1(Interger)
    this.OPTION(() => {
      this.CONSUME1(Comma)
      this.CONSUME2(Interger)
    })

    this.CONSUME2(EOF)
  })

  private response_error = this.RULE('response_errorClause', () => {
    this.CONSUME(response_error)
    this.CONSUME(Equal)
    this.CONSUME(Identifier)
    this.CONSUME(EOF)
  })

  private fault_state_signals = this.RULE('fault_state_signalsClause', () => {
    this.CONSUME(fault_state_signals)
    this.CONSUME(Equal)
    this.AT_LEAST_ONE_SEP({
      SEP: Comma,
      DEF: () => {
        this.CONSUME(Identifier)
      }
    })
    this.CONSUME(EOF)
  })

  private P2_min = this.RULE('P2_minClause', () => {
    this.CONSUME(P2_min)
    this.CONSUME(Equal)
    this.CONSUME(Interger)
    this.CONSUME(MS)
    this.CONSUME(EOF)
  })

  private ST_min = this.RULE('ST_minClause', () => {
    this.CONSUME(ST_min)
    this.CONSUME(Equal)
    this.CONSUME(Interger)
    this.CONSUME(MS)
    this.CONSUME(EOF)
  })

  private N_As_timeout = this.RULE('N_As_timeoutClause', () => {
    this.CONSUME(N_As_timeout)
    this.CONSUME(Equal)
    this.CONSUME(Interger)
    this.CONSUME(MS)
    this.CONSUME(EOF)
  })

  private N_Cr_timeout = this.RULE('N_Cr_timeoutClause', () => {
    this.CONSUME(N_Cr_timeout)
    this.CONSUME(Equal)
    this.CONSUME(Interger)
    this.CONSUME(MS)
    this.CONSUME(EOF)
  })

  private LIN_protocol = this.RULE('LIN_protocolClause', () => {
    this.CONSUME(LIN_protocol)
    this.CONSUME(Equal)
    this.OR([{ ALT: () => this.CONSUME(CharString) }, { ALT: () => this.CONSUME(Interger) }])
    this.CONSUME(EOF)
  })

  private configured_NAD = this.RULE('configured_NADClause', () => {
    this.CONSUME(configured_NAD)
    this.CONSUME(Equal)
    this.CONSUME(Interger)
    this.CONSUME(EOF)
  })

  private initial_NAD = this.RULE('initial_NADClause', () => {
    this.CONSUME(initial_NAD)
    this.CONSUME(Equal)
    this.CONSUME(Interger)
    this.CONSUME(EOF)
  })

  private composite_node = this.RULE('composite_nodeClause', () => {
    this.CONSUME1(Identifier)
    this.CONSUME1(LCurly)
    // this.MANY2({

    //     DEF: () => {
    //         this.CONSUME3(Comma)
    //         this.CONSUME4(Identifier)
    //     }
    // })
    this.AT_LEAST_ONE_SEP({
      SEP: Comma,
      DEF: () => {
        this.CONSUME2(Identifier)
      }
    })
    this.CONSUME2(EOF)
    this.CONSUME1(RCurly)
  })
  private configuration_name = this.RULE('configuration_nameClause', () => {
    this.CONSUME(configuration)
    this.CONSUME(Identifier)
    this.CONSUME(LCurly)
    this.MANY({
      DEF: () => {
        this.SUBRULE(this.composite_node)
      }
    })
    this.CONSUME1(RCurly)
  })
  /*
    Composite {
  Configuration ww { 
    wq { ws ; }
  }
  Configuration ww1 { 
    wq1 { ws1 ; }
    wq2 { ws2 ; }
  }
}
    */
  private composite = this.RULE('compositeClause', () => {
    this.CONSUME(composite)
    this.CONSUME(LCurly)
    this.MANY({
      DEF: () => {
        this.SUBRULE(this.configuration_name)
      }
    })
    this.CONSUME(RCurly)
  })

  private node_attributes = this.RULE('Node_attributesClause', () => {
    this.CONSUME(Node_attributes)
    this.CONSUME(LCurly)
    this.MANY({
      DEF: () => {
        this.CONSUME(Identifier)
        this.CONSUME1(LCurly)
        this.MANY1({
          DEF: () => {
            this.OR([
              { ALT: () => this.SUBRULE(this.configured_NAD) },
              { ALT: () => this.SUBRULE(this.initial_NAD) },
              { ALT: () => this.SUBRULE(this.LIN_protocol) },
              { ALT: () => this.SUBRULE(this.product_id) },
              { ALT: () => this.SUBRULE(this.response_error) },
              { ALT: () => this.SUBRULE(this.fault_state_signals) },
              { ALT: () => this.SUBRULE(this.P2_min) },
              { ALT: () => this.SUBRULE(this.ST_min) },
              { ALT: () => this.SUBRULE(this.N_As_timeout) },
              { ALT: () => this.SUBRULE(this.N_Cr_timeout) },
              { ALT: () => this.SUBRULE(this.configurable_frames) }
            ])
          }
        })
        this.CONSUME1(RCurly)
      }
    })
    this.CONSUME(RCurly)
  })

  private initvalueArray = this.RULE('initvalueArrayClause', () => {
    this.CONSUME2(LCurly)
    this.AT_LEAST_ONE_SEP({
      SEP: Comma,
      DEF: () => {
        this.CONSUME3(Interger)
      }
    })
    this.CONSUME2(RCurly)
  })

  private signal = this.RULE('signalClause', () => {
    this.CONSUME1(Identifier)
    this.CONSUME1(Colon)
    this.CONSUME1(Interger) //signal size
    this.CONSUME1(Comma)
    //init value
    this.OR([
      { ALT: () => this.CONSUME2(Interger) },
      {
        ALT: () => {
          this.SUBRULE(this.initvalueArray)
        }
      }
    ])
    this.CONSUME3(Comma)
    //publisher
    this.CONSUME2(Identifier)
    //subscriber
    this.MANY1({
      DEF: () => {
        this.CONSUME4(Comma)
        this.CONSUME3(Identifier)
      }
    })
    this.CONSUME1(EOF)
  })

  private Signals = this.RULE('SignalsClause', () => {
    this.CONSUME(Signals)
    this.CONSUME(LCurly)
    this.MANY({
      DEF: () => {
        this.SUBRULE(this.signal)
      }
    })
    this.CONSUME(RCurly)
  })

  private Diagnostic_signals = this.RULE('Diagnostic_signalsClause', () => {
    this.CONSUME(Diagnostic_signals)
    this.CONSUME(LCurly)
    this.MANY({
      DEF: () => {
        this.CONSUME(DiagReq)
        this.CONSUME(Interger) //signal size
        this.CONSUME(Comma)
        this.CONSUME1(Interger)
        this.CONSUME(EOF)
      }
    })

    this.CONSUME(RCurly)
  })

  /* 
    Signal_groups {
  sg1:3 {
    ss1 , 0;
    ss2 , 1;
  }
  sg2:2 {
    ss3 , 0;
    ss4 , 1;
  }
}
*/
  private Signal_group = this.RULE('Signal_groupClause', () => {
    this.CONSUME2(Identifier)
    this.CONSUME2(Comma)
    this.CONSUME2(Interger) //group offset
    this.CONSUME2(EOF)
  })

  private MSignal_group = this.RULE('MSignal_groupClause', () => {
    this.CONSUME(Identifier)
    this.CONSUME(Colon)
    this.CONSUME(Interger) //group size
    this.CONSUME1(LCurly)
    this.MANY1({
      DEF: () => {
        this.SUBRULE(this.Signal_group)
      }
    })
    this.CONSUME1(RCurly)
  })

  private Signal_groups = this.RULE('Signal_groupsClause', () => {
    this.CONSUME(Signal_groups)
    this.CONSUME(LCurly)
    this.MANY({
      DEF: () => {
        this.SUBRULE(this.MSignal_group)
      }
    })
    this.CONSUME(RCurly)
  })

  private subframeSignal = this.RULE('subframeSignalClause', () => {
    this.CONSUME2(Identifier) //signal_name
    this.CONSUME2(Comma)
    this.CONSUME2(Interger) //signal_offset
    this.CONSUME2(EOF)
  })

  private subframe = this.RULE('subframeClause', () => {
    this.CONSUME(Identifier) //frame name
    this.CONSUME(Colon)
    this.CONSUME(Interger) //frame id
    this.CONSUME(Comma)
    this.CONSUME1(Identifier) //published_by
    this.CONSUME1(Comma)
    this.CONSUME1(Interger) //frame_size
    this.CONSUME1(LCurly)
    this.MANY1({
      DEF: () => {
        this.SUBRULE(this.subframeSignal)
      }
    })
    this.CONSUME1(RCurly)
  })

  private frames = this.RULE('framesClause', () => {
    this.CONSUME(Frames)
    this.CONSUME(LCurly)
    this.MANY({
      DEF: () => {
        this.SUBRULE(this.subframe)
      }
    })
    this.CONSUME(RCurly)
  })

  private Sporadic_frame = this.RULE('Sporadic_frameClause', () => {
    this.CONSUME(Identifier) //sporadic_frame_name
    this.CONSUME(Colon)
    this.AT_LEAST_ONE_SEP({
      SEP: Comma,
      DEF: () => {
        this.CONSUME2(Identifier)
      }
    })
    this.CONSUME(EOF)
  })

  private Sporadic_frames = this.RULE('Sporadic_framesClause', () => {
    this.CONSUME(Sporadic_frames)
    this.CONSUME(LCurly)
    this.MANY({
      DEF: () => {
        this.SUBRULE(this.Sporadic_frame)
      }
    })
    this.CONSUME(RCurly)
  })

  private Event_triggered_frame = this.RULE('Event_triggered_frameClause', () => {
    this.CONSUME(Identifier) //event_triggered_frame_name
    this.CONSUME(Colon)
    this.CONSUME1(Identifier) //schedule_name
    this.CONSUME1(Comma)
    this.CONSUME1(Interger) //
    this.MANY1({
      DEF: () => {
        this.CONSUME2(Comma)
        this.CONSUME2(Identifier) //frame_name
      }
    })
    this.CONSUME(EOF)
  })

  private Event_triggered_frames = this.RULE('Event_triggered_framesClause', () => {
    this.CONSUME(Event_triggered_frames)
    this.CONSUME(LCurly)
    this.MANY({
      DEF: () => {
        this.SUBRULE(this.Event_triggered_frame)
      }
    })
    this.CONSUME(RCurly)
  })

  private Diagnostic_frames = this.RULE('Diagnostic_framesClause', () => {
    this.CONSUME(Diagnostic_frames)
    this.CONSUME(LCurly)
    this.CONSUME(DiagReqFrame)
    this.CONSUME1(LCurly)
    this.MANY1({
      DEF: () => {
        this.CONSUME2(SubDiagReq) //frame_name
        this.CONSUME2(Interger)
        this.CONSUME2(EOF)
      }
    })
    this.CONSUME1(RCurly)
    this.CONSUME1(DiagReqFrame)
    this.CONSUME2(LCurly)
    this.MANY2({
      DEF: () => {
        this.CONSUME3(SubDiagReq) //frame_name
        this.CONSUME3(Interger)
        this.CONSUME3(EOF)
      }
    })
    this.CONSUME2(RCurly)
    this.CONSUME(RCurly)
  })

  private ConditionalChangeNAD = this.RULE('ConditionalChangeNADClause', () => {
    this.CONSUME(ConditionalChangeNAD)
    this.CONSUME(LCurly)

    this.CONSUME1(Identifier)
    this.CONSUME1(Comma)

    this.CONSUME2(Interger)
    this.CONSUME2(Comma)

    this.CONSUME3(Interger)
    this.CONSUME3(Comma)
    this.CONSUME4(Interger)
    this.CONSUME4(Comma)
    this.CONSUME5(Interger)
    this.CONSUME5(Comma)

    this.CONSUME6(Interger)
    this.CONSUME6(RCurly)
  })

  private AssignNAD = this.RULE('AssignNADClause', () => {
    this.CONSUME(AssignNAD)
    this.CONSUME(LCurly)
    this.CONSUME1(Identifier)
    this.CONSUME(RCurly)
  })

  private AssignFrameId = this.RULE('AssignFrameIdClause', () => {
    this.CONSUME(AssignFrameId)
    this.CONSUME(LCurly)
    this.CONSUME(Identifier)
    this.CONSUME(Comma)
    this.CONSUME1(Identifier)
    this.CONSUME(RCurly)
  })

  private DataDump = this.RULE('DataDumpClause', () => {
    this.CONSUME(DataDump)
    this.CONSUME(LCurly)

    this.CONSUME1(Identifier)
    this.CONSUME1(Comma)

    this.CONSUME2(Interger)
    this.CONSUME2(Comma)

    this.CONSUME3(Interger)
    this.CONSUME3(Comma)
    this.CONSUME4(Interger)
    this.CONSUME4(Comma)
    this.CONSUME5(Interger)
    this.CONSUME5(Comma)

    this.CONSUME6(Interger)
    this.CONSUME6(RCurly)
  })

  private SaveConfiguration = this.RULE('SaveConfigurationClause', () => {
    this.CONSUME(SaveConfiguration)
    this.CONSUME(LCurly)
    this.CONSUME(Identifier)
    this.CONSUME(RCurly)
  })

  private AssignFrameIdRange = this.RULE('AssignFrameIdRangeClause', () => {
    this.CONSUME(AssignFrameIdRange)
    this.CONSUME(LCurly)
    this.CONSUME(Identifier)
    this.CONSUME(Comma)
    this.CONSUME1(Interger)
    this.OPTION(() => {
      this.CONSUME2(Comma)
      this.CONSUME2(Interger)
      this.CONSUME3(Comma)
      this.CONSUME3(Interger)
      this.CONSUME4(Comma)
      this.CONSUME4(Interger)
      this.CONSUME5(Comma)
      this.CONSUME5(Interger)
    })
    this.CONSUME(RCurly)
  })

  private MasterSlaveReq = this.RULE('MasterSlaveReqClause', () => {
    this.CONSUME(MasterReqSlaveResp)
  })

  private FreeFormat = this.RULE('FreeFormatClause', () => {
    this.CONSUME(FreeFormat)
    this.CONSUME(LCurly)

    this.CONSUME1(Interger)
    this.CONSUME1(Comma)

    this.CONSUME2(Interger)
    this.CONSUME2(Comma)

    this.CONSUME3(Interger)
    this.CONSUME3(Comma)
    this.CONSUME4(Interger)
    this.CONSUME4(Comma)
    this.CONSUME5(Interger)
    this.CONSUME5(Comma)

    this.CONSUME6(Interger)
    this.CONSUME6(RCurly)

    this.CONSUME7(Interger)
    this.CONSUME7(RCurly)

    this.CONSUME8(Interger)
    this.CONSUME8(RCurly)
  })

  private command = this.RULE('commandClause', () => {
    this.OR([
      {
        ALT: () => {
          this.SUBRULE(this.ConditionalChangeNAD)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.DataDump)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.AssignFrameIdRange)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.FreeFormat)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.AssignNAD)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.AssignFrameId)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.SaveConfiguration)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.MasterSlaveReq)
        }
      },
      {
        ALT: () => {
          this.CONSUME(Identifier)
        }
      }
    ])
  })

  private subSchItem = this.RULE('subSchItemClause', () => {
    this.SUBRULE(this.command) //command
    this.CONSUME2(DELAY)
    this.CONSUME2(Interger) //frame_time
    this.CONSUME2(MS)
    this.CONSUME2(EOF)
  })

  private schItem = this.RULE('schItemClause', () => {
    this.CONSUME(Identifier) //schedule_name
    this.CONSUME1(LCurly)
    this.MANY1({
      DEF: () => {
        this.SUBRULE(this.subSchItem)
      }
    })
    this.CONSUME1(RCurly)
  })

  private Schedule_tables = this.RULE('Schedule_tablesClause', () => {
    this.CONSUME(Schedule_tables)
    this.CONSUME(LCurly)
    this.MANY({
      DEF: () => {
        this.SUBRULE(this.schItem)
      }
    })
    this.CONSUME(RCurly)
  })

  private logical_value = this.RULE('logical_valueClause', () => {
    this.CONSUME(logical_value)
    this.CONSUME(Interger)
    this.OPTION(() => {
      this.CONSUME1(Comma)
      this.CONSUME1(CharString)
    })
    this.CONSUME(EOF)
  })

  private physical_range = this.RULE('physical_rangeClause', () => {
    this.CONSUME(physical_value)
    this.CONSUME(Interger)
    this.CONSUME1(Comma)
    this.CONSUME1(Interger)
    this.CONSUME2(Comma)
    this.CONSUME2(Interger)
    this.CONSUME3(Comma)
    this.CONSUME3(Interger)
    this.OPTION(() => {
      this.CONSUME5(Comma)
      this.CONSUME5(CharString)
    })
    this.CONSUME(EOF)
  })

  private bcd_value = this.RULE('bcd_valueClause', () => {
    this.CONSUME(bcd_value)
    this.CONSUME(EOF)
  })

  private ascii_value = this.RULE('ascii_valueClause', () => {
    this.CONSUME(ascii_value)
    this.CONSUME(EOF)
  })

  private SignalValue = this.RULE('SignalValueClause', () => {
    this.OR([
      {
        ALT: () => {
          this.SUBRULE(this.logical_value)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.physical_range)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.bcd_value)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.ascii_value)
        }
      }
    ])
  })

  private MSignalValue = this.RULE('MSignalValueClause', () => {
    this.CONSUME(Identifier) //signal_encoding_type_name
    this.CONSUME1(LCurly)
    this.MANY1({
      DEF: () => {
        this.SUBRULE(this.SignalValue)
      }
    })
    this.CONSUME1(RCurly)
  })

  private Signal_encoding_types = this.RULE('Signal_encoding_typesClause', () => {
    this.CONSUME(Signal_encoding_types)
    this.CONSUME(LCurly)
    this.MANY({
      DEF: () => {
        this.SUBRULE(this.MSignalValue)
      }
    })
    this.CONSUME(RCurly)
  })

  private SubSignal_representation = this.RULE('SubSignal_representationClause', () => {
    this.CONSUME(Identifier) //signal_representation_name
    this.CONSUME(Colon)
    this.CONSUME1(Identifier) //signal_encoding_type_name
    this.MANY1({
      DEF: () => {
        this.CONSUME1(Comma)
        this.CONSUME2(Identifier) //signal_encoding_type_name
      }
    })
    this.CONSUME(EOF)
  })

  private Signal_representation = this.RULE('Signal_representationClause', () => {
    this.CONSUME(Signal_representation)
    this.CONSUME(LCurly)
    this.MANY({
      DEF: () => {
        this.SUBRULE(this.SubSignal_representation)
      }
    })
    this.CONSUME(RCurly)
  })

  public ldfParse = this.RULE('ldfClause', () => {
    this.SUBRULE(this.header)
    this.SUBRULE(this.version)
    this.SUBRULE(this.llversion)
    this.SUBRULE(this.speed)
    this.OPTION(this.channel)
    this.MANY({
      DEF: () => {
        this.OR([
          { ALT: () => this.SUBRULE(this.nodes) },
          { ALT: () => this.SUBRULE(this.node_attributes) },
          { ALT: () => this.SUBRULE(this.composite) },
          { ALT: () => this.SUBRULE(this.Signals) },
          { ALT: () => this.SUBRULE(this.Diagnostic_signals) },
          { ALT: () => this.SUBRULE(this.frames) },
          { ALT: () => this.SUBRULE(this.Signal_groups) },
          { ALT: () => this.SUBRULE(this.Sporadic_frames) },
          { ALT: () => this.SUBRULE(this.Event_triggered_frames) },
          { ALT: () => this.SUBRULE(this.Diagnostic_frames) },
          { ALT: () => this.SUBRULE(this.Schedule_tables) },
          { ALT: () => this.SUBRULE(this.Signal_encoding_types) },
          { ALT: () => this.SUBRULE(this.Signal_representation) }
        ])
      }
    })
  })
}

const parser = new LdfParser()
const LdfLexer = new Lexer(allTokens)
const visitor = parser.getBaseCstVisitorConstructorWithDefaults()

class LdfVistor extends visitor {
  constructor() {
    super()
    this.validateVisitor()
    this.ldf = {
      eventTriggeredFrames: {},
      sporadicFrames: {},
      signalRep: {},
      signalEncodeTypes: {}
    } as LDF
  }
  ldf!: LDF

  // The Ctx argument is the current CSTNode's children.
  HeaderClause(ctx: CstChildrenDictionary) {
    this.ldf.global = {
      LIN_protocol_version: '',
      LIN_language_version: '',
      LIN_speed: 0
    }
  }
  VersionClause(ctx: CstChildrenDictionary) {
    // Each Terminal or Non-Terminal in a grammar rule are collected into
    // an array with the same name(key) in the ctx object.
    this.ldf.global.LIN_protocol_version = (ctx.CharString[0] as IToken).image.replace(/"+/g, '')
  }
  LVersionClause(ctx: CstChildrenDictionary) {
    // Each Terminal or Non-Terminal in a grammar rule are collected into
    this.ldf.global.LIN_language_version = (ctx.CharString[0] as IToken).image.replace(/"+/g, '')
  }

  SpeedClause(ctx: CstChildrenDictionary) {
    this.ldf.global.LIN_speed = Number((ctx.Interger[0] as IToken).image)
  }

  ChannelClause(ctx: CstChildrenDictionary) {
    this.ldf.global.Channel_name = (ctx.CharString[0] as IToken).image.replace(/"+/g, '')
  }

  NodesClause(ctx: CstChildrenDictionary) {
    // Each Terminal or Non-Terminal in a grammar rule are collected into
    // an array with the same name(key) in the ctx object.
    this.ldf.node = {
      master: {
        nodeName: (ctx.Identifier[0] as IToken).image,
        timeBase: Number((ctx.Interger[0] as IToken).image),
        jitter: Number((ctx.Interger[1] as IToken).image)
      },
      salveNode: [...ctx.Identifier.slice(1).map((identToken) => (identToken as IToken).image)]
    }
    // console.log(this.ldf)
  }

  Node_attributesClause(ctx: CstChildrenDictionary) {
    this.ldf.nodeAttrs = {}
    for (const [index, i] of ctx.Identifier.entries()) {
      const t = i as IToken
      // console.log(ctx.configurable_framesClause[index].children.frameDefinition)
      const configFrames = (ctx.configurable_framesClause[index] as any)?.children?.frameDefinition

      const configFramesVal: string[] = []
      for (const f of configFrames) {
        const name = f.children.Identifier[0].image
        if (f.children.Interger) {
          const number = Number(f.children.Interger[0].image)
          configFramesVal[number] = name
        } else {
          configFramesVal.push(name)
        }
      }
      //check empty in configFramesVal
      for (let i = 0; i < configFramesVal.length; i++) {
        if (configFramesVal[i] == undefined) {
          throw new Error(`configurable_frames of ${t.image}  must be continuous, and start from 0`)
        }
      }

      this.ldf.nodeAttrs[t.image] = {
        LIN_protocol: this.visit(ctx.LIN_protocolClause[index] as CstNode),
        configured_NAD: Number(
          ((ctx.configured_NADClause[index] as CstNode).children.Interger[0] as IToken).image
        ),
        initial_NAD: ctx.initial_NADClause[index]
          ? Number(((ctx.initial_NADClause[index] as CstNode).children.Interger[0] as IToken).image)
          : undefined,
        supplier_id: Number(
          ((ctx.product_idClause[index] as CstNode).children.Interger[0] as IToken).image
        ),
        function_id: Number(
          ((ctx.product_idClause[index] as CstNode).children.Interger[1] as IToken).image
        ),
        variant: (ctx.product_idClause[index] as CstNode).children.Interger[2]
          ? Number(((ctx.product_idClause[index] as CstNode).children.Interger[2] as IToken).image)
          : undefined,
        response_error: ctx.response_errorClause
          ? ((ctx.response_errorClause[index] as CstNode).children.Identifier[0] as IToken).image
          : undefined,
        fault_state_signals: [
          ...(ctx.fault_state_signalsClause && ctx.fault_state_signalsClause[index]
            ? (
                (ctx.fault_state_signalsClause[index] as CstNode).children.Identifier as IToken[]
              ).map((i) => i.image)
            : [])
        ],
        P2_min:
          ctx.P2_minClause && ctx.P2_minClause[index]
            ? Number(((ctx.P2_minClause[index] as CstNode).children.Interger[0] as IToken).image)
            : undefined,
        ST_min:
          ctx.ST_minClause && ctx.ST_minClause[index]
            ? Number(((ctx.ST_minClause[index] as CstNode).children.Interger[0] as IToken).image)
            : undefined,
        N_As_timeout:
          ctx.N_As_timeoutClause && ctx.N_As_timeoutClause[index]
            ? Number(
                ((ctx.N_As_timeoutClause[index] as CstNode).children.Interger[0] as IToken).image
              )
            : undefined,
        N_Cr_timeout:
          ctx.N_Cr_timeoutClause && ctx.N_Cr_timeoutClause[index]
            ? Number(
                ((ctx.N_Cr_timeoutClause[index] as CstNode).children.Interger[0] as IToken).image
              )
            : undefined,

        //TODO:
        configFrames: configFramesVal
      }
    }
    // console.log(this.ldf.nodeAttrs)
  }

  compositeClause(ctx: CstChildrenDictionary) {
    //TODO:
    // console.log(ctx)
    this.ldf.composite = {}
    for (const [index, i] of ctx.configuration_nameClause.entries()) {
      const c = (i as CstNode).children

      const nodes: CompositeNode[] = []
      for (const n of c.composite_nodeClause) {
        const t: any = {}
        const c1 = (n as CstNode).children
        t.compositeNode = (c1.Identifier[0] as IToken).image
        t.logicalNodes = [
          ...c1.Identifier.slice(1).map((identToken) => (identToken as IToken).image)
        ]
        nodes.push(t)
      }
      this.ldf.composite[(c.Identifier[0] as IToken).image] = nodes
    }
  }

  SignalsClause(ctx: CstChildrenDictionary) {
    this.ldf.signals = {}
    for (const s of ctx.signalClause) {
      const cs = (s as CstNode).children
      this.ldf.signals[(cs.Identifier[0] as IToken).image] = {
        signalName: (cs.Identifier[0] as IToken).image,
        signalSizeBits: Number((cs.Interger[0] as IToken).image),
        initValue:
          cs.initvalueArrayClause && cs.initvalueArrayClause[0]
            ? (cs.initvalueArrayClause[0] as CstNode).children.Interger.map((x) => {
                return Number((x as IToken).image)
              })
            : Number((cs.Interger[1] as IToken).image),
        punishedBy: (cs.Identifier[1] as IToken).image,
        subscribedBy: [...cs.Identifier.slice(2).map((identToken) => (identToken as IToken).image)],
        singleType: cs.initvalueArrayClause && cs.initvalueArrayClause[0] ? 'ByteArray' : 'Scalar'
      }
    }
  }

  Diagnostic_signalsClause(ctx: CstChildrenDictionary) {
    if (ctx.DiagReq.length != 16) {
      throw new Error('DiagReq length must be 16')
    }
  }

  Signal_groupsClause(ctx: CstChildrenDictionary) {
    // Each Terminal or Non-Terminal in a grammar rule are collected into
    // an array with the same name(key) in the ctx object.
    this.ldf.signalGroups = []

    for (const m of ctx.MSignal_groupClause) {
      const rm = (m as CstNode).children
      this.ldf.signalGroups.push({
        name: (rm.Identifier[0] as IToken).image,
        size: Number((rm.Interger[0] as IToken).image),
        signals: [
          ...rm.Signal_groupClause.map((identToken) => {
            const srm = (identToken as CstNode).children
            return {
              name: (srm.Identifier[0] as IToken).image,
              offset: Number((srm.Interger[0] as IToken).image)
            }
          })
        ]
      })
    }
  }

  framesClause(ctx: CstChildrenDictionary) {
    this.ldf.frames = {}
    for (const m of ctx.subframeClause) {
      const rm = (m as CstNode).children
      this.ldf.frames[(rm.Identifier[0] as IToken).image] = {
        name: (rm.Identifier[0] as IToken).image,
        id: Number((rm.Interger[0] as IToken).image),
        publishedBy: (rm.Identifier[1] as IToken).image,
        frameSize: Number((rm.Interger[1] as IToken).image),
        signals: [
          ...rm.subframeSignalClause.map((identToken) => {
            const srm = (identToken as CstNode).children
            return {
              name: (srm.Identifier[0] as IToken).image,
              offset: Number((srm.Interger[0] as IToken).image)
            }
          })
        ]
      }
    }
  }

  Sporadic_framesClause(ctx: CstChildrenDictionary) {
    this.ldf.sporadicFrames = {}
    for (const m of ctx.Sporadic_frameClause) {
      const rm = (m as CstNode).children

      this.ldf.sporadicFrames[(rm.Identifier[0] as IToken).image] = {
        name: (rm.Identifier[0] as IToken).image,
        frameNames: [...rm.Identifier.slice(1).map((identToken) => (identToken as IToken).image)]
      }
    }
  }

  Event_triggered_framesClause(ctx: CstChildrenDictionary) {
    this.ldf.eventTriggeredFrames = {}
    for (const m of ctx.Event_triggered_frameClause) {
      const rm = (m as CstNode).children

      this.ldf.eventTriggeredFrames[(rm.Identifier[0] as IToken).image] = {
        name: (rm.Identifier[0] as IToken).image,
        schTableName: (rm.Identifier[1] as IToken).image,
        frameId: Number((rm.Interger[0] as IToken).image),
        frameNames: [...rm.Identifier.slice(2).map((identToken) => (identToken as IToken).image)]
      }
    }
  }

  Diagnostic_framesClause(ctx: CstChildrenDictionary) {
    if (ctx.DiagReqFrame.length != 2) {
      throw new Error('DiagReqFrame length must be 2')
    }
    if (ctx.SubDiagReq.length != 16) {
      throw new Error('SubDiagReq length must be 16')
    }
  }

  Schedule_tablesClause(ctx: CstChildrenDictionary) {
    this.ldf.schTables = []

    for (const m of ctx.schItemClause) {
      const qrm = (m as CstNode).children
      const w: any = {
        name: (qrm.Identifier[0] as IToken).image,
        entries: []
      }
      for (const schItem of qrm.subSchItemClause) {
        const schItemChildren = (schItem as CstNode).children
        const command = (schItemChildren.commandClause[0] as CstNode).children
        const isCommand = command.Identifier ? false : true
        let name = ''
        const args: any = {}

        if (isCommand) {
          if (command.AssignNADClause) {
            const rrm = (command.AssignNADClause[0] as CstNode).children
            args.AssignNAD = {
              AssignNAD: (rrm.Identifier[0] as IToken).image
            }
            name = 'AssignNAD'
          } else if (command.ConditionalChangeNADClause) {
            const rrm = (command.ConditionalChangeNADClause[0] as CstNode).children
            args.ConditionalChangeNAD = {
              nad: Number((rrm.Interger[0] as IToken).image),
              id: Number((rrm.Interger[1] as IToken).image),
              byte: Number((rrm.Interger[2] as IToken).image),
              mask: Number((rrm.Interger[3] as IToken).image),
              inv: Number((rrm.Interger[4] as IToken).image),
              newNad: Number((rrm.Interger[5] as IToken).image)
            }
            name = 'ConditionalChangeNAD'
          } else if (command.DataDumpClause) {
            const rrm = (command.DataDumpClause[0] as CstNode).children
            args.DataDump = {
              nodeName: (rrm.Identifier[0] as IToken).image,
              D1: Number((rrm.Interger[0] as IToken).image),
              D2: Number((rrm.Interger[1] as IToken).image),
              D3: Number((rrm.Interger[2] as IToken).image),
              D4: Number((rrm.Interger[3] as IToken).image),
              D5: Number((rrm.Interger[4] as IToken).image)
            }
            name = 'DataDump'
          } else if (command.SaveConfigurationClause) {
            const rrm = (command.SaveConfigurationClause[0] as CstNode).children
            args.SaveConfiguration = {
              nodeName: (rrm.Identifier[0] as IToken).image
            }
            name = 'SaveConfiguration'
          } else if (command.AssignFrameIdRangeClause) {
            const rrm = (command.AssignFrameIdRangeClause[0] as CstNode).children
            args.AssignFrameIdRange = {
              nodeName: (rrm.Identifier[0] as IToken).image,
              frameIndex: Number((rrm.Interger[0] as IToken).image)
            }
            if (rrm.Interger.length > 1) {
              args.AssignFrameIdRange.framePID = [
                ...rrm.Interger.slice(1).map((item) => Number((item as IToken).image))
              ]
            }
            name = 'AssignFrameIdRange'
          } else if (command.FreeFormatClause) {
            const rrm = (command.FreeFormatClause[0] as CstNode).children
            args.FreeFormat = {
              D: [...rrm.Interger.map((item) => Number((item as IToken).image))]
            }
            name = 'FreeFormat'
          } else if (command.AssignFrameIdClause) {
            const rrm = (command.AssignFrameIdClause[0] as CstNode).children
            args.AssignFrameId = {
              nodeName: (rrm.Identifier[0] as IToken).image,
              frameName: (rrm.Identifier[1] as IToken).image
            }
            name = 'AssignFrameId'
          } else if (command.MasterSlaveReqClause) {
            const rrm = (command.MasterSlaveReqClause[0] as CstNode).children
            name = (rrm.MasterReqSlaveResp[0] as IToken).image
            if (name.startsWith('MasterReq')) {
              name = 'DiagnosticMasterReq'
            } else {
              name = 'DiagnosticSlaveResp'
            }
          } else {
            throw new Error('unknown command')
          }
        } else {
          name = (command.Identifier[0] as IToken).image
        }

        w.entries.push({
          name: name,
          delay: Number((schItemChildren.Interger[0] as IToken).image),
          isCommand: isCommand,
          ...args
        })
      }
      this.ldf.schTables.push(w)
    }
  }

  Signal_encoding_typesClause(ctx: CstChildrenDictionary) {
    if (ctx.MSignalValueClause) {
      for (const m of ctx.MSignalValueClause) {
        const rm = (m as CstNode).children
        const name = (rm.Identifier[0] as IToken).image
        const item: any = {
          name: name,
          encodingTypes: []
        }

        for (const s of rm.SignalValueClause) {
          const args: any = {}
          let type = ''
          const rs = (s as CstNode).children
          if (rs.logical_valueClause) {
            const rrm = (rs.logical_valueClause[0] as CstNode).children
            type = 'logicalValue'
            args.logicalValue = {
              signalValue: Number((rrm.Interger[0] as IToken).image),
              textInfo: rrm.CharString
                ? (rrm.CharString[0] as IToken).image.replace(/"+/g, '')
                : undefined
            }
          } else if (rs.physical_rangeClause) {
            type = 'physicalValue'
            const rrm = (rs.physical_rangeClause[0] as CstNode).children
            args.physicalValue = {
              minValue: Number((rrm.Interger[0] as IToken).image),
              maxValue: Number((rrm.Interger[1] as IToken).image),
              scale: Number((rrm.Interger[2] as IToken).image),
              offset: Number((rrm.Interger[3] as IToken).image),
              textInfo: rrm.CharString
                ? (rrm.CharString[0] as IToken).image.replace(/"+/g, '')
                : undefined
            }
          } else if (rs.bcd_valueClause) {
            type = 'bcdValue'
          } else if (rs.ascii_valueClause) {
            type = 'asciiValue'
          }
          item.encodingTypes.push({
            type: type,
            ...args
          })
        }
        this.ldf.signalEncodeTypes[item.name] = item
      }
    }
  }

  Signal_representationClause(ctx: CstChildrenDictionary) {
    this.ldf.signalRep = {}
    if (ctx.SubSignal_representationClause) {
      for (const m of ctx.SubSignal_representationClause) {
        const rm = (m as CstNode).children
        const name = (rm.Identifier[0] as IToken).image
        this.ldf.signalRep[name] = [...rm.Identifier.slice(1).map((item) => (item as IToken).image)]
      }
    }
  }

  LIN_protocolClause(ctx: CstChildrenDictionary) {
    // 获取值（可能是 CharString 或 Interger）
    const value = ctx.CharString
      ? (ctx.CharString[0] as IToken).image.replace(/"+/g, '')
      : (ctx.Interger[0] as IToken).image
    return value.trim()
  }
}

export function getFrameSize(ldfObj: LDF, frameName: string): number {
  if (frameName in ldfObj.frames) {
    const frame = ldfObj.frames[frameName]
    if (frame.signals.length == 0) {
      return 0
    }
    return frame.frameSize
  }

  if (frameName in ldfObj.eventTriggeredFrames) {
    const frames = ldfObj.eventTriggeredFrames[frameName].frameNames
    let maxbit = 0
    for (const fn of frames) {
      const bits = getFrameSize(ldfObj, fn)
      if (bits > maxbit) {
        maxbit = bits
      }
    }

    return maxbit
  }

  if (frameName in ldfObj.sporadicFrames) {
    const frames = ldfObj.sporadicFrames[frameName].frameNames
    let maxbit = 0
    for (const fn of frames) {
      const bits = getFrameSize(ldfObj, fn)
      if (bits > maxbit) {
        maxbit = bits
      }
    }

    return maxbit
  }
  return 0
  // if(frameName in ldfObj.value.)
}

// 添加一个函数来创建行号映射
function createLineMapping(originalText: string, processedText: string): number[] {
  const originalLines = originalText.split('\n')
  const processedLines = processedText.split('\n')
  const mapping: number[] = []
  let originalLineNum = 0

  for (let processedLineNum = 0; processedLineNum < processedLines.length; processedLineNum++) {
    while (originalLineNum < originalLines.length) {
      const originalLine = originalLines[originalLineNum].trim()
      const processedLine = processedLines[processedLineNum].trim()

      if (
        originalLine === processedLine ||
        originalLine.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/, '').trim() === processedLine
      ) {
        mapping[processedLineNum] = originalLineNum
        originalLineNum++
        break
      }
      originalLineNum++
    }
  }
  return mapping
}

function formatLexerError(
  error: any,
  text: string,
  originalText: string,
  lineMapping: number[]
): string {
  const lines = text.split('\n')
  const originalLines = originalText.split('\n')
  const lineNumber = error.line - 1
  const originalLineNumber = lineMapping[lineNumber]

  // Get context from original text
  const contextStart = Math.max(0, originalLineNumber - 3)
  const contextEnd = Math.min(originalLines.length, originalLineNumber + 4)
  const contextLines = originalLines.slice(contextStart, contextEnd)

  const context = contextLines
    .map((line, idx) => {
      const currentLineNumber = contextStart + idx + 1
      const linePrefix = currentLineNumber === originalLineNumber + 1 ? '>' : ' '
      return `${linePrefix} ${currentLineNumber.toString().padStart(4)}: ${line}`
    })
    .join('\n')

  const pointer = `     ${' '.repeat(error.column)}^`
  const message = `Lexer error at line ${originalLineNumber + 1}, column ${error.column}:
Context:
${context}
${pointer}
Unexpected character: "${error.message.split("'")[1]}"
`
  return message
}

function formatParserError(
  error: any,
  text: string,
  originalText: string,
  lineMapping: number[]
): string {
  const lines = text.split('\n')
  const originalLines = originalText.split('\n')
  let lineNumber = error.token.startLine - 1
  if (isNaN(lineNumber)) {
    // 如果行号是NaN，尝试从token的位置计算行号
    const textUpToToken = text.slice(0, error.token.startOffset)
    lineNumber = (textUpToToken.match(/\n/g) || []).length
  }

  const originalLineNumber = lineMapping[lineNumber] || lineNumber

  // 获取错误上下文
  const contextStart = Math.max(0, originalLineNumber - 3)
  const contextEnd = Math.min(originalLines.length, originalLineNumber + 4)
  const contextLines = originalLines.slice(contextStart, contextEnd)

  const context = contextLines
    .map((line, idx) => {
      const currentLineNumber = contextStart + idx + 1
      const linePrefix = currentLineNumber === originalLineNumber + 1 ? '>' : ' '
      return `${linePrefix} ${currentLineNumber.toString().padStart(4)}: ${line}`
    })
    .join('\n')

  const pointer = `     ${' '.repeat(error.token.startColumn || 0)}^`
  const message = `Parser error at line ${originalLineNumber + 1}, column ${error.token.startColumn || 0}:
Context:
${context}
${pointer}
${error.message}
Expected one of: ${(error.expectedTokens || []).join(', ')}`

  return message
}

export default function parseInput(text: string) {
  const originalText = text

  const lineMapping = createLineMapping(originalText, text)

  const lexingResult = LdfLexer.tokenize(text)
  if (lexingResult.errors.length > 0) {
    const formattedErrors = lexingResult.errors.map((err) =>
      formatLexerError(err, text, originalText, lineMapping)
    )
    throw new Error(`Lexing errors:\n${formattedErrors.join('\n\n')}`)
  }

  parser.input = lexingResult.tokens
  const vv = new LdfVistor()

  try {
    const cst = parser.ldfParse()
    if (parser.errors.length > 0) {
      const formattedErrors = parser.errors.map((err) =>
        formatParserError(err, text, originalText, lineMapping)
      )
      throw new Error(`Parsing errors:\n${formattedErrors.join('\n\n')}`)
    }
    vv.visit(cst)
    return vv.ldf
  } catch (err) {
    if (err instanceof Error) {
      throw err
    }
    // Handle unexpected errors
    throw new Error(`Unexpected error during parsing: ${err}`)
  }
}
