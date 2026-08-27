try:
    from .cdd_parser_shared import CddParserShared
except ImportError:
    from cdd_parser_shared import CddParserShared


class CddDiagnosticClassesParser:
    """Parses the diagnostic classes and which ones each variant enables.

    Those are two distinct things, stored in two different places:

    1. Every diagnostic class *template* the document defines. These are
       document-level `DCLTMPLS/DCLTMPL` elements, pre-defined by the
       template (typically by an OEM).
    2. Which of them a variant enables. There is no boolean to read: a
       class is enabled in a variant when that variant actually contains a
       `DIAGCLASS` (or, for singleton templates, a `DIAGINST`) whose
       `@tmplref` points at the template. Having the entity is what
       "enabled" means; deleting it is what "disabled" means.

    Singleton templates (`DCLTMPL@single='1'`, e.g. Fault Memory, Tester
    Present) appear in the variant as a bare `DIAGINST`. Non-singletons
    (`@single='0'`) appear as a `DIAGCLASS` holding one or more `DIAGINST`
    children. Both spellings have to be recognised.
    """

    ENABLING_TAGS = ("DIAGCLASS", "DIAGINST")

    def __init__(self, shared=None):
        self._shared = shared or CddParserShared()

    def _variants(self, ecu_doc):
        ecu = self._shared.first_child(ecu_doc, "ECU")
        if ecu is None:
            return []
        return self._shared.direct_children(ecu, "VAR")

    def _enabled_template_ids(self, variant):
        """Template ids enabled in this variant, with their instance counts.

        Only direct children of the VAR count: a DIAGINST nested inside a
        DIAGCLASS is an instance of that class, not a separate enabled
        class of its own.
        """
        enabled = {}
        for child in self._shared.direct_children(variant):
            if child.tag not in self.ENABLING_TAGS:
                continue
            template_id = child.attrib.get("tmplref")
            if not template_id:
                continue
            if child.tag == "DIAGINST":
                instances = 1
            else:
                instances = len(self._shared.direct_children(child, "DIAGINST"))
            entry = enabled.setdefault(template_id, {"instances": 0})
            entry["instances"] += instances
        return enabled

    def parse_entry(self, template, variant_quals, enabled_by_variant):
        template_id = template.attrib.get("id")
        variants = {}
        instance_counts = {}
        for variant_qual in variant_quals:
            enabled = enabled_by_variant[variant_qual].get(template_id)
            variants[variant_qual] = enabled is not None
            instance_counts[variant_qual] = enabled["instances"] if enabled else 0

        return {
            "id": template_id,
            "name": self._shared.name(template),
            "qual": self._shared.qual(template),
            "description": self._shared.text_by_path(template, "DESC/TUV"),
            # Internal use-case code from DCLTMPL@cls (ses, ftm, tpr, ...).
            # Passed through as-is: there is no reliable source mapping
            # these codes to display names, so they are not guessed at.
            "classKind": template.attrib.get("cls"),
            "singleton": template.attrib.get("single") == "1",
            "variants": variants,
            "instanceCounts": instance_counts,
            "enabled": any(variants.values()),
        }

    def parse(self, ecu_doc):
        templates_el = self._shared.first_child(ecu_doc, "DCLTMPLS")
        if templates_el is None:
            return []

        variants = self._variants(ecu_doc)
        variant_quals = [self._shared.qual(variant) for variant in variants]
        enabled_by_variant = {
            self._shared.qual(variant): self._enabled_template_ids(variant)
            for variant in variants
        }

        # Kept in document order so the output lines up with the file
        # entry for entry.
        return [
            self.parse_entry(template, variant_quals, enabled_by_variant)
            for template in self._shared.direct_children(templates_el, "DCLTMPL")
        ]
