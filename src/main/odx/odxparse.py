import epbipc
import json
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
from odxtools.parameters.tablekeyparameter import TableKeyParameter
from odxtools.parameters.tablestructparameter import TableStructParameter
from odxtools.parameters.valueparameter import ValueParameter
from odxtools.physicaltype import PhysicalType
from odxtools.standardlengthtype import StandardLengthType
from odxtools.structure import Structure

import traceback
ipc = epbipc.ipcServer()

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
        'hasSubFunction': False,
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
        'hasSubFunction': False
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
        'hasSubFunction': True
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
        'hasSubFunction': False
    },
    '0x37': {
        'name': 'RequestTransferExit',
        'hasSubFunction': False
    },
    '0x38': {
        'name': 'RequestFileTransfer',
        'hasSubFunction': False,
    }
}










class OdxParse:  
    def __init__(self):
        pass
    def bytes_to_hex(self,b):
        return ' '.join(f'{byte:02x}' for byte in b)
    def hex_to_bytes(self,h):
        return bytes.fromhex(h)
    def convert_complex_object(self,obj):
        if isinstance(obj, bytes) or isinstance(obj, bytearray):
            return self.bytes_to_hex(obj)
        elif isinstance(obj, dict):
            return {key: self.convert_complex_object(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self.convert_complex_object(element) for element in obj]
        else:
            return obj
    def parseDiagCodedType(self,coded: DiagCodedType, bitLen: int):
        value = None
        if coded.base_data_type.name == 'A_FLOAT32':

            t = 'FLOAT'
            value = 0
        elif coded.base_data_type.name == 'A_FLOAT64':
            t = 'DOUBLE'
            value = 0

        elif coded.base_data_type.name == 'A_ASCIISTRING':
            t = 'ASCII'
            value = '0'*math.ceil(bitLen/8)

        elif coded.base_data_type.name == 'A_BYTEFIELD':
            t = 'ARRAY'
            # bytes
            value = bytes([0]*math.ceil(bitLen/8))

        elif coded.base_data_type.name == 'A_INT32' or coded.base_data_type.name == 'A_UINT32':
            t = 'NUM'
            value = 0
        elif coded.base_data_type.name == 'A_UNICODE2STRING':
            t = 'UNICODE'
            value = '0'*math.ceil(bitLen/8)
        else:
            raise Exception('Not implemented coded type {}'.format(
                coded.base_data_type.name))
        return t, value
    def dopParams(self,param: Parameter, dop: DopBase, defVal: any = None):
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
                bitLen = coded.min_length*8
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
                        meta['choices'] = [str(scale.compu_const)
                                        for scale in dop.compu_method.internal_to_phys]
                        val = meta['choices'][0]
                    elif isinstance(dop.compu_method, IdenticalCompuMethod):
                        pass
                    elif isinstance(dop.compu_method, LinearCompuMethod):
                        ll = dop.compu_method.physical_lower_limit
                        ul = dop.compu_method.physical_upper_limit
                        # val from ll to ul, default is ll
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
                        raise Exception('Not implemented compu method {}'.format(
                            param.dop.compu_method.__class__.__name__))

            encode = EncodeState(
                bytearray([]), {param.short_name: defVal if defVal else val}, is_end_of_pdu=endOfPdu)

            defBytesVal = param.get_coded_value_as_bytes(encode)

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
            endOfPdu=False
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

            # bitLen = sum of all pr bitLen
            allValue = dict()
            
            for item in pr:
                allValue[item['name']] = item['phyValue']
           
            bytesVal = dop.convert_physical_to_bytes(
                allValue, EncodeState(bytearray([]), allValue, is_end_of_pdu=endOfPdu))
            meta = {
                'byteSIze': dop.byte_size,
                'subParams': pr,
                'type': param.parameter_type,
                'dopType': dop.__class__.__name__,
            }

            maxBytePos=0
            allBitLen=0
            for p in pr:
                if p['bytePos']>=maxBytePos:
                    maxBytePos=p['bytePos']
                    allBitLen=math.ceil((p['bytePos']*8+p['bitLen'])/8)*8
                    
            if len(bytesVal)*8 != allBitLen:
                raise Exception('bitLen not match {} {}'.format(allBitLen,len(bytesVal)*8))
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
                meta['choices'] = [str(scale.compu_const)
                                for scale in cm.internal_to_phys]
                val = meta['choices'][0]
            elif isinstance(cm, IdenticalCompuMethod):
                pass
            elif isinstance(cm, LinearCompuMethod):
                ll = cm.physical_lower_limit
                ul = cm.physical_upper_limit
                # val from ll to ul, default is ll

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
                raise Exception('Not implemented compu method {}'.format(
                    param.dop.compu_method.__class__.__name__))
            encode = EncodeState(
                bytearray([]), {param.short_name: defVal if defVal else val})
            defBytesVal = param.get_coded_value_as_bytes(encode)
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

                # print(dtc.sdgs)

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
                # 'switchKey':dopParams(param,dop.switch_key.dop,dictVal)
                'type': param.parameter_type,
                'dopType': dop.__class__.__name__,
                'cases': cases,
            }
            val = dop.convert_physical_to_bytes(
                dictVal, EncodeState(bytearray([]), {}))
            return {
                'name': param.short_name,
                'longName': param.long_name,
                'desc': param.description,
                'type': 'ARRAY',
                'value': val,
                'phyValue': dictVal,
                'bitLen': len(val)*8,
                'bitPos': param.bit_position,
                'bytePos': param.byte_position,
                'meta': meta
            }

        else:
            raise Exception('Not implemented dop {}'.format(
                dop.__class__.__name__))
    def parasParams(self,param: Parameter):
        if isinstance(param, ValueParameter):
            return self.dopParams(param, param.dop, param.physical_default_value)

        elif isinstance(param, CodedConstParameter):
            coded = param.diag_coded_type
            endOfPdu = False
            encode = EncodeState(
                bytearray([]), {param.short_name: param.coded_value}, is_end_of_pdu=endOfPdu)
            defVal = param.get_coded_value_as_bytes(encode)
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
            val = param.get_coded_value_as_bytes(EncodeState(bytearray([]), {}))
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
            val = param.get_coded_value_as_bytes(EncodeState(bytearray([]), {}))
            return {
                'name': param.short_name,
                'longName': param.long_name,
                'desc': param.description,
                'type': 'ARRAY',
                'value': val,
                'phyValue': val,
                'bitLen':  len(val)*8,
                'bitPos': param.bit_position,
                'bytePos': param.byte_position,
                'meta': {
                    'type': param.parameter_type,
                }
            }
        elif isinstance(param, TableStructParameter):
            return self.parasParams(param.table_key)
        else:
            raise Exception('Not implemented param {}'.format(
                param.__class__.__name__))
    def parse(self,filePath,praseResp=False):
        self.serviceDict = dict()
        self.paramDict = dict()
        try:
            self.db = odxtools.load_file(filePath)
            ecu = self.db.diag_layer_containers
            ecu_dict = {}
            for i in range(len(ecu)):
                name = ecu[i].short_name
                ecu_dict[name] = {}

                for j in range(len(ecu[i].diag_layers)):
                    dl = ecu[i].diag_layers[j]
                    dlName = dl.short_name
                    if dl.variant_type.name == "ECU_VARIANT" or dl.variant_type.name == "BASE_VARIANT":
                        services = {}
                        for service in dl.services:
                            reqItem = {}
                            reqItem['name'] = service.long_name if service.long_name else service.short_name
                            id = str(uuid.uuid4())
                            reqItem['id'] = id
                            reqItem['desc'] = service.description
                            needSub = False
                            params = []
                            self.serviceDict[id] = service                           
                            for p in service.request.parameters:
                                if p.semantic == 'SERVICE-ID':
                                    reqItem['serviceId'] = hex(
                                        p.coded_value).upper().replace('0X', '0x')
                                    if reqItem['serviceId'] in subFuncList:
                                        needSub = subFuncList[reqItem['serviceId']
                                                              ]['hasSubFunction']
                                    else:
                                        raise Exception(
                                            'Service ID not found in support list {} '.format(reqItem['serviceId']))
                                    continue
                                else:
                                    param = self.parasParams(p)
                                    id= str(uuid.uuid4())
                                    param['id'] = id
                                    self.paramDict[id] = p
                                    params.append(param)

                            respParams = []
                            if praseResp:
                                for repo in service.positive_responses:

                                    for index, p in enumerate(repo.parameters):

                                        if p.semantic == 'SERVICE-ID':

                                            continue
                                        else:
                                            
                                            id= str(uuid.uuid4())
                                            param = self.parasParams(p)
                                            param['id'] = id
                                            self.paramDict[id] = p
                                            respParams.append(param)

                                    break

                            if reqItem['serviceId']:
                                pass
                            else:
                                raise Exception(
                                    'Service ID not found in service {} '.format(reqItem['name']))

                            if needSub:
                                if len(params) > 0:
                                    param = params.pop(0)
                                    if param['bytePos'] != 1 or param['bitLen'] != 8:
                                        raise Exception(
                                            'Service ID not found in service {} '.format(reqItem['name'])) 
                                   
                                    if praseResp:
                                        respPram = respParams.pop(0)
                                        if respPram['bytePos'] != 1 or respPram['bitLen'] != 8:
                                            raise Exception(
                                                'Service ID not found in service {} '.format(reqItem['name']))
                                    reqItem['subfunc'] = param['value']
                                else:
                                    raise Exception(
                                        'Subfunction not found for service {} '.format(reqItem['name']))

                            reqItem['params'] = params
                            reqItem['respParams'] = respParams
                            if reqItem['serviceId'] not in services:
                                services[reqItem['serviceId']] = []
                            services[reqItem['serviceId']].append(reqItem)

                        ecu_dict[name][dlName] = services
            # print(ecu_dict)

            return json.dumps({
                'error': 0,
                'data': self.convert_complex_object(ecu_dict),
            })
        except Exception as e:
            traceback.print_exception(e)
            message = str(e)
            return json.dumps({'error': 1, 'message': message})


if __name__ == "__main__":
    parer=OdxParse()
    ipc.on('parse', parer.parse)
    # start the server
    ipc.start()
    # ipc.print("end")

