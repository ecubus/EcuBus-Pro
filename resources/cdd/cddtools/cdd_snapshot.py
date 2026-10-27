"""Stable, read-only diagnostic data for file and variant comparison."""

import base64
import hashlib

from .cdd_datatypes_parser import CddDataTypesParser
from .cdd_did_parser import CddDidParser
from .cdd_dtc_parser import CddDtcParser


def _lengths(minimum=None, maximum=None, variable=False):
    return {
        "bitLength": minimum if minimum is not None and minimum == maximum else None,
        "minBitLength": minimum,
        "maxBitLength": maximum,
        "variableLength": variable,
    }


class CddSnapshotParser:
    def __init__(self, shared):
        self._shared = shared
        self._types = CddDataTypesParser(shared)

    @staticmethod
    def _sum_lengths(members):
        def total(key):
            values = [member[key] for member in members]
            return None if any(value is None for value in values) else sum(values)

        return _lengths(
            total("minBitLength"), total("maxBitLength"),
            any(member["variableLength"] for member in members),
        )

    @staticmethod
    def _coded_lengths(coded):
        if not coded:
            return _lengths()
        bits = coded.get("bitLength")
        if coded.get("quantity") != "field":
            return _lengths(bits, bits)
        minimum = coded.get("minSize")
        maximum = coded.get("maxSize")
        return _lengths(
            bits * minimum if bits is not None and minimum is not None else None,
            bits * maximum if bits is not None and maximum is not None else None,
            minimum is None or maximum is None or minimum != maximum,
        )

    def _conversion_node(self, element):
        attributes = {}
        for key, value in element.attrib.items():
            if key in ("id", "oid", "temploid"):
                continue
            if key.lower().endswith("ref"):
                value = self._shared.qual(self._shared.by_id(value)) or None
            attributes[key] = value
        return {
            "kind": element.tag,
            "attributes": attributes,
            "text": (element.text or "").strip() or None,
            "children": [self._conversion_node(child) for child in element],
        }

    def _job_file(self, reference):
        job = self._shared.by_id(reference)
        if job is None:
            return {"unresolved": True}
        documents = []
        for document in self._shared.direct_children(job, "EXTDOC"):
            contents = self._shared.first_child(document, "FILECONTENTS")
            content_hash = None
            if contents is not None:
                encoded = "".join((contents.text or "").split())
                content_hash = hashlib.sha256(base64.b64decode(encoded, validate=True)).hexdigest()
            documents.append({
                "usage": document.attrib.get("usage"),
                "filename": self._shared.text_by_path(document, "FILENAME"),
                "contentHash": content_hash,
            })
        return {
            "syntax": job.attrib.get("syntax"),
            "documents": sorted(documents, key=lambda item: tuple(item[key] or "" for key in ("usage", "filename", "contentHash"))),
        }

    def _data_type(self, type_ref, ancestors):
        element = self._shared.by_id(type_ref)
        if element is None:
            return {"unresolved": True, **_lengths()}
        if type_ref in ancestors:
            return {"qual": self._shared.qual(element), "recursive": True, **_lengths()}
        ancestors = ancestors | {type_ref}
        entry = self._types.parse_entry(element)
        entry.pop("id", None)
        entry.pop("bitLength", None)
        entry.update(self._coded_lengths(entry.get("codedValue")))
        if "textTable" in entry:
            entry["textTable"].sort(key=lambda item: tuple(item[key] or "" for key in ("start", "end", "text", "addInfo")))
        if "members" in entry:
            entry["members"] = self._members(entry["members"], ancestors)
            if entry.get("codedValue") is None:
                lengths = self._sum_lengths(entry["members"])
                if entry["kind"] == "STRUCTDT":
                    entry.update(lengths)
                elif entry["kind"] == "STATICITERRDT":
                    count = entry.get("numOfItems")
                    entry.update(_lengths(
                        lengths["minBitLength"] * count
                        if lengths["minBitLength"] is not None and count is not None else None,
                        lengths["maxBitLength"] * count
                        if lengths["maxBitLength"] is not None and count is not None else None,
                        lengths["variableLength"],
                    ))
                else:
                    entry.update(_lengths(variable=True))
        if "mux" in entry:
            mux = entry["mux"]
            mux["selector"] = self._data_type(mux.pop("selectorDtref"), ancestors)
            mux.pop("selectorDtQual", None)
            mux["default"] = self._members(mux["default"], ancestors)
            for case in mux["cases"]:
                case["members"] = self._members(case["members"], ancestors)
        for procedure in entry.get("procedure", []):
            reference = procedure.pop("jobFileRef", None)
            procedure["jobFile"] = self._job_file(reference)
        if entry["kind"] in ("COMPTBL", "VALTBL"):
            entry["conversionData"] = [
                self._conversion_node(child) for child in element
                if child.tag not in ("NAME", "QUAL", "DESC", "CVALUETYPE", "PVALUETYPE")
            ]
        return entry

    def _members(self, members, ancestors=frozenset()):
        result = []
        offset = 0
        for member in members:
            item = {key: value for key, value in member.items() if key not in ("dtref", "dtQual", "members")}
            if member["type"] == "Gap":
                lengths = _lengths(member["bitLength"], member["bitLength"])
            else:
                if member.get("dtref"):
                    item["dataType"] = self._data_type(member["dtref"], ancestors)
                if member["type"] == "Struct":
                    item["members"] = self._members(member["members"], ancestors)
                if "dataType" in item:
                    lengths = {key: item["dataType"][key] for key in _lengths()}
                elif member["type"] == "Struct":
                    lengths = self._sum_lengths(item["members"])
                else:
                    lengths = _lengths()
            item.update(lengths)
            item["bitOffset"] = offset
            offset = offset + item["bitLength"] if offset is not None and item["bitLength"] is not None else None
            result.append(item)
        return result

    def parse(self, ecu_doc):
        ecu = self._shared.first_child(ecu_doc, "ECU")
        if ecu is None:
            raise ValueError("ECU not found")
        did_parser = CddDidParser(self._shared)
        dtc_parser = CddDtcParser(self._shared)
        dids = did_parser.parse(ecu_doc)
        dtcs = dtc_parser.parse(ecu_doc)
        normalized_dids = {}
        for did in dids:
            members = self._members(did["data"])
            normalized_dids[did["id"]] = {
                "identifier": did["identifier"],
                "identifierHex": did["identifierHex"],
                "name": did["name"],
                "qual": did["qual"],
                "data": members,
                **self._sum_lengths(members),
            }
        variants = []
        for variant in self._shared.direct_children(ecu, "VAR") or [ecu]:
            variants.append({
                "name": self._shared.name(variant),
                "qual": self._shared.qual(variant),
                "dids": [normalized_dids[did["id"]] for did in did_parser.for_variant(dids, variant)],
                "dtcs": sorted([
                    {key: value for key, value in dtc.items() if key != "id"}
                    for dtc in dtc_parser.for_variant(dtcs, variant)
                ], key=lambda item: (item["source"], item["raw"])),
            })
        return {"name": self._shared.name(ecu), "variants": sorted(variants, key=lambda item: item["qual"])}
