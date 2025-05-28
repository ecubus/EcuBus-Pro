// Definition of a grammar for DBC files
//
// Copyright (C) 2015-2024 Peter Vranken (mailto:Peter_Vranken@Yahoo.de)
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU Lesser General Public License as published by the
// Free Software Foundation, either version 3 of the License, or any later
// version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License
// for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.
grammar Dbc;


// This grammar has been designed according to Vector Informatik's language specification
// "DBC File Format Documentation". However many mistakes, gaps and inconsistencies can be
// found in the specification; we try to document the problems at the relavant locations of
// this file.
//   To begin, it is not stated, how white space has to be handled. As it is not mentioned
// one would assume that white space doesn't care. However the separation of messages is
// evidently made by a blank line and all real existing DBC files show a strict line
// orientation in their structure. We have to assume that end of line characters must not
// be ignored but form an important token. It's however completely open where they might
// appear and where they must not appear. The grammar will try to be most tolerant as
// possible.

/** @todo Javadoc comment can precede rule */
dbc : EOL* version?
      EOL* newSymbols?
      // Section 5, Bit Timing Definition
      EOL* 'BS_:' (baudRate=Integer ':' btr1=Integer ',' btr2=Integer)? EOL
      // Section 6: Node Definitions
      nodes
      valueTable*
      (msg | pseudoMsg)*
      messageTransmitter*
      environmentVariable*
      environmentVariableData*
      signalType*
      comment*
      (attributeDefinition | unrecognizedStatement)*
      (attributeDefault | unrecognizedStatement)*
      (attributeValue | unrecognizedStatement)*
      valueDescription*
      categoryDefinition*
      category*
      filter*
      signalTypeRef*
      signalGroup*
      // The specification doesn't make the next section signalExtendedValueTypeLists
      // optional and it specifies a single occurance but from the context it's doubtless
      // that it is optional and that it can be repeated
      signalExtendedValueTypeList*
      // Extended multiplexing
      multiplexedSignal*
      EOL*
      EOF
      ;

// Section 4, Version and New Symbol Specification
version : 'VERSION' title=String EOL ;

// Section 2, General Definitions
// Mostly, the keyword could also be mapped by the identifier. Not doing so implies that
// user defined symbols like messge or signal names can't accidentally be identical to a
// keyword, which is not permitted by the specification
keyword : 'VERSION' | 'NS_' | 'NS_DESC_' | newSymbol | 'BS_' | 'BU_' | 'BO_' | 'SG_'
          | 'EV_' | 'VECTOR__INDEPENDENT_SIG_MSG'
          // The string 'Vector_XXX' is used as dummy for not yet defined senders and
          // receivers. Likely, this is a mistake and should rather be 'VECTOR__XXX', i.e.
          // the keyword defined at the beginning (or vice versa). We can't sort this out
          // and stick to the specification
          | 'VECTOR__XXX'
          ;

// Section 4, Version and New Symbol Specification
newSymbol : 'CM_' | 'BA_DEF_' | 'BA_' | 'VAL_' 
            | 'CAT_DEF_' | 'CAT_' | 'FILTER' | 'BA_DEF_DEF_' | 'EV_DATA_' | 'ENVVAR_DATA_' 
            | 'SGTYPE_' | 'SGTYPE_VAL_' | 'BA_DEF_SGTYPE_' | 'BA_SGTYPE_' | 'SIG_TYPE_REF_'
            | 'VAL_TABLE_' | 'SIG_GROUP_' | 'SIG_VALTYPE_' | 'SIGTYPE_VALTYPE_'
            | 'BO_TX_BU_' | 'BA_DEF_REL_' | 'BA_REL_' | 'BA_DEF_DEF_REL_' | 'BU_SG_REL_'
            | 'BU_EV_REL_' | 'BU_BO_REL_' | 'SG_MUL_VAL_'
            // Those down here are not named by Vector in their language specification "DBC
            // File Format Documentation", Version 1.0.5, but have been found in real
            // existing DBC files.
            | 'NS_DESC_'
            ;
newSymbols : // Vector specifies '_NS' here but all real existing DBC files use 'NS_'.
             // The rule is made such that it will always consume a final EOL.
             ('_NS' | 'NS_') ':' (EOL | EOL? (newSymbol EOL)+)
             ;

// Section 6: Node Definitions
nodes : EOL* 'BU_:' (nodeList+=ID | dummyNode)* ;

// Section 7, Value Table Definitions
valueTable : EOL+ 'VAL_TABLE_' name=ID (singleValueDescription)* ';' ;

// Section 8, Message Definitions

// ID | dummyNode: The parser will swallow the dummy node name and say null if asked for
// the sender.
msg : EOL+ 'BO_' id=Integer name=ID ':' length=Integer (sender=ID | dummyNode)
      signal*
      ;
// A dedicated rule for section 8.1, Pseudo-message, means copied grammar code (bad) but
// clean parser code; the parser won't simply see the pseudo message if it listens to rule
// msg.
pseudoMsg : EOL+ 'BO_' Integer 'VECTOR__INDEPENDENT_SIG_MSG' ':' length=Integer
            (sender=ID | dummyNode)
            signal*
            ;


// Section 8.2, Signal Definitions
// The specification of the multiplexer is inconsistent and wrong. The EBNF syntax doesn't
// put the indicators m and M in quotes but there are no rules for those. Form the
// descriptive text it seems doubtless that terminal characters are meant and that's what
// we define here. Secondary, if no multiplex is used the specification explicitly demands
// a blank behind the signal name, for consistency reasons this would mean not to
// (necessarily) have a blank otherwise - but then the m/M would melt with the signal name,
// which is most likely not meant. The rule as implemented here expects a single character
// m or M, which is optional and whitespace separated from the signal name. However if it
// is not present the token : may immediately follow the signal name, with or without a
// blank in between.
signal : EOL 'SG_' name=ID mpxIndicator=ID? ':' startBit=Integer '|' length=Integer '@'
         byteOrder=Integer
         signed=Sign
         '(' factor=number ',' offset=number ')'
         '[' min=number '|' max=number ']'
         unit=String
         // The specification is inconsistent for the receiver list. The formal syntax list
         // permits the keyword 'Vector__XXX' at any list position and in any number of
         // repetitions. The descriptive text however says that the keyword is used if
         // there is no receiver around - in which case the list won't have any more
         // entries.
         //   We implement the grammar as formally specified since we saw DBC with lists
         // with true nodes and 'Vector__XXX'.
         (recList+=ID | dummyNode)
         (',' (recList+=ID | dummyNode))*
         ;
dummyNode : 'Vector__XXX' ;
signalExtendedValueTypeList : EOL+ 'SIG_VALTYPE_' msgId=Integer signalName=ID
                              // 0=signed or unsigned integer, 1=32-bit IEEE-float,
                              // 2=64-bit IEEE-double: The specification leaves open what 3
                              // means.
                              signalExtendedValueType=Integer ';'
                              ;

// Section 8.3, Definition of Message Transmitters
// We don't evaluate the tokens of the next, optional DBC element: "This is not used to
// define CAN layer-2 communication."
//   Likely a specification error: The transmitter names are found comma separated in real
// existing DBC files and this is indeed more consistent with other parts of the syntax
// format. We tolerate the specified and the likely correct format.
//   It's probably also a specification error that no transmitter is snytactically
// permitted although this makes the anyway optional statement useless.
messageTransmitter : EOL+ 'BO_TX_BU_' Integer ':' (ID (',' ID)*)? ';'
                     ;

// Sections 8.4, Signal Value Descriptions (Value Encodings), 9.1, Environment Variable
// Value Descriptions and 7.1, Value Descriptions (Value Encodings)
valueDescription : EOL+ 'VAL_' 
                   ( // Signal value descriptions 
                     msgId=Integer signalName=ID
                   | // Environment variable value descriptions.
                     envVarName=ID
                   ) 
                   singleValueDescription*
                   ';'
                   ;
// The specification requires a positive value, however, real existing DBC files use
// negative values. The parser should tolerate this with warning.
singleValueDescription : value=signedInteger description=String ;

// Section 9, Environment Variable Definitions
environmentVariable : EOL+ 'EV_' varName=ID ':'
                      type=Integer // 0=integer, 1=float, 2=string
                      '[' min=number '|' max=number ']'
                      unit=String
                      initValue=number
                      Integer // Event ID: Obsolete but not optional, can stay anonymous
                      // The access type is specified to be one out of DUMMY_NODE_VECTOR0,
                      // DUMMY_NODE_VECTOR1, DUMMY_NODE_VECTOR2, DUMMY_NODE_VECTOR3,
                      // DUMMY_NODE_VECTOR8000, DUMMY_NODE_VECTOR8001,
                      // DUMMY_NODE_VECTOR8002 or DUMMY_NODE_VECTOR8003. However, these are
                      // not specified to be keywords, which means that they can be legal
                      // identifiers (e.g. message or signal names) at the same time. If we
                      // placed the list of permitted words here like 'DUMMY_NODE_VECTOR0'
                      // | ... | 'DUMMY_NODE_VECTOR8003' then these words wouldn't be
                      // recognizable at the same time as ID in any other grammar rule. If
                      // environment variables are supported then explicit parser code will
                      // have to double check for the specific strings afterwards.
                      //   The number at the end of the strings encodes the access mode,
                      // see specification.
                      accessType=ID
                      // Probaly a mistake in the specification: Here the pseudo name
                      // VECTOR__XXX is used (which is by the way declared a keyword),
                      // whereas message and signal use Vector__XXX. We tolerate both.
                      (accessNodeList+=ID | 'VECTOR__XXX' | dummyNode)
                      (',' (accessNodeList+=ID | 'VECTOR__XXX' | dummyNode))*
                      ';'
                      ;
environmentVariableData : EOL+ 'ENVVAR_DATA_' varName=ID ':' sizeOfData=Integer ';' ;

// Specfication error: The syntax elements category_definitions, categories and filter are
// mentioned and they are marked obsolete but they are not specified. In real existing DBC
// files they might still be ssen. We need to skip them; any intepretation is impossible
// since there's no explanation. Skipping and ignoring is safely possible; the opening
// keyword can be guessed from the keyword list and all other syntax
// elements are completed by a EOL so this will hold for these, too.
categoryDefinition : EOL+ 'CAT_DEF_' ~(EOL | EOF)* ;
category : EOL+ 'CAT' ~(EOL | EOF)* ;
filter : EOL+ 'FILTER' ~(EOL | EOF)* ;


// Section 10, Signal Type and Signal Group Definitions

// The specification says: "Signal types are used to define the common properties of
// several signals. They are normally not used in DBC files." Consequently, they are parsed
// anonymously, just skipping the information.
signalType : EOL+ 'SGTYPE_' ID ':' Integer '@' Integer Sign '(' number ',' number ')'
             '[' number '|' number ']' String number ',' ID ';'
             ;
// According to the specification The next section starts with 'SGTYPE_'. This is likely an
// error in the specification; the appropriate keyword SIG_TYPE_REF_ is defined in the
// header, too. We accept both. Parsing is done anonymously as this belongs to the unused
// signal type.
signalTypeRef : EOL+ ('SGTYPE_' | 'SIG_TYPE_REF_') Integer ID ':' ID ';' ;

// The specification doesn't explain the meaning of repetitions. Is it the (redundant)
// number of signals in the group?
signalGroup : EOL+ 'SIG_GROUP_' msgId=Integer groupName=ID repetitions=Integer
              ':' (signalName+=ID)* ';' ;

// Section 11, Comment Definitions
comment : EOL+ 'CM_'
          (globalComment | nodeComment | msgComment | signalComment | envVarComment)
          ';'
          ;
globalComment : text=String ;
nodeComment : 'BU_' nodeName=ID text=String ;
msgComment : 'BO_' msgId=Integer text=String ;
signalComment : 'SG_' msgId=Integer signalName=ID text=String ;
envVarComment : 'EV_' envVarName=ID text=String ;


// Section 12, User Defined Attribute Definitions
attributeDefinition : EOL+ 'BA_DEF_'
                      objectType=('BU_' | 'BO_' | 'SG_' | 'EV_')?
                      attribName=String
                      (attribTypeInt | attribTypeFloat | attribTypeString | attribTypeEnum)
                      ';'
                      ;
attribTypeInt : type=('INT' | 'HEX') min=signedInteger max=signedInteger ;
attribTypeFloat : 'FLOAT' min=number max=number ;
attribTypeString : 'STRING' ;
attribTypeEnum : 'ENUM' (enumValList+=String (',' enumValList+=String)*)? ;
attributeDefault : EOL+ 'BA_DEF_DEF_' attribName=String attribVal ';' ;
attributeValue : EOL+ 'BA_' attribName=String
                 ( 'BU_' nodeName=ID 
                   | 'BO_' msgId=Integer
                   | 'SG_' msgId=Integer signalName=ID
                   | 'EV_' envVarName=ID
                 )?
                 attribVal
                 ';' 
                 ;
attribVal : numVal=number | stringVal=String ;


// Unspecified but real existing statements:
//   BA_DEF_REL_ is found between attributeDefinition and attributeDefault.
//   BA_REL_ is found after attributeValue.
// We skip these statements, assuming that they'll be terminated by an EOL as the others.
//   10/2019, new information: According to a new sample DBC file the statements XXX_REL_
// seem to be alternatives to XXX_. The variant XXX_REL_ specifies attributes with node
// (BU) dependent values. The normal statements XXX_ and the variants XXX_REL_ may appear
// in the same statement block and arbitrarily intermingled in this block. This could be
// handled like:
//   attributeDefinition : EOL+ ('BA_DEF_' | 'BA_DEF_REL_') ...
//   attributeDefault : EOL+ ('BA_DEF_DEF_' | 'BA_DEF_DEF_REL_') ...
//   attributeValue : EOL+ ('BA_' | 'BA_REL_') ...
//   The rest of the statement (...) depends on the statement variant, XXX_REL_ requires
// additional fields to refer to a particular node (BU).
//   It looks as if it is an either or, if XXX_ is used then XXX_REL_ must not appear and
// vice versa. Which means among more that it is not possible to have a network wide
// attribute default value and a second one for a particular node only.
//   All of this is based on the analysis of only a single sample DBC file. It is not
// documented in the Vector Informatik file format specification and it is not proven.
unrecognizedStatement : EOL+
                        statement=('BA_DEF_REL_'| 'BA_REL_' | 'BA_DEF_DEF_REL_'
                                   | 'BU_SG_REL_' | 'BU_EV_REL_' | 'BU_BO_REL_'
                                  )
                        ~(EOL | EOF)*
                        ;
unrecognizedAttributeDefinitionNodeSpecific :
                        EOL+ statement= 'BA_DEF_REL_' ~(EOL | EOF)* ;

// Section 13, Extended Multiplexing
multiplexedSignal : EOL+ 'SG_MUL_VAL_' msgId=Integer mpxSignalName=ID mpxSwitchName=ID
                    (fromList+=Integer Minus toList+=Integer)*
                    ';'
                    ;

number : Float | signedInteger ;

// The signed integer is expressed by two tokens. This makes the parser tolerate whitespace
// between sign and number - which is not specified. On the other hand, if we permit the
// sign to be (optional) part of the integer we would have to do a test on positive (most
// occurances of integers are positive) after parsing. 
// TODO Could Sign, Integer and SInteger coexist if order of rules is regarded?
signedInteger : Sign? Integer ;

// Lexer rules:
EOL : '\n' ;

// Section 2, General Definitions
// An arbitrary string consisting of any printable characters except double quotes and
// backslashes. Control characters like line feed, horizontal tab, etc. are tolerated, but
// their interpretation depends on the application. While it might be reasonable in
// descriptive strings is it meaningless in units.
//   In practice we often see the backslash in strings and sometimes an escaped backslash.
// The correct definition is unusable.
//String : '"' ~["\\]* '"' ; //"
String : '"' ('\\"' | ~'"')* '"' ;

ID : [a-zA-Z_] [a-zA-Z_0-9]* ; // match identifiers
Sign : Minus | Plus ;
Minus : '-' ;
Plus : '+' ;
Float : Sign?
        ( (Integer '.' Integer? | '.' Integer) ([eE] Sign? Integer)?
          | Integer [eE] Sign? Integer
        )
        ;
Integer : [0-9]+ ;
WS : [ \t\r]+ -> skip ; // skip spaces, tabs, newlines

// The specification doesn't introduce any comments. However, real existing DBC files tend
// to occasionally contain C/C++ style comments. Having the next two rule in place, these
// files would be successfully parsed.
//   Uncommenting these lines definitely violates the format specification!
BLOCK_COMMENT : '/*' .*? '*/' -> skip ;
LINE_COMMENT : '//' ~[\r\n]* -> skip ;