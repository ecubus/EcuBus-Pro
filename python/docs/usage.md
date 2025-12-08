# Quickstart

Install the package from the repo root or PyPI (when available):

```bash
pip install ecb
```

Basic UDS workflow:

```python
from ecb import Util, Service, DiagRequest

util = Util()
request = DiagRequest(service=Service.DiagnosticSessionControl, data=[0x03])
response = util.runUdsSeq(request)
print(response)
```

See the API reference for more helpers around signals, variables, and IPC utilities.
