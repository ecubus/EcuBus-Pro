import math
import uuid

try:
    from .cdd_attributes_parser import CddAttributesParser
    from .cdd_datatypes_parser import CddDataTypesParser
    from .cdd_did_parser import CddDidParser
    from .cdd_dtc_parser import CddDtcParser
    from .cdd_parser_shared import CddParserShared
    from .cdd_services_parser import CddServicesParser
except ImportError:
    from cdd_attributes_parser import CddAttributesParser
    from cdd_datatypes_parser import CddDataTypesParser
    from cdd_did_parser import CddDidParser
    from cdd_dtc_parser import CddDtcParser
    from cdd_parser_shared import CddParserShared
    from cdd_services_parser import CddServicesParser

BIG_ENDIAN = "big_endian"
LITTLE_ENDIAN = "little_endian"
BYTE_ORDERS = {"HighLow (Motorola)": BIG_ENDIAN, "LowHigh (Intel)": LITTLE_ENDIAN}

# Encoding label -> the short code a tester keys value conversion off.
ENCODINGS = {
    "Unsigned": "uns",
    "Signed": "sgn",
    "Unicode": "utf",
    "ASCII": "asc",
    "IEEE Float (double)": "dbl",
    "IEEE Float (single)": "flt",
    "BCD": "bcd",
}


# Communication parameter -> ISO-TP key in the emitted CAN address, with the
# fallback used when the document does not define the parameter.
ISOTP_PARAMETERS = (
    ("bs", ("Blocksize",), 0),
    ("stMin", ("StMin",), 10),
    ("nAs", ("TimeoutAs",), 1000),
    ("nAr", ("TimeoutAr",), 1000),
    ("nBs", ("TimeoutBs",), 1000),
    ("nCr", ("TimeoutCr",), 1000),
    ("nBr", ("TimeBr",), 0),
    ("nCs", ("TimeCs",), 0),
    ("maxWTF", ("MaxWTF", "MaxNumberOfWaitFrames", "Max_number_Wait_Frames"), 0),
)

# Parameters that identify what kind of bus an interface describes. Interface
# qualifiers are per-document ("CAN", "CAN_FD", "FlexRay_Autosar2x",
# "DoIP_ISO13400"...) so the bus kind has to be inferred from the parameter
# set rather than from the name.
CAN_MARKER_PARAMETERS = ("ReqCanId", "ResCanId", "CanIdType")
DOIP_MARKER_PREFIXES = ("CP_DoIP", "CP_P2Max", "CP_P6Max")

STANDARD_CAN_ID_MAX = 0x7FF

# `CanFdMaxDlc` tag text -> payload bytes. Classic CAN tops out at 8; CAN FD
# adds the larger sizes. Present only on CAN FD interfaces.
CAN_FD_MAX_DLC = {
    "CAN20": 8,
    "CANFD8": 8,
    "CANFD12": 12,
    "CANFD16": 16,
    "CANFD20": 20,
    "CANFD24": 24,
    "CANFD32": 32,
    "CANFD48": 48,
    "CANFD64": 64,
}
CLASSIC_CAN_DLC = 8

# CAN DLC code -> payload bytes, for documents that store the raw code
# instead of a tag such as "CANFD64".
CAN_DLC_LENGTH = {9: 12, 10: 16, 11: 20, 12: 24, 13: 32, 14: 48, 15: 64}

# Service names that only say what the service does, never which one it is.
GENERIC_SERVICE_NAMES = (
    "read",
    "write",
    "start",
    "stop",
    "result",
    "request",
    "send",
    "control",
    "reset",
)

# Data type names that say what a value is made of rather than what it means.
# A value typed by one of these is a byte string the tester edits byte-wise,
# and it is the data object, not the type, that names it.
GENERIC_TYPE_NAME_PREFIXES = (
    "hexdump",
    "ascii",
    "unicode",
    "memory",
    "datarecord",
    "newdataobject",
)

# Component roles that pin the byte identifying which service variant this is.
SUBFUNCTION_SPECS = ("sub", "accm")

# Parameters that carry a DTC and are offered a table of the document's DTCs.
DTC_TABLE_PARAM_NAMES = ("dtc", "listofdtc", "groupofdtc", "dtcgroups", "dtcgroup")

DEFAULT_TESTER_LOGICAL_ADDR = 0x0E00

# A DTC record parameter carries no data type of its own: a fault memory
# entry is the three-byte DTC the pool stores.
DTC_RECORD_BITS = 24


def _normalize(text):
    return "".join(char for char in str(text or "").lower() if char.isalnum())


def _buffer(data, bit_length):
    expected = max(1, math.ceil((bit_length or 8) / 8))
    data = list(data)
    if len(data) < expected:
        data = [0] * (expected - len(data)) + data
    elif len(data) > expected:
        data = data[-expected:]
    return {"type": "Buffer", "data": data}


def _bytes_of(number, bit_length):
    byte_count = max(1, math.ceil((bit_length or 8) / 8))
    return [(number >> shift) & 0xFF for shift in range((byte_count - 1) * 8, -1, -8)]


def _hex_text(data):
    return " ".join(f"{byte:02X}" for byte in data)


class CddTester:
    """Derives connection-oriented settings from the CDD.

    Everything here is an *interpretation* of the parsed data rather than
    a reproduction of it: CAN identifiers, ISO-TP parameters and UDS timing
    get reshaped into the form a tester needs to open a connection. Keys
    like canIdTx, pTime and nAs are this project's invention and do not
    exist in the CDD. The faithful view lives in CddAttributesParser.
    """

    def __init__(self, shared=None):
        self._shared = shared or CddParserShared()
        self._attributes = CddAttributesParser(self._shared)

    # -- helpers -------------------------------------------------------------

    @staticmethod
    def _by_parameter(interface):
        return {parameter["parameter"]: parameter for parameter in interface["parameters"]}

    @staticmethod
    def _number(parameters, names, default=None):
        """First of `names` that resolves to a number, else `default`."""
        if isinstance(names, str):
            names = (names,)
        for name in names:
            parameter = parameters.get(name)
            if parameter is None or parameter["value"] in (None, ""):
                continue
            try:
                return int(parameter["value"])
            except (TypeError, ValueError):
                continue
        return default

    def detect_bus_kind(self, interface):
        if interface is None:
            return "can"
        parameters = self._by_parameter(interface)
        if any(name in parameters for name in CAN_MARKER_PARAMETERS):
            return "can"
        if any(
            name.startswith(prefix)
            for name in parameters
            for prefix in DOIP_MARKER_PREFIXES
        ):
            return "eth"
        return "can"

    # -- timing --------------------------------------------------------------

    def build_uds_timing(self, interface):
        """P2 / P2* / S3 as a tester consumes them.

        Both the CAN and the DoIP parameter sets are checked, since the two
        spell the same concepts differently.
        """
        if interface is None:
            return {}
        parameters = self._by_parameter(interface)

        timing = {}
        p2 = self._number(parameters, ("P2Client", "CP_P2Max_Ecu", "CP_P2Max"))
        p2_star = self._number(parameters, ("P2ExClient", "CP_P2Star_Ecu", "CP_P2Star"))
        s3 = self._number(
            parameters,
            ("S3Client", "CP_TesterPresentTime", "CP_TesterPresentTime_Ecu"),
        )
        if p2 is not None:
            timing["pTime"] = p2
        if p2_star is not None:
            timing["pExtTime"] = p2_star
        if s3 is not None:
            timing["s3Time"] = s3
            timing["testerPresentEnable"] = s3 > 0
        return timing

    # -- addressing ----------------------------------------------------------

    def _address_defaults(self, parameters):
        defaults = {
            key: self._number(parameters, names, fallback)
            for key, names, fallback in ISOTP_PARAMETERS
        }
        defaults["paddingValue"] = hex(self._number(parameters, "CANFrameFillerByte", 0))
        defaults["padding"] = self._number(parameters, "FillerByteHandling", 1) != 0

        # CAN FD settings live only on CAN FD interfaces; a classic CAN
        # interface simply has no CanFd* parameters, which is what makes
        # their absence mean "classic CAN" rather than "unknown".
        can_fd = self._flag(parameters, "CanFdHandling")
        defaults["canfd"] = can_fd
        defaults["brs"] = can_fd and self._flag(parameters, "CanFdBrsHandling")
        defaults["dlc"] = self._max_dlc(parameters) if can_fd else CLASSIC_CAN_DLC
        if can_fd:
            data_baudrate = self._number(parameters, "CanFdDataBaudrate")
            if data_baudrate is not None:
                defaults["dataBaudrate"] = data_baudrate
        baudrate = self._number(parameters, "Baudrate")
        if baudrate is not None:
            defaults["baudrate"] = baudrate

        # Diagnostics never uses CAN remote frames and the CDD has no
        # parameter for them, so this stays constant.
        defaults["remote"] = False
        defaults["AE"] = str(self._number(parameters, "AddressExtension", 0))
        return defaults

    @staticmethod
    def _text(parameters, name):
        """An enum parameter's tag text, e.g. AddrScheme -> "Mixed"."""
        parameter = parameters.get(name)
        return parameter.get("valueText") if parameter else None

    def _flag(self, parameters, name):
        """An on/off parameter, however this document spells it.

        The tag text is what a document normally carries ("Enabled"), but a
        document may define the parameter as a plain number instead, and
        nothing stops it from wording the tags differently.
        """
        text = str(self._text(parameters, name) or "").strip().lower()
        if text in ("enabled", "enable", "true", "yes", "on"):
            return True
        if text in ("disabled", "disable", "false", "no", "off"):
            return False
        return self._number(parameters, name, 0) != 0

    def _max_dlc(self, parameters):
        """CAN FD payload size, from the tag text or the raw DLC code."""
        text = self._text(parameters, "CanFdMaxDlc")
        if text in CAN_FD_MAX_DLC:
            return CAN_FD_MAX_DLC[text]
        return CAN_DLC_LENGTH.get(self._number(parameters, "CanFdMaxDlc"), CLASSIC_CAN_DLC)

    def _addr_format(self, parameters, name):
        """NORMAL / MIXED / EXTENDED, from the AddrScheme enum's tag text.

        The numeric value cannot be used: the enum tags are defined per
        document, so value 0 reads "Normal" in one file while another file
        gives a different tag the same number.
        """
        text = self._text(parameters, name)
        return text.upper() if text else "NORMAL"

    def _id_type(self, parameters, name, *can_ids):
        """STANDARD / EXTENDED from the CAN-ID Type enum.

        Same caveat as _addr_format: every sample document stores 0 here,
        but the tag reads "11-Bit" in two of them and "29-Bit" in the third.
        Falls back to the identifier's magnitude when the parameter is
        missing.
        """
        text = self._text(parameters, name)
        if text:
            return "EXTENDED" if "29" in text else "STANDARD"
        return (
            "EXTENDED"
            if any(i is not None and i > STANDARD_CAN_ID_MAX for i in can_ids)
            else "STANDARD"
        )

    def _address_entry(self, name, addr_type, tx_id, rx_id, id_type, addr_format, defaults):
        return {
            "type": "can",
            "canAddr": {
                "name": name,
                "addrFormat": addr_format,
                "addrType": addr_type,
                "SA": tx_id,
                "TA": rx_id,
                "canIdTx": tx_id,
                "canIdRx": rx_id,
                "idType": id_type,
                **defaults,
            },
        }

    def build_can_addresses(self, interface):
        if interface is None or self.detect_bus_kind(interface) != "can":
            return []

        parameters = self._by_parameter(interface)
        request_id = self._number(parameters, "ReqCanId")
        response_id = self._number(parameters, "ResCanId")
        functional_id = self._number(parameters, "ReqCanIdFunc")
        if request_id is None and response_id is None:
            return []

        defaults = self._address_defaults(parameters)
        addresses = [
            self._address_entry(
                "Physical",
                "PHYSICAL",
                hex(request_id) if request_id is not None else None,
                hex(response_id) if response_id is not None else None,
                self._id_type(parameters, "CanIdType", request_id, response_id),
                self._addr_format(parameters, "AddrScheme"),
                defaults,
            )
        ]
        if functional_id is not None:
            addresses.append(
                self._address_entry(
                    "Functional",
                    "FUNCTIONAL",
                    hex(functional_id),
                    hex(response_id) if response_id is not None else None,
                    self._id_type(parameters, "CanIdTypeFunc", functional_id),
                    self._addr_format(parameters, "AddrSchemeFunc"),
                    defaults,
                )
            )
        return addresses

    # -- parameter expansion -------------------------------------------------

    @staticmethod
    def start_bit(bit_offset, bit_length, byte_order):
        """CDD bit offset -> the start-bit convention CAN tooling uses.

        In Motorola (big-endian) order a signal is named by the bit it
        *starts* at, which is its most significant bit within the first
        byte; Intel order names the least significant bit, which is the
        offset itself. The panel's own Byte No. / Bit Pos. columns are a
        different convention and stay on the parser's output untouched.
        """
        if byte_order != BIG_ENDIAN or bit_length is None:
            return bit_offset
        return 8 * (bit_offset // 8) + min(7, (bit_offset % 8) + bit_length - 1)

    def buffer(self, value, bit_length, element_bits=8):
        """A value as the byte array a tester puts on the wire."""
        byte_count = max(1, math.ceil((bit_length or 8) / 8))
        number = self._shared.cdd_int(value, element_bits)
        if number is None:
            number = 0
        return {
            "type": "Buffer",
            "data": [(number >> shift) & 0xFF for shift in range((byte_count - 1) * 8, -1, -8)],
        }

    @staticmethod
    def _choices(data_type):
        """{raw value: label} for a text table, as a tester would show it."""
        if not data_type or not data_type.get("textTable"):
            return None
        choices = {}
        for row in data_type["textTable"]:
            start = row.get("start")
            if start is None:
                continue
            try:
                choices[int(str(start), 16 if str(start).startswith("0x") else 10)] = row["text"]
            except ValueError:
                choices[start] = row["text"]
        return choices or None

    def _bit_groups(self, data_type, data_types):
        """A packet's bit-field members, flattened into one group list.

        A parameter whose data type packs several sub-values into a byte
        needs them individually to be encodable; `members` on the data type
        keeps them nested one level deeper.
        """
        if not data_type or not data_type.get("members"):
            return None
        groups = []
        offset = 0
        for member in data_type["members"]:
            children = member["members"] if member["type"] == "Struct" else [member]
            for child in children:
                if child["type"] == "Gap":
                    offset += child.get("bitLength") or 0
                    continue
                child_type = data_types.get(child.get("dtQual"))
                coded = (child_type or {}).get("codedValue") or {}
                bit_length = coded.get("bitLength")
                groups.append(
                    {
                        "name": child["name"],
                        "qual": child["qual"],
                        "bitOffset": offset,
                        "bitLength": bit_length,
                        "encoding": ENCODINGS.get(coded.get("encoding"), coded.get("encoding")),
                        "choices": self._choices(child_type),
                    }
                )
                offset += bit_length or 0
        return groups or None

    def expand_parameter(self, parameter, data_types):
        """A telegram parameter with its data type's detail inlined.

        The parser deliberately reports only the structure plus a
        `dataTypeQual`; a tester needs the conversion facts alongside each
        parameter to encode a request and decode a response, so they are
        denormalised here rather than in the parser.
        """
        data_type = data_types.get(parameter.get("dataTypeQual"))
        coded = (data_type or {}).get("codedValue") or {}
        physical = (data_type or {}).get("physicalValue") or {}
        linear = (data_type or {}).get("linear") or {}
        byte_order = BYTE_ORDERS.get(coded.get("byteOrder"), BIG_ENDIAN)
        bit_length = parameter.get("bitLength")

        # A constant pins the value; otherwise the default is the starting
        # point, and failing both the parameter starts out zeroed.
        raw = parameter.get("constant")
        if raw is None:
            raw = parameter.get("default")

        return {
            "name": parameter["name"],
            "qual": parameter["qual"],
            "bitOffset": parameter.get("bitOffset"),
            "startBit": self.start_bit(parameter.get("bitOffset") or 0, bit_length, byte_order),
            "bitLength": bit_length,
            "minBitLength": parameter.get("minBitLength"),
            "maxBitLength": parameter.get("maxBitLength"),
            "variableLength": parameter.get("variableLength"),
            "quantity": coded.get("quantity"),
            "byteOrder": byte_order,
            "encoding": ENCODINGS.get(coded.get("encoding"), coded.get("encoding")),
            "unit": physical.get("unit"),
            "factor": linear.get("factor", 1.0),
            "offset": linear.get("offset", 0.0),
            "minimum": coded.get("minSize"),
            "maximum": coded.get("maxSize"),
            "precision": physical.get("precision"),
            "choices": self._choices(data_type),
            "bitGroups": self._bit_groups(data_type, data_types),
            "constant": parameter.get("constant"),
            "default": parameter.get("default"),
            "value": self.buffer(raw, bit_length, coded.get("bitLength") or 8),
            "physicalValue": None if raw is None else raw,
            "dataType": parameter.get("dataType"),
            "dataTypeQual": parameter.get("dataTypeQual"),
        }

    def expand_telegram(self, telegram, data_types):
        return {
            **telegram,
            "parameters": [
                self.expand_parameter(parameter, data_types)
                for parameter in telegram["parameters"]
            ],
        }

    # -- assembly ------------------------------------------------------------

    # -- interfaces -----------------------------------------------------------

    def supported_interfaces(self, ecu_doc):
        """The interfaces a tester can be built for.

        An interface is an attribute in the COM.INTERFACES category, which
        the ECUs that support it set to 1.
        """
        return [
            interface
            for interface in self._attributes.parse_interfaces(ecu_doc)
            if interface["enabled"]
        ]

    @staticmethod
    def _interface_for_variant(interface, variant_qual):
        """The interface with every parameter resolved for one variant.

        A variant may override any communication parameter, so the parameter
        list a tester is built from is variant-specific.
        """
        parameters = []
        for parameter in interface["parameters"]:
            resolved = parameter["variants"].get(variant_qual)
            if resolved is None:
                parameters.append(parameter)
                continue
            value = resolved["value"]
            parameters.append(
                {
                    **parameter,
                    "value": value,
                    "valueText": (parameter["choices"] or {}).get(str(value), parameter["valueText"])
                    if parameter["kind"] == "enum"
                    else parameter["valueText"],
                    "source": resolved["source"],
                }
            )
        return {**interface, "parameters": parameters}

    # -- addressing -----------------------------------------------------------

    def _parameter_number(self, interface, name, default=None):
        for parameter in interface["parameters"]:
            if parameter["parameter"] == name:
                number = self._shared.cdd_int(parameter["value"])
                return default if number is None else number
        return default

    def _eth_address_entry(self, name, ta_type, target_addr, tester_addr, gateway_addr):
        is_gateway = gateway_addr is not None
        entity = {
            "vin": "00000000000000000",
            "eid": "00-00-00-00-00-00",
            "gid": "00-00-00-00-00-00",
            "nodeType": "gateway" if is_gateway else "node",
            "logicalAddr": gateway_addr if is_gateway else target_addr,
        }
        if is_gateway:
            entity["nodeAddr"] = target_addr

        return {
            "type": "eth",
            "ethAddr": {
                "name": name,
                "taType": ta_type,
                "virReqType": "broadcast",
                "virReqAddr": "",
                "entityNotFoundBehavior": "normal",
                "entity": entity,
                "tester": {
                    "testerLogicalAddr": tester_addr,
                    "routeActiveTime": 0,
                    "createConnectDelay": 1000,
                },
            },
        }

    def build_eth_addresses(self, interface):
        tester_addr = self._parameter_number(
            interface, "CP_DoIPLogicalTesterAddress", DEFAULT_TESTER_LOGICAL_ADDR
        )
        gateway_addr = self._parameter_number(interface, "CP_DoIPLogicalGatewayAddress")
        ecu_addr = self._parameter_number(interface, "CP_DoIPLogicalEcuAddress")
        functional_addr = self._parameter_number(interface, "CP_DoIPLogicalFunctionalAddress")

        addresses = []
        if ecu_addr is not None:
            addresses.append(
                self._eth_address_entry(
                    "Physical", "physical", ecu_addr, tester_addr, gateway_addr
                )
            )
        if functional_addr is not None:
            addresses.append(
                self._eth_address_entry(
                    "Functional", "functional", functional_addr, tester_addr, gateway_addr
                )
            )
        return addresses

    def build_addresses(self, interface, bus_kind):
        if bus_kind == "eth":
            return self.build_eth_addresses(interface)
        if bus_kind == "can":
            addresses = self.build_can_addresses(interface)
            for address in addresses:
                address["canAddr"].pop("baudrate", None)
                address["canAddr"].pop("dataBaudrate", None)
            return addresses
        return []

    def build_uds_time(self, interface, addresses, bus_kind):
        uds_time = self.build_uds_timing(interface)
        if bus_kind != "can":
            uds_time["testerPresentEnable"] = False
            return uds_time
        if uds_time.get("testerPresentEnable"):
            index = self._tester_present_addr_index(interface, addresses)
            if index is None:
                uds_time["testerPresentEnable"] = False
            else:
                uds_time["testerPresentAddrIndex"] = index
        return uds_time

    def _tester_present_addr_index(self, interface, addresses):
        """Which address tester-present is sent on.

        The document says so through TesterPresentPhys / TesterPresentFunc;
        without either, the physical address is the sensible default.
        """
        preferred = None
        if self._parameter_number(interface, "TesterPresentPhys") is not None:
            preferred = "PHYSICAL"
        elif self._parameter_number(interface, "TesterPresentFunc") is not None:
            preferred = "FUNCTIONAL"

        for addr_type in (preferred, "PHYSICAL", None):
            for index, address in enumerate(addresses):
                can_addr = address.get("canAddr")
                if not can_addr:
                    continue
                if addr_type is None or can_addr.get("addrType") == addr_type:
                    return index
        return None

    @staticmethod
    def _tester_present_service_id(service_map):
        services = service_map.get("0x3E") or []
        for service in services:
            if service.get("subfunc") == "0x00":
                return service["id"]
        return services[0]["id"] if services else None

    # -- parameters -----------------------------------------------------------

    def _param(self, field):
        """One tester parameter from the facts about a value on the wire."""
        bit_length = field.get("bitLength") or 8
        meta = {
            "type": "CDD-FIELD",
            "cddField": {
                "name": field.get("name"),
                "startBit": field.get("startBit"),
                "bitLength": field.get("bitLength"),
                "minBitLength": field.get("minBitLength"),
                "maxBitLength": field.get("maxBitLength"),
                "variableLength": field.get("variableLength"),
                "quantity": field.get("quantity"),
                "byteOrder": field.get("byteOrder") or BIG_ENDIAN,
                "encoding": field.get("encoding"),
                "minimum": field.get("minimum"),
                "maximum": field.get("maximum"),
                "unit": field.get("unit"),
                "factor": field.get("factor"),
                "offset": field.get("offset"),
                "choices": field.get("choices"),
                "bitGroups": field.get("bitGroups"),
                "members": field.get("members"),
                "spec": field.get("spec"),
            },
        }

        fixed = bool(field.get("fixedValue")) or field.get("spec") in ("id", "sub", "accm")
        value = field.get("value")
        param = {
            "id": str(uuid.uuid4()),
            "name": field.get("name") or "data",
            "bitLen": bit_length,
            "deletable": not fixed,
            "editable": not fixed,
            "meta": meta,
        }

        if field.get("encoding") in ("asc", "utf"):
            data = _bytes_of(value, bit_length) if value is not None else [0] * math.ceil(bit_length / 8)
            param["type"] = "ASCII"
            param["value"] = _buffer(data, bit_length)
            param["phyValue"] = _hex_text(data) if value is not None else ""
            return param

        if (
            not field.get("variableLength")
            and not field.get("byteString")
            and bit_length <= 32
            and field.get("encoding") != "bin"
        ):
            param["type"] = "NUM"
            param["value"] = _buffer(_bytes_of(value or 0, bit_length), bit_length)
            param["phyValue"] = 0 if value is None else value
            return param

        data = _bytes_of(value, bit_length) if value is not None else [0] * math.ceil(bit_length / 8)
        param["type"] = "ARRAY"
        param["value"] = _buffer(data, bit_length)
        param["phyValue"] = _hex_text(data)
        return param

    def _data_type_field(self, name, data_type, default=None, prefer_name=False):
        """The facts a parameter typed by `data_type` puts on the wire.

        A field (array) type states the width of one element, so its total
        width is that times the element count; a variable field contributes
        its minimum.
        """
        coded = data_type.get("codedValue") or {}
        physical = data_type.get("physicalValue") or {}
        linear = data_type.get("linear") or {}
        element_bits = coded.get("bitLength") or 8
        min_size = coded.get("minSize")
        max_size = coded.get("maxSize")
        variable = coded.get("quantity") == "field" and min_size != max_size
        if coded.get("quantity") == "field":
            bit_length = element_bits * (min_size or 1)
        else:
            bit_length = element_bits

        type_name = data_type.get("name") or data_type.get("qual") or ""
        generic = _normalize(type_name).startswith(GENERIC_TYPE_NAME_PREFIXES)
        return {
            "name": name if prefer_name or generic or not type_name else type_name,
            "startBit": 0,
            "bitLength": bit_length,
            "minBitLength": element_bits * min_size if min_size else bit_length,
            "maxBitLength": element_bits * max_size if max_size else bit_length,
            "variableLength": variable,
            "quantity": coded.get("quantity"),
            "byteOrder": BYTE_ORDERS.get(coded.get("byteOrder"), BIG_ENDIAN),
            "encoding": ENCODINGS.get(coded.get("encoding"), coded.get("encoding")),
            "minimum": min_size,
            "maximum": max_size,
            "unit": physical.get("unit"),
            "factor": linear.get("factor", 1.0),
            "offset": linear.get("offset", 0.0),
            "choices": self._choices(data_type),
            "byteString": generic,
            "value": self._shared.cdd_int(default, element_bits),
        }

    def _params_from_did(self, did, data_types):
        """A DID's data, one parameter per member.

        The telegram only references the DID; what it carries is the DID's
        own member list, which is what the tester has to encode.
        """
        params = []
        for member in did["data"]:
            if member["type"] == "Gap":
                continue
            if member["type"] == "Struct":
                params.extend(
                    self._params_from_did({"data": member["members"]}, data_types)
                )
                continue
            data_type = data_types.get(member.get("dtQual"))
            if data_type is None:
                continue
            params.append(
                self._param(
                    self._data_type_field(
                        member["name"],
                        data_type,
                        member.get("staticValue") or member.get("default"),
                        # Members of one DID often share a data type, so it is
                        # the member that names the parameter.
                        prefer_name=True,
                    )
                )
            )
        return params

    def _param_from_telegram_parameter(self, telegram_parameter, data_types):
        parameter = self.expand_parameter(telegram_parameter, data_types)
        raw = parameter.get("constant")
        if raw is None:
            raw = parameter.get("default")
        data_type = data_types.get(parameter.get("dataTypeQual")) or {}
        type_name = data_type.get("name") or data_type.get("qual") or ""
        generic = _normalize(type_name).startswith(GENERIC_TYPE_NAME_PREFIXES)
        return self._param(
            {
                **parameter,
                "name": parameter["name"] if generic else (type_name or parameter["name"]),
                "byteString": generic,
                "value": self._shared.cdd_int(raw, parameter.get("bitLength") or 8),
                "fixedValue": parameter.get("constant") is not None,
            }
        )

    def _params_from_component(self, component, telegrams, data_types):
        """The parameters one telegram component contributes.

        A component either pins a value itself -- the service id, a constant,
        a static identifier or subfunction -- or points at a telegram whose
        parameters are the payload.
        """
        if component["role"] == "ServiceId":
            return []

        if component["kind"] == "CONSTCOMP":
            data = [int(part, 16) for part in (component.get("bytes") or "").split() if part]
            if not data:
                return []
            number = int.from_bytes(bytes(data), "big")
            return [
                self._param(
                    {
                        "name": component["name"],
                        "startBit": 0,
                        "bitLength": 8 * len(data),
                        "byteOrder": BIG_ENDIAN,
                        "encoding": "uns",
                        "value": number,
                        "fixedValue": True,
                        "spec": component.get("spec"),
                    }
                )
            ]

        if component["kind"] == "STATICCOMP":
            data_type = data_types.get(component.get("dataType")) or {}
            coded = data_type.get("codedValue") or {}
            physical = data_type.get("physicalValue") or {}
            linear = data_type.get("linear") or {}
            data = [int(part, 16) for part in (component.get("bytes") or "").split() if part]
            bit_length = 8 * len(data) if data else coded.get("bitLength")
            return [
                self._param(
                    {
                        "name": component.get("dataType") or component["name"],
                        "startBit": 0,
                        "bitLength": bit_length,
                        "byteOrder": BYTE_ORDERS.get(coded.get("byteOrder"), BIG_ENDIAN),
                        "encoding": ENCODINGS.get(coded.get("encoding"), coded.get("encoding")),
                        "unit": physical.get("unit"),
                        "factor": linear.get("factor", 1.0),
                        "offset": linear.get("offset", 0.0),
                        "choices": self._choices(data_type),
                        "value": int.from_bytes(bytes(data), "big") if data else None,
                        "fixedValue": True,
                        "spec": component.get("spec"),
                    }
                )
            ]

        telegram = telegrams.get(component.get("telegram"))
        if telegram and telegram["parameters"]:
            params = []
            for parameter in telegram["parameters"]:
                if parameter["kind"] == "RECORDDATAOBJ":
                    params.append(
                        self._param(
                            {
                                "name": parameter["name"],
                                "startBit": 0,
                                "bitLength": DTC_RECORD_BITS,
                                "byteOrder": BIG_ENDIAN,
                                "encoding": "uns",
                                "byteString": True,
                            }
                        )
                    )
                    continue
                if parameter["kind"] == "DIDDATAREF":
                    did = self._dids.get(parameter["qual"])
                    if did is None:
                        break
                    params.extend(self._params_from_did(did, data_types))
                    continue
                params.append(self._param_from_telegram_parameter(parameter, data_types))
            if params:
                return params

        # A payload the document leaves open: the tester offers one editable
        # byte the user can grow.
        return [
            self._param(
                {
                    "name": component["name"],
                    "startBit": 0,
                    "bitLength": 8,
                    "byteOrder": BIG_ENDIAN,
                    "encoding": "bin",
                    "variableLength": True,
                }
            )
        ]

    def _params_from_telegram(self, telegram, telegrams, data_types):
        if telegram is None:
            return []
        params = []
        for component in telegram["components"]:
            params.extend(self._params_from_component(component, telegrams, data_types))
        return params

    def _attach_dtc_table(self, params, dtc_table):
        if not dtc_table:
            return
        for param in params:
            if _normalize(param["name"]) in DTC_TABLE_PARAM_NAMES:
                param["DTC_Table"] = dtc_table

    # -- services -------------------------------------------------------------

    @staticmethod
    def _service_label(instance, service, service_count):
        label = instance["name"] or instance["qual"]
        if service_count < 2:
            return label
        for candidate in (service.get("name"), service.get("qual")):
            if candidate and _normalize(candidate) not in GENERIC_SERVICE_NAMES:
                return f"{label}_{candidate}"
        return label

    @staticmethod
    def _subfunction(request):
        for component in request["components"]:
            if component.get("spec") not in SUBFUNCTION_SPECS:
                continue
            data = [part for part in (component.get("bytes") or "").split() if part]
            if data:
                return f"0x{int(data[0], 16):02X}"
        return None

    def _build_service(self, instance, service, telegrams, data_types, dtc_table):
        request = service.get("request")
        if not request or not request.get("bytes"):
            return None

        sid = f"0x{request['bytes'].split()[0]}"
        params = self._params_from_telegram(request, telegrams, data_types)
        resp_params = self._params_from_telegram(
            service.get("positiveResponse"), telegrams, data_types
        )
        self._attach_dtc_table(params, dtc_table)
        self._attach_dtc_table(resp_params, dtc_table)

        subfunction = self._subfunction(request)
        return {
            "id": str(uuid.uuid4()),
            "name": self._service_label(instance, service, len(instance["services"])),
            "serviceId": sid,
            "subfunc": subfunction,
            "params": params,
            "respParams": resp_params,
            "suppress": False,
            "autoSubfunc": subfunction is not None,
            "desc": f'{instance["className"]} / {service["qual"]}'
            if service.get("qual")
            else instance["className"],
        }

    # -- assembly -------------------------------------------------------------

    @staticmethod
    def _unique_key(testers, base):
        if base not in testers:
            return base
        index = 2
        while f"{base}_{index}" in testers:
            index += 1
        return f"{base}_{index}"

    def build(self, ecu_doc):
        ecu = self._shared.first_child(ecu_doc, "ECU")
        if ecu is None:
            return {}

        ecu_name = (
            self._shared.text_by_path(ecu, "QUAL")
            or self._shared.text_by_path(ecu, "NAME/TUV")
            or "CDD"
        )
        interfaces = self.supported_interfaces(ecu_doc)
        if not interfaces:
            raise ValueError(
                "no supported interface: the document declares none in its "
                "COM.INTERFACES attribute category"
            )
        instances = CddServicesParser(self._shared).parse(ecu_doc)
        data_types = CddDataTypesParser(self._shared).parse(ecu_doc)
        by_qual = {entry["qual"]: entry for entry in data_types}
        by_name = {entry["name"]: entry for entry in data_types}
        dtc_table = self._dtc_table(ecu_doc)
        did_list = CddDidParser(self._shared).parse(ecu_doc)
        dtc_list = CddDtcParser(self._shared).parse(ecu_doc)
        self._dids = {did["qual"]: did for did in did_list}

        variants = self._shared.direct_children(ecu, "VAR") or [ecu]
        result = {ecu_name: {}}
        for index, variant in enumerate(variants):
            variant_qual = (
                self._shared.qual(variant)
                if variant is not ecu
                else ecu_name
            ) or f"{ecu_name}_{index + 1}"
            service_map = self._service_map(
                instances, variant_qual, {**by_qual, **by_name}, dtc_table
            )

            for interface in interfaces:
                resolved = self._interface_for_variant(interface, variant_qual)
                bus_kind = self.detect_bus_kind(resolved)
                addresses = self.build_addresses(resolved, bus_kind)
                uds_time = self.build_uds_time(resolved, addresses, bus_kind)
                if uds_time.get("testerPresentEnable"):
                    service_id = self._tester_present_service_id(service_map)
                    if service_id is not None:
                        uds_time["testerPresentSpecialService"] = service_id

                name = variant_qual if len(interfaces) == 1 else interface["qual"]
                if len(variants) > 1 and len(interfaces) > 1:
                    name = f"{variant_qual}.{interface['qual']}"
                key = self._unique_key(result[ecu_name], name)
                result[ecu_name][key] = {
                    "id": str(uuid.uuid4()),
                    "name": name,
                    "type": bus_kind,
                    "interface": interface["qual"],
                    "udsTime": uds_time,
                    "seqList": [],
                    "address": addresses,
                    "didList": did_list,
                    "dtcList": dtc_list,
                    "allServiceList": service_map,
                }
        return result

    def _service_map(self, instances, variant_qual, data_types, dtc_table):
        service_map = {}
        for instance in instances:
            if instance["variant"] != variant_qual:
                continue
            telegrams = {
                telegram["name"]: telegram for telegram in instance["telegrams"]
            }
            for service in instance["services"]:
                built = self._build_service(
                    instance, service, telegrams, data_types, dtc_table
                )
                if built is None:
                    continue
                service_map.setdefault(built["serviceId"], []).append(built)
        return service_map

    def _dtc_table(self, ecu_doc):
        entries = []
        for dtc in CddDtcParser(self._shared).parse(ecu_doc):
            value = dtc["raw"] & 0xFFFFFF
            entries.append(
                {
                    "identifier": dtc["id"],
                    "name": dtc["errorText"] or dtc["dtc"],
                    "hexNumber": f"0x{value:06X}",
                    "hexValue": value,
                    "codeText": dtc["dtc"],
                }
            )
        entries.sort(key=lambda entry: entry["hexValue"])
        return entries
