import math
import traceback
import uuid
import xml.etree.ElementTree as ET

try:
    from .cdd_parser_base import CddParserBase
except ImportError:
    from cdd_parser_base import CddParserBase

try:
    from .cdd_shared import (
        CAN_ADDRESS_SYSTEM_DEFAULTS,
        GENERIC_TYPE_NAME_PREFIXES,
        SERVICE_MATCH_RULES,
        UDS_SERVICE_SPECS,
        buffer_obj,
        hex_bytes,
        normalize_text,
    )
except ImportError:
    from cdd_shared import (
        CAN_ADDRESS_SYSTEM_DEFAULTS,
        GENERIC_TYPE_NAME_PREFIXES,
        SERVICE_MATCH_RULES,
        UDS_SERVICE_SPECS,
        buffer_obj,
        hex_bytes,
        normalize_text,
    )

_buffer_obj = buffer_obj
_hex_bytes = hex_bytes
_normalize_text = normalize_text


class CddParse(CddParserBase):
    def __init__(self):
        super().__init__()

    def _is_dtc_table_param(self, param):
        name = _normalize_text(param.get("name"))
        if name in ("dtc", "listofdtc", "groupofdtc", "dtcgroups", "dtcgroup"):
            return True
        if "listofdtc" in name:
            return True
        if name == "dtc":
            return True
        return False

    def _attach_dtc_table_to_params(self, params):
        if not getattr(self, "_dtc_table_cache", None):
            return
        for param in params:
            if self._is_dtc_table_param(param):
                param["DTC_Table"] = self._dtc_table_cache

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
        type_name = _normalize_text(data_type.get("name") or data_type.get("qual"))
        if any(type_name.startswith(prefix) for prefix in GENERIC_TYPE_NAME_PREFIXES):
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

        # ECU / VAR actual configured values are usually stored as UNS/ENUM with attrref.
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
        for target_key, (source_key, default_value) in CAN_ADDRESS_SYSTEM_DEFAULTS.items():
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

    def _load_field(self, data_obj, offset):
        data_type_ref = data_obj.attrib.get("dtref")
        inline_type = None
        if data_type_ref and data_type_ref in self.data_types:
            data_type = self.data_types[data_type_ref]
        else:
            inline_type = self._parse_inline_data_type(data_obj)
            if inline_type is None:
                raise ValueError(f"Unknown DATAOBJ dtref: {data_type_ref}")
            data_type = inline_type

        preferred_instance_name = self._prefer_instance_field_name(data_type, data_obj)
        field_name = (
            preferred_instance_name
            or
            data_type.get("name")
            or data_type.get("qual")
            or self._text_by_path(data_obj, "QUAL")
            or self._text_by_path(data_obj, "NAME/TUV")
            or ""
        )
        if inline_type is not None:
            field_name = (
                self._text_by_path(data_obj, "QUAL")
                or self._text_by_path(data_obj, "NAME/TUV")
                or data_type.get("name")
                or data_type.get("qual")
                or ""
            )
        return {
            "name": field_name,
            "dataTypeRef": data_type_ref,
            "defaultValue": self._parse_optional_number(data_obj.attrib.get("def")),
            "startBit": self._cdd_offset_to_start_bit(
                offset, data_type["bitLength"], data_type["byteOrder"]
            ),
            "bitLength": data_type["bitLength"],
            "minBitLength": data_type.get("minBitLength"),
            "maxBitLength": data_type.get("maxBitLength"),
            "variableLength": data_type.get("variableLength"),
            "quantity": data_type.get("quantity"),
            "byteOrder": data_type["byteOrder"],
            "encoding": data_type["encoding"],
            "minimum": data_type["minimum"],
            "maximum": data_type["maximum"],
            "unit": data_type["unit"],
            "factor": data_type["factor"],
            "offset": data_type["offset"],
            "choices": data_type["choices"],
            "bitGroups": data_type.get("bitGroups"),
        }

    def _load_container(self, container):
        offset = 0
        fields = []
        data_objects = (
            self._find_all_by_path(container, "DATAOBJ")
            + self._find_all_by_path(container, "GODTCDATAOBJ")
            + self._find_all_by_path(container, "STRUCT/DATAOBJ")
            + self._find_all_by_path(container, "UNION/STRUCT/DATAOBJ")
        )

        for ref_element in self._find_all_by_path(container, "DIDDATAREF"):
            did_ref = ref_element.attrib.get("didRef") or ref_element.attrib.get("didref")
            referenced = self.did_data_refs.get(did_ref or "")
            if referenced is not None:
                data_objects.extend(self._find_all_by_path(referenced, "STRUCTURE/DATAOBJ"))

        for data_obj in data_objects:
            field = self._load_field(data_obj, offset)
            fields.append(field)
            offset += field["bitLength"]

        special_qual = self._text_by_path(container, "SPECDATAOBJ/QUAL")
        return {
            "qual": special_qual
            or self._text_by_path(container, "DIDDATAREF/QUAL")
            or self._text_by_path(container, "DATAOBJ/QUAL")
            or self._text_by_path(container, "STRUCT/QUAL"),
            "kind": "negative" if special_qual and "nr" in special_qual.lower() else "data",
            "fields": fields,
        }

    def _load_services(self, diag_inst, class_name):
        services = []
        for service in self._direct_children(diag_inst, "SERVICE"):
            services.append(
                {
                    "name": self._text_by_path(service, "NAME/TUV")
                    or self._text_by_path(service, "QUAL")
                    or "",
                    "qual": self._text_by_path(service, "QUAL")
                    or self._text_by_path(service, "NAME/TUV")
                    or "",
                    "tmplref": service.attrib.get("tmplref"),
                    "shortcutName": self._text_by_path(service, "SHORTCUTNAME/TUV"),
                    "shortcutQual": self._text_by_path(service, "SHORTCUTQUAL"),
                }
            )
        if services:
            return services
        return [{"name": class_name, "qual": class_name}]

    def _load_diag_instance(self, diag_inst, class_name, class_template_ref=None):
        static_value = self._first_child(diag_inst, "STATICVALUE")
        identifier = self._parse_optional_number(static_value.attrib.get("v") if static_value is not None else None) or 0
        containers = [self._load_container(item) for item in self._direct_children(diag_inst, "SIMPLECOMPCONT")]
        fields = [field for container in containers for field in container["fields"]]
        total_bits = sum(field["bitLength"] for field in fields)
        title = self._text_by_path(diag_inst, "NAME/TUV") or self._text_by_path(diag_inst, "QUAL") or ""
        return {
            "className": class_name,
            "identifier": identifier,
            "name": title,
            "qual": self._text_by_path(diag_inst, "QUAL") or "",
            "diagInstTemplateRef": diag_inst.attrib.get("tmplref"),
            "diagClassTemplateRef": class_template_ref,
            "lengthBytes": math.ceil(total_bits / 8),
            "fields": fields,
            "services": self._load_services(diag_inst, class_name),
            "containers": containers,
        }

    def _param_from_field(self, field):
        meta = {
            "type": "CDD-FIELD",
            "cddField": {
                "name": field["name"],
                "startBit": field["startBit"],
                "bitLength": field["bitLength"],
                "minBitLength": field.get("minBitLength"),
                "maxBitLength": field.get("maxBitLength"),
                "variableLength": field.get("variableLength"),
                "quantity": field.get("quantity"),
                "byteOrder": field["byteOrder"],
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

        default_value = field.get("defaultValue")
        fixed = field.get("fixedValue", False) or field.get("spec") in ("id", "sub", "accm")
        deletable = False if fixed else True
        editable = False if fixed else True

        if field.get("encoding") in ("asc", "ascii"):
            param = {
                "id": str(uuid.uuid4()),
                "name": field["name"] or "data",
                "bitLen": field["bitLength"],
                "deletable": deletable,
                "editable": editable,
                "type": "ASCII",
                "value": _buffer_obj([0] * math.ceil(field["bitLength"] / 8), field["bitLength"]),
                "phyValue": "",
                "meta": meta,
            }
            if default_value not in (None, ""):
                raw = list(default_value) if isinstance(default_value, (list, tuple, bytes, bytearray)) else [0] * math.ceil(field["bitLength"] / 8)
                param["value"] = _buffer_obj(raw, field["bitLength"])
                param["phyValue"] = _hex_bytes(raw)
            return param

        if (
            not field.get("variableLength")
            and field["bitLength"] <= 32
            and field.get("encoding") != "bin"
        ):
            param = {
                "id": str(uuid.uuid4()),
                "name": field["name"] or "data",
                "bitLen": field["bitLength"],
                "deletable": deletable,
                "editable": editable,
                "type": "NUM",
                "value": _buffer_obj([0] * math.ceil(field["bitLength"] / 8), field["bitLength"]),
                "phyValue": 0 if default_value is None else default_value,
                "meta": meta,
            }
            if default_value is not None:
                raw = [0] * math.ceil(field["bitLength"] / 8)
                number = int(default_value)
                for i in range(len(raw)):
                    raw[len(raw) - 1 - i] = (number >> (8 * i)) & 0xFF
                param["value"] = _buffer_obj(raw, field["bitLength"])
            return param

        raw = [0] * math.ceil(field["bitLength"] / 8)
        if default_value not in (None, ""):
            if isinstance(default_value, (bytes, bytearray)):
                raw = list(default_value)
            elif isinstance(default_value, (list, tuple)):
                raw = list(default_value)
        return {
            "id": str(uuid.uuid4()),
            "name": field["name"] or "data",
            "bitLen": field["bitLength"],
            "deletable": deletable,
            "editable": editable,
            "type": "ARRAY",
            "value": _buffer_obj(raw, field["bitLength"]),
            "phyValue": _hex_bytes(raw) if raw else "",
            "meta": meta,
        }

    def _param_from_data_type(self, data_type, name=None):
        field = {
            "name": name or data_type.get("qual") or data_type.get("name") or "data",
            "dataTypeRef": data_type.get("id"),
            "startBit": 0,
            "bitLength": data_type["bitLength"],
            "minBitLength": data_type.get("minBitLength"),
            "maxBitLength": data_type.get("maxBitLength"),
            "variableLength": data_type.get("variableLength"),
            "quantity": data_type.get("quantity"),
            "byteOrder": data_type["byteOrder"],
            "encoding": data_type.get("encoding"),
            "minimum": data_type.get("minimum"),
            "maximum": data_type.get("maximum"),
            "unit": data_type.get("unit"),
            "factor": data_type.get("factor"),
            "offset": data_type.get("offset"),
            "choices": data_type.get("choices"),
            "bitGroups": data_type.get("bitGroups"),
        }
        return self._param_from_field(field)

    def _is_byte_aligned_field(self, field):
        return field["startBit"] % 8 == 0 and field["bitLength"] % 8 == 0

    def _storage_end_bit(self, field):
        return field["startBit"] + field["bitLength"] - 1

    def _pack_field_group(self, fields):
        if len(fields) == 1:
            return fields[0]

        start_bit = min(field["startBit"] for field in fields)
        end_bit = max(self._storage_end_bit(field) for field in fields)
        start_byte = start_bit // 8
        end_byte = end_bit // 8
        packed_bit_len = (end_byte - start_byte + 1) * 8
        first = fields[0]

        return {
            "name": first["name"] or "data",
            "startBit": start_bit,
            "bitLength": packed_bit_len,
            "byteOrder": first["byteOrder"],
            "encoding": "uns",
            "minimum": None,
            "maximum": None,
            "unit": None,
            "factor": 1.0,
            "offset": 0.0,
            "choices": None,
            "bitGroups": first.get("bitGroups"),
            "dataTypeRef": first.get("dataTypeRef"),
            "members": [
                {
                    "name": field["name"],
                    "startBit": field["startBit"],
                    "bitLength": field["bitLength"],
                    "dataTypeRef": field.get("dataTypeRef"),
                    "choices": field.get("choices"),
                    "bitGroups": field.get("bitGroups"),
                }
                for field in fields
            ],
        }

    def _group_fields_for_params(self, fields):
        groups = []
        i = 0
        while i < len(fields):
            field = fields[i]
            if self._is_byte_aligned_field(field):
                groups.append(self._pack_field_group([field]))
                i += 1
                continue

            current_group = [field]
            current_end_byte = self._storage_end_bit(field) // 8
            i += 1
            while i < len(fields):
                next_field = fields[i]
                next_start_byte = next_field["startBit"] // 8
                if next_start_byte > current_end_byte:
                    break
                current_group.append(next_field)
                current_end_byte = max(current_end_byte, self._storage_end_bit(next_field) // 8)
                i += 1

            groups.append(self._pack_field_group(current_group))
        return groups

    def _proxy_component_dtref(self, component):
        data_type_ref = component.attrib.get("dtref")
        if data_type_ref:
            return data_type_ref
        if component.tag == "STATUSDTCPROXYCOMP":
            return self._default_dtc_status_mask_dtref()
        return None

    def _proxy_component_bit_length(self, component, data_type):
        max_bl = self._parse_optional_number(component.attrib.get("maxbl"))
        min_bl = self._parse_optional_number(component.attrib.get("minbl"))
        if max_bl is not None and min_bl is not None and max_bl == min_bl:
            return max_bl
        if max_bl is not None:
            return max_bl
        if min_bl is not None:
            return min_bl
        if data_type is not None:
            return data_type["bitLength"]
        return None

    def _component_name(self, component, data_type=None):
        return (
            (data_type or {}).get("name")
            or (data_type or {}).get("qual")
            or
            self._text_by_path(component, "QUAL")
            or self._text_by_path(component, "NAME/TUV")
            or component.attrib.get("dest")
            or "data"
        )

    def _build_protocol_component_field(self, component, offset):
        spec = component.attrib.get("spec")
        if component.tag == "CONSTCOMP":
            if spec == "sid":
                return None, offset
            bit_length = self._parse_optional_number(component.attrib.get("bl"))
            if bit_length is None:
                return None, offset
            return (
                {
                    "name": self._component_name(component),
                    "dataTypeRef": None,
                    "must": component.attrib.get("must"),
                    "mustAtRT": component.attrib.get("mustAtRT"),
                    "startBit": offset,
                    "bitLength": bit_length,
                    "byteOrder": "big_endian",
                    "encoding": "uns",
                    "minimum": None,
                    "maximum": None,
                    "unit": None,
                    "factor": 1.0,
                    "offset": 0.0,
                    "choices": None,
                    "bitGroups": None,
                    "spec": spec,
                    "defaultValue": self._parse_optional_number(component.attrib.get("v")),
                    "fixedValue": True,
                },
                offset + bit_length,
            )

        if component.tag in ("CONTENTCOMP", "SIMPLECOMPCONT", "STRUCT", "UNION"):
            nested_fields = self._load_protocol_component_fields(component, 0)
            if not nested_fields:
                return None, offset
            if len(nested_fields) == 1:
                child = dict(nested_fields[0])
                child["name"] = self._component_name(component) or child.get("name") or "data"
                child["startBit"] = offset
                return child, offset + child["bitLength"]
            total_bits = sum(field["bitLength"] for field in nested_fields)
            return (
                {
                    "name": self._component_name(component),
                    "dataTypeRef": None,
                    "must": component.attrib.get("must"),
                    "mustAtRT": component.attrib.get("mustAtRT"),
                    "startBit": offset,
                    "bitLength": total_bits,
                    "byteOrder": "big_endian",
                    "encoding": "bin",
                    "minimum": None,
                    "maximum": None,
                    "unit": None,
                    "factor": 1.0,
                    "offset": 0.0,
                    "choices": None,
                    "bitGroups": None,
                    "members": nested_fields,
                    "spec": spec,
                },
                offset + total_bits,
            )

        if component.tag == "DATAOBJ":
            data_type_ref = component.attrib.get("dtref")
            data_type = self._resolve_data_type(data_type_ref)
            if data_type is None:
                return None, offset
            bit_length = data_type["bitLength"]
            return (
                {
                    "name": self._component_name(component, data_type),
                    "dataTypeRef": data_type_ref,
                    "must": component.attrib.get("must"),
                    "mustAtRT": component.attrib.get("mustAtRT"),
                    "startBit": offset
                    if bit_length % 8 == 0
                    else self._cdd_offset_to_start_bit(offset, bit_length, data_type["byteOrder"]),
                    "bitLength": bit_length,
                    "byteOrder": data_type["byteOrder"],
                    "encoding": data_type["encoding"],
                    "minimum": data_type["minimum"],
                    "maximum": data_type["maximum"],
                    "unit": data_type["unit"],
                    "factor": data_type["factor"],
                    "offset": data_type["offset"],
                    "choices": data_type["choices"],
                    "bitGroups": data_type.get("bitGroups"),
                    "spec": spec,
                },
                offset + bit_length,
            )

        if component.tag == "EOSITERCOMP":
            nested_fields = self._load_protocol_component_fields(component, 0)
            if not nested_fields:
                return None, offset
            total_bits = sum(field["bitLength"] for field in nested_fields)
            return (
                {
                    "name": self._component_name(component),
                    "dataTypeRef": None,
                    "must": component.attrib.get("must"),
                    "mustAtRT": component.attrib.get("mustAtRT"),
                    "startBit": offset,
                    "bitLength": total_bits,
                    "byteOrder": "big_endian",
                    "encoding": "bin",
                    "minimum": None,
                    "maximum": None,
                    "unit": None,
                    "factor": 1.0,
                    "offset": 0.0,
                    "choices": None,
                    "bitGroups": None,
                    "members": nested_fields,
                    "spec": spec,
                },
                offset + total_bits,
            )

        data_type_ref = self._proxy_component_dtref(component)
        data_type = self._resolve_data_type(data_type_ref)
        bit_length = self._proxy_component_bit_length(component, data_type)
        if bit_length is None:
            return None, offset

        if data_type is not None:
            field = {
                "name": self._component_name(component, data_type),
                "dataTypeRef": data_type_ref,
                "must": component.attrib.get("must"),
                "mustAtRT": component.attrib.get("mustAtRT"),
                "startBit": offset
                if bit_length % 8 == 0
                else self._cdd_offset_to_start_bit(offset, bit_length, data_type["byteOrder"]),
                "bitLength": bit_length,
                "byteOrder": data_type["byteOrder"],
                "encoding": data_type["encoding"],
                "minimum": data_type["minimum"],
                "maximum": data_type["maximum"],
                "unit": data_type["unit"],
                "factor": data_type["factor"],
                "offset": data_type["offset"],
                "choices": data_type["choices"],
                "bitGroups": data_type.get("bitGroups"),
                "spec": spec,
            }
        else:
            field = {
                "name": self._component_name(component),
                "dataTypeRef": None,
                "must": component.attrib.get("must"),
                "mustAtRT": component.attrib.get("mustAtRT"),
                "startBit": offset,
                "bitLength": bit_length,
                "byteOrder": "big_endian",
                "encoding": "bin",
                "minimum": None,
                "maximum": None,
                "unit": None,
                "factor": 1.0,
                "offset": 0.0,
                "choices": None,
                "bitGroups": None,
                "spec": spec,
            }
        return field, offset + bit_length

    def _load_protocol_component_fields(self, parent, offset=0):
        fields = []
        current_offset = offset
        for child in self._direct_children(parent):
            field, next_offset = self._build_protocol_component_field(child, current_offset)
            if field is None:
                continue
            fields.append(field)
            current_offset = next_offset
        return fields

    def _load_protocol_section_fields(self, protocol_template, section_tag):
        section = self._first_child(protocol_template, section_tag) if protocol_template is not None else None
        if section is None:
            return []
        return self._load_protocol_component_fields(section, 0)

    def _protocol_section_has_identifier(self, protocol_template, section_tag):
        section = self._first_child(protocol_template, section_tag) if protocol_template is not None else None
        if section is None:
            return False
        for child in section.iter():
            if child.attrib.get("spec") == "id":
                return True
        return False

    def _protocol_section_exists(self, protocol_template, section_tag):
        return self._first_child(protocol_template, section_tag) is not None if protocol_template is not None else False

    def _create_numeric_param(self, name, bit_len, value, deletable=False, editable=True):
        nbytes = max(1, math.ceil(bit_len / 8))
        raw = [0] * nbytes
        for i in range(nbytes):
            raw[nbytes - 1 - i] = (value >> (8 * i)) & 0xFF
        return {
            "id": str(uuid.uuid4()),
            "name": name,
            "bitLen": bit_len,
            "deletable": deletable,
            "editable": editable,
            "type": "NUM",
            "value": _buffer_obj(raw, bit_len),
            "phyValue": value,
        }

    def _create_identifier_param(self, name, identifier):
        raw = [(identifier >> 8) & 0xFF, identifier & 0xFF]
        return {
            "id": str(uuid.uuid4()),
            "name": name,
            "bitLen": 16,
            "deletable": False,
            "editable": True,
            "type": "ARRAY",
            "value": _buffer_obj(raw, 16),
            "phyValue": _hex_bytes(raw),
        }

    def _match_service_info(self, class_name):
        text = _normalize_text(class_name)
        for keyword, sid, req, resp in SERVICE_MATCH_RULES:
            if keyword in text:
                return {
                    "sid": sid,
                    "requestKind": req,
                    "responseKind": resp,
                }
        return None

    def _resolve_diag_class_template(self, item):
        for template_ref in (item.get("diagClassTemplateRef"), item.get("diagInstTemplateRef")):
            if template_ref and template_ref in self.diag_class_templates:
                return self.diag_class_templates[template_ref]
        return None

    def _resolve_diag_service_template(self, item, service):
        diag_template_ref = service.get("tmplref")
        if not diag_template_ref:
            return None
        class_template = self._resolve_diag_class_template(item)
        if class_template is not None:
            for diag_service_template in class_template.iter("DCLSRVTMPL"):
                if diag_service_template.attrib.get("id") == diag_template_ref:
                    return diag_service_template
        return self.diag_service_templates.get(diag_template_ref)

    def _resolve_protocol_service_template(self, item, service):
        diag_service_template = self._resolve_diag_service_template(item, service)
        if diag_service_template is None:
            return None
        protocol_ref = diag_service_template.attrib.get("tmplref")
        if not protocol_ref:
            return None
        return self.protocol_service_templates.get(protocol_ref)

    def _find_component_by_spec(self, template_node, section_tag, spec_value):
        if template_node is None:
            return None
        section = self._first_child(template_node, section_tag)
        if section is None:
            return None
        for child in self._direct_children(section):
            if child.attrib.get("spec") == spec_value:
                return child
        return None

    def _component_numeric_value(self, component):
        if component is None:
            return None
        if component.tag == "CONSTCOMP":
            return self._parse_optional_number(component.attrib.get("v"))
        return None

    def _resolve_data_type(self, data_type_ref):
        if not data_type_ref:
            return None
        return self.data_types.get(data_type_ref)

    def _find_descendant_dtref(self, element, tag_name):
        if element is None:
            return None
        for child in element.iter(tag_name):
            data_type_ref = child.attrib.get("dtref")
            if data_type_ref:
                return data_type_ref
        return None

    def _default_dtc_status_mask_dtref(self):
        return next(iter(self.dtc_status_masks.keys()), None)

    def _resolve_service_dtref(self, diag_service_template, protocol_template):
        if protocol_template is None:
            if diag_service_template is not None:
                return diag_service_template.attrib.get("dtref")
            return None
        if self._find_descendant_dtref(protocol_template, "DTCSTATUSMASK"):
            return self._find_descendant_dtref(protocol_template, "DTCSTATUSMASK")
        if any(True for _ in protocol_template.iter("STATUSDTCPROXYCOMP")):
            return self._default_dtc_status_mask_dtref()
        for tag_name in ("DTCSTATUS", "STATICCOMP", "SIMPLECOMP"):
            data_type_ref = self._find_descendant_dtref(protocol_template, tag_name)
            if data_type_ref:
                return data_type_ref
        if diag_service_template is not None:
            data_type_ref = diag_service_template.attrib.get("dtref")
            if data_type_ref:
                return data_type_ref
        return None

    def _lookup_choice_value(self, data_type, *labels):
        if not data_type:
            return None
        choices = data_type.get("choices") or {}
        if not choices:
            return None

        normalized = {_normalize_text(label) for label in labels if label}
        normalized.discard("")
        if not normalized:
            return None

        for value, text in choices.items():
            if _normalize_text(text) in normalized:
                return value
        return None

    def _resolve_subfunction_value(self, item, service, diag_service_template, protocol_template):
        req_sub = self._find_component_by_spec(protocol_template, "REQ", "sub")
        sub_value = self._component_numeric_value(req_sub)
        if sub_value is not None:
            return sub_value

        data_type_ref = None
        if req_sub is not None:
            data_type_ref = req_sub.attrib.get("dtref")
        if not data_type_ref and diag_service_template is not None:
            data_type_ref = diag_service_template.attrib.get("dtref")

        data_type = self._resolve_data_type(data_type_ref)
        choice_value = self._lookup_choice_value(
            data_type,
            service.get("qual"),
            service.get("name"),
            item.get("qual"),
            item.get("name"),
        )
        if choice_value is not None:
            return choice_value
        return None

    def _default_resolution_for_sid(self, sid):
        if sid in ("0x22",):
            return {"requestKind": "identifier", "responseKind": "identifier", "requestSource": "none", "responseSource": "all"}
        if sid in ("0x2E",):
            return {"requestKind": "identifier", "responseKind": "identifier", "requestSource": "all", "responseSource": "none"}
        if sid in ("0x14",):
            return {"requestKind": "none", "responseKind": "none", "requestSource": "all", "responseSource": "none"}
        if sid in ("0x24", "0x2A", "0x2F"):
            return {"requestKind": "identifier", "responseKind": "identifier", "requestSource": "primary", "responseSource": "secondary"}
        return {
            "requestKind": "none",
            "responseKind": "none",
            "requestSource": "primary" if sid not in ("0x10", "0x11", "0x27", "0x85") else "none",
            "responseSource": "secondary" if sid not in ("0x10", "0x11", "0x27", "0x85") else "none",
        }

    def _resolve_service_from_sid(self, item, service):
        diag_service_template = self._resolve_diag_service_template(item, service)
        template = self._resolve_protocol_service_template(item, service)
        sid_comp = self._find_component_by_spec(template, "REQ", "sid")
        sid_value = self._component_numeric_value(sid_comp)
        if sid_value is None:
            return None

        sid = f"0x{sid_value:02X}"
        service_spec = UDS_SERVICE_SPECS.get(sid)
        if service_spec is None:
            return None

        resolution = {"sid": sid}
        resolution.update(self._default_resolution_for_sid(sid))
        resolution["dtref"] = self._resolve_service_dtref(diag_service_template, template)

        if len(item["containers"]) <= 1 and resolution["requestSource"] == "primary":
            resolution["requestSource"] = "all"
        if len(item["containers"]) <= 1 and resolution["responseSource"] == "secondary":
            resolution["responseSource"] = "all"

        sub_value = self._resolve_subfunction_value(item, service, diag_service_template, template)
        if sub_value is not None and (service_spec["hasSubFunction"] or sid in ("0x19", "0x31")):
            resolution["subfunction"] = sub_value

        if sid == "0x19":
            if sub_value is not None:
                resolution["subfunction"] = sub_value
                resolution["requestSource"] = "primary" if len(item["containers"]) > 1 else "all"
                resolution["responseSource"] = "secondary" if len(item["containers"]) > 1 else "all"

        if sid == "0x31":
            resolution["requestSource"] = "primary" if len(item["containers"]) > 1 else "all"
            resolution["responseSource"] = "secondary" if len(item["containers"]) > 1 else "all"

        if sid == "0x27":
            service_text = _normalize_text(service.get("qual") or service.get("name"))
            resolution["requestSource"] = "primary" if "send" in service_text else "none"
            resolution["responseSource"] = "primary" if "request" in service_text else "none"

        return resolution

    def _resolve_service(self, item, service):
        resolved = self._resolve_service_from_sid(item, service)
        if resolved is not None:
            return resolved

        class_text = _normalize_text(item["className"])
        service_text = _normalize_text(service.get("qual") or service.get("name"))

        if "sessions" == class_text:
            return {
                "sid": "0x10",
                "requestKind": "none",
                "responseKind": "none",
                "requestSource": "none",
                "responseSource": "primary",
                "subfunction": item["identifier"] & 0xFF,
            }

        if "ecureset" == class_text or "ecureset" in class_text:
            return {
                "sid": "0x11",
                "requestKind": "none",
                "responseKind": "none",
                "requestSource": "none",
                "responseSource": "none",
                "subfunction": item["identifier"] & 0xFF,
            }

        if "securityaccess" == class_text:
            return {
                "sid": "0x27",
                "requestKind": "none",
                "responseKind": "none",
                "requestSource": "primary" if "send" in service_text else "none",
                "responseSource": "primary" if "request" in service_text else "none",
                "subfunction": item["identifier"] & 0xFF,
            }

        if "controldtcsetting" in class_text:
            subfunction = item["identifier"] & 0xFF
            if "on" == service_text:
                subfunction = 0x01
            elif "off" == service_text:
                subfunction = 0x02
            return {
                "sid": "0x85",
                "requestKind": "none",
                "responseKind": "none",
                "requestSource": "none",
                "responseSource": "none",
                "subfunction": subfunction,
            }

        if "routinecontrol" in class_text:
            if "start" in service_text:
                return {"sid": "0x31", "requestKind": "none", "responseKind": "none", "requestSource": "primary", "responseSource": "secondary", "subfunction": 0x01}
            if "stop" in service_text:
                return {"sid": "0x31", "requestKind": "none", "responseKind": "none", "requestSource": "primary", "responseSource": "secondary", "subfunction": 0x02}
            if "result" in service_text:
                return {"sid": "0x31", "requestKind": "none", "responseKind": "none", "requestSource": "primary", "responseSource": "secondary", "subfunction": 0x03}

        if "inputoutputcontrol" in class_text or "iocontrol" in class_text:
            if "returncontrol" in service_text:
                return {"sid": "0x2F", "requestKind": "identifier", "responseKind": "identifier", "requestSource": "primary", "responseSource": "secondary", "subfunction": 0x00}
            if "resettodefault" in service_text:
                return {"sid": "0x2F", "requestKind": "identifier", "responseKind": "identifier", "requestSource": "primary", "responseSource": "secondary", "subfunction": 0x01}
            if "freezecurrentstate" in service_text:
                return {"sid": "0x2F", "requestKind": "identifier", "responseKind": "identifier", "requestSource": "primary", "responseSource": "secondary", "subfunction": 0x02}
            if "shorttermadjustment" in service_text or "adjust" in service_text:
                return {"sid": "0x2F", "requestKind": "identifier", "responseKind": "identifier", "requestSource": "primary", "responseSource": "secondary", "subfunction": 0x03}

        if "faultmemory" in class_text or "dtc" in class_text:
            if "clear" in service_text:
                return {"sid": "0x14", "requestKind": "none", "responseKind": "none", "requestSource": "all", "responseSource": "none"}
            dtc_map = {
                "readnumber": 0x01,
                "readallidentified": 0x02,
                "readsnapshotrecord": 0x04,
                "readsnapshotrecordbydtcnumber": 0x04,
                "readextendeddatarecord": 0x06,
                "readextendeddatarecordbydtcnumber": 0x06,
                "readallsupported": 0x0A,
            }
            sub = next((value for key, value in dtc_map.items() if key in service_text), item["identifier"] & 0xFF)
            return {"sid": "0x19", "requestKind": "none", "responseKind": "none", "requestSource": "primary", "responseSource": "secondary", "subfunction": sub}

        service_info = self._match_service_info(item["className"])
        if service_info is None:
            if service_text == "read":
                return {"sid": "0x22", "requestKind": "identifier", "responseKind": "identifier", "requestSource": "none", "responseSource": "all"}
            if service_text == "write":
                return {"sid": "0x2E", "requestKind": "identifier", "responseKind": "identifier", "requestSource": "all", "responseSource": "none"}
            return None

        if service_info["sid"] == "0x22" or service_text == "read":
            service_info["requestSource"] = "none"
            service_info["responseSource"] = "all"
            return service_info

        if service_info["sid"] == "0x2E" or service_text == "write":
            service_info["requestSource"] = "all"
            service_info["responseSource"] = "none"
            return service_info

        service_info["requestSource"] = "primary" if len(item["containers"]) > 1 else "all"
        service_info["responseSource"] = "secondary" if len(item["containers"]) > 1 else "all"
        return service_info

    def _select_fields(self, item, source):
        data_containers = [container for container in item["containers"] if container["kind"] == "data"]
        if source == "none":
            return []
        if source == "primary":
            return data_containers[0]["fields"] if len(data_containers) > 0 else []
        if source == "secondary":
            return data_containers[1]["fields"] if len(data_containers) > 1 else []
        return [field for container in data_containers for field in container["fields"]]

    def _build_data_params(self, item, source, resolution):
        fields = self._group_fields_for_params(self._select_fields(item, source))
        fields = self._filter_control_header_fields(fields, resolution)
        data_type = self._resolve_data_type(resolution.get("dtref"))

        if (
            data_type is not None
            and data_type.get("bitGroups")
            and fields
            and all(field.get("bitLength") == 1 for field in fields)
        ):
            return [self._param_from_data_type(data_type)]

        return [self._param_from_field(field) for field in fields]

    def _filter_control_header_fields(self, fields, resolution):
        filtered = []
        for field in fields:
            field_name = _normalize_text(field.get("name"))
            if resolution.get("subfunction") is not None and "subfunction" in field_name:
                continue
            if resolution.get("requestKind") == "identifier" or resolution.get("responseKind") == "identifier":
                if "identifier" in field_name and field.get("bitLength") in (8, 16, 24, 32):
                    continue
            filtered.append(field)
        return filtered

    def _protocol_field_default_value(self, field, item, resolution):
        spec = field.get("spec")
        if spec == "id":
            return item["identifier"]
        if spec in ("sub", "accm"):
            if resolution.get("subfunction") is not None:
                return resolution["subfunction"]
            if item.get("identifier") is not None:
                return item["identifier"] & 0xFF
        return field.get("defaultValue")

    def _should_replace_protocol_field(self, field):
        return (
            field.get("spec") not in ("id", "sub", "accm")
            and not field.get("dataTypeRef")
            and not field.get("bitGroups")
            and not field.get("members")
        )

    def _is_generic_protocol_field_name(self, name):
        return _normalize_text(name) in {
            "data",
            "datarecord",
            "recorddata",
            "newdataobject",
            "securityseed",
            "securitykey",
            "seed",
            "key",
        }

    def _is_optional_runtime_field(self, field):
        must_at_rt = str(field.get("mustAtRT") or "").strip()
        must = str(field.get("must") or "").strip()
        return must_at_rt == "1" or (must_at_rt in ("", "0") and must != "1")

    def _choices_overlap(self, field_a, field_b):
        choices_a = field_a.get("choices") or {}
        choices_b = field_b.get("choices") or {}
        if not choices_a or not choices_b:
            return False
        texts_a = {_normalize_text(v) for v in choices_a.values() if v}
        texts_b = {_normalize_text(v) for v in choices_b.values() if v}
        texts_a.discard("")
        texts_b.discard("")
        return bool(texts_a & texts_b)

    def _matching_instance_field(self, protocol_field, instance_fields, used_indexes):
        protocol_name = _normalize_text(protocol_field.get("name"))
        if protocol_name:
            for index, field in enumerate(instance_fields):
                if index in used_indexes:
                    continue
                if _normalize_text(field.get("name")) == protocol_name:
                    return index, field
        if self._is_generic_protocol_field_name(protocol_field.get("name")):
            for index, field in enumerate(instance_fields):
                if index in used_indexes:
                    continue
                return index, field
        for index, field in enumerate(instance_fields):
            if index in used_indexes:
                continue
            if field.get("bitLength") == protocol_field.get("bitLength") and self._choices_overlap(protocol_field, field):
                return index, field
        available = [(index, field) for index, field in enumerate(instance_fields) if index not in used_indexes]
        if len(available) == 1 and available[0][1].get("bitLength") == protocol_field.get("bitLength"):
            return available[0]
        return None, None

    def _should_expand_instance_fields(self, field, resolution, section_tag, instance_fields):
        if not instance_fields:
            return False
        field_name = _normalize_text(field.get("name"))
        if resolution.get("sid") == "0x31" and section_tag == "REQ" and field_name == "routinecontroloptionrecord":
            return True
        return False

    def _build_protocol_data_params(self, protocol_template, section_tag, item, resolution, source):
        fields = self._group_fields_for_params(
            self._load_protocol_section_fields(protocol_template, section_tag)
        )
        instance_fields = self._filter_control_header_fields(self._select_fields(item, source), resolution)
        used_instance_indexes = set()
        params = []
        for field in fields:
            field_copy = dict(field)
            if self._should_expand_instance_fields(field_copy, resolution, section_tag, instance_fields):
                for index, instance_field in enumerate(instance_fields):
                    if index in used_instance_indexes:
                        continue
                    used_instance_indexes.add(index)
                    params.append(self._param_from_field(dict(instance_field)))
                continue
            match_index, match_field = self._matching_instance_field(
                field_copy, instance_fields, used_instance_indexes
            )
            should_replace = self._should_replace_protocol_field(field_copy) or (
                resolution.get("sid") == "0x31"
                and section_tag == "REQ"
                and len(instance_fields) > 0
                and _normalize_text(field_copy.get("name")) == "routinecontroloptionrecord"
            )
            if should_replace:
                if match_field is not None:
                    field_copy = dict(match_field)
                    used_instance_indexes.add(match_index)
                elif self._is_optional_runtime_field(field_copy):
                    continue
            elif match_field is not None:
                if field_copy.get("defaultValue") is None and match_field.get("defaultValue") is not None:
                    field_copy["defaultValue"] = match_field.get("defaultValue")
            field_copy["defaultValue"] = self._protocol_field_default_value(field_copy, item, resolution)
            params.append(self._param_from_field(field_copy))
        return params

    def _uses_dtc_status_mask(self, service, resolution):
        if resolution.get("sid") != "0x19":
            return False
        service_text = _normalize_text((service.get("name") or "") + (service.get("qual") or ""))
        if "statusmask" in service_text:
            return True
        data_type = self._resolve_data_type(resolution.get("dtref"))
        return bool(data_type and data_type.get("bitGroups"))

    def _push_identifier_params(self, params, sid, identifier, kind):
        if kind == "identifier":
            params.append(self._create_identifier_param("routineIdentifier" if sid == "0x31" else "dataIdentifier", identifier))
        elif kind == "subfunction" and sid == "0x31":
            params.append(self._create_identifier_param("routineIdentifier", identifier))

    def _build_service(self, item, service):
        resolution = self._resolve_service(item, service)
        if resolution is None:
            return None
        protocol_template = self._resolve_protocol_service_template(item, service)
        protocol_request_params = self._build_protocol_data_params(
            protocol_template, "REQ", item, resolution, resolution["requestSource"]
        )
        protocol_response_params = self._build_protocol_data_params(
            protocol_template, "POS", item, resolution, resolution["responseSource"]
        )
        has_protocol_req = self._protocol_section_exists(protocol_template, "REQ")
        has_protocol_pos = self._protocol_section_exists(protocol_template, "POS")

        request_params = []
        response_params = []
        item_label = item.get("name") or item.get("qual") or f'{item["className"]}_{item["identifier"]:X}'
        service_name = service.get("name") or service.get("qual") or ""
        service_qual = service.get("qual") or ""
        service_suffix = ""
        if len(item["services"]) > 1 and service_name and _normalize_text(service_name) not in ("read", "write", "start", "stop", "result", "request", "send", "control", "reset"):
            service_suffix = f'_{service_name}'
        elif len(item["services"]) > 1 and service_qual and _normalize_text(service_qual) not in ("read", "write", "start", "stop", "result", "request", "send", "control", "reset"):
            service_suffix = f'_{service_qual}'

        service_label = item_label + service_suffix

        subfunction = resolution.get("subfunction")
        if (
            subfunction is not None
            and resolution["sid"] == "0x31"
            and not self._protocol_section_has_identifier(protocol_template, "REQ")
        ):
            request_params.append(self._create_identifier_param("routineIdentifier", item["identifier"]))
        if (
            subfunction is not None
            and resolution["sid"] == "0x31"
            and not self._protocol_section_has_identifier(protocol_template, "POS")
        ):
            response_params.append(self._create_identifier_param("routineIdentifier", item["identifier"]))

        if not has_protocol_req and not self._protocol_section_has_identifier(protocol_template, "REQ"):
            self._push_identifier_params(request_params, resolution["sid"], item["identifier"], resolution["requestKind"])
        if not has_protocol_pos and not self._protocol_section_has_identifier(protocol_template, "POS"):
            self._push_identifier_params(response_params, resolution["sid"], item["identifier"], resolution["responseKind"])

        if has_protocol_req:
            request_params.extend(protocol_request_params)
        elif self._uses_dtc_status_mask(service, resolution):
            mask_type = self._resolve_data_type(
                resolution.get("dtref") or self._default_dtc_status_mask_dtref()
            )
            if mask_type is not None:
                request_params.append(self._param_from_data_type(mask_type, "DTCStatusMask"))
            else:
                request_params.extend(self._build_data_params(item, resolution["requestSource"], resolution))
        else:
            request_params.extend(self._build_data_params(item, resolution["requestSource"], resolution))

        if has_protocol_pos:
            response_params.extend(protocol_response_params)
        elif self._uses_dtc_status_mask(service, resolution):
            mask_type = self._resolve_data_type(
                resolution.get("dtref") or self._default_dtc_status_mask_dtref()
            )
            if mask_type is not None:
                response_params.append(self._param_from_data_type(mask_type, "DTCStatusAvailabilityMask"))
            else:
                response_params.extend(self._build_data_params(item, resolution["responseSource"], resolution))
        else:
            response_params.extend(self._build_data_params(item, resolution["responseSource"], resolution))

        self._attach_dtc_table_to_params(request_params)
        self._attach_dtc_table_to_params(response_params)

        return {
            "id": str(uuid.uuid4()),
            "name": service_label,
            "serviceId": resolution["sid"],
            "subfunc": f'0x{subfunction:02X}' if subfunction is not None else None,
            "params": request_params,
            "respParams": response_params,
            "suppress": False,
            "autoSubfunc": resolution["requestKind"] == "subfunction" or subfunction is not None,
            "desc": f'{item["className"]} / {service.get("qual")}' if service.get("qual") else item["className"],
        }

    def _build_tester(self, name, diagnostics, system_values):
        self._dtc_table_cache = self._load_dtc_table(self._ecu_doc)
        service_map = {}
        for item in diagnostics:
            for service in item["services"]:
                built = self._build_service(item, service)
                if built is None:
                    continue
                sid = built["serviceId"]
                service_map.setdefault(sid, []).append(built)

        return {
            "id": str(uuid.uuid4()),
            "name": name,
            "type": self._detect_bus_kind(system_values),
            "udsTime": self._build_uds_time(system_values),
            "seqList": [],
            "address": self._build_addresses(system_values),
            "allServiceList": service_map,
        }

    def parse_tester_info(self, file_path):
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
            ecu_doc = root if root.tag == "ECUDOC" else root.find("ECUDOC")
            if ecu_doc is None:
                raise ValueError("ECUDOC not found")
            self._ecu_doc = ecu_doc

            self.data_types = {}
            self.dtc_status_masks = {}
            self.did_data_refs = {}
            self._load_data_types(ecu_doc)
            self._load_dtc_status_masks(ecu_doc)
            self._load_did_refs(ecu_doc)
            self._load_service_templates(ecu_doc)
            system_defs = self._load_system_defs(ecu_doc)
            system_defaults = self._load_system_defaults(system_defs)

            ecu = self._first_child(ecu_doc, "ECU")
            if ecu is None:
                return {"error": 0, "data": {}}

            ecu_name = self._text_by_path(ecu, "QUAL") or self._text_by_path(ecu, "NAME/TUV") or "CDD"
            result = {ecu_name: {}}
            ecu_system_values = dict(system_defaults)
            ecu_system_values.update(self._load_system_values(ecu, system_defs))

            variants = self._direct_children(ecu, "VAR")
            if not variants:
                variants = [ecu]

            for index, var in enumerate(variants):
                var_name = ecu_name
                system_values = dict(ecu_system_values)
                system_values.update(self._load_system_values(var, system_defs))
                diagnostics = []
                for diag_class in self._direct_children(var, "DIAGCLASS"):
                    class_name = self._text_by_path(diag_class, "QUAL") or self._text_by_path(diag_class, "NAME/TUV") or ""
                    class_template_ref = diag_class.attrib.get("tmplref")
                    for diag_inst in self._direct_children(diag_class, "DIAGINST"):
                        diagnostics.append(self._load_diag_instance(diag_inst, class_name, class_template_ref))
                for diag_inst in self._direct_children(var, "DIAGINST"):
                    class_name = (
                        self._text_by_path(diag_inst, "QUAL")
                        or self._text_by_path(diag_inst, "NAME/TUV")
                        or ""
                    )
                    diagnostics.append(self._load_diag_instance(diag_inst, class_name))
                result[ecu_name][var_name] = self._build_tester(var_name, diagnostics, system_values)

            return {"error": 0, "data": result}
        except Exception as exc:
            traceback.print_exception(exc)
            return {"error": 1, "message": str(exc)}
