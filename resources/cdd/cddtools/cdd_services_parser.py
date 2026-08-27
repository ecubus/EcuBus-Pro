try:
    from .cdd_parser_shared import CddParserShared
except ImportError:
    from cdd_parser_shared import CddParserShared


PRIMITIVE_KINDS = {
    "REQ": "Request",
    "POS": "PositiveResponse",
    "NEG": "NegativeResponse",
}

# Components that carry payload rather than a fixed byte. Each becomes a
# placeholder in the telegram byte sequence.
PROXY_TAGS = (
    "SIMPLEPROXYCOMP",
    "GROUPOFDTCPROXYCOMP",
    "STATUSDTCPROXYCOMP",
    "CONTENTCOMP",
    "EOSITERCOMP",
    "NUMITERCOMP",
    # No sample document contains an ENDMKITERCOMP. It is listed here because
    # the three iteration components are interchangeable at this level -- each
    # is a payload carrier -- but its layout is unverified.
    "ENDMKITERCOMP",
    "MUXCOMP",
)

COMPONENT_TAGS = ("CONSTCOMP", "STATICCOMP") + PROXY_TAGS

# Telegram-table member tags found inside a *COMPCONT on a DIAGINST.
# SPECDATAOBJ is deliberately absent: inside a container it is never a
# telegram row but the negative-response-code holder. Verified across all
# three sample documents -- every one of the 102 SPECDATAOBJs there has no
# @dtref and holds exactly NAME/QUAL/NEGRESCODEPROXIES.
TELEGRAM_MEMBER_TAGS = (
    "DATAOBJ",
    "GAPDATAOBJ",
    "STRUCT",
    "DIDDATAREF",
    "GODTCDATAOBJ",
    "RECORDDATAOBJ",
    "MUXDT",
)

# Members that carry their data type inline as a child element instead of
# pointing at the shared pool with @dtref (e.g. GODTCDATAOBJ wrapping a
# local TEXTTBL, or a local MUXDT).
INLINE_DATA_TYPE_TAGS = ("TEXTTBL", "IDENT", "LINCOMP", "STRUCTDT", "MUXDT", "EOSITERDT")

# Placeholder shown in the byte sequence for a payload component. The
# response-code one is stable across documents; the data ones are letter
# pairs generated at display time ("zz" in one document and "yy" in
# another for the same service) that are NOT stored anywhere in the .cdd,
# so they cannot be reproduced from the file.
PLACEHOLDER_BY_DEST = {
    "resCode": "rc",
    "data": "..",
    "dtc": "..",
    "any": "..",
}


class CddServicesParser:
    """Parses the "Diagnostic Instance" detail panel.

    For each diagnostic instance in each variant this yields the service(s)
    it runs, the Request / Positive Response / Negative Response telegram
    layouts taken from the underlying protocol service, and the telegram
    tables (Byte No. / Bit Pos. / Name / Data Type / Default / Constant /
    Description) filled in by that instance.

    Three reference chains have to be followed to assemble one instance:

    1. `DIAGINST/SERVICE@tmplref` -> `DCLSRVTMPL@tmplref` -> `PROTOCOLSERVICE`,
       which holds the REQ / POS / NEG component layout shared by every
       instance of the class.
    2. `STATICCOMP@id` -> class template `SHSTATIC/STATICCOMPREF@idref` ->
       instance `STATICVALUE@shstaticref` -> `@v`. This is what turns the
       generic "DiagnosticSessionType" slot into the concrete `01` of the
       "01 DefaultSession" instance.
    3. proxy component `@id` -> class template `SHPROXY/PROXYCOMPREF@idref`
       -> instance `SIMPLECOMPCONT@shproxyref`, whose data objects are the
       rows of the telegram table.
    """

    def __init__(self, shared=None):
        self._shared = shared or CddParserShared()

    # -- reference resolution -------------------------------------------------

    def _protocol_service(self, service):
        service_template = self._shared.by_id(service.attrib.get("tmplref"))
        if service_template is None:
            return None
        return self._shared.by_id(service_template.attrib.get("tmplref"))

    def _template_component_refs(self, class_template, holder_tag, ref_tag):
        """{component id: shared-slot id} from the class template."""
        refs = {}
        if class_template is None:
            return refs
        for holder in self._shared.direct_children(class_template, holder_tag):
            for comp_ref in self._shared.direct_children(holder, ref_tag):
                refs[comp_ref.attrib.get("idref")] = holder.attrib.get("id")
        return refs

    def _instance_static_values(self, instance):
        """{SHSTATIC id: raw value} chosen by this instance."""
        return {
            static.attrib.get("shstaticref"): static.attrib.get("v")
            for static in self._shared.direct_children(instance, "STATICVALUE")
        }

    def _instance_containers(self, instance):
        """{SHPROXY id: *COMPCONT element} provided by this instance."""
        containers = {}
        for child in self._shared.direct_children(instance):
            if child.tag.endswith("COMPCONT"):
                containers[child.attrib.get("shproxyref")] = child
        return containers

    # -- telegram tables ------------------------------------------------------

    @staticmethod
    def _optional_int(value):
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _data_type_bit_length(self, data_type):
        """How many bits the value occupies in the telegram.

        For `qty="field"` the `@bl` attribute is the width of *one element*,
        not of the whole value: a 16-byte hex dump stores bl=8 with
        minsz=maxsz=16. Using `@bl` directly would lay four such parameters
        out at bytes 0/1/2/3 instead of 0/16/32/48.

        Returns (bitLength, minBitLength, maxBitLength, variableLength).
        """
        coded = self._shared.first_child(data_type, "CVALUETYPE") if data_type is not None else None
        if coded is None:
            return None, None, None, None

        element_bits = self._optional_int(coded.attrib.get("bl"))
        if element_bits is None:
            return None, None, None, None
        if coded.attrib.get("qty") != "field":
            return element_bits, element_bits, element_bits, False

        min_size = self._optional_int(coded.attrib.get("minsz"))
        max_size = self._optional_int(coded.attrib.get("maxsz"))
        if min_size is not None and min_size == max_size:
            total = element_bits * min_size
            return total, total, total, False

        # Variable-length field: the minimum is what it contributes to the
        # offset of whatever follows it.
        minimum = element_bits * min_size if min_size is not None else element_bits
        maximum = element_bits * max_size if max_size is not None else None
        return minimum, minimum, maximum, True

    def _member_data_type(self, member):
        """The member's data type: referenced via @dtref, or inline.

        A MUXDT member *is* its own data type rather than wrapping one.
        """
        data_type = self._shared.by_id(member.attrib.get("dtref"))
        if data_type is not None:
            return data_type
        if member.tag in INLINE_DATA_TYPE_TAGS:
            return member
        for child in self._shared.direct_children(member):
            if child.tag in INLINE_DATA_TYPE_TAGS:
                return child
        return None

    def _telegram_parameter(self, member, bit_offset):
        """One row of the telegram table. Returns (row, consumed bits)."""
        data_type = self._member_data_type(member)
        if member.tag == "GAPDATAOBJ":
            bit_length = self._optional_int(member.attrib.get("bl"))
            min_bits, max_bits, variable = bit_length, bit_length, False
        else:
            bit_length, min_bits, max_bits, variable = self._data_type_bit_length(data_type)

        row = {
            "byteNo": bit_offset // 8,
            # Bit position is only meaningful when not byte-aligned.
            "bitPos": bit_offset % 8 if bit_offset % 8 else None,
            "bitOffset": bit_offset,
            "name": self._shared.name(member),
            "qual": self._shared.qual(member),
            "kind": member.tag,
            "dataType": self._shared.name(data_type) if data_type is not None else None,
            "dataTypeQual": self._shared.qual(data_type) if data_type is not None else None,
            "dtref": member.attrib.get("dtref"),
            "bitLength": bit_length,
            "minBitLength": min_bits,
            "maxBitLength": max_bits,
            "variableLength": variable,
            # DATAOBJ@v is the "Constant" column, @def the "Default" column.
            "constant": member.attrib.get("v"),
            "default": member.attrib.get("def"),
            "description": self._shared.text_by_path(member, "DESC/TUV"),
        }
        return row, bit_length or 0

    def _telegram(self, proxy_slot, container):
        parameters = []
        bit_offset = 0
        for member in self._shared.direct_children(container):
            if member.tag not in TELEGRAM_MEMBER_TAGS:
                continue
            row, consumed = self._telegram_parameter(member, bit_offset)
            parameters.append(row)
            bit_offset += consumed
        return {
            "name": self._shared.name(proxy_slot),
            "qual": self._shared.qual(proxy_slot),
            "kind": container.tag,
            "parameters": parameters,
        }

    # -- telegram byte sequence ----------------------------------------------

    @staticmethod
    def _hex_bytes(value, bit_length):
        """Space-separated hex bytes, big-endian, e.g. 0x9004/16 -> "90 04"."""
        byte_count = max(1, ((bit_length or 8) + 7) // 8)
        return " ".join(f"{(value >> shift) & 0xFF:02X}" for shift in range((byte_count - 1) * 8, -1, -8))

    def _element_bits(self, data_type):
        """The width of one element of a data type, the unit a field value
        lists its entries in."""
        coded = self._shared.first_child(data_type, "CVALUETYPE") if data_type is not None else None
        if coded is None:
            return 8
        return self._optional_int(coded.attrib.get("bl")) or 8

    def _const_bytes(self, component):
        value = self._shared.cdd_int(component.attrib.get("v"))
        if value is None:
            return None
        bit_length = self._optional_int(component.attrib.get("bl")) or 8
        return self._hex_bytes(value, bit_length)

    def _component(self, component, context):
        item = {
            "name": self._shared.name(component),
            "qual": self._shared.qual(component),
            "kind": component.tag,
            "spec": component.attrib.get("spec"),
        }

        if component.tag == "CONSTCOMP":
            item["role"] = "ServiceId" if component.attrib.get("spec") == "sid" else "Constant"
            item["bytes"] = self._const_bytes(component)
            return item

        if component.tag == "STATICCOMP":
            item["role"] = "Static"
            slot_id = context["staticRefs"].get(component.attrib.get("id"))
            raw = context["staticValues"].get(slot_id)
            data_type = self._shared.by_id(component.attrib.get("dtref"))
            element_bits = self._element_bits(data_type)
            item["value"] = self._shared.hex_value(raw, element_bits)
            item["dataType"] = self._shared.name(data_type) if data_type is not None else None
            # Width comes from the referenced data type, so a 2-byte
            # identifier such as 0x9004 renders as "90 04", not "9004".
            # A slot this instance chose no value for stays a placeholder.
            number = self._shared.cdd_int(raw, element_bits)
            if number is None:
                item["bytes"] = ".."
            else:
                bit_length, _min, _max, _variable = self._data_type_bit_length(data_type)
                item["bytes"] = self._hex_bytes(number, bit_length)
            return item

        item["role"] = "Payload"
        item["dest"] = component.attrib.get("dest")
        item["bytes"] = PLACEHOLDER_BY_DEST.get(component.attrib.get("dest"), "..")
        slot_id = context["proxyRefs"].get(component.attrib.get("id"))
        item["telegram"] = context["telegramNames"].get(slot_id)
        if component.attrib.get("dest") == "resCode":
            item["responseCodes"] = context["responseCodes"].get(slot_id, [])
        return item

    def _primitive(self, primitive, context):
        components = [
            self._component(child, context)
            for child in self._shared.direct_children(primitive)
            if child.tag in COMPONENT_TAGS
        ]
        byte_parts = [item["bytes"] for item in components if item.get("bytes")]
        return {
            "name": self._shared.name(primitive),
            "qual": self._shared.qual(primitive),
            "kind": PRIMITIVE_KINDS.get(primitive.tag, primitive.tag),
            "bytes": " ".join(byte_parts),
            "components": components,
        }

    # -- negative response codes ---------------------------------------------

    def _response_codes(self, instance):
        """{SHPROXY id: [NRC, ...]} declared by this instance."""
        codes = {}
        for child in self._shared.direct_children(instance):
            if not child.tag.endswith("COMPCONT"):
                continue
            entries = []
            for proxy in child.iter("NEGRESCODEPROXY"):
                code = self._shared.by_id(proxy.attrib.get("idref"))
                if code is None:
                    continue
                entries.append(
                    {
                        "name": self._shared.name(code),
                        "qual": self._shared.qual(code),
                        "code": self._shared.hex_value(code.attrib.get("v")),
                    }
                )
            if entries:
                codes[child.attrib.get("shproxyref")] = entries
        return codes

    # -- assembly -------------------------------------------------------------

    def _service(self, service, context):
        protocol_service = self._protocol_service(service)
        entry = {
            "name": self._shared.name(service),
            "qual": self._shared.qual(service),
            "shortcutName": self._shared.text_by_path(service, "SHORTCUTNAME/TUV"),
            "shortcutQual": self._shared.text_by_path(service, "SHORTCUTQUAL"),
            "semantic": self._shared.text_by_path(service, "SEMANTIC"),
            "protocolService": self._shared.name(protocol_service) if protocol_service is not None else None,
            "protocolServiceQual": self._shared.qual(protocol_service) if protocol_service is not None else None,
            "request": None,
            "positiveResponse": None,
            "negativeResponse": None,
        }
        if protocol_service is None:
            return entry

        for primitive in self._shared.direct_children(protocol_service):
            if primitive.tag == "REQ":
                entry["request"] = self._primitive(primitive, context)
            elif primitive.tag == "POS":
                entry["positiveResponse"] = self._primitive(primitive, context)
            elif primitive.tag == "NEG":
                entry["negativeResponse"] = self._primitive(primitive, context)
        return entry

    def parse_instance(self, instance, class_element, variant_qual):
        class_template = self._shared.by_id(instance.attrib.get("tmplref"))
        containers = self._instance_containers(instance)
        static_values = self._instance_static_values(instance)

        telegrams = []
        telegram_names = {}
        for slot_id, container in containers.items():
            proxy_slot = self._shared.by_id(slot_id)
            if proxy_slot is None:
                continue
            telegram = self._telegram(proxy_slot, container)
            # A container with no data rows is a bare negative-response
            # holder, not a telegram table, so it is not emitted as one.
            if telegram["parameters"]:
                telegrams.append(telegram)
                telegram_names[slot_id] = telegram["name"]

        context = {
            "proxyRefs": self._template_component_refs(class_template, "SHPROXY", "PROXYCOMPREF"),
            "staticRefs": self._template_component_refs(class_template, "SHSTATIC", "STATICCOMPREF"),
            "staticValues": static_values,
            "telegramNames": telegram_names,
            "responseCodes": self._response_codes(instance),
        }

        static_by_name = {}
        for slot_id, raw in static_values.items():
            slot = self._shared.by_id(slot_id)
            if slot is not None:
                static_by_name[self._shared.name(slot)] = self._shared.hex_value(raw)

        services = [
            self._service(service, context)
            for service in self._shared.direct_children(instance, "SERVICE")
        ]

        return {
            "id": instance.attrib.get("id"),
            "variant": variant_qual,
            "className": self._shared.name(class_element),
            "classQual": self._shared.qual(class_element),
            "name": self._shared.name(instance),
            "qual": self._shared.qual(instance),
            "description": self._shared.text_by_path(instance, "DESC/TUV"),
            # The "DiagnosticSessi..."-style identifier box in the panel: the
            # instance's single static value when it has exactly one.
            "identifier": next(iter(static_by_name.values()), None) if len(static_by_name) == 1 else None,
            "staticValues": static_by_name,
            "services": services,
            "telegrams": telegrams,
        }

    def parse(self, ecu_doc):
        ecu = self._shared.first_child(ecu_doc, "ECU")
        if ecu is None:
            return []

        entries = []
        for variant in self._shared.direct_children(ecu, "VAR"):
            variant_qual = self._shared.qual(variant)
            for child in self._shared.direct_children(variant):
                if child.tag == "DIAGCLASS":
                    for instance in self._shared.direct_children(child, "DIAGINST"):
                        entries.append(self.parse_instance(instance, child, variant_qual))
                elif child.tag == "DIAGINST":
                    # Singleton class: the instance stands in for the class,
                    # so its own template supplies the class name.
                    class_element = self._shared.by_id(child.attrib.get("tmplref"))
                    entries.append(self.parse_instance(child, class_element, variant_qual))
        return entries
