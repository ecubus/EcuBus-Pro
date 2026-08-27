try:
    from .cdd_parser_shared import CddParserShared
except ImportError:
    from cdd_parser_shared import CddParserShared


CONVERSION_LABELS = {
    "IDENT": "Raw value",
    "TEXTTBL": "Text Table",
    "LINCOMP": "Linear",
    "COMPTBL": "Piecewise Linear",
    "VALTBL": "Characteristic Curve",
    "PROCDT": "Procedural Conversion",
    "FORMULADT": "Formula",
    "STRUCTDT": "Packet",
    "MUXDT": "Mux",
    "STATICITERRDT": "Fixed Count Iteration",
    "NUMITERDT": "Counter Iteration",
    "ENDMKITERDT": "End-Marker Iteration",
    "EOSITERDT": "End-of-Service Iteration",
}

# Iteration data types repeat their member list; how often is decided by
# @numOfItems (fixed count), a selector elsewhere in the telegram (counter),
# a terminating value (end-marker) or the end of the service (end-of-service).
ITERATION_KINDS = ("STATICITERRDT", "NUMITERDT", "ENDMKITERDT", "EOSITERDT")

# Kinds whose children are a member list rather than a conversion.
MEMBER_KINDS = ("STRUCTDT",) + ITERATION_KINDS

BYTE_ORDER_LABELS = {
    "12": "LowHigh (Intel)",
    "21": "HighLow (Motorola)",
}

ENCODING_LABELS = {
    "uns": "Unsigned",
    "sgn": "Signed",
    "utf": "Unicode",
    "asc": "ASCII",
    "dbl": "IEEE Float (double)",
    "flt": "IEEE Float (single)",
    "bcd": "BCD",
}

DISPLAY_FORMAT_LABELS = {
    "dec": "Decimal",
    "hex": "Hexadecimal",
    "text": "Text",
    "flt": "Floating point",
}


class CddDataTypesParser:
    def __init__(self, shared=None):
        self._shared = shared or CddParserShared()

    @staticmethod
    def _int_or_none(value):
        if value is None or value == "":
            return None
        try:
            return int(value)
        except ValueError:
            return None

    @staticmethod
    def _float_or_none(value):
        if value is None or value == "":
            return None
        try:
            return float(value)
        except ValueError:
            return None

    def _bit_length_display(self, value_type):
        if value_type is None:
            return ""
        bit_length = self._int_or_none(value_type.attrib.get("bl")) or 0
        if value_type.attrib.get("qty") == "field":
            min_size = value_type.attrib.get("minsz")
            max_size = value_type.attrib.get("maxsz")
            if min_size and max_size and min_size == max_size:
                return f"[{min_size}]"
            return f"[{min_size or 0}..{max_size or '*'}]"
        return f"{bit_length // 8}:{bit_length % 8}"

    def _value_type(self, value_type):
        if value_type is None:
            return None
        result = {
            "bitLength": self._int_or_none(value_type.attrib.get("bl")),
            "byteOrder": BYTE_ORDER_LABELS.get(value_type.attrib.get("bo"), value_type.attrib.get("bo")),
            "encoding": ENCODING_LABELS.get(value_type.attrib.get("enc"), value_type.attrib.get("enc")),
            "precision": self._int_or_none(value_type.attrib.get("sig")),
            "displayFormat": DISPLAY_FORMAT_LABELS.get(value_type.attrib.get("df"), value_type.attrib.get("df")),
            "quantity": value_type.attrib.get("qty"),
        }
        if value_type.attrib.get("qty") == "field":
            result["minSize"] = self._int_or_none(value_type.attrib.get("minsz"))
            result["maxSize"] = self._int_or_none(value_type.attrib.get("maxsz"))
        unit = self._shared.first_child(value_type, "UNIT")
        if unit is not None and unit.text and unit.text.strip():
            result["unit"] = unit.text.strip()
        return result

    def _bitmask(self, data_type):
        bitmask = data_type.attrib.get("bm")
        return self._shared.hex_value(bitmask) if bitmask not in (None, "") else None

    def _text_table(self, data_type):
        entries = []
        for text_map in self._shared.direct_children(data_type, "TEXTMAP"):
            start = text_map.attrib.get("s")
            end = text_map.attrib.get("e")
            entries.append(
                {
                    "start": self._shared.hex_value(start),
                    "end": self._shared.hex_value(end) if end != start else None,
                    "text": self._shared.text_by_path(text_map, "TEXT/TUV") or "",
                    "addInfo": self._shared.text_by_path(text_map, "ADDINFO/TUV"),
                }
            )
        return entries

    def _invalid_values(self, data_type):
        entries = []
        for excl in self._shared.direct_children(data_type, "EXCL"):
            entries.append(
                {
                    "start": self._shared.hex_value(excl.attrib.get("s")),
                    "end": self._shared.hex_value(excl.attrib.get("e")),
                    "invalidType": excl.attrib.get("inv"),
                }
            )
        return entries

    def _linear(self, data_type):
        comp = self._shared.first_child(data_type, "COMP")
        if comp is None:
            return None
        return {
            "factor": self._float_or_none(comp.attrib.get("f")),
            "offset": self._float_or_none(comp.attrib.get("o")),
            "rangeStart": self._float_or_none(comp.attrib.get("s")),
            "rangeEnd": self._float_or_none(comp.attrib.get("e")),
        }

    def _attributes(self, data_type):
        attributes = []
        for child in self._shared.direct_children(data_type):
            if child.tag == "ENUM":
                definition = self._shared.by_id(child.attrib.get("attrref"))
                if definition is None:
                    continue
                value = None
                for etag in self._shared.direct_children(definition, "ETAG"):
                    if etag.attrib.get("v") == child.attrib.get("v"):
                        value = self._shared.text_by_path(etag, "TUV")
                        break
                attributes.append({"name": self._shared.name(definition), "qual": self._shared.qual(definition), "value": value})
            elif child.tag == "CSTR":
                definition = self._shared.by_id(child.attrib.get("attrref"))
                if definition is None:
                    continue
                value = self._shared.text_by_path(child, "COMMONSTRING")
                attributes.append({"name": self._shared.name(definition), "qual": self._shared.qual(definition), "value": value})
        return attributes

    def _formula(self, data_type):
        return [
            {
                "usage": formula.attrib.get("usage"),
                "text": (formula.text or "").strip() or None,
            }
            for formula in self._shared.direct_children(data_type, "FORMULA")
        ]

    def _procedure(self, data_type):
        conv = self._shared.first_child(data_type, "PROCCONV")
        if conv is None:
            return []
        return [
            {
                "usage": function.attrib.get("usage"),
                "jobFileRef": function.attrib.get("jobFileRef"),
                "entryPoint": function.attrib.get("entryPoint") or None,
            }
            for function in self._shared.direct_children(conv, "FUNCTION")
        ]

    def _mux(self, data_type):
        selector_dtref = data_type.attrib.get("dtref")
        cases = []
        for case in self._shared.direct_children(data_type, "CASE"):
            cases.append(
                {
                    "start": self._shared.hex_value(case.attrib.get("s")),
                    "end": self._shared.hex_value(case.attrib.get("e")),
                    "members": self._shared.member_list(self._shared.first_child(case, "STRUCTURE")),
                }
            )
        return {
            "selectorDtref": selector_dtref,
            "selectorDtQual": self._shared.qual(self._shared.by_id(selector_dtref)) if selector_dtref else None,
            "default": self._shared.member_list(self._shared.first_child(data_type, "STRUCTURE")),
            "cases": cases,
        }

    def parse_entry(self, data_type):
        kind = data_type.tag
        entry = {
            "id": data_type.attrib.get("id"),
            "name": self._shared.name(data_type),
            "qual": self._shared.qual(data_type),
            "description": self._shared.text_by_path(data_type, "DESC/TUV"),
            "kind": kind,
            "conversion": CONVERSION_LABELS.get(kind, kind),
            "bitLength": self._bit_length_display(self._shared.first_child(data_type, "CVALUETYPE")),
            "bitmask": self._bitmask(data_type),
            "codedValue": self._value_type(self._shared.first_child(data_type, "CVALUETYPE")),
            "physicalValue": self._value_type(self._shared.first_child(data_type, "PVALUETYPE")),
            "invalidValues": self._invalid_values(data_type),
            "attributes": self._attributes(data_type),
        }
        if kind == "TEXTTBL":
            entry["textTable"] = self._text_table(data_type)
        elif kind == "LINCOMP":
            entry["linear"] = self._linear(data_type)
        elif kind == "VALTBL":
            entry["interpolated"] = data_type.attrib.get("interpolated") == "1"
        elif kind == "FORMULADT":
            entry["formula"] = self._formula(data_type)
        elif kind == "PROCDT":
            entry["procedure"] = self._procedure(data_type)
        elif kind == "MUXDT":
            entry["mux"] = self._mux(data_type)
        elif kind in MEMBER_KINDS:
            entry["members"] = self._shared.member_list(data_type)
            if kind == "STATICITERRDT":
                entry["numOfItems"] = self._int_or_none(data_type.attrib.get("numOfItems"))
            elif kind == "EOSITERDT":
                entry["minNumOfItems"] = self._int_or_none(data_type.attrib.get("minNumOfItems"))
        return entry

    def parse(self, ecu_doc):
        datatypes_el = self._shared.first_child(ecu_doc, "DATATYPES")
        if datatypes_el is None:
            return []
        entries = [self.parse_entry(data_type) for data_type in list(datatypes_el)]
        return sorted(entries, key=lambda item: item["name"].casefold())
