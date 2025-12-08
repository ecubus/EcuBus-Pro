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

from ecb import Util, output, setSignal, setVar, getVar, CanMessage
from ecb.structs import CAN_ID_TYPE, CanMsgType
from ecb.util import run

def init():
    print("init")    

def stop(key):
    print("stop", key)
    Util.OffKey('s', stop)

async def set_var():
    await setVar('test', 1)
    print("set_var", getVar('test'))

async def output_can(can):
    print("output_can", can)
    # Echo a CAN frame back out with valid structure
    msg = CanMessage(
        id=0x111,
        data=bytearray([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
        dir='OUT',
        msgType=CanMsgType(
            idType=CAN_ID_TYPE.STANDARD,
            brs=False,
            canfd=False,
            remote=False,
        ),
    )
    await output(msg)
    Util.OffCan(1, output_can)

if __name__ == "__main__":
    # Register initialization callback
    Util.Init(init)
    
    # Register end callback
    Util.OnKey('s', stop)


    Util.OnKey('v', set_var)

    Util.OnVar('button',lambda data: print("button", data))


    Util.OnCan(1,output_can)
    
    # Start the event loop and IPC
    run()