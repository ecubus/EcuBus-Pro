import asyncio
import sys
from typing import Optional, Dict, Any, List, Callable, Union, Awaitable
from pyee.asyncio import AsyncIOEventEmitter
from copy import deepcopy
from dataclasses import is_dataclass

from .ipc import get_ipc, ecb_print
from .structs import (
    ServiceItem, CanMessage, LinMsg, SomeipMessageBase, 
    VarUpdateItem, Param, ServiceId, UdsAddress, CanMsgType, 
    CAN_ID_TYPE, LinDirection, LinChecksumType
)
from .uds import (
    Service, DiagRequest, DiagResponse, DiagJob, 
    service_map, param_set_val_raw, ServiceItem
)

# --- Global State ---
_init_done = False
_init_promise = asyncio.Future()

# --- Helpers ---

def _dict_to_param(d: Dict[str, Any]) -> Param:
    val = d.get('value')
    if isinstance(val, dict) and val.get('type') == 'Buffer':
        val = bytearray(val['data'])
    elif isinstance(val, list):
        val = bytearray(val)
    elif isinstance(val, str): 
        val = bytearray()
    
    d['value'] = val
    return Param(**{k: v for k, v in d.items() if k in Param.__annotations__})

def _dict_to_service_item(d: Dict[str, Any]) -> ServiceItem:
    d['params'] = [_dict_to_param(p) for p in d.get('params', [])]
    d['respParams'] = [_dict_to_param(p) for p in d.get('respParams', [])]
    return ServiceItem(**{k: v for k, v in d.items() if k in ServiceItem.__annotations__})

# --- Util Class ---

class UtilClass:
    def __init__(self):
        self.event = AsyncIOEventEmitter()
        self.tester_name: Optional[str] = None
        self.vars: Dict[str, Any] = {}
        
        ipc = get_ipc()
        ipc.on('__on', self._worker_on)
        ipc.on('__start', self._start)
        ipc.on('__eventDone', self._event_done)
        ipc.on('methods', lambda: list(ipc.rpc_handlers.keys()))
        
        self.event.on('__canMsg', self._can_msg)
        self.event.on('__linMsg', self._lin_msg)
        self.event.on('__someipMsg', self._someip_msg)
        self.event.on('__keyDown', self._key_down)
        self.event.on('__varUpdate', self._var_update)
        
        # Default init handler
        self.Init(lambda: None)

    async def _worker_on(self, event: str, data: Any) -> bool:
        if self.event.listeners(event):
            self.event.emit(event, data)
            if event.endswith('.send') or event.endswith('.recv'):
                parts = event.split('.')
                if len(parts) >= 3:
                    parts[1] = '*'
                    wildcard = '.'.join(parts)
                    self.event.emit(wildcard, data)
            return True
        elif event.endswith('.send') or event.endswith('.recv'):
             parts = event.split('.')
             if len(parts) >= 3:
                parts[1] = '*'
                wildcard = '.'.join(parts)
                if self.event.listeners(wildcard):
                    self.event.emit(wildcard, data)
                    return True
        return False

    def _start(self, data_set: Any, val: Dict[str, Any], tester_name: str = None):
        self.tester_name = tester_name
        
        for key, service_data in val.items():
            service_item = _dict_to_service_item(service_data)
            service_map[key] = service_item
             
        if self.event.listeners('__varFc'):
             self.event.emit('__varFc')

    def _event_done(self, id: int, resp: Optional[Dict[str, Any]] = None):
        get_ipc().resolve_emit(id, resp.get('data') if resp else None, resp.get('err') if resp else None)

    async def _can_msg(self, msg: Dict[str, Any]):
        if 'data' in msg and isinstance(msg['data'], dict) and msg['data'].get('type') == 'Buffer':
            msg['data'] = bytearray(msg['data']['data'])
        await self._emit_generic('can', msg.get('id'), msg)

    async def _lin_msg(self, msg: Dict[str, Any]):
        if 'data' in msg and isinstance(msg['data'], dict) and msg['data'].get('type') == 'Buffer':
            msg['data'] = bytearray(msg['data']['data'])
        await self._emit_generic('lin', msg.get('frameId'), msg)

    async def _someip_msg(self, msg: Dict[str, Any]):
        if 'payload' in msg and isinstance(msg['payload'], dict) and msg['payload'].get('type') == 'Buffer':
             msg['payload'] = bytearray(msg['payload']['data'])
        self.event.emit('someip', msg)

    async def _emit_generic(self, prefix: str, id_val: Any, msg: Any):
        self.event.emit(f"{prefix}.{id_val}", msg)
        self.event.emit(prefix, msg)

    async def _key_down(self, key: str):
        self.event.emit(f"keyDown{key}", key)
        self.event.emit("keyDown*", key)

    async def _var_update(self, data: Union[Dict[str, Any], List[Dict[str, Any]]]):
        items = data if isinstance(data, list) else [data]
        for item in items:
            self.event.emit(f"varUpdate{item['name']}", item)
            self.event.emit("varUpdate*", item)

    def Init(self, fc: Callable[[], Awaitable[None]]):
        async def wrapper():
            global _init_done
            try:
                res = fc()
                if asyncio.iscoroutine(res):
                    await res
                if not _init_promise.done():
                    _init_promise.set_result(None)
                _init_done = True
            except Exception as e:
                if not _init_promise.done():
                    _init_promise.set_exception(e)
                sys.stderr.write(f"Init failed: {e}\n")
        
        self.event.remove_all_listeners('__varFc')
        self.event.on('__varFc', wrapper)

    def End(self, fc: Callable[[], Awaitable[None]]):
        self.event.remove_all_listeners('__end')
        self.event.on('__end', fc)
        
    def On(self, event: str, listener: Callable):
        self.event.on(event, listener)
        
    def Once(self, event: str, listener: Callable):
        self.event.once(event, listener)

    def Off(self, event: str, listener: Callable):
        self.event.remove_listener(event, listener)

    def OnCan(self, id: Union[int, str, bool], fc: Callable):
        if id is True:
            self.event.on('can', fc)
        else:
            self.event.on(f"can.{id}", fc)

Util = UtilClass()

# --- Top Level Functions ---

async def output(msg: Union[CanMessage, LinMsg, SomeipMessageBase]) -> int:
    data = msg
    ts = await get_ipc().async_emit('output', data)
    return ts

async def setSignal(signal: str, value: Union[int, float, str, List[int]]) -> None:
    await get_ipc().async_emit('setSignal', {'signal': signal, 'value': value})

def getSignal(signal: str):
    raise NotImplementedError("getSignal requires local dataset access which is not fully implemented")

def setVar(name: str, value: Any):
    get_ipc().send({
        'type': 'event',
        'payload': {
            'event': 'varApi',
            'data': {'method': 'setVar', 'name': name, 'value': value}
        }
    })

def getVar(name: str) -> Any:
    return None 

async def runUdsSeq(seqName: str, device: str = None):
    await get_ipc().async_emit('runUdsSeq', {'name': seqName, 'device': device})

async def stopUdsSeq(seqName: str, device: str = None):
    await get_ipc().async_emit('stopUdsSeq', {'name': seqName, 'device': device})

def run():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    get_ipc().start(loop)
    
    try:
        loop.run_forever()
    except KeyboardInterrupt:
        pass
