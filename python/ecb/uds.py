import struct
import asyncio
from typing import List, Optional, Union, Any, Dict, cast
from copy import deepcopy
from uuid import uuid4

from .structs import (
    ServiceItem, Param, UdsAddress, CanMessage, LinMsg,
    LinDirection, LinChecksumType
)
from .ipc import get_ipc

# --- Helper Functions ---

def split_str2(s: str) -> str:
    result = []
    for i in range(0, len(s), 2):
        result.append(s[i:i+2])
    return ' '.join(result)

def checkServiceId(service_id: str, need: List[str]) -> bool:
    if not service_id:
        return False
    if 'job' in need:
        if not service_id.startswith('0x'):
            return True
    if 'uds' in need:
        if service_id.startswith('0x'):
            return True
    return False

def param2str(param: Param) -> str:
    return str(param.phyValue)

def param2raw(param: Param) -> bytearray:
    return param.value

def get_param_buffer(params: List[Param]) -> bytearray:
    buffer = bytearray()
    for p in params:
        buffer.extend(p.value)
    return buffer

def getTxPdu(service: ServiceItem) -> bytearray:
    sid = int(service.serviceId, 16) if service.serviceId.startswith('0x') else 0
    header = bytearray([sid])
    return header + get_param_buffer(service.params)

def getRxPdu(service: ServiceItem) -> bytearray:
    sid = int(service.serviceId, 16) if service.serviceId.startswith('0x') else 0
    if service.isNegativeResponse:
        return bytearray([0x7f, sid, service.nrc or 0x00])
    header = bytearray([sid + 0x40])
    return header + get_param_buffer(service.respParams)

def paramSetVal(param: Param, val: Union[str, int, float]) -> None:
    if param.type == 'NUM':
        v = int(val)
        byte_len = int(param.bitLen / 8)
        pow_val = pow(2, byte_len * 8)
        if 0 <= v < pow_val:
            param.phyValue = v
            param.value = bytearray(byte_len)
            for i in range(byte_len):
                param.value[byte_len - i - 1] = (v >> (8 * i)) & 0xff
        else:
            raise ValueError(f"value should be in [0,{pow_val - 1}]")
            
    elif param.type == 'ARRAY':
        byte_len = int(param.bitLen / 8)
        if not val:
            param.phyValue = ''
            param.value = bytearray()
            return
        s_val = str(val)
        import re
        if not re.match(r'^[0-9a-fA-F]{2}( [0-9a-fA-F]{2})*$', s_val):
             raise ValueError('value should be a 00 F4 33 5a')
        parts = s_val.split(' ')
        if len(parts) > byte_len:
            raise ValueError(f"value length {len(parts)} should less than {byte_len}")
        param.phyValue = s_val
        param.value = bytearray([int(x, 16) for x in parts])
        
    elif param.type in ('ASCII', 'FILE'):
        byte_len = int(param.bitLen / 8)
        s_val = str(val)
        if len(s_val) > byte_len:
             raise ValueError(f"value length {len(s_val)} should less than {byte_len}")
        param.phyValue = s_val
        param.value = bytearray(s_val, 'ascii')
        
    elif param.type == 'UNICODE':
        byte_len = int(param.bitLen / 8)
        s_val = str(val)
        encoded = s_val.encode('utf-8')
        if len(encoded) > byte_len:
             raise ValueError(f"value length {len(encoded)} should less than {byte_len}")
        param.phyValue = s_val
        param.value = bytearray(encoded)
        
    elif param.type == 'FLOAT':
        v = float(val)
        param.phyValue = v
        param.value = bytearray(struct.pack('>f', v))
        
    elif param.type == 'DOUBLE':
        v = float(val)
        param.phyValue = v
        param.value = bytearray(struct.pack('>d', v))

def paramSetValRaw(param: Param, val: bytearray) -> None:
    byte_len = (param.bitLen + 7) // 8
    if len(val) > byte_len:
        raise ValueError(f"value length {len(val)} should less than {byte_len}")
    param.value = val
    if param.type == 'NUM':
        v = 0
        for b in val:
            v = (v << 8) | b
        param.phyValue = v
    elif param.type == 'ARRAY':
        param.phyValue = split_str2(val.hex().upper().zfill(byte_len * 2))
    elif param.type == 'ASCII':
        try: param.phyValue = val.decode('ascii')
        except: param.phyValue = val.decode('ascii', errors='ignore')
    elif param.type == 'UNICODE':
        try: param.phyValue = val.decode('utf-8')
        except: param.phyValue = val.decode('utf-8', errors='ignore')
    elif param.type == 'FLOAT':
        if len(val) >= 4: param.phyValue = struct.unpack('>f', val[:4])[0]
    elif param.type == 'DOUBLE':
        if len(val) >= 8: param.phyValue = struct.unpack('>d', val[:8])[0]

def paramSetSize(param: Param, bit_size: int) -> None:
    byte_len = (bit_size + 7) // 8
    min_len = min(byte_len, len(param.value))
    param.bitLen = bit_size
    new_value = bytearray(byte_len)
    new_value[:min_len] = param.value[:min_len]
    param.value = new_value

def applyBuffer(service: ServiceItem, data: bytearray, is_req: bool) -> None:
    if not data: return
    if data[0] == 0x7f:
        if not is_req:
            expected_sid = int(service.serviceId, 16)
            if data[1] != expected_sid:
                raise ValueError(f"serviceId not match")
            service.isNegativeResponse = True
            service.nrc = data[2]
        return
    sid = data[0]
    if not is_req: sid -= 0x40
    expected_sid = int(service.serviceId, 16)
    if sid != expected_sid: raise ValueError(f"serviceId not match")
    params = service.params if is_req else service.respParams
    if params and params[-1].name == '__left': params.pop()
    offset = 1
    for param in params:
        param_len = (param.bitLen + 7) // 8
        if offset < len(data):
            sub_data = data[offset : offset + param_len]
            if len(sub_data) < param_len: return
            paramSetValRaw(param, sub_data)
        offset += param_len
    if offset < len(data):
        param = Param(id=str(uuid4()), name='__left', type='ARRAY', value=bytearray(), phyValue='', bitLen=(len(data) - offset) * 8)
        paramSetValRaw(param, data[offset:])
        params.append(param)

# --- Service Class ---

service_map: Dict[str, ServiceItem] = {}

class Service:
    def __init__(self, tester_name: str, service: ServiceItem, is_request: bool):
        self.tester_name = tester_name
        self.service = service
        self.is_request = is_request
        self.params = self.service.params if is_request else self.service.respParams
        
    def __str__(self):
        return getTxPdu(self.service).hex() if self.is_request else getRxPdu(self.service).hex()
        
    async def changeService(self):
        await get_ipc().async_emit('set', {
            'service': self.service,
            'isRequest': self.is_request,
            'testerName': self.tester_name
        })
        service_map[self.getServiceName()] = self.service

    def On(self, event: str, listener: Any):
        from .util import Util
        Util.On(f"{self.getServiceName()}.{event}", listener)
        
    def Once(self, event: str, listener: Any):
        from .util import Util
        Util.OnOnce(f"{self.getServiceName()}.{event}", listener)
        
    def Off(self, event: str, listener: Any):
        from .util import Util
        Util.Off(f"{self.getServiceName()}.{event}", listener)
        
    def getServiceName(self) -> str:
        return f"{self.tester_name}.{self.service.name}"
        
    def getServiceDesc(self) -> Optional[str]:
        return self.service.desc
        
    def diagGetParameter(self, param_name: str) -> Union[str, int, float]:
        param = next((p for p in self.params if p.name == param_name), None)
        if param: return param.phyValue
        raise ValueError(f"param {param_name} not found")
        
    def diagGetParameterRaw(self, param_name: str) -> bytearray:
        param = next((p for p in self.params if p.name == param_name), None)
        if param: return param.value
        raise ValueError(f"param {param_name} not found")
        
    def diagGetParameterSize(self, param_name: str) -> int:
        param = next((p for p in self.params if p.name == param_name), None)
        if param: return param.bitLen
        raise ValueError(f"param {param_name} not found")
        
    def diagGetParameterNames(self) -> List[str]:
        return [p.name for p in self.params]
        
    def diagSetParameterSize(self, param_name: str, bit_len: int) -> None:
        param = next((p for p in self.params if p.name == param_name), None)
        if param: paramSetSize(param, bit_len)
        else: raise ValueError(f"param {param_name} not found")
            
    def diagSetParameter(self, param_name: str, value: Union[str, int, float]) -> None:
        param = next((p for p in self.params if p.name == param_name), None)
        if param: paramSetVal(param, value)
        else: raise ValueError(f"param {param_name} not found")
            
    def diagSetParameterRaw(self, param_name: str, value: bytearray) -> None:
        param = next((p for p in self.params if p.name == param_name), None)
        if param: paramSetValRaw(param, value)
        else: raise ValueError(f"param {param_name} not found")
            
    async def outputDiag(self, device_name: Optional[str] = None, address_name: Optional[str] = None) -> int:
        ts = await get_ipc().async_emit('sendDiag', {
            'device': device_name,
            'address': address_name,
            'service': self.service,
            'isReq': self.is_request,
            'testerName': self.tester_name
        })
        return ts
        
    def diagSetRaw(self, data: bytearray) -> None:
        applyBuffer(self.service, data, self.is_request)
        
    def diagGetRaw(self) -> bytearray:
        return getTxPdu(self.service) if self.is_request else getRxPdu(self.service)

class DiagJob(Service):
    def __init__(self, tester_name: str, service: ServiceItem):
        super().__init__(tester_name, deepcopy(service), True)
        
    @staticmethod
    def fromJob(job_name: str) -> 'DiagJob':
        tester_name = job_name.split('.')[0]
        service = service_map.get(job_name)
        if service and checkServiceId(service.serviceId, ['job']):
            return DiagJob(tester_name, service)
        raise ValueError(f"job {job_name} not found")

class DiagResponse(Service):
    def __init__(self, tester_name: str, service: ServiceItem, addr: Optional[UdsAddress] = None):
        super().__init__(tester_name, deepcopy(service), False)
        self.addr = addr
        
    def getUdsAddress(self) -> Optional[UdsAddress]:
        return self.addr
        
    @staticmethod
    def from_(service_name: str) -> 'DiagResponse':
        tester_name = service_name.split('.')[0]
        service = service_map.get(service_name)
        if service and checkServiceId(service.serviceId, ['uds']):
            return DiagResponse(tester_name, service)
        raise ValueError(f"service {service_name} not found")
        
    @staticmethod
    def fromDiagRequest(req: 'DiagRequest') -> 'DiagResponse':
        return DiagResponse(req.tester_name, req.service)
        
    def diagIsPositiveResponse(self) -> bool:
        return not self.service.isNegativeResponse
        
    def diagGetResponseCode(self) -> Optional[int]:
        if not self.diagIsPositiveResponse():
            return self.service.nrc
        return None

class DiagRequest(Service):
    def __init__(self, tester_name: str, service: ServiceItem, addr: Optional[UdsAddress] = None):
        super().__init__(tester_name, deepcopy(service), True)
        self.addr = addr
        
    def getUdsAddress(self) -> Optional[UdsAddress]:
        return self.addr
        
    @staticmethod
    def from_(service_name: str) -> 'DiagRequest':
        tester_name = service_name.split('.')[0]
        service = service_map.get(service_name)
        if service:
            return DiagRequest(tester_name, service)
        raise ValueError(f"service {service_name} not found")
