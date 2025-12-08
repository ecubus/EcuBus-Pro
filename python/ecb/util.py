import asyncio
import sys
import inspect
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
    Service,
    DiagRequest,
    DiagResponse,
    DiagJob,
    service_map,
    ServiceItem,
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
        # store wrapped key callbacks so OffKey can remove them correctly
        self._key_func_map: Dict[str, Dict[Callable, Callable]] = {}
        # store wrapped event callbacks so Off* can remove them correctly
        self._event_func_map: Dict[str, Dict[Callable, Callable]] = {}
        
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

    def _start(
        self,
        data_set: Any,
        val: Dict[str, Any],
        tester_name: str = None,
        test_control: Any = None  # kept for compatibility with TS side, currently unused
    ):
        """Handle __start RPC from Node side.

        Signature matches uds.ts / workerClient.ts:
        __start(dataSet, serviceMap, testerName, testControl)
        """
        self.tester_name = tester_name

        # Build Python-side service_map from plain dict sent by Node
        for key, service_data in val.items():
            service_item = _dict_to_service_item(service_data)
            service_map[key] = service_item

        # Mirror TS worker start: flatten dataset vars (including sys vars) and store locally
        self.vars = {}
        if isinstance(data_set, dict):
            raw_vars: Dict[str, Any] = deepcopy(data_set.get('vars', {}))
            sys_vars = data_set.get('sysVars') or data_set.get('sysvars') or {}
            if isinstance(sys_vars, dict):
                for v in sys_vars.values():
                    if isinstance(v, dict) and v.get('id'):
                        raw_vars[v['id']] = deepcopy(v)

            for key, var in raw_vars.items():
                if not isinstance(var, dict):
                    continue
                value_obj = var.get('value')
                if value_obj:
                    parent_names: List[str] = []
                    current = var
                    while current.get('parentId'):
                        parent = raw_vars.get(current['parentId'])
                        if not parent:
                            break
                        parent_names.insert(0, parent.get('name'))
                        current = parent
                    parent_names.append(var.get('name'))
                    var['name'] = '.'.join([p for p in parent_names if p])
                self.vars[key] = var

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
            # keep local cache in sync
            name = item.get('name') if isinstance(item, dict) else None
            value = item.get('value') if isinstance(item, dict) else None
            if name is not None:
                for v in self.vars.values():
                    if isinstance(v, dict) and v.get('name') == name and isinstance(v.get('value'), dict):
                        v['value']['value'] = value
            self.event.emit(f"varUpdate{item['name']}", item)
            self.event.emit("varUpdate*", item)

    def Init(self, fc: Callable[[], Awaitable[None]]):
        async def wrapper(*_args, **_kwargs):
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
        async def wrapper(*_args, **_kwargs):
            res = fc()
            if asyncio.iscoroutine(res):
                await res

        self.event.remove_all_listeners('__end')
        self.event.on('__end', wrapper)
        
    def On(self, event: str, listener: Callable):
        self.event.on(event, listener)
        
    def Once(self, event: str, listener: Callable):
        self.event.once(event, listener)

    def Off(self, event: str, listener: Callable):
        self.event.remove_listener(event, listener)

    def _wrap_event_callback(self, fc: Callable) -> Callable:
        """Allow event callbacks with 0 parameters by ignoring emitted args."""
        try:
            sig = inspect.signature(fc)
            if len(sig.parameters) == 0:
                async def wrapper(*_args, **_kwargs):
                    res = fc()
                    if asyncio.iscoroutine(res):
                        await res
                return wrapper
        except (TypeError, ValueError):
            return fc
        return fc

    def OnCan(self, id: Union[int, str, bool], fc: Callable):
        event_name = 'can' if id is True else f"can.{id}"
        wrapped = self._wrap_event_callback(fc)
        self._event_func_map.setdefault(event_name, {})[fc] = wrapped
        self.event.on(event_name, wrapped)

    def OnCanOnce(self, id: Union[int, str, bool], fc: Callable):
        """Register a CAN listener that will be triggered only once."""
        event_name = 'can' if id is True else f"can.{id}"
        wrapped = self._wrap_event_callback(fc)
        self.event.once(event_name, wrapped)

    def OffCan(self, id: Union[int, str, bool], fc: Callable):
        """Unregister a CAN listener. id and callback must match the original registration."""
        event_name = 'can' if id is True else f"can.{id}"
        wrapped = self._event_func_map.get(event_name, {}).pop(fc, None)
        if wrapped is None:
            wrapped = fc
        self.event.remove_listener(event_name, wrapped)

    # --- LIN event helpers (subset of TS Util.OnLin/OnLinOnce/OffLin) ---

    def OnLin(self, id: Union[int, str, bool], fc: Callable[[Any], Union[None, Awaitable[None]]]):
        """Register a LIN listener. id can be frameId (int) or name (str); True for all."""
        event_name = 'lin' if id is True else f"lin.{id}"
        wrapped = self._wrap_event_callback(fc)
        self._event_func_map.setdefault(event_name, {})[fc] = wrapped
        self.event.on(event_name, wrapped)

    def OnLinOnce(self, id: Union[int, str, bool], fc: Callable[[Any], Union[None, Awaitable[None]]]):
        """Register a LIN listener that will be triggered only once."""
        event_name = 'lin' if id is True else f"lin.{id}"
        wrapped = self._wrap_event_callback(fc)
        self.event.once(event_name, wrapped)

    def OffLin(self, id: Union[int, str, bool], fc: Callable[[Any], Union[None, Awaitable[None]]]):
        """Unregister a LIN listener."""
        event_name = 'lin' if id is True else f"lin.{id}"
        wrapped = self._event_func_map.get(event_name, {}).pop(fc, None)
        if wrapped is None:
            wrapped = fc
        self.event.remove_listener(event_name, wrapped)

    # --- Variable event helpers (subset of TS Util.OnVar/OnVarOnce/OffVar) ---

    def OnVar(self, name: str, fc: Callable[[Dict[str, Any]], Union[None, Awaitable[None]]]):
        """Register a variable update listener. name can be concrete name or '*' wildcard."""
        if not name:
            return
        event_name = "varUpdate*" if name == "*" else f"varUpdate{name}"
        wrapped = self._wrap_event_callback(fc)
        self._event_func_map.setdefault(event_name, {})[fc] = wrapped
        self.event.on(event_name, wrapped)

    def OnVarOnce(self, name: str, fc: Callable[[Dict[str, Any]], Union[None, Awaitable[None]]]):
        """Register a one-shot variable update listener."""
        if not name:
            return
        event_name = "varUpdate*" if name == "*" else f"varUpdate{name}"
        wrapped = self._wrap_event_callback(fc)
        self.event.once(event_name, wrapped)

    def OffVar(self, name: str, fc: Callable[[Dict[str, Any]], Union[None, Awaitable[None]]]):
        """Unregister a variable update listener."""
        if not name:
            return
        event_name = "varUpdate*" if name == "*" else f"varUpdate{name}"
        wrapped = self._event_func_map.get(event_name, {}).pop(fc, None)
        if wrapped is None:
            wrapped = fc
        self.event.remove_listener(event_name, wrapped)

    # --- Misc helpers ---

    def getTesterName(self) -> Optional[str]:
        """Return current tester name (if any), similar to TS Util.getTesterName."""
        return self.tester_name

    # --- Key event helpers (API parity with TS Util.OnKey/OnKeyOnce/OffKey) ---

    def _wrap_key_callback(self, fc: Callable) -> Callable:
        """Allow key callbacks with 0 or 1 positional arguments.

        - If user callback has no parameters: call fc() and ignore the key argument.
        - If it has >=1 parameters: pass key through as usual.
        """
        try:
            sig = inspect.signature(fc)
            if len(sig.parameters) == 0:
                def wrapper(_key: str):
                    return fc()
                return wrapper
        except (TypeError, ValueError):
            # Fallback: if we cannot introspect, just return original
            return fc
        return fc

    def OnKey(self, key: str, fc: Callable[[str], Union[None, Awaitable[None]]]):
        """Register a key-down handler. Only first char of key is used, '*' is wildcard."""
        if not key:
            return
        k = key[0]
        event_name = "keyDown*" if k == "*" else f"keyDown{k}"
        wrapped = self._wrap_key_callback(fc)
        # remember mapping so OffKey can remove the correct function
        self._key_func_map.setdefault(event_name, {})[fc] = wrapped
        self.event.on(event_name, wrapped)

    def OnKeyOnce(self, key: str, fc: Callable[[str], Union[None, Awaitable[None]]]):
        """Register a one-shot key-down handler. Only first char of key is used, '*' is wildcard."""
        if not key:
            return
        k = key[0]
        event_name = "keyDown*" if k == "*" else f"keyDown{k}"
        wrapped = self._wrap_key_callback(fc)
        self.event.once(event_name, wrapped)

    def OffKey(self, key: str, fc: Callable[[str], Union[None, Awaitable[None]]]):
        """Unregister a key-down handler. Only first char of key is used, '*' is wildcard."""
        if not key:
            return
        k = key[0]
        event_name = "keyDown*" if k == "*" else f"keyDown{k}"
        wrapped = self._key_func_map.get(event_name, {}).pop(fc, None)
        if wrapped is None:
            # fall back to removing original if we didn't wrap
            wrapped = fc
        self.event.remove_listener(event_name, wrapped)

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

async def setVar(name: str, value: Any):
    await get_ipc().async_emit('varApi', {'method': 'setVar', 'name': name, 'value': value})
    # update local cache to keep getVar consistent
    for v in Util.vars.values():
        if isinstance(v, dict) and v.get('name') == name and isinstance(v.get('value'), dict):
            v['value']['value'] = value
            break

async def setVars(vars: Dict[str, Any]):
    updates = [{'name': name, 'value': value} for name, value in vars.items()]
    if not updates:
        return

    await get_ipc().async_emit('varApi', {'method': 'setVars', 'vars': updates})
    # sync cache for batch updates
    for name, value in vars.items():
        for v in Util.vars.values():
            if isinstance(v, dict) and v.get('name') == name and isinstance(v.get('value'), dict):
                v['value']['value'] = value
                break

def getVar(name: str) -> Any:
    """Read cached var value (mirrors TS getVar)."""
    for var in Util.vars.values():
        if not isinstance(var, dict):
            continue
        if var.get('name') != name:
            continue

        value_obj = var.get('value')
        if not isinstance(value_obj, dict):
            break

        vtype = value_obj.get('type')
        if vtype == 'number':
            val = value_obj.get('value')
            if val is None:
                val = value_obj.get('initValue')
            return float(val) if val is not None else None
        if vtype == 'string':
            val = value_obj.get('value')
            if val is None:
                val = value_obj.get('initValue')
            return val or ''
        if vtype == 'array':
            arr = value_obj.get('value')
            if arr is None:
                arr = value_obj.get('initValue')
            arr = arr or []
            return [float(x) if x is not None else 0 for x in arr]
        break

    raise KeyError(f"var {name} not found")

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
