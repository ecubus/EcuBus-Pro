#!/usr/bin/env python3
"""Line-oriented SocketCAN worker used by the Vitest helper.

Each process owns one AF_CAN / CAN_RAW socket bound to the given interface.
stdin:  JSON {"cmd":"send","id":...,"ext":bool,"rtr":bool,"canfd":bool,"brs":bool,"data":"hex"}
stdout: JSON {"evt":"rx", ...} / {"evt":"ok"} / {"evt":"err","msg":...}
"""
from __future__ import annotations

import json
import os
import select
import socket
import struct
import sys
import threading

CAN_EFF_FLAG = 0x80000000
CAN_RTR_FLAG = 0x40000000
CAN_RAW = 1
CAN_RAW_FD_FRAMES = 5
SOL_CAN_RAW = 101
CAN_MTU = 16
CANFD_MTU = 72

CLASSIC_FMT = "=IB3x8s"
FD_FMT = "=IBB2x64s"


def pack_frame(msg: dict) -> bytes:
    can_id = int(msg["id"])
    if msg.get("ext"):
        can_id |= CAN_EFF_FLAG
    if msg.get("rtr"):
        can_id |= CAN_RTR_FLAG
    data = bytes.fromhex(msg.get("data") or "")
    if msg.get("canfd"):
        flags = 0x01 if msg.get("brs") else 0
        return struct.pack(FD_FMT, can_id, len(data), flags, data.ljust(64, b"\0"))
    return struct.pack(CLASSIC_FMT, can_id, len(data), data.ljust(8, b"\0"))


def unpack_frame(raw: bytes) -> dict:
    if len(raw) == CANFD_MTU:
        can_id, dlc, flags, data = struct.unpack(FD_FMT, raw)
        payload = data[:dlc]
        canfd = True
        brs = bool(flags & 0x01)
    else:
        can_id, dlc, data = struct.unpack(CLASSIC_FMT, raw[:CAN_MTU])
        payload = data[:dlc]
        canfd = False
        brs = False
    return {
        "evt": "rx",
        "id": can_id & 0x1FFFFFFF,
        "ext": bool(can_id & CAN_EFF_FLAG),
        "rtr": bool(can_id & CAN_RTR_FLAG),
        "canfd": canfd,
        "brs": brs,
        "data": payload.hex(),
    }


def emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def main() -> int:
    if len(sys.argv) < 2:
        emit({"evt": "err", "msg": "usage: socketcan_worker.py <iface>"})
        return 2
    iface = sys.argv[1]
    try:
        sock = socket.socket(socket.AF_CAN, socket.SOCK_RAW, CAN_RAW)
        try:
            sock.setsockopt(SOL_CAN_RAW, CAN_RAW_FD_FRAMES, 1)
        except OSError:
            pass
        sock.bind((iface,))
    except OSError as exc:
        emit({"evt": "err", "msg": f"open {iface}: {exc}"})
        return 1

    emit({"evt": "ready", "iface": iface, "pid": os.getpid()})

    stop = threading.Event()

    def reader() -> None:
        while not stop.is_set():
            try:
                r, _, _ = select.select([sock], [], [], 0.2)
            except OSError:
                break
            if not r:
                continue
            try:
                raw = sock.recv(CANFD_MTU)
            except OSError:
                break
            if not raw:
                break
            emit(unpack_frame(raw))

    t = threading.Thread(target=reader, daemon=True)
    t.start()

    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError as exc:
                emit({"evt": "err", "msg": str(exc)})
                continue
            cmd = msg.get("cmd")
            if cmd == "close":
                break
            if cmd != "send":
                emit({"evt": "err", "msg": f"unknown cmd {cmd}"})
                continue
            try:
                sock.send(pack_frame(msg))
                emit({"evt": "ok"})
            except OSError as exc:
                emit({"evt": "err", "msg": str(exc)})
    finally:
        stop.set()
        try:
            sock.close()
        except OSError:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
