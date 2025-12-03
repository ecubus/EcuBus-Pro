from dataclasses import dataclass, field
from typing import List, Optional, Union, Any, Dict, Literal
from enum import Enum
import struct

# --- CAN Enums and Types ---

class CAN_ID_TYPE(str, Enum):
    STANDARD = 'STANDARD'
    EXTENDED = 'EXTENDED'

class CAN_ADDR_TYPE(str, Enum):
    PHYSICAL = 'PHYSICAL'
    FUNCTIONAL = 'FUNCTIONAL'

class CAN_ADDR_FORMAT(str, Enum):
    NORMAL = 'NORMAL'
    FIXED_NORMAL = 'NORMAL_FIXED'
    EXTENDED = 'EXTENDED'
    MIXED = 'MIXED'
    ENHANCED = 'ENHANCED'

@dataclass
class CanMsgType:
    idType: CAN_ID_TYPE
    brs: bool
    canfd: bool
    remote: bool

@dataclass
class CanMessage:
    id: int
    data: bytearray
    dir: Literal['IN', 'OUT']
    msgType: CanMsgType
    name: Optional[str] = None
    device: Optional[str] = None
    ts: Optional[int] = None
    isSimulate: Optional[bool] = None
    database: Optional[str] = None
    # children ignored for now as it is internal use

@dataclass
class CanAddr(CanMsgType):
    addrFormat: CAN_ADDR_FORMAT
    addrType: CAN_ADDR_TYPE
    SA: str
    TA: str
    AE: str
    canIdTx: str
    canIdRx: str
    nAs: int
    nAr: int
    nBs: int
    nCr: int
    stMin: int
    bs: int
    maxWTF: int
    dlc: int
    padding: bool
    paddingValue: str
    name: str = ''
    desc: Optional[str] = None
    nBr: Optional[int] = None
    nCs: Optional[int] = None

# --- LIN Enums and Types ---

class LinDirection(str, Enum):
    SEND = 'SEND'
    RECV = 'RECV'
    RECV_AUTO_LEN = 'RECV_AUTO_LEN'

class LinMode(str, Enum):
    MASTER = 'MASTER'
    SLAVE = 'SLAVE'

class LinChecksumType(str, Enum):
    CLASSIC = 'CLASSIC'
    ENHANCED = 'ENHANCED'

@dataclass
class LinCableErrorInject:
    breakLength: Optional[int] = 13
    breakDelLength: Optional[float] = 1
    hInterLength: Optional[int] = 0
    dInterLength: Optional[List[int]] = None
    syncVal: Optional[Union[int, bool]] = 0x55
    pid: Optional[Union[int, bool]] = None # default getPID(frameId)
    errorInject: Optional[Dict[str, int]] = None # bit, value
    checkSum: Optional[int] = None

@dataclass
class LinMsg:
    frameId: int
    data: bytearray
    direction: LinDirection
    checksumType: LinChecksumType
    checksum: Optional[int] = None
    database: Optional[str] = None
    device: Optional[str] = None
    workNode: Optional[str] = None
    name: Optional[str] = None
    isEvent: Optional[bool] = None
    uuid: Optional[str] = None
    ts: Optional[int] = None
    lincable: Optional[LinCableErrorInject] = None

class LIN_ADDR_TYPE(str, Enum):
    PHYSICAL = 'PHYSICAL'
    FUNCTIONAL = 'FUNCTIONAL'

class LIN_SCH_TYPE(str, Enum):
    DIAG_ONLY = 'DIAG_ONLY'
    DIAG_INTERLEAVED = 'DIAG_INTERLEAVED'

@dataclass
class LinAddr:
    name: str
    addrType: LIN_ADDR_TYPE
    nad: int
    stMin: int
    nAs: int
    nCr: int
    schType: LIN_SCH_TYPE

# --- UDS Types ---

DataType = Literal['NUM', 'ARRAY', 'ASCII', 'UNICODE', 'FLOAT', 'DOUBLE', 'FILE']
HardwareType = Literal['can', 'lin', 'eth', 'pwm', 'someip']

@dataclass
class Param:
    id: str
    name: str
    type: DataType
    value: bytearray
    phyValue: Any
    bitLen: int
    longName: Optional[str] = None
    desc: Optional[str] = None
    bitPos: Optional[int] = None
    meta: Optional[Dict[str, str]] = None
    deletable: Optional[bool] = None
    editable: Optional[bool] = None

# Helper for circular reference in ServiceItem <-> Param (not really circular but cleaner)
ServiceId = str # '0x10', 'Job', etc.

@dataclass
class ServiceItem:
    id: str
    name: str
    serviceId: ServiceId
    params: List[Param]
    respParams: List[Param]
    subfunc: Optional[str] = None
    suppress: Optional[bool] = None
    autoSubfunc: Optional[bool] = None
    desc: Optional[str] = None
    isNegativeResponse: Optional[bool] = None
    nrc: Optional[int] = None
    generateConfigs: Optional[Dict[str, str]] = None

@dataclass
class UdsAddress:
    type: HardwareType
    canAddr: Optional[CanAddr] = None
    # ethAddr: Optional[EthAddr] = None # TODO: Add when Eth/DoIP is implemented
    linAddr: Optional[LinAddr] = None

# --- SOMEIP Types (Basic placeholder as per uds.ts imports) ---

class SomeipMessageType(int, Enum):
    REQUEST = 0x00
    REQUEST_NO_RETURN = 0x01
    NOTIFICATION = 0x02
    RESPONSE = 0x80
    ERROR = 0x81

@dataclass
class SomeipMessageStruct:
    service: int
    method: int
    instance: int
    messageType: SomeipMessageType
    returnCode: int
    payload: bytearray

@dataclass
class SomeipMessageBase:
    msg: SomeipMessageStruct
    ts: Optional[int] = None

class SomeipMessageRequest(SomeipMessageBase):
    pass

class SomeipMessageResponse(SomeipMessageBase):
    pass

# --- Global Types ---

@dataclass
class VarUpdateItem:
    name: str
    value: Any

