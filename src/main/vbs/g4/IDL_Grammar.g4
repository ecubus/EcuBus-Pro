grammar IDL_Grammar;

// Specification
specification
   : definition+
   ;

definition
   : annotation
     ( module_dcl SEMICOLON
     | const_dcl SEMICOLON
     | type_dcl SEMICOLON
     | interface_dcl SEMICOLON
     )
   ;

// module_dcl
module_dcl
   : KW_MODULE identifier LEFT_BRACE module_contents+ RIGHT_BRACE
   ;

module_contents
   : module_content SEMICOLON
   ;

module_content
   : annotation
     ( type_dcl
     | module_dcl
     | const_dcl
     | interface_dcl
     )
   ;

// Interface
interface_dcl
   : interface_def
   | interface_forward_dcl
   ;

interface_forward_dcl
   : interface_kind identifier
   ;

interface_def
   : interface_header LEFT_BRACE interface_body RIGHT_BRACE
   ;

interface_header
   : interface_kind identifier
   | interface_inheritance_spec
   ;

interface_kind
   : KW_INTERFACE
   ;

interface_inheritance_spec
   : COLON interface_name (COMMA interface_name)*
   ;

interface_body
   : export_dcl*
   ;

export_dcl
   : annotation
     ( type_dcl SEMICOLON
     | const_dcl SEMICOLON
     | op_dcl SEMICOLON
     )
   ;

interface_name
   : scoped_name
   ;

// scoped_name
scoped_name
   : identifier
   | DOUBLE_COLON identifier
   | scoped_name DOUBLE_COLON identifier
   ;

annotated_scoped_name
   : annotation scoped_name
   ;

// Initialization Parameter
initialization_parameter_declaration
   : annotation KW_IN annotation type_spec annotation identifier
   ;

// Constant
const_dcl
   : KW_CONST const_type identifier EQUAL const_expr
   ;

const_type
   : annotation
     ( integer_type
     | floating_pt_type
     | char_type
     | wide_char_type
     | boolean_type
     | octet_type
     | string_type
     | scoped_name
     )
   ;

const_expr
   : or_expr
   ;

or_expr
   : xor_expr
   | xor_expr BITWISE_OR xor_expr
   ;

xor_expr
   : and_expr
   | xor_expr BITWISE_XOR and_expr
   ;

and_expr
   : shift_expr
   | and_expr BITWISE_AND shift_expr
   ;

shift_expr
   : add_expr
   | shift_expr SHIFT_LEFT add_expr
   | shift_expr SHIFT_RIGHT add_expr
   ;

add_expr
   : mult_expr
   | add_expr PLUS mult_expr
   | add_expr MINUS mult_expr
   ;

mult_expr
   : unary_expr
   | mult_expr MULT unary_expr
   | mult_expr DIV unary_expr
   | mult_expr MOD unary_expr
   ;

unary_expr
   : primary_expr
   | unary_operator primary_expr
   ;

primary_expr
   : scoped_name
   | literal
   | LEFT_BRACKET const_expr RIGHT_BRACKET
   ;

unary_operator
   : (PLUS | MINUS |  BITWISE_NOT)
   ;

literal
   : (INTEGER_LITERAL
   | HEX_LITERAL
   | OCTAL_LITERAL
   | CHARACTER_LITERAL
   | FLOATING_PT_LITERAL
   | BOOLEAN_LITERAL
   | STRING_LITERAL)
   ;

type_dcl
   : constr_type_dcl
   | typedef_dcl
   ;

typedef_dcl
   : KW_TYPEDEF annotation type_declarator
   ;

// Type Declaration
constr_type_dcl
   : typedef_dcl
   | struct_dcl
   | union_def
   | enum_dcl
   | annotation identifier
   ;

type_declarator
   : type_spec declarators
   ;

type_spec
   : simple_type_spec
   ;


simple_type_spec
   : base_type_spec
   | template_type_spec
   | scoped_name
   ;

base_type_spec
   : integer_type
   | floating_pt_type
   | char_type
   | wide_char_type
   | boolean_type
   | octet_type
   ;

template_type_spec
   : sequence_type
   | string_type
   ;

// Declarators
declarators
   : declarator (COMMA declarator)*
   ;

declarator
   : simple_declarator
   | complex_declarator
   ;

simple_declarator
   :identifier
   ;

complex_declarator
   : array_declarator
   ;

// Floating Point Type
floating_pt_type
   : float_type
   | double_type
   | long_double_type
   ;

float_type
   : FLOAT_TYPE
   ;

double_type
   : DOUBLE_TYPE
   ;

long_double_type
   : LONG_TYPE DOUBLE_TYPE
   ;

// Integer Type
integer_type
   : signed_int
   | unsigned_int
   ;

signed_int
   : signed_octet_int
   | signed_short_int
   | signed_long_int
   | signed_longlong_int
   ;

signed_octet_int
   : INT8_TYPE
   ;

signed_short_int
   : SHORT_TYPE
   | INT16_TYPE
   ;

signed_long_int
   : LONG_TYPE
   | INT32_TYPE
   ;

signed_longlong_int
   : LONG_TYPE LONG_TYPE
   | INT64_TYPE
   ;

unsigned_int
   : unsigned_octet_int
   | unsigned_short_int
   | unsigned_long_int
   | unsigned_longlong_int
   ;

unsigned_octet_int
   : UINT8_TYPE
   ;

unsigned_short_int
   : UNSIGNED_TYPE SHORT_TYPE
   | UINT16_TYPE
   ;

unsigned_long_int
   : UNSIGNED_TYPE LONG_TYPE
   | UINT32_TYPE
   ;

unsigned_longlong_int
   : UNSIGNED_TYPE LONG_TYPE LONG_TYPE
   | UINT64_TYPE
   ;

// Other Types
char_type
   : CHAR_TYPE
   ;

wide_char_type
   : WCHAR_TYPE
   ;

boolean_type
   : KW_BOOLEAN
   ;

octet_type
   : OCTET_TYPE
   ;

// Annotation
annotation
   : (annotation_appl)*
   ;

annotation_appl
   : AT (scoped_name | KW_DEFAULT)  (LEFT_BRACKET annotation_appl_params RIGHT_BRACKET)?
   ;

annotation_appl_params
   : const_expr (COMMA const_expr)*
   | annotation_appl_param (COMMA annotation_appl_param)*
   ;

annotation_appl_param
   : identifier EQUAL const_expr
   ;


// Struct
struct_dcl
   : struct_def
   | struct_forward_dcl
   ;

struct_def
   : KW_STRUCT identifier (COLON scoped_name )? LEFT_BRACE member_list RIGHT_BRACE
   ;

struct_forward_dcl
   : KW_STRUCT identifier
   ;

member_list
   : member*
   ;

member
   : annotation type_spec declarators SEMICOLON
   ;


// Union
union_dcl
   : union_def
   | union_forward_dcl
   ;

union_def
   : KW_UNION identifier KW_SWITCH LEFT_BRACKET switch_type_spec RIGHT_BRACKET LEFT_BRACE switch_body RIGHT_BRACE
   ;

union_forward_dcl
   : KW_UNION identifier
   ;

switch_type_spec
   : integer_type
   | char_type
   | boolean_type
   | scoped_name
   ;

switch_body
   : case+
   ;

case
   : case_label+ element_spec SEMICOLON
   ;

case_label
   : KW_CASE const_expr COLON
   | KW_DEFAULT COLON
   ;

element_spec
   : type_spec declarator
   ;

// Enum
enum_dcl
   : KW_ENUM identifier LEFT_BRACE enumerator_list RIGHT_BRACE
   ;

enumerator_list
   : enumerator (COMMA enumerator)*
   ;

enumerator
   : declarator (EQUAL const_expr)*
   ;

// String
string_type
   : KW_STRING (LEFT_ANG_BRACKET positive_int_const RIGHT_ANG_BRACKET)?
   ;


positive_int_const
   : const_expr
   ;

// Sequence
sequence_type
   : KW_SEQUENCE LEFT_ANG_BRACKET annotation simple_type_spec (COMMA positive_int_const)? RIGHT_ANG_BRACKET
   ;

// Array
array_declarator
   : identifier fixed_array_size+
   ;

fixed_array_size
   : LEFT_SQUARE_BRACKET positive_int_const RIGHT_SQUARE_BRACKET
   ;

// Operation
op_dcl
   : operation_type_spec identifier parameter_dcls
   ;

operation_type_spec
   : type_spec
   | KW_VOID
   ;

parameter_dcls
   : LEFT_BRACKET (param_dcl (COMMA param_dcl)*)? RIGHT_BRACKET
   ;

param_dcl
   :  (param_attribute)? type_spec simple_declarator
   ;

param_attribute
   : KW_IN
   | KW_OUT
   | KW_INOUT
   ;

// Identifier
identifier
   : ID
   ;

// Lexer Rules
// Fragments
fragment DIGIT : [0-9];
fragment HEX_DIGIT : [0-9a-fA-F];
fragment ESCAPE_SEQUENCE : '\\' [btnfr"'\\];

// Literals
INTEGER_LITERAL : '-'? ('0' | [1-9] DIGIT*);
OCTAL_LITERAL : '0' [0-7]+;
HEX_LITERAL : '0' ('x' | 'X') HEX_DIGIT+;
FLOATING_PT_LITERAL : [+-]? (DIGIT+ '.' DIGIT* | '.' DIGIT+) ([eE] [+-]? DIGIT+)?;
STRING_LITERAL : '"' (ESCAPE_SEQUENCE | ~["\\])* '"';
CHARACTER_LITERAL : '\'' (ESCAPE_SEQUENCE | ~['\\]) '\'';

BOOLEAN_LITERAL : 'TRUE' | 'FALSE';

//symbol
// Delimiters
SEMICOLON : ';';
COLON : ':';
COMMA : ',';

// Brackets
LEFT_BRACE : '{';
RIGHT_BRACE : '}';
LEFT_BRACKET : '(';
RIGHT_BRACKET : ')';
LEFT_SQUARE_BRACKET : '[';
RIGHT_SQUARE_BRACKET : ']';
LEFT_ANG_BRACKET : '<';
RIGHT_ANG_BRACKET : '>';

// Operators
EQUAL : '=';
PLUS : '+';
MINUS : '-';
MULT : '*';
DIV : '/';
MOD : '%';
BITWISE_OR : '|';
BITWISE_XOR : '^';
BITWISE_AND : '&';
SHIFT_LEFT : '<<';
SHIFT_RIGHT : '>>';
BITWISE_NOT : '~';

// Special Symbols
DOUBLE_COLON : '::';
AT : '@';

//Rpc keywords
KW_IN : 'in';
KW_OUT : 'out';
KW_INOUT : 'inout';
KW_INTERFACE : 'interface';


KW_TYPEDEF : 'typedef';
KW_VOID : 'void';
KW_DEFAULT : 'default';
KW_MODULE : 'module';
KW_AT_ANNOTATION : '@annotation';
KW_IFNDEF : 'ifndef';

//Complex type
KW_SWITCH : 'switch';
KW_CASE : 'case';
KW_SEQUENCE : 'sequence';
KW_STRUCT : 'struct';
KW_ENUM : 'enum';
KW_CONST : 'const';
KW_STRING : 'string';
KW_UNION : 'union';

// Integer Types
CHAR_TYPE : 'char';
INT8_TYPE : 'int8';
INT16_TYPE : 'int16';
INT32_TYPE : 'int32';
INT64_TYPE : 'int64';
LONG_TYPE : 'long';
OCTET_TYPE : 'octet';
SHORT_TYPE : 'short';
UINT8_TYPE : 'uint8';
UINT16_TYPE : 'uint16';
UINT32_TYPE : 'uint32';
UINT64_TYPE : 'uint64';
UNSIGNED_TYPE : 'unsigned';

// Floating-Point Types
DOUBLE_TYPE : 'double';
FLOAT_TYPE : 'float';

// Other Types
KW_BOOLEAN : 'boolean';
WCHAR_TYPE : 'wchar';

ID : LETTER (LETTER | ID_DIGIT)*;
LETTER : [a-zA-Z_];
ID_DIGIT : [0-9];


//Hidden
WS : [ \r\t\u000C\n]+ -> channel(HIDDEN);
PREPROC_DIRECTIVE : '#' ~[\n]* '\n' -> channel(HIDDEN);
COMMENT : '/*' .*? '*/' -> channel(HIDDEN);
LINE_COMMENT : '//' ~[\n\r]* -> channel(HIDDEN);