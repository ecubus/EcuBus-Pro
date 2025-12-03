import sys
import asyncio
import json
import threading
import traceback
from typing import Callable, Any, Dict, Optional
from dataclasses import is_dataclass, asdict
from enum import Enum

class ECBJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if is_dataclass(o):
            return asdict(o)
        if isinstance(o, (bytes, bytearray)):
            return {"type": "Buffer", "data": list(o)}
        if isinstance(o, Enum):
            return o.value
        return super().default(o)

class IPC:
    def __init__(self):
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.rpc_handlers: Dict[str, Callable] = {}
        self.emit_map: Dict[int, asyncio.Future] = {}
        self._id_counter = 0
       

    def start(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop
        t = threading.Thread(target=self._read_stdin, daemon=True)
        t.start()

    def _read_stdin(self):
        try:
            for line in sys.stdin:
                if line.strip():
                    try:
                        msg = json.loads(line)
                        if self.loop and not self.loop.is_closed():
                            self.loop.call_soon_threadsafe(self._dispatch_message, msg)
                    except Exception as e:
                        sys.stderr.write(f"IPC Error: {e}\n")
        except Exception as e:
             sys.stderr.write(f"IPC Stdin Error: {e}\n")

    def _dispatch_message(self, msg: Dict[str, Any]):
        msg_type = msg.get('type')
        if msg_type == 'rpc':
            asyncio.create_task(self._handle_rpc(msg))
        elif msg_type == 'rpc_response':
            # This might be a response to our request if we supported bidirectional RPC fully
            # But here we mainly use 'event' with 'id' for async_emit responses.
            # However, uds.ts implementation of 'workerEmit' sends {id, event, data}.
            # And expects 'rpc_response' from parent? No.
            # uds.ts 'workerEmit' -> parentPort.postMessage({ type: 'event', payload })
            # Then parent sends something back?
            # uds.ts `asyncEmit` uses `emitMap`.
            # It waits for `evnetDone` (typo in uds.ts: `evnetDone`).
            # `evnetDone` is an RPC call FROM parent TO worker.
            # So we don't handle 'rpc_response' here, we handle 'evnetDone' RPC.
            pass

    async def _handle_rpc(self, msg: Dict[str, Any]):
        msg_id = msg.get('id')
        method_name = msg.get('method')
        params = msg.get('params', [])

        if method_name not in self.rpc_handlers:
            # Use Error-like object for better compatibility with JS side
            self._send_response(msg_id, error={
                'message': f"Method {method_name} not found",
                'stack': ''.join(traceback.format_stack())
            })
            return

        try:
            handler = self.rpc_handlers[method_name]
            result = handler(*params)
            if asyncio.iscoroutine(result):
                result = await result
            self._send_response(msg_id, result=result)
        except Exception as e:
            # Send structured error object similar to JS Error
            self._send_response(msg_id, error={
                'message': str(e),
                'stack': traceback.format_exc()
            })

    def _send_response(self, msg_id: Any, result: Any = None, error: Any = None):
        resp = {'type': 'rpc_response', 'id': msg_id}
        if error:
            # Normalize error to an object with at least a message field
            if isinstance(error, dict):
                if 'message' not in error:
                    error = {**error, 'message': str(error)}
                resp['error'] = error
            else:
                resp['error'] = {'message': str(error)}
        else:
            resp['result'] = result
        self.send(resp)

    def send(self, msg: Dict[str, Any]):
        try:
            json_str = json.dumps(msg, cls=ECBJSONEncoder)
            print(json_str, file=sys.stdout, flush=True)
        except Exception as e:
             sys.stderr.write(f"IPC Send Error: {e}\n")

    def on(self, method: str, handler: Callable):
        self.rpc_handlers[method] = handler

    async def async_emit(self, event: str, data: Any) -> Any:
        """Emits an event and waits for a response (via evnetDone RPC)."""
        if not self.loop:
            raise RuntimeError("IPC loop not started")
            
        req_id = self._id_counter
        self._id_counter += 1
        
        self.send({
             'type': 'event', 
             'payload': {
                 'id': req_id,
                 'event': event,
                 'data': data
             }
        })
        
        future = self.loop.create_future()
        self.emit_map[req_id] = future
        return await future

    def resolve_emit(self, id: int, data: Any = None, error: str = None):
        if id in self.emit_map:
            fut = self.emit_map.pop(id)
            if error:
                fut.set_exception(Exception(error))
            else:
                fut.set_result(data)

_ipc = IPC()

def get_ipc():
    return _ipc

def ecb_print(*args, **kwargs):
    text = " ".join(map(str, args))
    _ipc.send({'type': 'event', 'payload': {'event': 'log', 'data': text}})
