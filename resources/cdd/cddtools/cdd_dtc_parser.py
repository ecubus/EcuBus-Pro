try:
    from .cdd_parser_shared import CddParserShared
except ImportError:
    from cdd_parser_shared import CddParserShared


DTC_CATEGORY_LETTERS = "PCBU"

# RECORDTMPL child tag -> matching RECORD child tag that references it by idref.
RECORD_ITEM_TAGS = {
    "ENUMRECORDITEMTMPL": "ENUMRECORDITEM",
    "TRRECORDITEMTMPL": "TRRECORDITEM",
    "UNSRECORDITEMTMPL": "UNSRECORDITEM",
}

# `DTCSTATUSBITGROUP@conv` -> whether the ECU implements that status bit.
STATUS_BIT_SUPPORT = {
    "req": "required",
    "optyes": "optional, supported",
    "optno": "optional, not supported",
}


class CddDtcParser:
    def __init__(self, shared=None):
        self._shared = shared or CddParserShared()

    def _format_dtc(self, raw16):
        """SAE J2012 / ISO 15031-6 display format: top 2 bits select
        P/C/B/U, remaining 14 bits are the 4-digit hex code."""
        category = (raw16 >> 14) & 0b11
        code = raw16 & 0x3FFF
        return f"{DTC_CATEGORY_LETTERS[category]}{code:04X}"

    def _failure_type_texts(self, ecu_doc):
        datatypes_el = self._shared.first_child(ecu_doc, "DATATYPES")
        if datatypes_el is None:
            return {}
        table = next(
            (
                dt
                for dt in self._shared.direct_children(datatypes_el, "TEXTTBL")
                if self._shared.qual(dt) == "SAE_J2012_Failure_Type_Byte"
            ),
            None,
        )
        if table is None:
            return {}
        values = {}
        for text_map in self._shared.direct_children(table, "TEXTMAP"):
            start = text_map.attrib.get("s")
            if start is None:
                continue
            value = self._shared.cdd_int(start)
            if value is None:
                continue
            values[value] = self._shared.text_by_path(text_map, "TEXT/TUV") or ""
        return values

    def _record_template_fields(self, record_tmpl):
        """{RECORDITEMTMPL@id: {"name", "kind": "enum"|"text", "values"}}."""
        fields = {}
        if record_tmpl is None:
            return fields
        for child in self._shared.direct_children(record_tmpl):
            if child.tag not in RECORD_ITEM_TAGS:
                continue
            name = self._shared.name(child)
            if child.tag == "ENUMRECORDITEMTMPL":
                values = {
                    self._shared.cdd_int(etag.attrib.get("v")): self._shared.text_by_path(
                        etag, "TUV"
                    )
                    for etag in self._shared.direct_children(child, "ETAG")
                    if self._shared.cdd_int(etag.attrib.get("v")) is not None
                }
                fields[child.attrib.get("id")] = {"name": name, "kind": "enum", "values": values}
            else:
                fields[child.attrib.get("id")] = {"name": name, "kind": "text"}
        return fields

    def _record_properties(self, record, template_fields):
        properties = {}
        for child in self._shared.direct_children(record):
            field = template_fields.get(child.attrib.get("idref"))
            if field is None:
                continue
            if field["kind"] == "enum":
                value_index = self._shared.cdd_int(child.attrib.get("v"))
                properties[field["name"]] = (
                    field["values"].get(value_index) if value_index is not None else None
                )
            else:
                properties[field["name"]] = self._shared.text_by_path(child, "TEXT/TUV")
        return properties

    def _used_record_ids(self, ecu_doc):
        """RECORD ids referenced by a RECORDREF anywhere outside the master
        RECORDDTPOOL, i.e. actually used by a data type / diagnostic
        instance (same "definition list vs. reference elsewhere" pattern as
        DID's `used`, see cdd_did_parser.py)."""
        used = set()
        for element in ecu_doc.iter():
            if element.tag == "RECORDDTPOOL":
                continue
            for child in self._shared.direct_children(element):
                if child.tag == "RECORDREF":
                    ref = child.attrib.get("idref")
                    if ref:
                        used.add(ref)
        return used

    def parse_record(self, record, byte_length, template_fields, failure_types, used_ids):
        raw = self._shared.cdd_int(record.attrib.get("v")) or 0
        if byte_length == 24:
            raw16 = raw >> 8
            failure_type = raw & 0xFF
        else:
            raw16 = raw
            failure_type = None
        return {
            "id": record.attrib.get("id"),
            "dtc": self._format_dtc(raw16),
            "raw": raw,
            "failureType": f"0x{failure_type:02X}" if failure_type is not None else None,
            "failureTypeText": failure_types.get(failure_type) if failure_type is not None else None,
            "errorText": self._shared.text_by_path(record, "TEXT/TUV") or "",
            "used": record.attrib.get("id") in used_ids,
            "properties": self._record_properties(record, template_fields),
        }

    def _parse_pool(self, ecu_doc, rt_spec, byte_length, failure_types, used_ids):
        record_tmpl = next(
            (t for t in ecu_doc.iter("RECORDTMPL") if t.attrib.get("spec") == rt_spec),
            None,
        )
        template_fields = self._record_template_fields(record_tmpl)
        record_dt = next(
            (dt for dt in ecu_doc.iter("RECORDDT") if dt.attrib.get("rtSpec") == rt_spec),
            None,
        )
        if record_dt is None:
            return []
        return [
            self.parse_record(record, byte_length, template_fields, failure_types, used_ids)
            for record in self._shared.direct_children(record_dt, "RECORD")
        ]

    def parse_status_mask(self, ecu_doc):
        """The DTC status byte and the meaning of each of its bits.

        `DTCSTATUSMASK` points at the byte's data type and lists one
        `DTCSTATUSBITGROUP` per bit, in bit order 0..7, each pointing at the
        text table that names the bit. This is the ISO 14229-1 status byte,
        so bit 0 is "Test failed" and bit 7 "Warning indicator requested".
        """
        mask = self._shared.first_child(ecu_doc, "DTCSTATUSMASK")
        if mask is None:
            return None

        data_type = self._shared.by_id(mask.attrib.get("dtref"))
        coded = self._shared.first_child(data_type, "CVALUETYPE") if data_type is not None else None

        bits = []
        for index, group in enumerate(self._shared.direct_children(mask, "DTCSTATUSBITGROUP")):
            bit_type = self._shared.by_id(group.attrib.get("dtref"))
            support = group.attrib.get("conv")
            bits.append(
                {
                    "bit": index,
                    "mask": f"0x{1 << index:02X}",
                    "name": self._shared.name(bit_type),
                    "qual": self._shared.qual(bit_type),
                    "support": STATUS_BIT_SUPPORT.get(support, support),
                    "supported": support != "optno",
                    "dtref": group.attrib.get("dtref"),
                }
            )

        return {
            "name": self._shared.name(data_type),
            "qual": self._shared.qual(data_type),
            "bitLength": self._int_or_none(coded.attrib.get("bl")) if coded is not None else None,
            # The bits the ECU actually implements, as a single byte mask.
            "supportedMask": f"0x{sum(1 << b['bit'] for b in bits if b['supported']):02X}",
            "bits": bits,
        }

    @staticmethod
    def _int_or_none(value):
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def parse(self, ecu_doc):
        failure_types = self._failure_type_texts(ecu_doc)
        used_ids = self._used_record_ids(ecu_doc)
        entries = self._parse_pool(ecu_doc, "faultMemory", 24, failure_types, used_ids)
        entries += self._parse_pool(ecu_doc, "obdFaultMemory", 16, failure_types, used_ids)
        return sorted(entries, key=lambda entry: entry["dtc"])
