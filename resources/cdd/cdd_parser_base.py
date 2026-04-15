import math

try:
    from .cdd_shared import (
        CAN_ADDRESS_SYSTEM_DEFAULTS,
        GENERIC_TYPE_NAME_PREFIXES,
        normalize_text,
    )
except ImportError:
    from cdd_shared import (
        CAN_ADDRESS_SYSTEM_DEFAULTS,
        GENERIC_TYPE_NAME_PREFIXES,
        normalize_text,
    )


class CddParserBase:
    CAN_ADDRESS_SYSTEM_DEFAULTS = CAN_ADDRESS_SYSTEM_DEFAULTS
    GENERIC_TYPE_NAME_PREFIXES = GENERIC_TYPE_NAME_PREFIXES

    def __init__(self):
        self._ecu_doc = None
        self.data_types = {}
        self.dtc_status_masks = {}
        self.did_data_refs = {}
        self.diag_class_templates = {}
        self.diag_service_templates = {}
        self.protocol_service_templates = {}

    def _direct_children(self, element, tag=None):
        children = []
        for child in list(element):
            if tag is None or child.tag == tag:
                children.append(child)
        return children

    def _first_child(self, element, tag):
        return next((child for child in self._direct_children(element, tag)), None)

    def _find_first_by_path(self, element, path):
        current = element
        for part in [p for p in path.split("/") if p]:
            if current is None:
                return None
            current = self._first_child(current, part)
        return current

    def _find_all_by_path(self, element, path):
        current = [element]
        for part in [p for p in path.split("/") if p]:
            next_nodes = []
            for item in current:
                next_nodes.extend(self._direct_children(item, part))
            current = next_nodes
            if not current:
                return []
        return current

    def _text_by_path(self, element, path):
        target = self._find_first_by_path(element, path)
        if target is None or target.text is None:
            return None
        value = target.text.strip()
        return value or None

    def _parse_number(self, value, field_name):
        if value is None or value == "":
            raise ValueError(f"Missing numeric value for {field_name}")
        num = int(float(value))
        return num

    def _parse_optional_number(self, value):
        if value is None or value == "":
            return None
        try:
            return int(float(value))
        except ValueError:
            return None

    def _cdd_offset_to_start_bit(self, offset, bit_length, byte_order):
        if byte_order == "big_endian":
            return (8 * (offset // 8)) + min(7, (offset % 8) + bit_length - 1)
        return offset

    def _decode_byte_order(self, byte_order_code):
        if byte_order_code == "21":
            return "big_endian"
        if byte_order_code == "12":
            return "little_endian"
        return None

    def _resolve_bit_length_info(self, ctype):
        base_bit_length = self._parse_number(ctype.attrib.get("bl"), "CVALUETYPE.bl")
        min_size = self._parse_optional_number(ctype.attrib.get("minsz"))
        max_size = self._parse_optional_number(ctype.attrib.get("maxsz"))
        qty = ctype.attrib.get("qty")
        bit_length = base_bit_length
        min_bit_length = base_bit_length
        max_bit_length = base_bit_length
        variable_length = False

        if qty == "field" and min_size is not None and max_size is not None and min_size == max_size:
            bit_length = base_bit_length * min_size
            min_bit_length = bit_length
            max_bit_length = bit_length
        elif qty == "field":
            if min_size is not None:
                min_bit_length = base_bit_length * min_size
                bit_length = min_bit_length
            if max_size is not None:
                max_bit_length = base_bit_length * max_size
            variable_length = True

        return {
            "bitLength": bit_length,
            "minBitLength": min_bit_length,
            "maxBitLength": max_bit_length,
            "variableLength": variable_length,
            "quantity": qty,
            "minimum": min_size,
            "maximum": max_size,
        }

    def _parse_data_type_definition(self, data_type):
        ctype = self._first_child(data_type, "CVALUETYPE")
        if ctype is None:
            return None

        byte_order = self._decode_byte_order(ctype.attrib.get("bo"))
        if byte_order is None:
            return None

        comp = self._first_child(data_type, "COMP")
        length_info = self._resolve_bit_length_info(ctype)

        return {
            "name": self._text_by_path(data_type, "NAME/TUV") or "",
            "qual": self._text_by_path(data_type, "QUAL") or "",
            "id": data_type.attrib.get("id"),
            **length_info,
            "encoding": ctype.attrib.get("enc"),
            "choices": self._load_choices(data_type),
            "byteOrder": byte_order,
            "unit": self._text_by_path(data_type, "PVALUETYPE/UNIT"),
            "factor": float(comp.attrib.get("f", "1")) if comp is not None else 1.0,
            "offset": float(comp.attrib.get("o", "0")) if comp is not None else 0.0,
        }

    def _parse_inline_data_type(self, element):
        inline_type = next(
            (
                child
                for child in self._direct_children(element)
                if child.tag in ("TEXTTBL", "IDENT", "UNSDEF", "ENUMDEF")
            ),
            None,
        )
        if inline_type is None:
            return None
        return self._parse_data_type_definition(inline_type)

    def _prefer_instance_field_name(self, data_type, data_obj):
        instance_name = self._text_by_path(data_obj, "QUAL") or self._text_by_path(data_obj, "NAME/TUV")
        if not instance_name:
            return None
        type_name = normalize_text(data_type.get("name") or data_type.get("qual"))
        if any(type_name.startswith(prefix) for prefix in self.GENERIC_TYPE_NAME_PREFIXES):
            return instance_name
        return None

    def _load_choices(self, data_type_element):
        choices = {}
        for choice in self._direct_children(data_type_element, "TEXTMAP"):
            start = self._parse_number(
                (choice.attrib.get("s") or "").replace("(", "").replace(")", ""),
                "TEXTMAP.s",
            )
            end = self._parse_number(
                (choice.attrib.get("e") or "").replace("(", "").replace(")", ""),
                "TEXTMAP.e",
            )
            if start != end:
                continue
            text = self._text_by_path(choice, "TEXT/TUV")
            if text is not None:
                choices[start] = text
        return choices or None

    def _load_data_types(self, ecu_doc):
        data_types_root = self._first_child(ecu_doc, "DATATYPES")
        if data_types_root is None:
            return

        for data_type in self._direct_children(data_types_root):
            parsed = self._parse_data_type_definition(data_type)
            if parsed is not None and parsed.get("id"):
                self.data_types[parsed["id"]] = parsed

    def _load_did_refs(self, ecu_doc):
        dids_root = self._first_child(ecu_doc, "DIDS")
        if dids_root is None:
            return
        for did in self._direct_children(dids_root, "DID"):
            did_id = did.attrib.get("id")
            if did_id:
                self.did_data_refs[did_id] = did

    def _load_dtc_status_masks(self, ecu_doc):
        self.dtc_status_masks = {}
        for mask in ecu_doc.iter("DTCSTATUSMASK"):
            data_type_ref = mask.attrib.get("dtref")
            if not data_type_ref:
                continue

            bit_groups = []
            for bit_index, bit_group in enumerate(self._direct_children(mask, "DTCSTATUSBITGROUP")):
                bit_type_ref = bit_group.attrib.get("dtref")
                bit_type = self.data_types.get(bit_type_ref or "")
                bit_groups.append(
                    {
                        "bitIndex": bit_index,
                        "dtref": bit_type_ref,
                        "name": (bit_type or {}).get("name")
                        or self._text_by_path(bit_group, "QUAL")
                        or self._text_by_path(bit_group, "NAME/TUV")
                        or f"statusBit{bit_index}",
                        "qual": (bit_type or {}).get("qual"),
                        "choices": (bit_type or {}).get("choices"),
                    }
                )

            if not bit_groups:
                continue

            self.dtc_status_masks[data_type_ref] = {
                "dtref": data_type_ref,
                "bitGroups": bit_groups,
            }

            if data_type_ref in self.data_types:
                self.data_types[data_type_ref]["bitGroups"] = bit_groups

    def _load_service_templates(self, ecu_doc):
        self.diag_class_templates = {}
        self.diag_service_templates = {}
        self.protocol_service_templates = {}
        for child in ecu_doc.iter():
            template_id = child.attrib.get("id")
            if not template_id:
                continue
            if child.tag == "DCLTMPL":
                self.diag_class_templates[template_id] = child
            elif child.tag == "DCLSRVTMPL":
                self.diag_service_templates[template_id] = child
            elif child.tag == "PROTOCOLSERVICE":
                self.protocol_service_templates[template_id] = child

    def _load_system_defs(self, ecu_doc):
        definitions = {}
        for child in ecu_doc.iter():
            if child.tag not in ("ENUMDEF", "UNSDEF"):
                continue
            attr_id = child.attrib.get("id")
            qual = self._text_by_path(child, "QUAL")
            default_value = self._parse_optional_number(child.attrib.get("v"))
            if attr_id and qual:
                definitions[attr_id] = {
                    "qual": qual,
                    "default": default_value,
                }
        return definitions

    def _load_system_defaults(self, system_defs):
        values = {}
        for item in system_defs.values():
            qual = item.get("qual")
            default_value = item.get("default")
            if qual and default_value is not None:
                values[qual] = default_value
        return values

    def _load_system_values(self, element, system_defs):
        values = {}

        for child in self._direct_children(element):
            if child.tag not in ("UNS", "ENUM"):
                continue
            attr_ref = child.attrib.get("attrref")
            qual = (system_defs.get(attr_ref or "") or {}).get("qual")
            value = self._parse_optional_number(child.attrib.get("v"))
            if qual and value is not None:
                values[qual] = value
        return values

    def _detect_bus_kind(self, system_values):
        if system_values.get("CAN") == 1 or any(key.startswith("CAN.") for key in system_values):
            return "can"
        if system_values.get("DoIP") == 1 or any(key.startswith("DoIP.") for key in system_values):
            return "eth"
        return "can"

    def _build_uds_time(self, system_values):
        if system_values.get("CAN") == 1 or any(key.startswith("CAN.") for key in system_values):
            s3_time = system_values.get("CAN.S3Client", 5000)
            return {
                "pTime": system_values.get("CAN.P2Client", 2000),
                "pExtTime": system_values.get("CAN.P2ExClient", 5000),
                "s3Time": s3_time,
                "testerPresentEnable": s3_time > 0,
            }

        if system_values.get("DoIP") == 1 or any(key.startswith("DoIP.") for key in system_values):
            s3_time = system_values.get(
                "DoIP.CP_TesterPresentTime",
                system_values.get("DoIP.CP_TesterPresentTime_Ecu", 5000),
            )
            return {
                "pTime": system_values.get("DoIP.CP_P2Max_Ecu", 2000),
                "pExtTime": system_values.get("DoIP.CP_P2Star_Ecu", 5000),
                "s3Time": s3_time,
                "testerPresentEnable": s3_time > 0,
            }

        return {
            "pTime": 2000,
            "pExtTime": 5000,
            "s3Time": 5000,
            "testerPresentEnable": False,
        }

    def _build_can_address_defaults(self, system_values):
        defaults = {}
        for target_key, (source_key, default_value) in self.CAN_ADDRESS_SYSTEM_DEFAULTS.items():
            defaults[target_key] = system_values.get(source_key, default_value)
        defaults["maxWTF"] = system_values.get(
            "CAN.MaxWTF", system_values.get("CAN.MaxNumberOfWaitFrames", 0)
        )
        defaults["paddingValue"] = hex(system_values.get("CAN.CANFrameFillerByte", 0x00))
        defaults["padding"] = system_values.get("CAN.FillerByteHandling", 1) != 0
        defaults["dlc"] = 8
        defaults["brs"] = False
        defaults["canfd"] = False
        defaults["remote"] = False
        defaults["AE"] = "0"
        return defaults

    def _build_can_address_entry(self, name, addr_type, tx_id, rx_id, id_type, defaults):
        return {
            "type": "can",
            "canAddr": {
                "name": name,
                "addrFormat": "NORMAL",
                "addrType": addr_type,
                "SA": tx_id,
                "TA": rx_id,
                "canIdTx": tx_id,
                "canIdRx": rx_id,
                "idType": id_type,
                **defaults,
            },
        }

    def _build_addresses(self, system_values):
        if not (
            system_values.get("CAN") == 1
            or any(key.startswith("CAN.") for key in system_values)
        ):
            return []

        can_phys_req = system_values.get("CAN.ReqCanId")
        can_resp = system_values.get("CAN.ResCanId")
        can_func_req = system_values.get("CAN.ReqCanIdFunc")
        tx_id = hex(can_phys_req) if can_phys_req is not None else "0x700"
        rx_id = hex(can_resp) if can_resp is not None else "0x701"
        is_extended = (
            (can_phys_req is not None and can_phys_req > 0x7FF)
            or (can_resp is not None and can_resp > 0x7FF)
        )
        defaults = self._build_can_address_defaults(system_values)
        standard_id_type = "EXTENDED" if is_extended else "STANDARD"

        addresses = [
            self._build_can_address_entry("Physical", "PHYSICAL", tx_id, rx_id, standard_id_type, defaults)
        ]

        if can_func_req is not None:
            addresses.append(
                self._build_can_address_entry(
                    "Functional",
                    "FUNCTIONAL",
                    hex(can_func_req),
                    rx_id,
                    "EXTENDED" if can_func_req > 0x7FF else "STANDARD",
                    defaults,
                )
            )

        return addresses

    def _dtc_hex_to_code_text(self, value):
        if value is None:
            return None
        dtc_hex = f"{int(value) & 0xFFFFFF:06X}"
        prefix_map = {
            "00": "P",
            "01": "C",
            "10": "B",
            "11": "U",
        }
        dtc_bin = bin(int(dtc_hex, 16))[2:].zfill(24)
        return (
            prefix_map.get(dtc_bin[0:2], "P")
            + str(int(dtc_bin[2:4], 2))
            + str(int(dtc_bin[4:8], 2))
            + dtc_hex[2:]
        )

    def _dtc_code_text_to_hex(self, code_text):
        if not code_text or len(code_text) < 3:
            return None
        prefix_map = {
            "P": "00",
            "C": "01",
            "B": "10",
            "U": "11",
        }
        prefix_bits = prefix_map.get(code_text[0].upper())
        if prefix_bits is None:
            return None
        try:
            bit13_12 = bin(int(code_text[1], 16))[2:].zfill(2)
            bit11_8 = bin(int(code_text[2], 16))[2:].zfill(4)
            bit7_0 = bin(int(code_text[3:5], 16))[2:].zfill(8)
            low_byte = bin(int(code_text[5:], 16))[2:].zfill(8)
        except ValueError:
            return None
        return f"0x{int(prefix_bits + bit13_12 + bit11_8 + bit7_0 + low_byte, 2):06X}"

    def _build_dtc_entry(self, identifier, raw_value, name):
        if raw_value is None:
            return None
        value = int(raw_value) & 0xFFFFFF
        code_text = self._dtc_hex_to_code_text(value)
        return {
            "identifier": identifier,
            "name": name or code_text or f"DTC_{value:06X}",
            "hexNumber": f"0x{value:06X}",
            "hexValue": value,
            "codeText": code_text,
        }

    def _load_dtc_table(self, ecu_doc):
        entries = []
        seen = set()

        for req_dtc in ecu_doc.iter("REQDTC"):
            identifier = req_dtc.attrib.get("identifier")
            raw_value = self._parse_optional_number(req_dtc.attrib.get("code"))
            name = self._text_by_path(req_dtc, "REQNAME")
            entry = self._build_dtc_entry(identifier, raw_value, name)
            if entry is None:
                continue
            key = entry["hexValue"]
            if key in seen:
                continue
            seen.add(key)
            entries.append(entry)

        for text_table in ecu_doc.iter("TEXTTBL"):
            table_name = self._text_by_path(text_table, "NAME/TUV") or ""
            table_qual = self._text_by_path(text_table, "QUAL") or ""
            normalized = f"{table_name} {table_qual}".lower()
            if "dtc" not in normalized:
                continue
            for record in self._direct_children(text_table, "RECORD"):
                raw_value = self._parse_optional_number(record.attrib.get("v"))
                name = self._text_by_path(record, "TEXT/TUV") or self._text_by_path(record, "NAME/TUV")
                entry = self._build_dtc_entry(record.attrib.get("id"), raw_value, name)
                if entry is None:
                    continue
                key = entry["hexValue"]
                if key in seen:
                    continue
                seen.add(key)
                entries.append(entry)

        entries.sort(key=lambda item: item["hexValue"])
        return entries
