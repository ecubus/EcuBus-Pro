#!/usr/bin/env python3
"""
Basic ECB Example

This example demonstrates the basic usage of the ECB library.

To use this script in EcuBus-Pro:
1. Configure the script path in EcuBus-Pro
2. Set scriptType to 'python' in the options
"""

import asyncio
import sys
import os

# Manually add ecb library path since it's not published yet
current_dir = os.path.dirname(os.path.abspath(__file__))
# Path to: ecubus-pro/python
lib_path = os.path.abspath(os.path.join(current_dir, '../../../python'))
if lib_path not in sys.path:
    sys.path.append(lib_path)

from ecb import Util, output, setSignal, setVar
from ecb.util import run

def init():
    print("init")    

def stop(key):
    print("stop", key)
    Util.OffKey('s', stop)

if __name__ == "__main__":
    # Register initialization callback
    Util.Init(init)
    
    # Register end callback
    Util.OnKey('s', stop)
    
    # Start the event loop and IPC
    run()