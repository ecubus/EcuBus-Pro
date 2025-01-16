# Scope
This document doesn't claim to specifiy the complete [Vector DBC standard](http://vector.com/vi_candb_en.html)

# Format description
`<...>`: Required field
`[...]`: Optional field
`  |  `: Or (eg. <A|B>)

# Supported Keywords
## VERSION
Version identifier of the DBC file.
Format: `VERSION "<VersionIdentifier>"`

## NS_
Names used throughout the DBC file.
Format::
```
NS_:
    BS_
    CM_
    ...
```


## BS_
Bus configuration.
Format:: `BS_: <Speed>`
Speed in kBit/s

## BU_
List of all CAN-Nodes, seperated by whitespaces.

## BO_
Message definition.
Format: `BO_ <CAN-ID> <MessageName>: <MessageLength> <SendingNode>`
MessageLength in bytes.

## SG_
Signal definition.
Format: `SG_ <SignalName> [M|m<MultiplexerIdentifier>] : <StartBit>|<Length>@<Endianness><Signed> (<Factor>,<Offset>) [<Min>|<Max>] "[Unit]" [ReceivingNodes]`
Length in bits.
Signed: + = unsigned; - = signed
Endianness: 1 = little-endian, Intel; 0 = big-endian, Motorola
M: If M than this signals contains a multiplexer identifier.
MultiplexerIdentifier: Signal definition is only used if the value of the multiplexer signal equals to this value.

## CM_
Description field.
Format: `CM_ [<BU_|BO_|SG_> [CAN-ID] [SignalName]] "<DescriptionText>";`

## BA_DEF_
Attribute definition.
Format: `BA_DEF_ [BU_|BO_|SG_] "<AttributeName>" <DataType> [Config];`

DataType | Description         | Config format
---------|---------------------|----------------
INT      | integer             | `<min> <max>`
FLOAT    | floating point      | `<min> <max>`
STRING   | string              |
ENUM     | enumeration         | `"<Value0>","<Value1>"...`

## BA_DEF_DEF_
Attribute default value
Format: `BA_DEF_DEF_ "<AttributeName>" ["]<DefaultValue>["];`

## BA_
Attribute
Format: `BA_ "<AttributeName>" [BU_|BO_|SG_] [Node|CAN-ID] [SignalName] <AttributeValue>;`

## VAL_
Value definitions for signals.
Format: `VAL_ <CAN-ID> <SignalsName> <ValTableName|ValTableDefinition>;`

## VAL_TABLE_
Value table definition for signals.
Format: `VAL_TABLE_ <ValueTableName> <ValueTableDefinition>;`
ValueTableDefinition: List of `IntValue "StringValue"` Pairs, seperated by whitespaces

## BO_TX_BU_:
Transmitter for signals.
Format: `BO_TX_BU_ <CAN-ID> : [BU_ seperated by commas]`

## SIG_GROUP_:
Group signals assigned to one can-id. I guess it makes it easier to parse and assign the correct signals like this.
Format: `SIG_GROUP_ <CAN-ID> <IntValue> : [Signal];`

# Attributes
In this sections are standard attributes used by [CANpy](https://github.com/stefanhoelzl/CANpy) defined. The attributes can be overwritten within a DBC file.
## Message Attributes

### GenMsgSendType
Defines the send type of a message.
Supported types:
* cyclic
* triggered
* cyclicIfActive
* cyclicAndTriggered
* cyclicIfActiveAndTriggered
* none
Definition: `BA_DEF BO_ "GenMsgSendType" ENUM "cyclic","triggered","cyclicIfActive","cyclicAndTriggered","cyclicIfActiveAndTriggered","none"`
Default: none
Definition: `BA_DEF_DEF "GenMsgSendType" "none"`

### GenMsgCycleTime
Defines the cycle time of a message in ms.
Definition: `BA_DEF BO_ "GenMsgCycleTime" INT 0 0`
Default: 0
Definition: `BA_DEF_DEF "GenMsgCycleTime" 0`

### GenMsgStartDelayTime
Defines the allowed delay after startup this message must occure the first time in ms.
Definition: `BA_DEF BO_ "GenMsgStartDelayTime" INT 0 0`
Default: 0 (=GenMsgCycleTime)
Definition: `BA_DEF_DEF "GenMsgStartDelayTime" 0`

### GenMsgDelayTime
Defines the allowed delay for a message in ms.
Definition: `BA_DEF BO_ "GenMsgDelayTime" INT 0 0`
Default: 0
Definition: `BA_DEF_DEF "GenMsgDelayTime" 0`

## Signal Attributes
### GenSigStartValue
Defines the value as long as no value is set/received for this signal.
Definition: `BA_DEF SG_ "GenSigStartValue" INT 0 0`
Default: 0
Definition: `BA_DEF_DEF "GenSigStartValue" 0`

# Sources
http://pisnoop.s3.amazonaws.com/snoop_help_dbc.htm
http://www.racelogic.co.uk/_downloads/vbox/Application_Notes/CAN%20Format%20for%20VBOXII%20and%20PRO%20v4.pdf
https://hackage.haskell.org/package/ecu-0.0.8/src/src/j1939_utf8.dbc
http://www.ingenieurbuerobecker.de/downloads/CANtool_Manual.pdf