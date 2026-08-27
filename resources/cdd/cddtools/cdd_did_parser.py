try:
    from .cdd_parser_shared import CddParserShared
except ImportError:
    from cdd_parser_shared import CddParserShared


class CddDidParser:
    def __init__(self, shared=None):
        self._shared = shared or CddParserShared()

    def _variant_refs(self, ecu_doc):
        """{variant qual: set(DID id)} from each VAR's DIDREFS/DIDREF@didRef."""
        ecu = self._shared.first_child(ecu_doc, "ECU")
        refs = {}
        for var in self._shared.direct_children(ecu, "VAR"):
            didrefs = self._shared.first_child(var, "DIDREFS")
            refs[self._shared.qual(var)] = {
                ref.attrib.get("didRef")
                for ref in self._shared.direct_children(didrefs, "DIDREF")
            } if didrefs is not None else set()
        return refs

    def _used_ids(self, ecu_doc):
        """DID ids referenced by a DIDDATAREF/DIDREF anywhere outside the
        per-variant DIDREFS list, i.e. actually used by a diagnostic
        instance/service (telegram, fixed data, snapshot record...)."""
        used = set()
        for element in ecu_doc.iter():
            if element.tag == "DIDREFS":
                continue
            for child in self._shared.direct_children(element):
                if child.tag in ("DIDDATAREF", "DIDREF"):
                    did_ref = child.attrib.get("didRef")
                    if did_ref:
                        used.add(did_ref)
        return used

    def _data_summary(self, members):
        parts = []
        for member in members:
            if member["type"] == "Gap":
                continue
            if member["type"] == "Struct":
                bitfields = ", ".join(m["name"] for m in member["members"] if m["type"] != "Gap")
                parts.append(f"{member['name']}({bitfields})" if bitfields else member["name"])
            else:
                parts.append(member["name"])
        return ", ".join(parts)

    def parse_entry(self, did, variant_refs, used_ids):
        identifier = self._shared.first_child(did, "STRUCTURE")
        members = self._shared.member_list(identifier)
        number = self._shared.cdd_int(did.attrib.get("n")) or 0
        return {
            "id": did.attrib.get("id"),
            "identifier": number,
            "identifierHex": f"0x{number:04X}",
            "name": self._shared.name(did),
            "qual": self._shared.qual(did),
            "variants": {
                variant_qual: did.attrib.get("id") in ids
                for variant_qual, ids in variant_refs.items()
            },
            "used": did.attrib.get("id") in used_ids,
            "data": members,
            "dataSummary": self._data_summary(members),
        }

    def parse(self, ecu_doc):
        dids_el = self._shared.first_child(ecu_doc, "DIDS")
        if dids_el is None:
            return []
        variant_refs = self._variant_refs(ecu_doc)
        used_ids = self._used_ids(ecu_doc)
        entries = [
            self.parse_entry(did, variant_refs, used_ids)
            for did in self._shared.direct_children(dids_el, "DID")
        ]
        return sorted(entries, key=lambda item: item["identifier"])
