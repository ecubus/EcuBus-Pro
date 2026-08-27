"""Public API.

Every entry point takes a `.cdd` path and returns the same envelope as the
original cddtools release::

    {"error": 0, "data": ...}
    {"error": 1, "message": "..."}

The `parse*` names from that release are kept so existing callers keep
working; `parse_datatypes`, `parse_diagnostic_classes`, `parse_services` and
`parse_attributes` are new.
"""

import xml.etree.ElementTree as ET

from .cdd_attributes_parser import CddAttributesParser
from .cdd_datatypes_parser import CddDataTypesParser
from .cdd_diagnostic_classes_parser import CddDiagnosticClassesParser
from .cdd_did_parser import CddDidParser
from .cdd_dtc_parser import CddDtcParser
from .cdd_parser_shared import CddParserShared
from .cdd_services_parser import CddServicesParser
from .cdd_states_parser import CddStatesParser
from .cdd_tester import CddTester


def load_ecu_doc(file_path):
    """Parse a .cdd and return `(shared, ecu_doc)` with the id index built.

    Every parser needs the index, and building it once per document keeps a
    multi-parser run from walking the tree repeatedly.
    """
    root = ET.parse(file_path).getroot()
    ecu_doc = root if root.tag == "ECUDOC" else root.find("ECUDOC")
    if ecu_doc is None:
        raise ValueError("ECUDOC not found")
    shared = CddParserShared()
    shared.build_id_index(ecu_doc)
    return shared, ecu_doc


def _run(file_path, build):
    try:
        shared, ecu_doc = load_ecu_doc(file_path)
        return {"error": 0, "data": build(shared, ecu_doc)}
    except Exception as exc:
        return {"error": 1, "message": str(exc)}


def parse_datatypes(file_path):
    """Data Types panel."""
    return _run(file_path, lambda shared, doc: CddDataTypesParser(shared).parse(doc))


def parse_dids(file_path):
    """DID Overview panel."""
    return _run(file_path, lambda shared, doc: CddDidParser(shared).parse(doc))


def parse_dtcs(file_path):
    """Fault Memory / Available DTCs panel."""
    return _run(file_path, lambda shared, doc: CddDtcParser(shared).parse(doc))


def parse_dtc_status_mask(file_path):
    """The DTC status byte and what each of its bits means."""
    return _run(file_path, lambda shared, doc: CddDtcParser(shared).parse_status_mask(doc))


def parse_states(file_path):
    """State groups (session, security access) and their states."""
    return _run(file_path, lambda shared, doc: CddStatesParser(shared).parse(doc))


def parse_diagnostic_classes(file_path):
    """Supported Diagnostic Classes panel."""
    return _run(file_path, lambda shared, doc: CddDiagnosticClassesParser(shared).parse(doc))


def parse_services(file_path):
    """Diagnostic Instance panels: services, telegrams, byte layouts."""
    return _run(file_path, lambda shared, doc: CddServicesParser(shared).parse(doc))


def parse_attributes(file_path):
    """Attribute definitions with their effective ECU / variant values."""
    return _run(file_path, lambda shared, doc: CddAttributesParser(shared).parse(doc))


def parse_interfaces(file_path):
    """Every interface the document defines, with its communication parameters.

    Each carries an `enabled` flag saying whether this ECU declares support
    for it; `parse_supported_interfaces` returns just those.
    """
    return _run(file_path, lambda shared, doc: CddAttributesParser(shared).parse_interfaces(doc))


def parse_supported_interfaces(file_path):
    """Only the interfaces the ECU supports, as the tree node of that name."""
    return _run(
        file_path, lambda shared, doc: CddAttributesParser(shared).parse_supported_interfaces(doc)
    )


def parse_tester_info(file_path, parse_resp=True):
    """Connection-oriented view: addressing, timing, DIDs, DTCs, services."""
    return _run(file_path, lambda shared, doc: CddTester(shared).build(doc))


def parse(file_path, parse_resp=False):
    return parse_tester_info(file_path, parse_resp=parse_resp)


def load_file(file_path, parse_resp=True):
    return parse_tester_info(file_path, parse_resp=parse_resp)
