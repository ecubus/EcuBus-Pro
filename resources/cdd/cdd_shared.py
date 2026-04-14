import math

UDS_SERVICE_SPECS = {
    "0x10": {"name": "DiagnosticSessionControl", "hasSubFunction": True},
    "0x11": {"name": "ECUReset", "hasSubFunction": True},
    "0x14": {"name": "ClearDiagnosticInformation", "hasSubFunction": False},
    "0x19": {"name": "ReadDTCInformation", "hasSubFunction": False},
    "0x22": {"name": "ReadDataByIdentifier", "hasSubFunction": False},
    "0x23": {"name": "ReadMemoryByAddress", "hasSubFunction": False},
    "0x24": {"name": "ReadScalingDataByIdentifier", "hasSubFunction": False},
    "0x27": {"name": "SecurityAccess", "hasSubFunction": True},
    "0x28": {"name": "CommunicationControl", "hasSubFunction": True},
    "0x29": {"name": "Authentication", "hasSubFunction": True},
    "0x2A": {"name": "ReadDataByPeriodicIdentifier", "hasSubFunction": False},
    "0x2C": {"name": "DynamicallyDefineDataIdentifier", "hasSubFunction": True},
    "0x2E": {"name": "WriteDataByIdentifier", "hasSubFunction": False},
    "0x2F": {"name": "InputOutputControlByIdentifier", "hasSubFunction": False},
    "0x31": {"name": "RoutineControl", "hasSubFunction": True},
    "0x34": {"name": "RequestDownload", "hasSubFunction": False},
    "0x35": {"name": "RequestUpload", "hasSubFunction": False},
    "0x36": {"name": "TransferData", "hasSubFunction": False},
    "0x37": {"name": "RequestTransferExit", "hasSubFunction": False},
    "0x38": {"name": "RequestFileTransfer", "hasSubFunction": False},
    "0x3D": {"name": "WriteMemoryByAddress", "hasSubFunction": False},
    "0x3E": {"name": "TesterPresent", "hasSubFunction": True},
    "0x83": {"name": "AccessTimingParameter", "hasSubFunction": True},
    "0x84": {"name": "SecuredDataTransmission", "hasSubFunction": False},
    "0x85": {"name": "ControlDTCSetting", "hasSubFunction": True},
    "0x86": {"name": "ResponseOnEvent", "hasSubFunction": True},
    "0x87": {"name": "LinkControl", "hasSubFunction": True},
}

GENERIC_TYPE_NAME_PREFIXES = ("hexdump", "ascii", "unicode", "memory", "datarecord", "newdataobject")

SERVICE_MATCH_RULES = [
    ("diagnosticsessioncontrol", "0x10", "subfunction", "subfunction"),
    ("ecureset", "0x11", "subfunction", "subfunction"),
    ("cleardiagnosticinformation", "0x14", "identifier", "none"),
    ("readdtcinformation", "0x19", "subfunction", "subfunction"),
    ("readdatabyidentifier", "0x22", "identifier", "identifier"),
    ("readmemorybyaddress", "0x23", "none", "none"),
    ("readscalingdatabyidentifier", "0x24", "identifier", "identifier"),
    ("securityaccess", "0x27", "subfunction", "subfunction"),
    ("communicationcontrol", "0x28", "subfunction", "subfunction"),
    ("authentication", "0x29", "subfunction", "subfunction"),
    ("readdatabyperiodicidentifier", "0x2A", "identifier", "identifier"),
    ("dynamicallydefinedataidentifier", "0x2C", "subfunction", "subfunction"),
    ("writedatabyidentifier", "0x2E", "identifier", "identifier"),
    ("inputoutputcontrolbyidentifier", "0x2F", "identifier", "identifier"),
    ("routinecontrol", "0x31", "subfunction", "subfunction"),
    ("requestdownload", "0x34", "none", "none"),
    ("requestupload", "0x35", "none", "none"),
    ("transferdata", "0x36", "none", "none"),
    ("requesttransferexit", "0x37", "none", "none"),
    ("requestfiletransfer", "0x38", "none", "none"),
    ("testerpresent", "0x3E", "subfunction", "subfunction"),
    ("accesstimingparameter", "0x83", "subfunction", "subfunction"),
    ("secureddatatransmission", "0x84", "none", "none"),
    ("controldtcsetting", "0x85", "subfunction", "subfunction"),
    ("linkcontrol", "0x87", "subfunction", "subfunction"),
]

CAN_ADDRESS_SYSTEM_DEFAULTS = {
    "bs": ("CAN.Blocksize", 0),
    "stMin": ("CAN.StMin", 10),
    "nAs": ("CAN.TimeoutAs", 1000),
    "nAr": ("CAN.TimeoutAr", 1000),
    "nBs": ("CAN.TimeoutBs", 1000),
    "nCr": ("CAN.TimeoutCr", 1000),
    "nBr": ("CAN.TimeBr", 0),
    "nCs": ("CAN.TimeCs", 0),
}


def buffer_obj(data, bit_len):
    expected_len = max(1, math.ceil(bit_len / 8)) if bit_len else 1
    raw = list(data or [])
    if len(raw) < expected_len:
        raw.extend([0] * (expected_len - len(raw)))
    elif len(raw) > expected_len > 0:
        raw = raw[:expected_len]
    return {"type": "Buffer", "data": raw}


def hex_bytes(data):
    return " ".join(f"{byte:02X}" for byte in data)


def normalize_text(value):
    if not value:
        return ""
    return value.lower().replace(" ", "").replace("_", "").replace("-", "")

