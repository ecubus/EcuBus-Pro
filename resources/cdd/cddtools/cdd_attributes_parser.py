try:
    from .cdd_parser_shared import CddParserShared
except ImportError:
    from cdd_parser_shared import CddParserShared


# Attribute definition element -> (value element, kind label).
ATTRIBUTE_DEFINITIONS = {
    "UNSDEF": ("UNS", "unsigned"),
    "SGNDEF": ("SGN", "signed"),
    "FLTDEF": ("FLT", "float"),
    "ENUMDEF": ("ENUM", "enum"),
    "CSTRDEF": ("CSTR", "commonString"),
    "STRDEF": ("STR", "string"),
    "TXTDEF": ("TXT", "text"),
}

VALUE_TAGS = {value_tag for value_tag, _kind in ATTRIBUTE_DEFINITIONS.values()}

# `@df` on a definition -> the panel's "Display" column. Enums carry `@sort`
# there instead, which the panel renders as "Sort by ID" / "Sort by Text".
DISPLAY_FORMATS = {"hex": "Hexadecimal", "dec": "Decimal", "bin": "Binary"}
SORT_FORMATS = {"id": "Sort by ID", "text": "Sort by Text"}

# The ATTRCAT that lists which interfaces the ECU supports. Every other
# communication parameter is qualified "<interface qual>.<parameter qual>".
INTERFACES_CATEGORY_QUAL = "COM.INTERFACES"


class CddAttributesParser:
    """Parses the CDD attribute system.

    Communication parameters have no storage structure of their own in the
    file: they are ordinary attributes, the same mechanism that carries the
    attribute values hanging off data types, services, DIDs and so on. So
    one mechanism has to be parsed to reach several different things.

    The mechanism has two halves:

    1. Definitions in `DEFATTS` (`UNSDEF`, `ENUMDEF`, `CSTRDEF`, ...), each
       carrying a qualifier, an `attrcatref` pointing at an `ATTRCAT`
       category, and a default value.
    2. Values (`UNS`, `ENUM`, `CSTR`, ...) attached to an object via
       `attrref`, overriding that default for that object.

    This parser resolves the definitions and the values that sit on the ECU
    and its variants -- the layer that carries CAN identifiers and UDS
    timing. Attribute values on data types and DTC records are reported by
    their own parsers instead.
    """

    def __init__(self, shared=None):
        self._shared = shared or CddParserShared()

    # -- categories ----------------------------------------------------------

    def _categories(self, ecu_doc):
        """{ATTRCAT id: (name, qual)}."""
        categories = {}
        for category in ecu_doc.iter("ATTRCAT"):
            categories[category.attrib.get("id")] = (
                self._shared.name(category),
                self._shared.qual(category),
            )
        return categories

    # -- values --------------------------------------------------------------

    @staticmethod
    def _raw_value(element):
        """An attribute value element's payload.

        Numeric kinds carry it in `@v`; string kinds carry it as the text of
        a child element instead.
        """
        if "v" in element.attrib:
            return element.attrib.get("v")
        for child in element:
            if child.text and child.text.strip():
                return child.text.strip()
        return None

    def _values_on(self, element):
        """{definition id: raw value} for one object's own attribute values."""
        values = {}
        for child in self._shared.direct_children(element):
            if child.tag not in VALUE_TAGS:
                continue
            attr_ref = child.attrib.get("attrref")
            if attr_ref:
                values[attr_ref] = self._raw_value(child)
        return values

    # -- definitions ---------------------------------------------------------

    def _choices(self, definition):
        choices = {}
        for etag in self._shared.direct_children(definition, "ETAG"):
            value = etag.attrib.get("v")
            if value is not None:
                choices[value] = self._shared.text_by_path(etag, "TUV")
        return choices or None

    def _default_value(self, definition):
        if "v" in definition.attrib:
            return definition.attrib.get("v")
        # String kinds keep their default in a child element (COMMONSTRING,
        # STRING, ...) which is usually empty.
        for child in self._shared.direct_children(definition):
            if child.tag in ("COMMONSTRING", "STRING", "DEFAULT"):
                text = (child.text or "").strip()
                return text or None
        return None

    def _definitions(self, ecu_doc):
        categories = self._categories(ecu_doc)
        definitions = []
        for element in ecu_doc.iter():
            if element.tag not in ATTRIBUTE_DEFINITIONS:
                continue
            qual = self._shared.qual(element)
            if not qual:
                continue
            _value_tag, kind = ATTRIBUTE_DEFINITIONS[element.tag]
            category_name, category_qual = categories.get(
                element.attrib.get("attrcatref"), (None, None)
            )
            definitions.append(
                {
                    "id": element.attrib.get("id"),
                    "name": self._shared.name(element),
                    "qual": qual,
                    "description": self._shared.text_by_path(element, "DESC/TUV"),
                    "category": category_name,
                    "categoryQual": category_qual,
                    "kind": kind,
                    "display": (
                        DISPLAY_FORMATS.get(element.attrib.get("df"))
                        or SORT_FORMATS.get(element.attrib.get("sort"))
                    ),
                    "displayFormat": element.attrib.get("df"),
                    "default": self._default_value(element),
                    "choices": self._choices(element),
                }
            )
        return definitions

    @staticmethod
    def _value_text(value, kind, choices, display_format):
        """The value rendered for display.

        Enums resolve to their tag text; values marked for hex display are
        padded to an even digit count, e.g. 1792 -> 0x0700 and 204 -> 0xCC.
        """
        if value is None:
            return None
        if kind == "enum" and choices:
            return choices.get(str(value), str(value))
        if display_format in ("hex", "bin"):
            try:
                number = int(value)
            except (TypeError, ValueError):
                return str(value)
            if display_format == "bin":
                return f"0b{number:b}"
            digits = max(2, len(f"{number:X}"))
            if digits % 2:
                digits += 1
            return f"0x{number:0{digits}X}"
        return str(value)

    # -- interfaces ----------------------------------------------------------

    def parse_interfaces(self, ecu_doc):
        """The ECU's supported interfaces, from the COM.INTERFACES category.

        Interface qualifiers are per-document -- "CAN", "CAN_FD",
        "CAN_Extended_Addressing", "DoIP_ISO13400" -- and a communication
        parameter belongs to the interface whose qualifier prefixes it. Note
        that several do not start with "CAN.", so the prefix has to be read
        from the document rather than assumed.
        """
        entries = self.parse(ecu_doc)
        interfaces = []
        for entry in entries:
            if entry["categoryQual"] != INTERFACES_CATEGORY_QUAL:
                continue
            interfaces.append(
                {
                    "name": entry["name"],
                    "qual": entry["qual"],
                    # The enum/unsigned value doubles as the enabled flag.
                    "enabled": str(entry["value"]) == "1",
                    "parameters": [
                        other
                        for other in entries
                        if other["interface"] == entry["qual"]
                    ],
                }
            )
        return interfaces

    def parse_supported_interfaces(self, ecu_doc):
        """Only the interfaces the ECU actually supports.

        The COM.INTERFACES category lists every interface the *template*
        offers; the ECU picks which ones it supports by setting the enum to
        1. A document may offer CAN, CAN FD, FlexRay and DoIP while the ECU
        supports only CAN, so read this rather than the full list when
        deciding what the ECU can actually do.
        """
        return [i for i in self.parse_interfaces(ecu_doc) if i["enabled"]]

    def active_interface(self, ecu_doc):
        """The single supported interface, or None when none is marked."""
        return next(iter(self.parse_supported_interfaces(ecu_doc)), None)

    # -- entry point ---------------------------------------------------------

    def parse(self, ecu_doc):
        definitions = self._definitions(ecu_doc)
        interface_quals = {
            definition["qual"]
            for definition in definitions
            if definition["categoryQual"] == INTERFACES_CATEGORY_QUAL
        }

        ecu = self._shared.first_child(ecu_doc, "ECU")
        ecu_values = self._values_on(ecu) if ecu is not None else {}
        variants = self._shared.direct_children(ecu, "VAR") if ecu is not None else []
        variant_values = {
            self._shared.qual(variant): self._values_on(variant) for variant in variants
        }

        entries = []
        for definition in definitions:
            definition_id = definition["id"]

            # Effective value at ECU level: the definition's default unless
            # the ECU overrides it.
            if definition_id in ecu_values:
                value, source = ecu_values[definition_id], "ecu"
            else:
                value, source = definition["default"], "default"

            # ...and again per variant, which may override the ECU value.
            variants_resolved = {}
            for variant_qual, values in variant_values.items():
                if definition_id in values:
                    variants_resolved[variant_qual] = {
                        "value": values[definition_id],
                        "source": "variant",
                    }
                else:
                    variants_resolved[variant_qual] = {"value": value, "source": source}

            interface = None
            parameter = definition["qual"]
            if "." in definition["qual"]:
                prefix, suffix = definition["qual"].split(".", 1)
                if prefix in interface_quals:
                    interface, parameter = prefix, suffix

            entry = dict(definition)
            entry.update(
                {
                    "interface": interface,
                    "parameter": parameter,
                    "value": value,
                    "valueText": self._value_text(
                        value, definition["kind"], definition["choices"],
                        definition["displayFormat"],
                    ),
                    # The panel keeps "Default Value" and "Overwritten Value"
                    # in separate columns, so both need a rendered form.
                    "defaultText": self._value_text(
                        definition["default"], definition["kind"], definition["choices"],
                        definition["displayFormat"],
                    ),
                    "source": source,
                    "variants": variants_resolved,
                }
            )
            entries.append(entry)
        return entries
