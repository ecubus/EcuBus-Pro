import json
import sys
import odxtools
import math
import uuid
from odxtools.compumethods.identicalcompumethod import IdenticalCompuMethod
from odxtools.compumethods.limit import Limit
from odxtools.compumethods.linearcompumethod import LinearCompuMethod
from odxtools.compumethods.texttablecompumethod import TexttableCompuMethod
from odxtools.dataobjectproperty import DataObjectProperty
from odxtools.diagcodedtype import DiagCodedType
from odxtools.dopbase import DopBase
from odxtools.dtcdop import DtcDop
from odxtools.encodestate import EncodeState
from odxtools.endofpdufield import EndOfPduField
from odxtools.environmentdatadescription import EnvironmentDataDescription
from odxtools.minmaxlengthtype import MinMaxLengthType
from odxtools.multiplexer import Multiplexer
from odxtools.parameters.codedconstparameter import CodedConstParameter
from odxtools.parameters.parameter import Parameter
from odxtools.parameters.parameterwithdop import ParameterWithDOP
from odxtools.parameters.physicalconstantparameter import PhysicalConstantParameter
from odxtools.parameters.reservedparameter import ReservedParameter
from odxtools.parameters.matchingrequestparameter import MatchingRequestParameter
from odxtools.parameters.tablekeyparameter import TableKeyParameter
from odxtools.parameters.tablestructparameter import TableStructParameter
from odxtools.parameters.valueparameter import ValueParameter
from odxtools.physicaltype import PhysicalType
from odxtools.standardlengthtype import StandardLengthType
from odxtools.structure import Structure

import traceback


def _patch_bytefield_parsing():
    """Read the byte fields real ODX files carry, not only conformant ones.

    A_BYTEFIELD is plain hexBinary, so odxtools takes it two characters at a
    time. That leaves three ways a real file breaks it: a "0x" prefix makes
    the first pair "0x" and raises `invalid literal for int() with base 16`,
    which is what aborts the whole import; surrounding whitespace shifts
    every pair and silently yields the wrong bytes (" 1A2B " read as
    01 A2 0B); and an odd digit count pads the tail instead of the head,
    silently multiplying the value by 16. Values reach this from CODED-VALUE,
    PHYS-CONSTANT-VALUE, PHYSICAL-DEFAULT-VALUE, COMPU-CONST and the limits
    of a text table, none of which strip their text.
    """
    from odxtools import odxtypes

    def bytefield_to_bytearray(bytefield):
        text = ''.join(str(bytefield or '').split())
        if text[:2].lower() == '0x':
            text = text[2:]
        if len(text) % 2:
            text = '0' + text
        return bytearray.fromhex(text)

    odxtypes.bytefield_to_bytearray = bytefield_to_bytearray
    odxtypes._PARSE_ODX_TYPE['A_BYTEFIELD'] = bytefield_to_bytearray


_patch_bytefield_parsing()


def _patch_rational_coefficient_parsing():
    """Read a fractional scaling factor on an integer-coded value.

    COMPU-RATIONAL-COEFFS holds real numbers -- a factor of 0.5 on a value
    coded as an integer is ordinary -- but odxtools parses the coefficients
    with the *internal* data type, which describes the coded value rather
    than the conversion. Such a document fails to load outright with
    "Expected an integer value, got 0.5".
    """
    from odxtools.compumethods.compurationalcoeffs import CompuRationalCoeffs
    from odxtools.exceptions import odxrequire
    from odxtools.odxtypes import DataType

    integer_types = (DataType.A_UINT32, DataType.A_INT32)

    def coeffs_from_et(et_element, context, *, value_type):
        def coefficient(text):
            number = float(text)
            # A whole coefficient keeps the type the document asked for.
            if value_type in integer_types and number.is_integer():
                return int(number)
            return number

        return CompuRationalCoeffs(
            value_type=value_type,
            numerators=[coefficient(odxrequire(elem.text))
                        for elem in et_element.iterfind('COMPU-NUMERATOR/V')],
            denominators=[coefficient(odxrequire(elem.text))
                          for elem in et_element.iterfind('COMPU-DENOMINATOR/V')],
        )

    CompuRationalCoeffs.coeffs_from_et = staticmethod(coeffs_from_et)


_patch_rational_coefficient_parsing()


def _load_document(file_path):
    """Load an ODX/PDX document, tolerating an incomplete archive.

    A PDX exported without the communication parameter files it references
    -- the ISO comparam subsets are commonly treated as standard and left
    out of the archive -- cannot be resolved strictly. Rather than refuse
    the file, read it again with references allowed to stay unresolved:
    every service is still there, only the addressing and timing the
    comparams would have supplied are not. The caller is told, so the user
    is not left wondering why the CAN identifiers look nothing like theirs.
    """
    try:
        return odxtools.load_file(file_path), []
    except Exception as strict_error:
        import odxtools.exceptions as odx_exceptions
        from odxtools.diaglayers.protocolraw import ProtocolRaw

        resolve_snrefs = ProtocolRaw._resolve_snrefs

        def resolve_without_comparams(self, context):
            if getattr(self, '_comparam_spec', None) is not None:
                return resolve_snrefs(self, context)
            # The protocol names a comparam spec the archive does not carry.
            super(ProtocolRaw, self)._resolve_snrefs(context)
            self._prot_stack = None
            for parent_ref in self.parent_refs:
                parent_ref._resolve_snrefs(context)

        odx_exceptions.strict_mode = False
        ProtocolRaw._resolve_snrefs = resolve_without_comparams
        try:
            db = odxtools.load_file(file_path)
        except Exception:
            raise strict_error
        finally:
            odx_exceptions.strict_mode = True
            ProtocolRaw._resolve_snrefs = resolve_snrefs

        print(f'odxparse: strict load failed, read leniently: {strict_error}',
              file=sys.stderr)
        return db, [
            'This file references communication parameter definitions it does '
            'not carry, so it was read without them. The values the file '
            'states are used as they are; a parameter the file leaves to a '
            'standard default is unknown and falls back to an EcuBus default.'
        ]


def _zeros(bit_length):
    return bytes(max(1, math.ceil((bit_length or 8) / 8)))


def _encode_or_zeros(encode, bit_length):
    """The bytes a parameter starts out with, or zeros of the right width.

    Encoding one parameter on its own is only a way to obtain a starting
    value for the editor: nothing downstream needs it to be the byte string
    the ECU would see. So a document the encoder refuses -- a MIN-MAX-LENGTH
    field that is not last in this fragment, a DTC default that is not in the
    DTC list -- has to cost that one value, not the whole service.
    """
    try:
        return encode()
    except Exception as e:
        print(f'odxparse: starting value unavailable ({e}), using zeros', file=sys.stderr)
        return _zeros(bit_length)


def _fit_bytes(value, bit_length):
    """`value` as exactly the width the parameter layout says it is."""
    expected = max(0, math.ceil((bit_length or 0) / 8))
    if expected == 0 or len(value) == expected:
        return value
    if len(value) > expected:
        return value[:expected]
    return value + bytes(expected - len(value))


def _is_number(text):
    try:
        float(text)
        return True
    except (TypeError, ValueError):
        return False


def _linear_limits(compu_method):
    """The physical limits of a linear conversion.

    odxtools moved them onto the method's segment; older releases carried
    them on the method itself.
    """
    holder = getattr(compu_method, 'segment', compu_method)
    return (getattr(holder, 'physical_lower_limit', None),
            getattr(holder, 'physical_upper_limit', None))


def _coded_value_to_bytes(coded_value, bit_length):
    """Convert CodedConstParameter.coded_value (int) to bytes. Avoids EncodeState API."""
    if coded_value is None:
        return bytes([0] * max(1, (bit_length + 7) // 8))
    nbytes = max(1, (bit_length + 7) // 8)
    return coded_value.to_bytes(nbytes, byteorder='big', signed=False)


def _encode_param_to_bytes(param, physical_value=None, is_end_of_pdu=True):
    """Encode a parameter into bytes. Compatible with odxtools v6 and v11+."""
    if hasattr(param, 'encode_into_pdu'):
        es = EncodeState(is_end_of_pdu=is_end_of_pdu)
        param.encode_into_pdu(physical_value, es)
        return bytes(es.coded_message)
    vals = {param.short_name: physical_value} if physical_value is not None else {}
    es = EncodeState(bytearray([]), vals, is_end_of_pdu=is_end_of_pdu)
    return param.get_coded_value_as_bytes(es)


def _encode_dop_to_bytes(dop, physical_value, is_end_of_pdu=True):
    """Encode a DOP (Structure/Multiplexer) into bytes. Compatible with odxtools v6 and v11+."""
    if hasattr(dop, 'encode_into_pdu'):
        es = EncodeState(is_end_of_pdu=is_end_of_pdu)
        dop.encode_into_pdu(physical_value, es)
        return bytes(es.coded_message)
    vals = physical_value if isinstance(physical_value, dict) else {}
    es = EncodeState(bytearray([]), vals, is_end_of_pdu=is_end_of_pdu)
    return dop.convert_physical_to_bytes(physical_value, es)


def _get_texttable_scales(compu_method):
    """Get TexttableCompuMethod scales. Compatible with odxtools v6 and v11+."""
    if hasattr(compu_method, 'compu_internal_to_phys'):
        citp = compu_method.compu_internal_to_phys
        if hasattr(citp, 'compu_scales'):
            return citp.compu_scales
        return citp
    return compu_method.internal_to_phys


def _compu_const_value(compu_const):
    """Extract the display value from a CompuConst. Compatible with odxtools v6 and v11+."""
    if hasattr(compu_const, 'vt') and compu_const.vt is not None:
        return compu_const.vt
    if hasattr(compu_const, 'v') and compu_const.v is not None:
        return str(compu_const.v)
    return str(compu_const)


subFuncList = {
    '0x10': {
        'name': 'DiagnosticSessionControl',
        'hasSubFunction': True,
    },
    '0x11': {
        'name': 'ECUReset',
        'hasSubFunction': True,
    },
    '0x27': {
        'name': 'SecurityAccess',
        'hasSubFunction': True,
    },
    '0x28': {
        'name': 'CommunicationControl',
        'hasSubFunction': True,
    },
    '0x29': {
        'name': 'Authentication',
        'hasSubFunction': True,
    },
    '0x3E': {
        'name': 'TesterPresent',
        'hasSubFunction': True,
    },
    '0x83': {
        'name': 'AccessTimingParameter',
        'hasSubFunction': True,
    },
    '0x84': {
        'name': 'SecuredDataTransmission',
        'hasSubFunction': False,
    },
    '0x85': {
        'name': 'ControlDTCSetting',
        'hasSubFunction': True,
    },
    '0x86': {
        'name': 'ResponseOnEvent',
        'hasSubFunction': True,
    },
    '0x87': {
        'name': 'LinkControl',
        'hasSubFunction': True,
    },
    '0x22': {
        'name': 'ReadDataByIdentifier',
        'hasSubFunction': False,
    },
    '0x23': {
        'name': 'ReadMemoryByAddress',
        'hasSubFunction': False,
    },
    '0x24': {
        'name': 'ReadScalingDataByIdentifier',
        'hasSubFunction': False,
    },
    '0x2A': {
        'name': 'ReadDataByPeriodicIdentifier',
        'hasSubFunction': False,
    },
    '0x2C': {
        'name': 'DynamicallyDefineDataIdentifier',
        'hasSubFunction': True,
    },
    '0x2E': {
        'name': 'WriteDataByIdentifier',
        'hasSubFunction': False,
    },
    '0x3D': {
        'name': 'WriteDataByIdentifier',
        'hasSubFunction': False,
    },
    '0x14': {
        'name': 'ClearDiagnosticInformation',
        'hasSubFunction': False,
    },
    '0x19': {
        'name': 'ReadDTCInformation',
        'hasSubFunction': False,
    },
    '0x2F': {
        'name': 'InputOutputControlByIdentifier',
        'hasSubFunction': False,
    },
    '0x31': {
        'name': 'RoutineControl',
        'hasSubFunction': True,
    },
    '0x34': {
        'name': 'RequestDownload',
        'hasSubFunction': False,
    },
    '0x35': {
        'name': 'RequestUpload',
        'hasSubFunction': False,
    },
    '0x36': {
        'name': 'TransferData',
        'hasSubFunction': False,
    },
    '0x37': {
        'name': 'RequestTransferExit',
        'hasSubFunction': False,
    },
    '0x38': {
        'name': 'RequestFileTransfer',
        'hasSubFunction': False,
    }
}


class OdxParse:
    def __init__(self):
        self.serviceDict = dict()
        self.paramDict = dict()
        # Services this document declares that could not be built, and any
        # note about how the document itself had to be read. A caller showing
        # "imported" without these would be lying to the user.
        self.skipped = []
        self.notes = []

    def bytes_to_hex(self, b):
        return ' '.join(f'{byte:02x}' for byte in b)

    def hex_to_bytes(self, h):
        return bytes.fromhex(h)

    def _toBufferObj(self, value, bitLen):
        """Convert bytes value to {type: 'Buffer', data: [...]} with length matching bitLen."""
        if isinstance(value, (bytes, bytearray)):
            data = list(value)
        elif isinstance(value, list):
            data = value
        else:
            data = [0]
        expected_len = max(1, math.ceil(bitLen / 8)) if bitLen else 1
        if len(data) < expected_len:
            data.extend([0] * (expected_len - len(data)))
        elif len(data) > expected_len > 0:
            data = data[:expected_len]
        return {'type': 'Buffer', 'data': data}

    def _normalizeParam(self, param):
        """Normalize param value to {type: 'Buffer', data: [...]} format."""
        if 'value' in param and 'bitLen' in param:
            param['value'] = self._toBufferObj(param['value'], param['bitLen'])
        if param.get('meta') and isinstance(param['meta'].get('subParams'), list):
            for sub in param['meta']['subParams']:
                self._normalizeParam(sub)
        return param

    def convert_complex_object(self, obj):
        if isinstance(obj, bytes) or isinstance(obj, bytearray):
            return self.bytes_to_hex(obj)
        elif isinstance(obj, dict):
            return {key: self.convert_complex_object(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self.convert_complex_object(element) for element in obj]
        elif isinstance(obj, (str, int, float, bool)) or obj is None:
            return obj
        else:
            return str(obj)

    def parseDiagCodedType(self, coded: DiagCodedType, bitLen: int):
        value = None
        if coded.base_data_type.name == 'A_FLOAT32':
            t = 'FLOAT'
            value = 0
        elif coded.base_data_type.name == 'A_FLOAT64':
            t = 'DOUBLE'
            value = 0
        elif coded.base_data_type.name == 'A_ASCIISTRING':
            t = 'ASCII'
            value = '0' * math.ceil(bitLen / 8)
        elif coded.base_data_type.name == 'A_BYTEFIELD':
            t = 'ARRAY'
            value = bytes([0] * math.ceil(bitLen / 8))
        elif coded.base_data_type.name == 'A_INT32' or coded.base_data_type.name == 'A_UINT32':
            t = 'NUM'
            value = 0
        elif coded.base_data_type.name == 'A_UNICODE2STRING':
            t = 'UNICODE'
            value = '0' * math.ceil(bitLen / 8)
        else:
            raise Exception('Not implemented coded type {}'.format(
                coded.base_data_type.name))
        return t, value

    def dopParams(self, param: Parameter, dop: DopBase, defVal=None):
        if isinstance(dop, DataObjectProperty):
            coded = dop.diag_coded_type
            meta = {
                'type': param.parameter_type,
                'dopType': dop.__class__.__name__,
            }
            endOfPdu = False

            if isinstance(coded, StandardLengthType):
                bitLen = coded.bit_length
                meta['bitMask'] = coded.bit_mask
            elif isinstance(coded, MinMaxLengthType):
                bitLen = coded.min_length * 8
                meta['maxLen'] = coded.max_length
                if coded.termination == 'END-OF-PDU':
                    endOfPdu = True
                meta['endOfPdu'] = endOfPdu
            else:
                raise Exception('Not implemented dop coded {}'.format(
                    coded.__class__.__name__))

            usedCoed = coded
            if dop.physical_type:
                t, val = self.parseDiagCodedType(usedCoed, bitLen)
                if dop.compu_method:
                    if isinstance(dop.compu_method, TexttableCompuMethod):
                        meta['choices'] = [_compu_const_value(scale.compu_const)
                                           for scale in _get_texttable_scales(dop.compu_method)]
                        val = meta['choices'][0]
                    elif isinstance(dop.compu_method, IdenticalCompuMethod):
                        pass
                    elif isinstance(dop.compu_method, LinearCompuMethod):
                        ll, ul = _linear_limits(dop.compu_method)
                        if ll is not None:
                            meta['min'] = ll.value
                        if ul is not None:
                            meta['max'] = ul.value
                        if ll is not None:
                            val = ll.value
                        elif ul is not None:
                            val = ul.value
                        else:
                            val = 0
                    else:
                        # A conversion this parser does not model still has a
                        # coded type, which is what the editor works on; only
                        # the physical reading of the value is lost.
                        meta['cm'] = dop.compu_method.__class__.__name__

            defBytesVal = _encode_or_zeros(
                lambda: _encode_param_to_bytes(
                    param, defVal if defVal else val, is_end_of_pdu=endOfPdu),
                bitLen)

            return {
                'name': param.short_name,
                'longName': param.long_name,
                'desc': param.description,
                'type': t,
                'value': defBytesVal,
                'phyValue': defVal if defVal else val,
                'bitLen': bitLen,
                'bitPos': param.bit_position,
                'bytePos': param.byte_position,
                'meta': meta
            }
        elif isinstance(dop, Structure):
            pr = []
            endOfPdu = False
            for p in dop.parameters:
                v = self.parasParams(p)
                if v:
                    if v['bitLen'] is None:
                        raise Exception(v)
                    if v['meta'].get('endOfPdu'):
                        endOfPdu = True
                    pr.append(v)
                else:
                    raise Exception('Not implemented param {}'.format(
                        p.__class__.__name__))

            allValue = dict()
            for item in pr:
                allValue[item['name']] = item['phyValue']

            meta = {
                'byteSIze': dop.byte_size,
                'subParams': pr,
                'type': param.parameter_type,
                'dopType': dop.__class__.__name__,
            }

            maxBytePos = 0
            allBitLen = 0
            for p in pr:
                if p['bytePos'] >= maxBytePos:
                    maxBytePos = p['bytePos']
                    allBitLen = math.ceil((p['bytePos'] * 8 + p['bitLen']) / 8) * 8

            bytesVal = _encode_or_zeros(
                lambda: _encode_dop_to_bytes(dop, allValue, is_end_of_pdu=endOfPdu),
                allBitLen)
            # The member layout, and BYTE-SIZE where the document gives one,
            # is what says how wide the structure is; the encoder can append
            # a byte the structure does not have. An end-of-PDU structure has
            # no fixed width to hold it to.
            if not endOfPdu:
                bytesVal = _fit_bytes(bytesVal, allBitLen)
            return {
                'name': param.short_name,
                'longName': param.long_name,
                'desc': param.description,
                'phyValue': allValue,
                'value': bytesVal,
                'type': 'ARRAY',
                'bytePos': param.byte_position,
                'bitPos': param.bit_position,
                'bitLen': allBitLen,
                'meta': meta
            }
        elif isinstance(dop, EndOfPduField):
            structure = dop.structure
            meta = {
                'min': dop.min_number_of_items,
                'max': dop.max_number_of_items,
                'type': param.parameter_type,
                'dopType': dop.__class__.__name__,
            }
            ret = self.dopParams(param, structure, defVal)
            ret['meta'].update(meta)
            return ret
        elif isinstance(dop, DtcDop):
            coded = dop.diag_coded_type
            meta = {
                'type': param.parameter_type,
                'dopType': dop.__class__.__name__,
            }
            t, val = self.parseDiagCodedType(coded, coded.bit_length)
            cm = dop.compu_method
            meta['cm'] = cm.__class__.__name__
            if isinstance(cm, TexttableCompuMethod):
                meta['choices'] = [_compu_const_value(scale.compu_const)
                                   for scale in _get_texttable_scales(cm)]
                val = meta['choices'][0]
            elif isinstance(cm, IdenticalCompuMethod):
                pass
            elif isinstance(cm, LinearCompuMethod):
                ll, ul = _linear_limits(cm)
                if ll is not None:
                    meta['min'] = ll.value
                if ul is not None:
                    meta['max'] = ul.value
                if ll is not None:
                    val = ll.value
                elif ul is not None:
                    val = ul.value
                else:
                    val = 0
            else:
                meta['cm'] = cm.__class__.__name__
            defBytesVal = _encode_or_zeros(
                lambda: _encode_param_to_bytes(param, defVal if defVal else val),
                coded.bit_length)
            dtcs = dop.dtcs
            meta['dtcs'] = []
            for dtc in dtcs:
                v = {
                    'name': dtc.short_name,
                    'troubleCode': dtc.trouble_code,
                    'text': dtc.text,
                    'displayTroubleCode': dtc.display_trouble_code,
                    'level': dtc.level,
                }
                meta['dtcs'].append(v)
            return {
                'name': param.short_name,
                'longName': param.long_name,
                'desc': param.description,
                'type': t,
                'value': defBytesVal,
                'phyValue': defVal if defVal else val,
                'bitLen': coded.bit_length,
                'bitPos': param.bit_position,
                'bytePos': param.byte_position,
                'meta': meta
            }
        elif isinstance(dop, EnvironmentDataDescription):
            return {
                'name': param.short_name,
                'longName': param.long_name,
                'desc': param.description,
                'type': 'ARRAY',
                'value': bytes(),
                'phyValue': bytes([]),
                'bitLen': 0,
                'bitPos': 0,
                'bytePos': param.byte_position,
                'meta': {
                    'type': param.parameter_type,
                    'dopType': dop.__class__.__name__,
                }
            }
        elif isinstance(dop, Multiplexer):
            cases = []
            dictVal = dict()
            for c in dop.cases:
                v = self.dopParams(param, c.structure, defVal)
                if v:
                    v['name'] = c.short_name
                    v['longName'] = c.long_name
                    v['desc'] = c.description
                    cases.append(v)
                    dictVal[v['name']] = v['phyValue']
                else:
                    raise Exception('Not implemented param {}'.format(
                        c.__class__.__name__))
            meta = {
                'type': param.parameter_type,
                'dopType': dop.__class__.__name__,
                'cases': cases,
            }
            val = _encode_or_zeros(lambda: _encode_dop_to_bytes(dop, dictVal), None)
            return {
                'name': param.short_name,
                'longName': param.long_name,
                'desc': param.description,
                'type': 'ARRAY',
                'value': val,
                'phyValue': dictVal,
                'bitLen': len(val) * 8,
                'bitPos': param.bit_position,
                'bytePos': param.byte_position,
                'meta': meta
            }
        else:
            raise Exception('Not implemented dop {}'.format(
                dop.__class__.__name__))

    def parasParams(self, param: Parameter):
        if isinstance(param, ValueParameter):
            return self.dopParams(param, param.dop, param.physical_default_value)
        elif isinstance(param, CodedConstParameter):
            coded = param.diag_coded_type
            defVal = _coded_value_to_bytes(param.coded_value, coded.bit_length)
            t, _ = self.parseDiagCodedType(coded, coded.bit_length)
            meta = {
                'type': param.parameter_type
            }
            return {
                'name': param.short_name,
                'longName': param.long_name,
                'desc': param.description,
                'type': t,
                'value': defVal,
                'phyValue': param.coded_value,
                'bitLen': coded.bit_length,
                'bitPos': param.bit_position,
                'bytePos': param.byte_position,
                'meta': meta
            }
        elif isinstance(param, PhysicalConstantParameter):
            meta = {
                'phyValueRawStr': param.physical_constant_value_raw,
                'type': param.parameter_type
            }
            ret = self.dopParams(param, param.dop, param.physical_constant_value)
            ret['meta'].update(meta)
            return ret
        elif isinstance(param, ReservedParameter):
            val = _encode_or_zeros(lambda: _encode_param_to_bytes(param), param.bit_length)
            meta = {
                'type': param.parameter_type
            }
            return {
                'name': param.short_name,
                'longName': param.long_name,
                'desc': param.description,
                'phyValue': val,
                'type': 'ARRAY',
                'value': val,
                'bitLen': param.bit_length,
                'bitPos': param.bit_position,
                'bytePos': param.byte_position,
                'meta': meta
            }
        elif isinstance(param, TableKeyParameter):
            bitLen = 8
            try:
                table = param.table
                if table and hasattr(table, 'key_dop') and table.key_dop:
                    kd = table.key_dop
                    if hasattr(kd, 'diag_coded_type') and kd.diag_coded_type:
                        bitLen = kd.diag_coded_type.bit_length
            except Exception:
                pass
            byteLen = math.ceil(bitLen / 8)
            try:
                val = _encode_param_to_bytes(param)
                if len(val) != byteLen:
                    val = bytes(byteLen)
            except (RuntimeError, Exception):
                val = bytes(byteLen)
            choices = []
            try:
                table = param.table
                if table and hasattr(table, 'table_rows'):
                    for row in table.table_rows:
                        choices.append({
                            'key': row.key_raw if hasattr(row, 'key_raw') else str(row.short_name),
                            'name': row.short_name,
                            'longName': row.long_name,
                        })
            except Exception:
                pass
            return {
                'name': param.short_name,
                'longName': param.long_name,
                'desc': param.description,
                'type': 'NUM',
                'value': val,
                'phyValue': 0,
                'bitLen': bitLen,
                'bitPos': param.bit_position,
                'bytePos': param.byte_position,
                'meta': {
                    'type': param.parameter_type,
                    'choices': choices,
                }
            }
        elif isinstance(param, MatchingRequestParameter):
            bitLen = param.byte_length * 8
            return {
                'name': param.short_name,
                'longName': param.long_name,
                'desc': param.description,
                'type': 'ARRAY',
                'value': bytes(param.byte_length),
                'phyValue': bytes(param.byte_length),
                'bitLen': bitLen,
                'bitPos': param.bit_position,
                'bytePos': param.byte_position,
                'meta': {
                    'type': param.parameter_type,
                }
            }
        elif isinstance(param, TableStructParameter):
            table_key = param.table_key
            key_result = self.parasParams(table_key)
            bitLen = 0
            try:
                table = table_key.table
                if table and hasattr(table, 'table_rows'):
                    max_bits = 0
                    for row in table.table_rows:
                        if hasattr(row, 'structure') and row.structure:
                            row_bits = 0
                            for sp in row.structure.parameters:
                                sb = sp.get_static_bit_length() if hasattr(sp, 'get_static_bit_length') else None
                                if sb:
                                    row_bits += sb
                            if row_bits > max_bits:
                                max_bits = row_bits
                    bitLen = max_bits
            except Exception:
                pass
            byteLen = math.ceil(bitLen / 8) if bitLen > 0 else 0
            return {
                'name': param.short_name,
                'longName': param.long_name,
                'desc': param.description,
                'type': 'ARRAY',
                'value': bytes(byteLen),
                'phyValue': bytes(byteLen),
                'bitLen': bitLen,
                'bitPos': param.bit_position,
                'bytePos': param.byte_position if param.byte_position is not None else (key_result['bytePos'] + math.ceil(key_result['bitLen'] / 8) if key_result.get('bytePos') is not None else None),
                'meta': {
                    'type': param.parameter_type,
                    'tableKey': key_result['name'],
                }
            }
        else:
            raise Exception('Not implemented param {}'.format(
                param.__class__.__name__))

    def _detectServiceId(self, parameters):
        """Detect the service ID from request parameters.
        
        First tries semantic='SERVICE-ID', then falls back to detecting
        the first CodedConstParameter at byte_position=0 with bit_length=8.
        
        Returns:
            (serviceId hex string, index of SID param) or (None, -1)
        """
        for i, p in enumerate(parameters):
            if p.semantic == 'SERVICE-ID':
                sid_hex = hex(p.coded_value).upper().replace('0X', '0x')
                return sid_hex, i

        for i, p in enumerate(parameters):
            if isinstance(p, CodedConstParameter) and \
               p.byte_position == 0 and \
               hasattr(p, 'diag_coded_type') and \
               p.diag_coded_type.bit_length == 8:
                sid_hex = hex(p.coded_value).upper().replace('0X', '0x')
                return sid_hex, i

        return None, -1

    def _parseServiceList(self, dl, parseResp=False):
        """Parse all services from a diag layer, grouped by serviceId."""
        services = {}
        for service in dl.services:
            try:
                reqItem = {}
                reqItem['name'] = service.long_name if service.long_name else service.short_name
                item_id = str(uuid.uuid4())
                reqItem['id'] = item_id
                reqItem['desc'] = service.description
                needSub = False
                params = []
                self.serviceDict[item_id] = service

                sid_hex, sid_index = self._detectServiceId(service.request.parameters)

                for i, p in enumerate(service.request.parameters):
                    if i == sid_index:
                        continue
                    param = self.parasParams(p)
                    pid = str(uuid.uuid4())
                    param['id'] = pid
                    self.paramDict[pid] = p
                    params.append(param)

                if not sid_hex:
                    self.skipped.append({
                        'service': service.short_name,
                        'layer': dl.short_name,
                        'reason': 'no service identifier in the request',
                    })
                    continue

                reqItem['serviceId'] = sid_hex
                if sid_hex in subFuncList:
                    needSub = subFuncList[sid_hex]['hasSubFunction']
                else:
                    needSub = False

                respParams = []
                if parseResp:
                    for repo in service.positive_responses:
                        resp_sid_hex, resp_sid_index = self._detectServiceId(repo.parameters)
                        for idx, p in enumerate(repo.parameters):
                            if idx == resp_sid_index:
                                continue
                            pid = str(uuid.uuid4())
                            param = self.parasParams(p)
                            param['id'] = pid
                            self.paramDict[pid] = p
                            respParams.append(param)
                        break

                if needSub:
                    if len(params) > 0:
                        param = params[0]
                        if param['bytePos'] == 1 and param['bitLen'] == 8:
                            reqItem['autoSubfunc'] = True
                            reqItem['suppress'] = False
                        else:
                            needSub = False

                reqItem['params'] = [self._normalizeParam(p) for p in params]
                reqItem['respParams'] = [self._normalizeParam(p) for p in respParams]
                if needSub and len(reqItem['params']) > 0:
                    p0 = reqItem['params'][0]
                    if p0.get('bytePos') == 1 and p0.get('bitLen') == 8:
                        reqItem['subfunc'] = p0['value']
                if reqItem['serviceId'] not in services:
                    services[reqItem['serviceId']] = []
                services[reqItem['serviceId']].append(reqItem)
            except Exception as e:
                traceback.print_exc()
                self.skipped.append({
                    'service': service.short_name,
                    'layer': dl.short_name,
                    'reason': str(e),
                })
                continue

        return services

    def _extractComParamDefaults(self):
        """Extract communication parameter defaults from comparam subsets."""
        params = {}
        try:
            for subset in self.db.comparam_subsets:
                for cp in subset.comparams:
                    try:
                        params[cp.short_name] = cp.physical_default_value
                    except Exception:
                        pass
        except Exception:
            pass
        return params

    def _comparamRefs(self, dl):
        """Every COMPARAM-REF that applies to a diag layer, least specific first.

        Read off the raw layers rather than `dl.comparam_refs`, which drops a
        reference whose definition is missing -- exactly what happens when an
        archive does not carry the ISO comparam subsets.
        """
        refs = []
        seen = set()

        def walk(layer):
            if layer is None or id(layer) in seen:
                return
            seen.add(id(layer))
            for parent_ref in getattr(layer, 'parent_refs', []) or []:
                walk(getattr(parent_ref, 'layer', None))
            raw = getattr(layer, 'hierarchy_element_raw', None) or getattr(
                layer, 'diag_layer_raw', None)
            refs.extend(getattr(raw, 'comparam_refs', []) or [])

        walk(dl)
        return refs

    @staticmethod
    def _comparamName(ref):
        """A COMPARAM-REF's parameter name, from the reference itself.

        `ref.short_name` needs the definition, which an incomplete archive
        does not have; the reference always carries "<subset>.<parameter>".
        """
        ref_id = getattr(getattr(ref, 'spec_ref', None), 'ref_id', '') or ''
        return ref_id.rsplit('.', 1)[-1]

    def _canProtocolRefs(self, dl):
        """The COMPARAM-REFs of the one protocol this tester speaks.

        A document may describe the same ECU over several protocols, and the
        same parameter then appears once per protocol -- with different units
        in practice. Mixing them produces timings that belong to no protocol
        at all, so keep the refs of whichever protocol carries the CAN
        identifiers, plus those that name no protocol.
        """
        refs = self._comparamRefs(dl)
        protocols = [
            getattr(ref, 'protocol_snref', None) for ref in refs
            if self._comparamName(ref) in ('CP_UniqueRespIdTable', 'CP_CanPhysReqId')
        ]
        protocol = next((name for name in protocols if name), None)
        if protocol is None:
            return refs
        return [
            ref for ref in refs
            if getattr(ref, 'protocol_snref', None) in (None, protocol)
        ]

    def _layerComparams(self, dl):
        """The communication parameters that apply to a diag layer.

        The values the document sets take precedence over the defaults of the
        comparam subsets -- the whole point of a COMPARAM-REF -- and the CAN
        identifiers are folded in from CP_UniqueRespIdTable, which is where
        ODX keeps them.
        """
        params = dict(self._extractComParamDefaults())
        refs = self._canProtocolRefs(dl)
        for ref in refs:
            value = getattr(ref, 'value', None)
            if isinstance(value, str):
                params[self._comparamName(ref)] = value

        # Parent layers are walked first, so a later row is the more specific.
        for row in self._canIdTable(refs):
            params.update(row)
        return params

    def _canIdTable(self, refs):
        """The CAN identifiers a layer uses, from CP_UniqueRespIdTable.

        ODX keeps the physical request and response identifiers in this
        complex parameter, one row per ECU layer, each row listing three
        groups: physical request, USDT response, UUDT response. Documents
        order the fields within a group differently, so the addressing format
        -- the only element that says what it is -- anchors the reading: the
        identifier follows it, and the group's other number is the extended
        address.
        """
        rows = []
        for ref in refs:
            if self._comparamName(ref) != 'CP_UniqueRespIdTable':
                continue
            value = getattr(ref, 'value', None)
            if value is None or isinstance(value, str):
                continue
            values = [v for v in value if isinstance(v, str)]
            groups = [
                index for index, item in enumerate(values[:-1])
                if not _is_number(item) and _is_number(values[index + 1])
            ]
            row = {}
            for group, (identifier, ext_addr) in enumerate(
                    zip(('CP_CanPhysReqId', 'CP_CanRespUSDTId', 'CP_CanRespUUDTId'),
                        ('CP_CanPhysReqExtAddr', 'CP_CanRespUSDTExtAddr',
                         'CP_CanRespUUDTExtAddr'))):
                if group >= len(groups):
                    break
                index = groups[group]
                row[identifier] = values[index + 1]
                if index > 0 and _is_number(values[index - 1]):
                    row[ext_addr] = values[index - 1]
                elif index + 2 < len(values) and _is_number(values[index + 2]):
                    row[ext_addr] = values[index + 2]
            if row:
                rows.append(row)
        return rows

    def _buildUdsTime(self, comparams):
        """Build UdsInfo timing from communication parameters.
        
        ODX comparam timing values are in microseconds, converted to milliseconds.
        """
        uds_time = {
            'pTime': 5000,
            'pExtTime': 50000,
            's3Time': 5000,
            'testerPresentEnable': True,
        }

        for name in ['CP_P2Max', 'CP_P2ServerMax']:
            if name in comparams:
                try:
                    uds_time['pTime'] = int(float(comparams[name]) / 1000)
                except (ValueError, TypeError):
                    pass
                break

        for name in ['CP_P2Star', 'CP_P2StarMax', 'CP_P2StarServerMax']:
            if name in comparams:
                try:
                    uds_time['pExtTime'] = int(float(comparams[name]) / 1000)
                except (ValueError, TypeError):
                    pass
                break

        for name in ['CP_TesterPresentTime', 'CP_S3Client', 'CP_S3']:
            if name in comparams:
                try:
                    uds_time['s3Time'] = int(float(comparams[name]) / 1000)
                except (ValueError, TypeError):
                    pass
                break

        return uds_time

    def _buildDefaultCanAddr(self, comparams):
        """Build default CAN addresses from communication parameters.
        
        ODX transport layer timing values are in microseconds, converted to milliseconds.
        """
        can_phys_req = None
        can_resp = None
        can_func_req = None

        if 'CP_CanPhysReqId' in comparams:
            try:
                can_phys_req = int(float(comparams['CP_CanPhysReqId']))
            except (ValueError, TypeError):
                pass

        if 'CP_CanRespUSDTId' in comparams:
            try:
                can_resp = int(float(comparams['CP_CanRespUSDTId']))
            except (ValueError, TypeError):
                pass

        if 'CP_CanFuncReqId' in comparams:
            try:
                can_func_req = int(float(comparams['CP_CanFuncReqId']))
            except (ValueError, TypeError):
                pass

        bs = 0
        st_min = 10
        n_as = 1000
        n_ar = 1000
        n_bs = 1000
        n_cr = 1000

        for name in ['CP_BlockSize']:
            if name in comparams:
                try:
                    bs = int(float(comparams[name]))
                except (ValueError, TypeError):
                    pass
                break

        for name in ['CP_StMin']:
            if name in comparams:
                try:
                    # ISO 15765-2 states CP_StMin in microseconds
                    # (SCALE_LINEAR_UINT8_INT32_MicroSecond_StMin).
                    st_min = int(float(comparams[name]) / 1000)
                except (ValueError, TypeError):
                    pass
                break

        if 'CP_As' in comparams:
            try:
                n_as = int(float(comparams['CP_As']) / 1000)
            except (ValueError, TypeError):
                pass
        if 'CP_Ar' in comparams:
            try:
                n_ar = int(float(comparams['CP_Ar']) / 1000)
            except (ValueError, TypeError):
                pass
        if 'CP_Bs' in comparams:
            try:
                n_bs = int(float(comparams['CP_Bs']) / 1000)
            except (ValueError, TypeError):
                pass
        if 'CP_Cr' in comparams:
            try:
                n_cr = int(float(comparams['CP_Cr']) / 1000)
            except (ValueError, TypeError):
                pass

        addresses = []

        padding = True
        if comparams.get('CP_CanFillerByteHandling') is not None:
            handling = str(comparams['CP_CanFillerByteHandling'])
            if _is_number(handling):
                padding = float(handling) != 0
            else:
                padding = 'disable' not in handling.lower()

        padding_value = '0x0'
        if comparams.get('CP_CanFillerByte') is not None:
            try:
                padding_value = hex(int(float(comparams['CP_CanFillerByte'])))
            except (ValueError, TypeError):
                pass

        ext_addr = '0'
        if comparams.get('CP_CanPhysReqExtAddr'):
            try:
                ext_addr = str(int(float(comparams['CP_CanPhysReqExtAddr'])))
            except (ValueError, TypeError):
                pass

        tx_id = hex(can_phys_req) if can_phys_req is not None else '0x700'
        rx_id = hex(can_resp) if can_resp is not None else '0x701'
        is_extended = (can_phys_req is not None and can_phys_req > 0x7FF) or \
                      (can_resp is not None and can_resp > 0x7FF)

        phys_addr = {
            'type': 'can',
            'canAddr': {
                'name': 'Physical',
                'addrFormat': 'NORMAL',
                'addrType': 'PHYSICAL',
                'SA': '0',
                'TA': '0',
                'AE': ext_addr,
                'canIdTx': tx_id,
                'canIdRx': rx_id,
                'nAs': n_as,
                'nAr': n_ar,
                'nBs': n_bs,
                'nCr': n_cr,
                'stMin': st_min,
                'bs': bs,
                'maxWTF': 0,
                'dlc': 8,
                'padding': padding,
                'paddingValue': padding_value,
                'idType': 'EXTENDED' if is_extended else 'STANDARD',
                'brs': False,
                'canfd': False,
                'remote': False,
            }
        }
        addresses.append(phys_addr)

        if can_func_req is not None:
            func_addr = {
                'type': 'can',
                'canAddr': {
                    'name': 'Functional',
                    'addrFormat': 'NORMAL',
                    'addrType': 'FUNCTIONAL',
                    'SA': '0',
                    'TA': '0',
                    'AE': '0',
                    'canIdTx': hex(can_func_req),
                    'canIdRx': rx_id,
                    'nAs': n_as,
                    'nAr': n_ar,
                    'nBs': n_bs,
                    'nCr': n_cr,
                    'stMin': st_min,
                    'bs': bs,
                    'maxWTF': 0,
                    'dlc': 8,
                    'padding': padding,
                    'paddingValue': padding_value,
                    'idType': 'EXTENDED' if can_func_req > 0x7FF else 'STANDARD',
                    'brs': False,
                    'canfd': False,
                    'remote': False,
                }
            }
            addresses.append(func_addr)

        return addresses

    def parse(self, filePath, parseResp=False):
        """Parse ODX file and return services grouped by ECU container and diag layer."""
        self.serviceDict = dict()
        self.paramDict = dict()
        try:
            self.db, self.notes = _load_document(filePath)
            ecu = self.db.diag_layer_containers
            ecu_dict = {}
            for i in range(len(ecu)):
                name = ecu[i].short_name
                ecu_dict[name] = {}
                for j in range(len(ecu[i].diag_layers)):
                    dl = ecu[i].diag_layers[j]
                    dlName = dl.short_name
                    if dl.variant_type.name == "ECU_VARIANT" or dl.variant_type.name == "BASE_VARIANT":
                        services = self._parseServiceList(dl, parseResp)
                        ecu_dict[name][dlName] = services

            return {
                'error': 0,
                'data': self.convert_complex_object(ecu_dict),
                'skipped': self.skipped,
                'notes': self.notes,
            }
        except Exception as e:
            traceback.print_exception(e)
            return {'error': 1, 'message': str(e)}

    def parseTesterInfo(self, filePath, parseResp=True):
        """Parse ODX file and generate TesterInfo objects.
        
        Returns:
            {
                error: 0,
                data: {
                    containerName: {
                        diagLayerName: TesterInfo
                    }
                }
            }
        
        Each TesterInfo contains:
        - id, name, type, udsTime, seqList, address, allServiceList
        """
        self.serviceDict = dict()
        self.paramDict = dict()
        try:
            self.db, self.notes = _load_document(filePath)

            ecu = self.db.diag_layer_containers
            result = {}
            for container in ecu:
                container_name = container.short_name
                result[container_name] = {}

                for dl in container.diag_layers:
                    dl_name = dl.short_name
                    if dl.variant_type.name not in ("ECU_VARIANT", "BASE_VARIANT"):
                        continue

                    services = self._parseServiceList(dl, parseResp)
                    # Communication parameters are per layer: a variant may
                    # set its own, and the CAN identifiers come from the
                    # table entry that names it.
                    comparams = self._layerComparams(dl)
                    uds_time = self._buildUdsTime(comparams)
                    addresses = self._buildDefaultCanAddr(comparams)

                    tester_info = {
                        'id': str(uuid.uuid4()),
                        'name': dl_name,
                        'type': 'can',
                        'udsTime': uds_time,
                        'seqList': [],
                        'address': addresses,
                        'allServiceList': services,
                    }

                    result[container_name][dl_name] = tester_info

            return {
                'error': 0,
                'data': self.convert_complex_object(result),
                'skipped': self.skipped,
                'notes': self.notes,
            }
        except Exception as e:
            traceback.print_exception(e)
            return {'error': 1, 'message': str(e)}


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({'error': 1, 'message': 'Usage: odxparse.py <command> <odxFilePath> <outputJsonPath> [--parseResp]'}))
        sys.exit(1)

    command = sys.argv[1]
    odx_path = sys.argv[2]
    output_path = sys.argv[3]
    parse_resp = '--parseResp' in sys.argv

    parser = OdxParse()

    if command == 'parse':
        result = parser.parse(odx_path, parse_resp)
    elif command == 'parseTesterInfo':
        result = parser.parseTesterInfo(odx_path, parse_resp)
    else:
        result = {'error': 1, 'message': f'Unknown command: {command}'}

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False)
