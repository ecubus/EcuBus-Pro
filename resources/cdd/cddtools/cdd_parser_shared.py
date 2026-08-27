MEMBER_TAGS = ("DATAOBJ", "GAPDATAOBJ", "SPECDATAOBJ", "STRUCT")


class CddParserShared:
    def __init__(self):
        self._id_index = {}

    def build_id_index(self, root):
        self._id_index = {}
        for element in root.iter():
            element_id = element.attrib.get("id")
            if element_id:
                self._id_index[element_id] = element

    def by_id(self, element_id):
        if not element_id:
            return None
        return self._id_index.get(element_id)

    def direct_children(self, element, tag=None):
        children = []
        for child in list(element):
            if tag is None or child.tag == tag:
                children.append(child)
        return children

    def first_child(self, element, tag):
        return next((child for child in self.direct_children(element, tag)), None)

    def find_first_by_path(self, element, path):
        current = element
        for part in [part for part in path.split("/") if part]:
            if current is None:
                return None
            current = self.first_child(current, part)
        return current

    def text_by_path(self, element, path):
        target = self.find_first_by_path(element, path)
        if target is None or target.text is None:
            return None
        value = target.text.strip()
        return value or None

    def name(self, element):
        if element is None:
            return ""
        return self.text_by_path(element, "NAME/TUV") or self.text_by_path(element, "QUAL") or ""

    def qual(self, element):
        if element is None:
            return ""
        return self.text_by_path(element, "QUAL") or self.name(element)

    def value_elements(self, value):
        """A CDD attribute value as its elements, or None if it is not numeric.

        CANdela serialises a list value as "(a,b,c)": `languages`,
        `mayBeExec` and `trans` on the document, and the value of anything
        typed by a field (array) data type -- a text table entry, a static
        or a constant component. A scalar comes back as a single element.
        """
        if value is None:
            return None
        text = str(value).strip()
        if text.startswith("(") and text.endswith(")"):
            text = text[1:-1]
        parts = [part.strip() for part in text.split(",")]
        if not parts or any(not part for part in parts):
            return None
        try:
            return [int(part) for part in parts]
        except ValueError:
            return None

    def cdd_int(self, value, element_bits=8):
        """A CDD attribute value as one integer, or None if it is not numeric.

        A field value carries one entry per element, each `CVALUETYPE@bl`
        bits wide -- that attribute is the length of one element, not of the
        whole value ("Bit Length / Field Size" in the CANdelaStudio help).
        The elements are folded into the integer they form on the wire,
        first element most significant.
        """
        elements = self.value_elements(value)
        if elements is None:
            return None
        folded = 0
        for element in elements:
            folded = (folded << element_bits) | element
        return folded

    def hex_value(self, value, element_bits=8):
        if value is None or value == "":
            return None
        elements = self.value_elements(value)
        if elements is None:
            return value
        digits = max(2, (element_bits * len(elements) + 3) // 4)
        return f"0x{self.cdd_int(value, element_bits):0{digits}X}"

    def text_map_values(self, table):
        values = []
        for text_map in self.direct_children(table, "TEXTMAP"):
            start = text_map.attrib.get("s")
            end = text_map.attrib.get("e")
            if start == end:
                value = self.hex_value(start)
            else:
                value = f"{self.hex_value(start)}..{self.hex_value(end)}"
            values.append(
                {
                    "name": self.text_by_path(text_map, "TEXT/TUV") or "",
                    "qual": "",
                    "type": "Value",
                    "value": value,
                }
            )
        return values

    def data_type_summary(self, data_type):
        if data_type is None:
            return None

        name = self.name(data_type).replace("(1)", "")
        summary = {
            "name": name,
            "qual": self.qual(data_type),
            "type": "Type",
            "children": [],
        }
        if data_type.tag == "TEXTTBL":
            summary["children"] = self.text_map_values(data_type)
            return summary

        for child in self.direct_children(data_type):
            if child.tag == "STRUCT":
                for data_obj in self.direct_children(child):
                    if data_obj.tag not in ("DATAOBJ", "GAPDATAOBJ", "SPECDATAOBJ"):
                        continue
                    summary["children"].append(
                        {
                            "name": self.name(data_obj),
                            "qual": self.qual(data_obj),
                            "type": "Value",
                            "default": data_obj.attrib.get("def"),
                        }
                    )
        return summary

    def member(self, element):
        """Parse a DATAOBJ/GAPDATAOBJ/SPECDATAOBJ/STRUCT member of a complex
        data type, DID Data, or Mux structure into a Member/Gap/Struct dict."""
        if element.tag == "GAPDATAOBJ":
            return {
                "name": self.name(element) or "(reserved)",
                "qual": self.qual(element),
                "type": "Gap",
                "bitLength": self.cdd_int(element.attrib.get("bl")),
            }
        if element.tag == "STRUCT":
            return {
                "name": self.name(element),
                "qual": self.qual(element),
                "type": "Struct",
                "dtref": element.attrib.get("dtref"),
                "members": self.member_list(element),
            }
        data_type_ref = element.attrib.get("dtref")
        return {
            "name": self.name(element),
            "qual": self.qual(element),
            "type": "Member",
            "dtref": data_type_ref,
            "dtQual": self.qual(self.by_id(data_type_ref)) if data_type_ref else None,
            "description": self.text_by_path(element, "DESC/TUV"),
            "default": element.attrib.get("def"),
            "staticValue": element.attrib.get("v"),
        }

    def member_list(self, container):
        if container is None:
            return []
        return [self.member(child) for child in self.direct_children(container) if child.tag in MEMBER_TAGS]
