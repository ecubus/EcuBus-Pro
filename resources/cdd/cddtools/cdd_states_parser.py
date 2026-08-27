try:
    from .cdd_parser_shared import CddParserShared
except ImportError:
    from cdd_parser_shared import CddParserShared


# `STATEGROUP@spec` -> what the group controls. Groups without a spec are
# document-specific and reported with the raw value.
GROUP_KINDS = {
    "session": "Session",
    "security": "Security Access",
}


class CddStatesParser:
    """Parses the "States" node: state groups and their states.

    A state group models one axis of ECU state a service can depend on --
    the diagnostic session in one group, the security access level in
    another. The group names are per-document ("Session" in one file,
    "DiagnosticMode" in another), so `kind` (from `@spec`) is the stable
    way to tell which axis a group represents.
    """

    def __init__(self, shared=None):
        self._shared = shared or CddParserShared()

    def _state(self, state):
        return {
            "name": self._shared.name(state),
            "qual": self._shared.qual(state),
            "description": self._shared.text_by_path(state, "DESC/TUV"),
        }

    def parse_group(self, group):
        spec = group.attrib.get("spec")
        return {
            "name": self._shared.name(group),
            "qual": self._shared.qual(group),
            "spec": spec,
            "kind": GROUP_KINDS.get(spec, spec),
            "description": self._shared.text_by_path(group, "DESC/TUV"),
            "states": [
                self._state(state)
                for state in self._shared.direct_children(group, "STATE")
            ],
        }

    def parse(self, ecu_doc):
        groups = self._shared.first_child(ecu_doc, "STATEGROUPS")
        if groups is None:
            return []
        return [
            self.parse_group(group)
            for group in self._shared.direct_children(groups, "STATEGROUP")
        ]
